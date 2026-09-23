"use server";

import path from "path";
import { createHash, randomUUID } from "crypto";
import { readFile, stat, unlink, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canManageVesselCatalog,
  requireActiveRole,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { VAN_HANH_TAU } from "@/lib/roles";
import { layT } from "@/lib/i18n/server";
import { MAX_UPLOAD_BYTES, ensureUploadDir, fileExtension, getUploadDir } from "@/lib/uploads";
import { KHOA_TON_KHO_ADVISORY, khoaAdvisoryDongTon } from "@/lib/theKho";
import {
  NGUOI_TAI_PHIEU_GIAO,
  chuoiNgay,
  dangDocAi,
  kiemTraDongNhap,
  ngayTuChuoi,
  type DongNhap,
  type DongSach,
  type ThongTinPhieuNhap,
} from "@/lib/phieuGiao";
import type { ImportedItem } from "@/lib/materialImport";
import type { DongAi } from "@/lib/docPhieuBangAi";

/*
 * PHIẾU GIAO HÀNG → HÀNG CHỜ DUYỆT → DANH MỤC + TỒN KHO.
 *
 * Ba bước, ba quyền:
 *   1. taoPhieuGiaoTuPdf — sĩ quan tàu tải bản scan lên; máy đọc dòng hàng để
 *      ĐIỀN SẴN. Không ghi gì vào danh mục hay tồn.
 *   2. luuDongPhieuGiao — người tải hoặc người quản lý danh mục sửa các dòng
 *      (tên, mã, số lượng...) — vẫn chỉ là hàng chờ.
 *   3. duyetPhieuGiao — thuyền trưởng / quản trị bấm duyệt: lúc này mới đi qua
 *      đúng đường nhập danh mục (applyMaterialImport, cùng luật sinh mã, cùng
 *      cách ghép mặt hàng có sẵn) và ghi phiếu NHẬP kho với cùng khóa tồn kho
 *      như phiếu nhập tay. Kết quả nhận dạng chữ không bao giờ đúng 100%, nên
 *      không có đường nào để dòng máy đọc lọt thẳng vào tồn kho.
 */

export type KetQuaPhieuGiao = { message: string; success?: boolean };

const GIAO_DICH_GIU_KHOA = { timeout: 20000, maxWait: 10000 };
const TIEN_TO_TEP = "phieu-giao-";

/** Ghép dòng với mặt hàng đã có trong danh mục tàu: Part No → IMPA → tên. */
async function khopMatHang(
  vesselId: number,
  dong: { partNo: string | null; impa: string | null; ten: string }[]
): Promise<(number | null)[]> {
  const chuan = (s: string | null | undefined) =>
    (s ?? "").normalize("NFC").toLowerCase().replace(/[\s\-_.\/]+/g, "");
  const links = await prisma.vesselMaterial.findMany({
    where: { vesselId },
    select: { material: { select: { id: true, partNumber: true, impa: true, nameVn: true, nameEn: true } } },
  });
  const theoPn = new Map<string, number>();
  const theoImpa = new Map<string, number>();
  const theoTen = new Map<string, number>();
  for (const { material: m } of links) {
    const pn = chuan(m.partNumber);
    const im = chuan(m.impa);
    if (pn && !theoPn.has(pn)) theoPn.set(pn, m.id);
    if (im && !theoImpa.has(im)) theoImpa.set(im, m.id);
    for (const ten of [m.nameVn, m.nameEn]) {
      const k = chuan(ten);
      if (k && !theoTen.has(k)) theoTen.set(k, m.id);
    }
  }
  return dong.map((d) => {
    const pn = chuan(d.partNo);
    const im = chuan(d.impa);
    return (pn && theoPn.get(pn)) || (im && theoImpa.get(im)) || theoTen.get(chuan(d.ten)) || null;
  });
}

type KetQuaDocKhongAi = {
  chuDoc: string | null;
  nguonChu: "TEXT" | "OCR" | "TAY";
  dong: DongAi[];
  nhaCungCap: string | null;
  soPhieu: string | null;
  ngayGiao: string | null;
};

const dongThuong = (d: Omit<DongAi, "tenEn" | "trang" | "canhBao">): DongAi => ({ ...d, tenEn: null, trang: null, canhBao: null });

/**
 * Chữ tách sẵn cho nhà cung cấp CHỈ ĐỌC CHỮ (DeepSeek): lớp chữ PDF (mọi máy),
 * không có thì OCR (chỉ Windows). Nhà cung cấp đọc được ảnh không cần.
 */
async function chuChoAi(nhaCungCap: string, buffer: Buffer, fullPath: string | null): Promise<string | null> {
  const { CHI_DOC_CHU } = await import("@/lib/docPhieuBangAi");
  if (!(CHI_DOC_CHU as readonly string[]).includes(nhaCungCap)) return null;
  const { docChuTuPdf } = await import("@/lib/pdfChu");
  const lop = await docChuTuPdf(buffer, 100);
  if (lop.ok) return lop.text;
  if (fullPath && process.platform === "win32") {
    const { docPdfBangOcr } = await import("@/lib/pdfOcr");
    const ocr = await docPdfBangOcr(fullPath, 30);
    if (ocr.ok && ocr.text.trim().length >= 10) return ocr.text;
  }
  return null;
}

/**
 * Lấy dòng hàng KHÔNG dùng AI: lớp chữ PDF (pdfjs, PDF số) → OCR Windows (bản
 * scan, máy văn phòng) → không đọc được (người duyệt gõ tay). Nhanh, chạy ngay
 * trong lúc tải lên; cũng là đường lùi khi bộ đọc AI hỏng.
 */
async function docDongKhongAi(buffer: Buffer, fullPath: string): Promise<KetQuaDocKhongAi> {
  let chuDoc: string | null = null;
  let nguonChu: KetQuaDocKhongAi["nguonChu"] = "TAY";
  const { docChuTuPdf } = await import("@/lib/pdfChu");
  const lopChu = await docChuTuPdf(buffer);
  if (lopChu.ok) {
    chuDoc = lopChu.text;
    nguonChu = "TEXT";
  } else if (process.platform === "win32") {
    const { docPdfBangOcr } = await import("@/lib/pdfOcr");
    const ocr = await docPdfBangOcr(fullPath, 4);
    if (ocr.ok && ocr.text.trim().length >= 10) {
      chuDoc = ocr.text;
      nguonChu = "OCR";
    }
  }
  const { docPhieuGiaoTuChu } = await import("@/lib/phieuGiaoParse");
  const doc = chuDoc ? docPhieuGiaoTuChu(chuDoc) : null;
  return {
    chuDoc,
    nguonChu,
    dong: (doc?.dong ?? []).map(dongThuong),
    nhaCungCap: doc?.nhaCungCap ?? null,
    soPhieu: doc?.soPhieu ?? null,
    ngayGiao: doc?.ngayGiao ?? null,
  };
}

/** Dữ liệu tạo dòng phiếu từ kết quả đọc (AI hoặc không). */
function duLieuDong(dong: DongAi[], khop: (number | null)[]) {
  return dong.map((d, i) => ({
    thuTu: i + 1,
    chuGoc: d.chuGoc.slice(0, 500),
    ten: d.ten.slice(0, 200),
    partNo: d.partNo,
    impa: d.impa,
    soLuong: d.soLuong,
    donVi: d.donVi.slice(0, 20),
    loai: d.loai,
    thietBi: d.thietBi?.slice(0, 120) ?? null,
    tenEn: d.tenEn?.slice(0, 200) ?? null,
    trang: d.trang ?? null,
    canhBao: d.canhBao?.slice(0, 300) ?? null,
    materialId: khop[i] ?? null,
  }));
}

type NguoiThaoTac = { id: number; email: string; role: string };

/**
 * Đọc phiếu bằng AI ở CHẾ ĐỘ NỀN — chạy trong after() sau khi trang đã trả về.
 *
 * Vì sao nền: phiếu 300+ dòng, AI đọc hai lượt theo nhiều cụm trang mất vài
 * phút. Để người dùng ngồi chờ một request dài như vậy thì trình duyệt / proxy
 * dễ cắt ngang và không ai biết tiến độ. Nay phiếu được lưu ngay, trang duyệt
 * mở ra liền, hiện "AI đang đọc x/y lượt" và tự làm mới tới khi xong.
 *
 * Mọi đường ra đều gỡ dấu aiDangDocTu — lỗi thì ghi loiAi nguyên văn.
 */
async function chayDocAiNen(phieuId: number, actor: NguoiThaoTac, laDocLai: boolean): Promise<void> {
  const phieu = await prisma.phieuGiaoNhan
    .findUnique({
      where: { id: phieuId },
      select: {
        id: true,
        vesselId: true,
        storedName: true,
        fileName: true,
        soPhieu: true,
        nhaCungCap: true,
        ngayGiao: true,
        vessel: { select: { code: true } },
      },
    })
    .catch(() => null);
  if (!phieu) return;
  const tenPhieu = phieu.soPhieu ?? phieu.fileName;
  const ketThuc = (data: Prisma.PhieuGiaoNhanUpdateInput) =>
    prisma.phieuGiaoNhan.update({ where: { id: phieu.id }, data: { ...data, aiDangDocTu: null, aiTienDo: null } }).catch(() => undefined);
  try {
    const { layCauHinhAi } = await import("@/lib/cauHinhAi");
    const cauHinh = await layCauHinhAi();
    if (!cauHinh) {
      await ketThuc({ loiAi: "Chưa cấu hình bộ đọc AI." });
      return;
    }
    const fullPath = path.join(getUploadDir(), path.basename(phieu.storedName));
    const buffer = await readFile(fullPath);
    const { docPhieuGiaoBangAi } = await import("@/lib/docPhieuBangAi");
    const { demTrangPdf } = await import("@/lib/pdfChu");
    const bd = Date.now();
    const ai = await docPhieuGiaoBangAi(buffer, cauHinh, {
      fileName: phieu.fileName,
      soTrang: await demTrangPdf(buffer),
      chuPdf: await chuChoAi(cauHinh.nhaCungCap, buffer, fullPath),
      onTienDo: (xong, tong) => {
        void prisma.phieuGiaoNhan.update({ where: { id: phieu.id }, data: { aiTienDo: `${xong}/${tong}` } }).catch(() => undefined);
      },
    });
    const giay = Math.round((Date.now() - bd) / 1000);
    if (!ai.ok) {
      // Ra log máy chủ (Dokploy → Logs) để tra được khi người dùng chỉ thấy câu tóm tắt.
      console.error(`[phieu-giao] Bộ đọc AI (${cauHinh.nhaCungCap} · ${cauHinh.model}) lỗi phiếu #${phieu.id} sau ${giay}s: ${ai.loi}`);
      if (laDocLai) {
        // Đọc lại hỏng: GIỮ nguyên các dòng đang có, chỉ báo lỗi.
        await ketThuc({ loiAi: ai.loi.slice(0, 500) });
      } else {
        // Tải lên lần đầu: vẫn lấy dòng bằng lớp chữ / OCR nếu được, để người
        // duyệt không phải gõ lại từ đầu.
        const du = await docDongKhongAi(buffer, fullPath);
        const khop = du.dong.length ? await khopMatHang(phieu.vesselId, du.dong) : [];
        await prisma.$transaction(async (tx) => {
          await tx.phieuGiaoNhanDong.deleteMany({ where: { phieuId: phieu.id } });
          if (du.dong.length) {
            await tx.phieuGiaoNhanDong.createMany({ data: duLieuDong(du.dong, khop).map((d) => ({ ...d, phieuId: phieu.id })) });
          }
          await tx.phieuGiaoNhan.update({
            where: { id: phieu.id },
            data: {
              loiAi: ai.loi.slice(0, 500),
              nguonChu: du.nguonChu,
              chuDoc: du.chuDoc ? du.chuDoc.slice(0, 60000) : null,
              nhaCungCap: phieu.nhaCungCap ?? du.nhaCungCap?.slice(0, 200) ?? null,
              soPhieu: phieu.soPhieu ?? du.soPhieu?.slice(0, 80) ?? null,
              ngayGiao: phieu.ngayGiao ?? ngayTuChuoi(du.ngayGiao),
              aiDangDocTu: null,
              aiTienDo: null,
            },
          });
        });
      }
      await ghiNhatKyNguoiDung(actor, {
        action: "phieu-giao-ai-loi",
        path: `/materials/phieu-giao/${phieu.id}`,
        vesselId: phieu.vesselId,
        detail: `AI (${cauHinh.nhaCungCap} · ${cauHinh.model}) ${laDocLai ? "đọc lại" : "đọc"} phiếu ${tenPhieu} lỗi sau ${giay}s: ${ai.loi.slice(0, 200)}`,
      });
      return;
    }
    const khop = ai.dong.length ? await khopMatHang(phieu.vesselId, ai.dong) : [];
    await prisma.$transaction(async (tx) => {
      await tx.phieuGiaoNhanDong.deleteMany({ where: { phieuId: phieu.id } });
      if (ai.dong.length) {
        await tx.phieuGiaoNhanDong.createMany({ data: duLieuDong(ai.dong, khop).map((d) => ({ ...d, phieuId: phieu.id })) });
      }
      await tx.phieuGiaoNhan.update({
        where: { id: phieu.id },
        data: {
          nguonChu: "AI",
          chuDoc: ai.chuTomTat.slice(0, 60000),
          // Một số cụm trang hỏng: nêu rõ trang nào để người duyệt đọc lại / gõ tay.
          loiAi: ai.canhBaoChung ? ai.canhBaoChung.slice(0, 500) : null,
          // Đầu phiếu: giữ cái người dùng đã gõ, chỉ điền chỗ trống bằng kết quả AI.
          nhaCungCap: phieu.nhaCungCap ?? ai.nhaCungCap?.slice(0, 200) ?? null,
          soPhieu: phieu.soPhieu ?? ai.soPhieu?.slice(0, 80) ?? null,
          ngayGiao: phieu.ngayGiao ?? ngayTuChuoi(ai.ngayGiao),
          aiDangDocTu: null,
          aiTienDo: null,
        },
      });
    });
    await ghiNhatKyNguoiDung(actor, {
      action: laDocLai ? "phieu-giao-doc-lai-ai" : "phieu-giao-doc-ai",
      path: `/materials/phieu-giao/${phieu.id}`,
      vesselId: phieu.vesselId,
      detail: `AI (${ai.model}, ${ai.soLuotGoi} lượt, ${giay}s) đọc phiếu ${tenPhieu} (${phieu.vessel.code}): ${ai.dong.length} dòng (${ai.soDongCanKiem} cần kiểm), token ${ai.tokenVao}/${ai.tokenRa}${
        ai.loiPhu.length ? ` — ${ai.loiPhu.join(" | ").slice(0, 200)}` : ""
      }`,
    });
  } catch (e) {
    console.error(`[phieu-giao] Đọc nền phiếu #${phieu.id} lỗi:`, e);
    await ketThuc({ loiAi: `Lỗi khi đọc phiếu: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500) });
  }
}

// ─── 1. Tải phiếu lên + đọc dòng hàng ────────────────────────────────────────

export async function taoPhieuGiaoTuPdf(
  _prev: KetQuaPhieuGiao,
  formData: FormData
): Promise<KetQuaPhieuGiao> {
  const { t } = await layT();
  const actor = await requireActiveRole([...NGUOI_TAI_PHIEU_GIAO]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const vesselId = Number(formData.get("vesselId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) return { message: t("actions.vuiLongChonTau") };
  if (!trongPhamVi(vesselScopeDayDu(actor), vesselId)) {
    return { message: t("actions.danhMuc_chiTauMinhPhuTrach") };
  }
  const vessel = await prisma.vessel.findUnique({ where: { id: vesselId }, select: { id: true, code: true } });
  if (!vessel) return { message: t("actions.tau_khongTonTai") };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: t("actions.nhap_vuiLongChonFile") };
  if (fileExtension(file.name) !== ".pdf") return { message: t("actionsModule.nhienLieu_filePhaiLaPdf") };
  if (file.size > MAX_UPLOAD_BYTES) return { message: t("actionsModule.nhienLieu_fileVuot20Mb") };

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const dir = await ensureUploadDir();
  const storedName = `${TIEN_TO_TEP}${randomUUID()}.pdf`;
  const fullPath = path.join(dir, storedName);
  await writeFile(fullPath, buffer);

  // Có bộ đọc AI: lưu phiếu NGAY và để AI đọc ở chế độ nền (chayDocAiNen).
  // Không có: đọc lớp chữ / OCR tại chỗ như trước (nhanh). Không đọc được thì
  // vẫn lưu phiếu, người duyệt gõ tay: bản scan đã ở trong hệ thống là được việc chính.
  const { layCauHinhAi } = await import("@/lib/cauHinhAi");
  const coAi = (await layCauHinhAi()) !== null;
  const du = coAi ? null : await docDongKhongAi(buffer, fullPath);
  const dong = du?.dong ?? [];
  const khop = dong.length ? await khopMatHang(vesselId, dong) : [];

  const nhaCungCap = String(formData.get("nhaCungCap") || "").trim() || du?.nhaCungCap || null;
  const soPhieu = String(formData.get("soPhieu") || "").trim() || du?.soPhieu || null;
  const ngayGiao = ngayTuChuoi(String(formData.get("ngayGiao") || "")) ?? ngayTuChuoi(du?.ngayGiao);
  const ghiChu = String(formData.get("ghiChu") || "").trim() || null;

  const phieu = await prisma.phieuGiaoNhan.create({
    data: {
      vesselId,
      fileName: file.name.slice(0, 200),
      storedName,
      mimeType: "application/pdf",
      size: file.size,
      sha256,
      nguonChu: du?.nguonChu ?? "TAY",
      chuDoc: du?.chuDoc ? du.chuDoc.slice(0, 60000) : null,
      nhaCungCap: nhaCungCap?.slice(0, 200) ?? null,
      soPhieu: soPhieu?.slice(0, 80) ?? null,
      ngayGiao,
      ghiChu,
      uploadedById: actor.id,
      aiDangDocTu: coAi ? new Date() : null,
      aiTienDo: coAi ? "0" : null,
      dong: { create: duLieuDong(dong, khop) },
    },
    select: { id: true },
  });

  await ghiNhatKyNguoiDung(actor, {
    action: "phieu-giao-tai-len",
    path: `/materials/phieu-giao/${phieu.id}`,
    vesselId,
    detail: `Tải phiếu giao ${soPhieu ?? file.name} (${vessel.code}) — ${
      coAi ? "AI đọc ở chế độ nền" : `${dong.length} dòng, nguồn ${du?.nguonChu ?? "TAY"}`
    }`,
  });
  if (coAi) {
    const nguoi = { id: actor.id, email: actor.email, role: actor.role };
    after(() => chayDocAiNen(phieu.id, nguoi, false));
  }
  revalidatePath("/materials/phieu-giao");
  redirect(coAi ? `/materials/phieu-giao/${phieu.id}` : `/materials/phieu-giao/${phieu.id}?doc=${dong.length}&nguon=${du?.nguonChu ?? "TAY"}`);
}

// ─── 2. Sửa dòng (hàng chờ) ──────────────────────────────────────────────────

type PhieuChoDuyet = NonNullable<Awaited<ReturnType<typeof timPhieuChoDuyet>>>;

async function timPhieuChoDuyet(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.phieuGiaoNhan.findUnique({
    where: { id },
    select: {
      id: true,
      vesselId: true,
      status: true,
      uploadedById: true,
      fileName: true,
      storedName: true,
      soPhieu: true,
      nhaCungCap: true,
      ngayGiao: true,
      ghiChu: true,
      aiDangDocTu: true,
      vessel: { select: { code: true } },
    },
  });
}

// ─── 2b. Đọc lại bằng AI (phiếu đã tải, còn chờ duyệt) ───────────────────────

/**
 * Cho phiếu máy chưa đọc được (bản scan tải trước khi bật AI) hoặc đọc kém:
 * gửi lại bản scan cho AI ở CHẾ ĐỘ NỀN, THAY toàn bộ dòng khi đọc xong. Trả về
 * ngay; trang duyệt hiện tiến độ và tự làm mới.
 */
export async function docLaiPhieuGiaoBangAi(phieuId: number): Promise<KetQuaPhieuGiao> {
  const { t, tTuDo } = await layT();
  const actor = await requireActiveRole([...NGUOI_TAI_PHIEU_GIAO]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const phieu = await timPhieuChoDuyet(Number(phieuId));
  if (!phieu || !trongPhamVi(vesselScopeDayDu(actor), phieu.vesselId)) {
    return { message: t("chung.khongCoQuyen") };
  }
  if (phieu.status !== "CHO_DUYET") {
    return { message: t("phieuGiao.phieuDaXuLy", { trangThai: tTuDo(`phieuGiao.trangThai_${phieu.status}`) }) };
  }
  if (phieu.uploadedById !== actor.id && !canManageVesselCatalog(actor, phieu.vesselId)) {
    return { message: t("chung.khongCoQuyen") };
  }
  if (dangDocAi(phieu.aiDangDocTu)) return { message: t("phieuGiao.aiDangDocRoi") };
  const { layCauHinhAi } = await import("@/lib/cauHinhAi");
  if (!(await layCauHinhAi())) return { message: t("phieuGiao.aiChuaCauHinh") };
  try {
    await stat(path.join(getUploadDir(), path.basename(phieu.storedName)));
  } catch {
    return { message: t("phieuGiao.tepKhongCon") };
  }
  await prisma.phieuGiaoNhan.update({
    where: { id: phieu.id },
    data: { aiDangDocTu: new Date(), aiTienDo: "0", loiAi: null },
  });
  const nguoi = { id: actor.id, email: actor.email, role: actor.role };
  after(() => chayDocAiNen(phieu.id, nguoi, true));
  revalidatePath("/materials/phieu-giao");
  revalidatePath(`/materials/phieu-giao/${phieu.id}`);
  return { message: t("phieuGiao.aiBatDauDoc"), success: true };
}

async function ghiDong(
  phieu: PhieuChoDuyet,
  thongTin: ThongTinPhieuNhap,
  dongSach: DongSach[]
) {
  // materialId do giao diện gửi: chỉ nhận id có thật, tránh vỡ ràng buộc khóa ngoại.
  const ids = [...new Set(dongSach.map((d) => d.materialId).filter((x): x is number => x !== null))];
  const coThat = new Set(
    ids.length
      ? (await prisma.material.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((m) => m.id)
      : []
  );
  await prisma.$transaction(async (tx) => {
    await tx.phieuGiaoNhan.update({
      where: { id: phieu.id },
      data: {
        nhaCungCap: thongTin.nhaCungCap.trim().slice(0, 200) || null,
        soPhieu: thongTin.soPhieu.trim().slice(0, 80) || null,
        ngayGiao: ngayTuChuoi(thongTin.ngayGiao),
        ghiChu: thongTin.ghiChu.trim().slice(0, 1000) || null,
      },
    });
    await tx.phieuGiaoNhanDong.deleteMany({ where: { phieuId: phieu.id } });
    if (dongSach.length) {
      await tx.phieuGiaoNhanDong.createMany({
        data: dongSach.map((d, i) => ({
          phieuId: phieu.id,
          thuTu: i + 1,
          chuGoc: d.chuGoc,
          ten: d.ten,
          partNo: d.partNo,
          impa: d.impa,
          soLuong: d.soLuong,
          donVi: d.donVi,
          loai: d.loai,
          thietBi: d.thietBi,
          tenEn: d.tenEn,
          trang: d.trang,
          canhBao: d.canhBao,
          materialId: d.materialId !== null && coThat.has(d.materialId) ? d.materialId : null,
          chon: d.chon,
        })),
      });
    }
  });
}

export async function luuDongPhieuGiao(
  phieuId: number,
  thongTin: ThongTinPhieuNhap,
  dong: DongNhap[]
): Promise<KetQuaPhieuGiao> {
  const { t, tTuDo } = await layT();
  const actor = await requireActiveRole([...NGUOI_TAI_PHIEU_GIAO]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const phieu = await timPhieuChoDuyet(Number(phieuId));
  if (!phieu || !trongPhamVi(vesselScopeDayDu(actor), phieu.vesselId)) {
    return { message: t("chung.khongCoQuyen") };
  }
  if (phieu.status !== "CHO_DUYET") {
    return { message: t("phieuGiao.phieuDaXuLy", { trangThai: tTuDo(`phieuGiao.trangThai_${phieu.status}`) }) };
  }
  if (phieu.uploadedById !== actor.id && !canManageVesselCatalog(actor, phieu.vesselId)) {
    return { message: t("chung.khongCoQuyen") };
  }
  // AI đang đọc nền sẽ THAY toàn bộ dòng khi xong — lưu bây giờ là mất công.
  if (dangDocAi(phieu.aiDangDocTu)) return { message: t("phieuGiao.aiDangDocRoi") };
  const kq = kiemTraDongNhap(Array.isArray(dong) ? dong.slice(0, 1000) : []);
  if (!kq.ok) {
    return { message: t(kq.loi === "thieuTen" ? "phieuGiao.dongThieuTen" : "phieuGiao.dongSoLuongSai", { n: kq.n }) };
  }
  await ghiDong(phieu, thongTin, kq.dong);
  revalidatePath(`/materials/phieu-giao/${phieu.id}`);
  revalidatePath("/materials/phieu-giao");
  return { message: t("phieuGiao.daLuuDong", { n: kq.dong.length }), success: true };
}

// ─── 3. Phê duyệt → danh mục + tồn kho ───────────────────────────────────────

export async function duyetPhieuGiao(
  phieuId: number,
  thongTin: ThongTinPhieuNhap,
  dong: DongNhap[],
  warehouseIdRaw: number | null
): Promise<KetQuaPhieuGiao> {
  const { t, tTuDo } = await layT();
  const actor = await requireActiveRole([...VAN_HANH_TAU]);
  const phieu = actor ? await timPhieuChoDuyet(Number(phieuId)) : null;
  if (!actor || !phieu || !canManageVesselCatalog(actor, phieu.vesselId)) {
    return { message: t("phieuGiao.khongCoQuyenDuyet") };
  }
  if (phieu.status !== "CHO_DUYET") {
    return { message: t("phieuGiao.phieuDaXuLy", { trangThai: tTuDo(`phieuGiao.trangThai_${phieu.status}`) }) };
  }
  if (dangDocAi(phieu.aiDangDocTu)) return { message: t("phieuGiao.aiDangDocRoi") };
  const kq = kiemTraDongNhap(Array.isArray(dong) ? dong.slice(0, 1000) : []);
  if (!kq.ok) {
    return { message: t(kq.loi === "thieuTen" ? "phieuGiao.dongThieuTen" : "phieuGiao.dongSoLuongSai", { n: kq.n }) };
  }
  const chon = kq.dong.filter((d) => d.chon);
  if (!chon.length) return { message: t("phieuGiao.canChonItNhatMotDong") };

  let warehouseId: number | null = null;
  if (warehouseIdRaw !== null && warehouseIdRaw !== undefined && String(warehouseIdRaw) !== "") {
    const wid = Number(warehouseIdRaw);
    const kho = Number.isInteger(wid) && wid > 0 ? await prisma.warehouse.findUnique({ where: { id: wid } }) : null;
    if (!kho || kho.vesselId !== phieu.vesselId) return { message: t("actions.kho_khongThuocTauDaChon") };
    warehouseId = kho.id;
  }

  // Lưu bản người duyệt vừa sửa trước — phiếu phải phản ánh đúng cái đã được duyệt.
  await ghiDong(phieu, thongTin, kq.dong);

  // Dòng đã ghép mặt hàng có sẵn: chỉ bảo đảm liên kết tàu. Dòng mới: đi qua
  // applyMaterialImport (cùng luật sinh mã + ghép trùng như nhập từ Excel).
  const daKhop = chon.filter((d) => d.materialId !== null);
  const chuaKhop = chon.filter((d) => d.materialId === null);
  const idTheoRef = new Map<string, number>();
  const taoMoiTheoRef = new Map<string, boolean>();
  let taoMoi = 0;
  let gan = 0;
  if (chuaKhop.length) {
    const items: ImportedItem[] = chuaKhop.map((d, i) => ({
      name: d.ten,
      impa: d.impa,
      partNumber: d.partNo,
      uom: d.donVi,
      equipment: d.thietBi,
      nameEn: d.tenEn,
      group: null,
      minStock: 0,
      rob: null,
      sheet: null,
      materialType: d.loai,
      ref: `m${i}`,
    }));
    const { applyMaterialImport } = await import("@/lib/materialImportApply");
    const r = await applyMaterialImport({
      vesselId: phieu.vesselId,
      warehouseId: null,
      warehouseByKind: null,
      fallbackKind: "SPARE",
      items,
      fileName: phieu.fileName,
      actorName: actor.name,
    });
    if (r.conflict) return { message: t("actions.nhap_trungMaDoDongThoi") };
    for (const x of r.resolved ?? []) {
      if (!x.ref) continue;
      idTheoRef.set(x.ref, x.materialId);
      taoMoiTheoRef.set(x.ref, x.taoMoi);
    }
    taoMoi = r.createdCount;
    gan += r.linkedCount;
  }
  const materialCuaDong = (d: DongSach) =>
    d.materialId ?? idTheoRef.get(`m${chuaKhop.indexOf(d)}`) ?? null;
  // Dòng này có TẠO MỚI mặt hàng không — để sau này gỡ phiếu (hoàn tác) biết
  // mặt hàng nào là của phiếu, mặt hàng nào có sẵn từ trước.
  const dongTaoMoi = (d: DongSach) => (d.materialId ? false : (taoMoiTheoRef.get(`m${chuaKhop.indexOf(d)}`) ?? null));

  const ghiChuNhap = `Phiếu giao ${thongTin.soPhieu.trim() || phieu.soPhieu || phieu.fileName}${
    thongTin.nhaCungCap.trim() ? ` — ${thongTin.nhaCungCap.trim().slice(0, 80)}` : ""
  }`;
  const occurredAt = ngayTuChuoi(thongTin.ngayGiao) ?? new Date();
  let soDongTon = 0;

  await prisma.$transaction(async (tx) => {
    for (const d of daKhop) {
      await tx.vesselMaterial.upsert({
        where: { vesselId_materialId: { vesselId: phieu.vesselId, materialId: d.materialId as number } },
        update: {},
        create: { vesselId: phieu.vesselId, materialId: d.materialId as number },
      });
      gan++;
    }
    // Gắn materialId vào từng dòng đã duyệt (theo thứ tự đã lưu ở ghiDong).
    const dongDb = await tx.phieuGiaoNhanDong.findMany({
      where: { phieuId: phieu.id },
      orderBy: { thuTu: "asc" },
      select: { id: true, thuTu: true },
    });
    for (let i = 0; i < kq.dong.length; i++) {
      const d = kq.dong[i];
      if (!d.chon) continue;
      const materialId = materialCuaDong(d);
      const row = dongDb[i];
      if (!row || !materialId) continue;
      await tx.phieuGiaoNhanDong.update({ where: { id: row.id }, data: { materialId, taoMoi: dongTaoMoi(d) } });
      if (warehouseId && d.soLuong > 0) {
        // Cùng khóa tồn kho với phiếu nhập tay (xem createInventoryTransaction).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_TON_KHO_ADVISORY}::int, ${khoaAdvisoryDongTon(
          materialId,
          warehouseId
        )}::int)`;
        await tx.inventory.upsert({
          where: { materialId_warehouseId: { materialId, warehouseId } },
          update: { quantity: { increment: d.soLuong }, vesselId: phieu.vesselId },
          create: { materialId, warehouseId, vesselId: phieu.vesselId, quantity: d.soLuong },
        });
        await tx.inventoryTransaction.create({
          data: {
            type: "IN",
            materialId,
            warehouseId,
            vesselId: phieu.vesselId,
            quantity: d.soLuong,
            note: ghiChuNhap.slice(0, 200),
            occurredAt,
            performedBy: actor.name,
            // Dấu vết để hoàn tác khi quản trị gỡ phiếu (goPhieuGiaoDaDuyet).
            phieuGiaoId: phieu.id,
          },
        });
        soDongTon++;
      }
    }
    await tx.phieuGiaoNhan.update({
      where: { id: phieu.id },
      data: { status: "DA_DUYET", approvedBy: actor.name, approvedAt: new Date(), warehouseId },
    });
  }, GIAO_DICH_GIU_KHOA);

  await ghiNhatKyNguoiDung(actor, {
    action: "phieu-giao-duyet",
    path: `/materials/phieu-giao/${phieu.id}`,
    vesselId: phieu.vesselId,
    detail: `Duyệt phiếu giao ${phieu.soPhieu ?? phieu.fileName} (${phieu.vessel.code}): ${taoMoi} mới, ${gan} có sẵn, ${soDongTon} dòng cộng tồn${
      warehouseId ? ` kho #${warehouseId}` : ""
    }`,
  });
  revalidatePath("/materials");
  revalidatePath("/inventory");
  revalidatePath("/materials/phieu-giao");
  revalidatePath(`/materials/phieu-giao/${phieu.id}`);
  return { message: t("phieuGiao.daDuyet", { moi: taoMoi, coSan: gan, ton: soDongTon }), success: true };
}

export async function tuChoiPhieuGiao(phieuId: number, lyDo: string): Promise<KetQuaPhieuGiao> {
  const { t, tTuDo } = await layT();
  const actor = await requireActiveRole([...VAN_HANH_TAU]);
  const phieu = actor ? await timPhieuChoDuyet(Number(phieuId)) : null;
  if (!actor || !phieu || !canManageVesselCatalog(actor, phieu.vesselId)) {
    return { message: t("phieuGiao.khongCoQuyenDuyet") };
  }
  if (phieu.status !== "CHO_DUYET") {
    return { message: t("phieuGiao.phieuDaXuLy", { trangThai: tTuDo(`phieuGiao.trangThai_${phieu.status}`) }) };
  }
  await prisma.phieuGiaoNhan.update({
    where: { id: phieu.id },
    data: {
      status: "TU_CHOI",
      lyDoTuChoi: String(lyDo ?? "").trim().slice(0, 500) || null,
      approvedBy: actor.name,
      approvedAt: new Date(),
    },
  });
  await ghiNhatKyNguoiDung(actor, {
    action: "phieu-giao-tu-choi",
    path: `/materials/phieu-giao/${phieu.id}`,
    vesselId: phieu.vesselId,
    detail: `Từ chối phiếu giao ${phieu.soPhieu ?? phieu.fileName}: ${String(lyDo ?? "").trim().slice(0, 200)}`,
  });
  revalidatePath("/materials/phieu-giao");
  revalidatePath(`/materials/phieu-giao/${phieu.id}`);
  return { message: t("phieuGiao.daTuChoi"), success: true };
}

export async function xoaPhieuGiao(phieuId: number): Promise<KetQuaPhieuGiao> {
  const { t, tTuDo } = await layT();
  const actor = await requireActiveRole([...NGUOI_TAI_PHIEU_GIAO]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const phieu = await prisma.phieuGiaoNhan.findUnique({
    where: { id: Number(phieuId) || -1 },
    select: { id: true, vesselId: true, status: true, uploadedById: true, storedName: true, fileName: true, soPhieu: true },
  });
  if (!phieu || !trongPhamVi(vesselScopeDayDu(actor), phieu.vesselId)) return { message: t("chung.khongCoQuyen") };
  if (phieu.uploadedById !== actor.id && !canManageVesselCatalog(actor, phieu.vesselId)) {
    return { message: t("chung.khongCoQuyen") };
  }
  // Phiếu đã duyệt là chứng từ của các dòng nhập kho — giữ lại, không xóa.
  if (phieu.status === "DA_DUYET") {
    return { message: t("phieuGiao.phieuDaXuLy", { trangThai: tTuDo("phieuGiao.trangThai_DA_DUYET") }) };
  }
  await prisma.phieuGiaoNhan.delete({ where: { id: phieu.id } });
  await unlink(path.join(getUploadDir(), path.basename(phieu.storedName))).catch(() => undefined);
  await ghiNhatKyNguoiDung(actor, {
    action: "phieu-giao-xoa",
    path: `/materials/phieu-giao`,
    vesselId: phieu.vesselId,
    detail: `Xóa phiếu giao ${phieu.soPhieu ?? phieu.fileName}`,
  });
  revalidatePath("/materials/phieu-giao");
  redirect("/materials/phieu-giao");
}

/** Cho trang duyệt: ngày → chuỗi ô date (giữ ở đây để trang server không phải import lib riêng). */
export async function chuoiNgayPhieu(d: Date | null): Promise<string> {
  return chuoiNgay(d);
}

// ─── 5. Gỡ bỏ phiếu ĐÃ DUYỆT (hoàn tác) — quản trị tại văn phòng ─────────────

export type TomTatGoPhieu = {
  /** Dòng nhập kho do phiếu sinh ra sẽ bị xóa (tồn trừ lại). */
  soDongNhap: number;
  /** Mặt hàng do phiếu tạo mới, chưa dùng ở đâu khác → xóa. */
  soVatTuXoa: number;
  /** Mặt hàng có sẵn từ trước hoặc đã được dùng nơi khác → giữ. */
  soVatTuGiu: number;
  /** Mã mặt hàng mà trừ lại tồn sẽ âm (đã xuất bớt sau khi nhập) → không gỡ được. */
  tonAm: string[];
};

export type KetQuaGoPhieu = { message: string; success?: boolean; tomTat?: TomTatGoPhieu };

type KeHoachGo = TomTatGoPhieu & {
  txIds: number[];
  /** Trừ tồn theo từng dòng tồn (vật tư, kho). */
  tru: { materialId: number; warehouseId: number; soLuong: number }[];
  vatTuXoa: number[];
  maVatTuXoa: string[];
};

class LoiTonAm extends Error {
  constructor(public readonly ma: string[]) {
    super("ton am");
  }
}

const PHUT = 60_000;

/**
 * Tìm mọi thứ phiếu đã sinh ra và quyết định gỡ được gì. Phiếu duyệt SAU khi có
 * cột phieuGiaoId / taoMoi thì tra thẳng; phiếu duyệt trước đó suy từ ghi chú
 * dòng nhập và mốc thời gian duyệt (±15 phút) — hẹp để không vơ nhầm phiếu khác.
 */
async function lapKeHoachGo(
  // PrismaClient gán được vào TransactionClient — cùng một hàm dùng cho cả xem trước lẫn giao dịch thật.
  db: Prisma.TransactionClient,
  phieu: {
    id: number;
    vesselId: number;
    soPhieu: string | null;
    fileName: string;
    approvedAt: Date | null;
    updatedAt: Date;
    dong: { materialId: number | null; chon: boolean; taoMoi: boolean | null }[];
  }
): Promise<KeHoachGo> {
  const mocDuyet = phieu.approvedAt ?? phieu.updatedAt;
  const dong = phieu.dong.filter((d) => d.chon && d.materialId);
  const materialIds = [...new Set(dong.map((d) => d.materialId as number))];
  const trong: KeHoachGo = { soDongNhap: 0, soVatTuXoa: 0, soVatTuGiu: 0, tonAm: [], txIds: [], tru: [], vatTuXoa: [], maVatTuXoa: [] };
  if (!materialIds.length) return trong;

  const [txs, vatTu] = await Promise.all([
    db.inventoryTransaction.findMany({
      where: {
        type: "IN",
        vesselId: phieu.vesselId,
        materialId: { in: materialIds },
        OR: [
          { phieuGiaoId: phieu.id },
          {
            phieuGiaoId: null,
            note: { startsWith: `Phiếu giao ${phieu.soPhieu ?? phieu.fileName}` },
            createdAt: { gte: new Date(mocDuyet.getTime() - 15 * PHUT), lte: new Date(mocDuyet.getTime() + 15 * PHUT) },
          },
        ],
      },
      select: { id: true, materialId: true, warehouseId: true, quantity: true },
    }),
    db.material.findMany({ where: { id: { in: materialIds } }, select: { id: true, code: true, createdAt: true } }),
  ]);
  const maCua = new Map(vatTu.map((m) => [m.id, m.code]));
  const txIds = txs.map((x) => x.id);

  // Trừ tồn: gộp theo (vật tư, kho).
  const truTheoDong = new Map<string, { materialId: number; warehouseId: number; soLuong: number }>();
  for (const x of txs) {
    const k = `${x.materialId}|${x.warehouseId}`;
    const c = truTheoDong.get(k) ?? { materialId: x.materialId, warehouseId: x.warehouseId, soLuong: 0 };
    c.soLuong += x.quantity;
    truTheoDong.set(k, c);
  }
  const tru = [...truTheoDong.values()];

  // Ứng viên xóa: dòng tạo mới (taoMoi=true) hoặc phiếu cũ mà mặt hàng ra đời
  // ngay trước lúc duyệt.
  const ungVien = new Set<number>();
  for (const d of dong) {
    const id = d.materialId as number;
    if (d.taoMoi === true) ungVien.add(id);
    else if (d.taoMoi === null) {
      const m = vatTu.find((v) => v.id === id);
      if (m && m.createdAt.getTime() >= mocDuyet.getTime() - 15 * PHUT && m.createdAt.getTime() <= mocDuyet.getTime() + 2 * PHUT) ungVien.add(id);
    }
  }
  const cands = [...ungVien];
  const [tonRows, txKhac, yeuCau, donMua, phieuKhac, tauKhac] = await Promise.all([
    db.inventory.findMany({
      where: { materialId: { in: materialIds } },
      select: { materialId: true, warehouseId: true, quantity: true, reservedQuantity: true },
    }),
    cands.length ? db.inventoryTransaction.groupBy({ by: ["materialId"], where: { materialId: { in: cands }, id: { notIn: txIds } }, _count: { _all: true } }) : [],
    cands.length ? db.materialRequestItem.groupBy({ by: ["materialId"], where: { materialId: { in: cands } }, _count: { _all: true } }) : [],
    cands.length ? db.purchaseOrderItem.groupBy({ by: ["materialId"], where: { materialId: { in: cands } }, _count: { _all: true } }) : [],
    cands.length ? db.phieuGiaoNhanDong.groupBy({ by: ["materialId"], where: { materialId: { in: cands }, phieuId: { not: phieu.id } }, _count: { _all: true } }) : [],
    cands.length ? db.vesselMaterial.groupBy({ by: ["materialId"], where: { materialId: { in: cands }, vesselId: { not: phieu.vesselId } }, _count: { _all: true } }) : [],
  ]);
  // Tồn âm: dòng tồn nào trừ xong < 0 nghĩa là đã xuất bớt sau khi nhập.
  const tonAm = new Set<string>();
  for (const c of tru) {
    const row = tonRows.find((r) => r.materialId === c.materialId && r.warehouseId === c.warehouseId);
    if ((row?.quantity ?? 0) - c.soLuong < -1e-9) tonAm.add(maCua.get(c.materialId) ?? String(c.materialId));
  }
  // Còn tham chiếu ở đâu → giữ mặt hàng.
  const conDung = new Set<number>();
  for (const g of [...txKhac, ...yeuCau, ...donMua, ...phieuKhac, ...tauKhac]) if (g.materialId) conDung.add(g.materialId);
  for (const r of tonRows) {
    if (!ungVien.has(r.materialId)) continue;
    const c = truTheoDong.get(`${r.materialId}|${r.warehouseId}`);
    const conLai = r.quantity - (c?.soLuong ?? 0);
    if (conLai > 1e-9 || r.reservedQuantity > 0) conDung.add(r.materialId);
  }
  const vatTuXoa = cands.filter((id) => !conDung.has(id));
  return {
    soDongNhap: txs.length,
    soVatTuXoa: vatTuXoa.length,
    soVatTuGiu: materialIds.length - vatTuXoa.length,
    tonAm: [...tonAm],
    txIds,
    tru,
    vatTuXoa,
    maVatTuXoa: vatTuXoa.map((id) => maCua.get(id) ?? String(id)),
  };
}

/**
 * Gỡ bỏ một phiếu ĐÃ DUYỆT và hoàn tác những gì nó đã sinh ra. thuc=false chỉ
 * tính kế hoạch để giao diện hỏi xác nhận bằng con số thật; thuc=true thực hiện
 * trong MỘT giao dịch (khóa tồn kho như phiếu nhập tay). Chỉ ADMIN tại văn phòng
 * — bản trên tàu không được, cùng lý do với xóa mặt hàng (lib/banCai.ts).
 */
export async function goPhieuGiaoDaDuyet(phieuId: number, thuc: boolean): Promise<KetQuaGoPhieu> {
  const { t } = await layT();
  const actor = await requireActiveRole(["ADMIN"]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const { laBanTau } = await import("@/lib/banCai");
  if (await laBanTau()) return { message: t("phieuGiao.goChiVanPhong") };
  const phieu = await prisma.phieuGiaoNhan.findUnique({
    where: { id: Number(phieuId) || -1 },
    select: {
      id: true,
      vesselId: true,
      soPhieu: true,
      fileName: true,
      storedName: true,
      status: true,
      approvedAt: true,
      updatedAt: true,
      vessel: { select: { code: true } },
      dong: { select: { materialId: true, chon: true, taoMoi: true } },
    },
  });
  if (!phieu) return { message: t("chung.duLieuKhongHopLe") };
  if (phieu.status !== "DA_DUYET") return { message: t("phieuGiao.goChiPhieuDaDuyet") };
  const tenPhieu = phieu.soPhieu ?? phieu.fileName;

  if (!thuc) {
    const kh = await lapKeHoachGo(prisma, phieu);
    const tomTat: TomTatGoPhieu = { soDongNhap: kh.soDongNhap, soVatTuXoa: kh.soVatTuXoa, soVatTuGiu: kh.soVatTuGiu, tonAm: kh.tonAm };
    if (kh.tonAm.length) return { message: t("phieuGiao.goTonAm", { ds: kh.tonAm.slice(0, 20).join(", ") }), tomTat };
    return { message: "", success: true, tomTat };
  }

  let kh: KeHoachGo | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      kh = await lapKeHoachGo(tx, phieu);
      if (kh.tonAm.length) throw new LoiTonAm(kh.tonAm);
      for (const c of kh.tru) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_TON_KHO_ADVISORY}::int, ${khoaAdvisoryDongTon(c.materialId, c.warehouseId)}::int)`;
        const r = await tx.inventory.updateMany({
          where: { materialId: c.materialId, warehouseId: c.warehouseId, quantity: { gte: c.soLuong - 1e-9 } },
          data: { quantity: { decrement: c.soLuong } },
        });
        if (r.count === 0) throw new LoiTonAm([String(c.materialId)]);
      }
      if (kh.txIds.length) await tx.inventoryTransaction.deleteMany({ where: { id: { in: kh.txIds } } });
      if (kh.vatTuXoa.length) {
        // Dòng tồn đã về 0 của mặt hàng sắp xóa: dọn trước (khóa ngoại cascade cũng dọn, nhưng nói rõ ý).
        await tx.inventory.deleteMany({ where: { materialId: { in: kh.vatTuXoa }, quantity: { lte: 1e-9 }, reservedQuantity: { lte: 0 } } });
        await tx.material.deleteMany({ where: { id: { in: kh.vatTuXoa } } });
      }
      await tx.phieuGiaoNhan.delete({ where: { id: phieu.id } });
    }, GIAO_DICH_GIU_KHOA);
  } catch (e) {
    if (e instanceof LoiTonAm) return { message: t("phieuGiao.goTonAm", { ds: e.ma.slice(0, 20).join(", ") }) };
    throw e;
  }
  const ketQua = kh as KeHoachGo | null;
  await unlink(path.join(getUploadDir(), path.basename(phieu.storedName))).catch(() => undefined);
  await ghiNhatKyNguoiDung(actor, {
    action: "phieu-giao-go-da-duyet",
    path: "/materials/phieu-giao",
    vesselId: phieu.vesselId,
    detail: `Gỡ phiếu giao ĐÃ DUYỆT ${tenPhieu} (${phieu.vessel.code}): xóa ${ketQua?.soDongNhap ?? 0} dòng nhập kho, xóa ${ketQua?.soVatTuXoa ?? 0} mặt hàng mới [${(ketQua?.maVatTuXoa ?? []).slice(0, 80).join(", ")}${
      (ketQua?.maVatTuXoa.length ?? 0) > 80 ? "…" : ""
    }], giữ ${ketQua?.soVatTuGiu ?? 0}`,
  });
  revalidatePath("/materials");
  revalidatePath("/inventory");
  revalidatePath("/materials/phieu-giao");
  const tomTat: TomTatGoPhieu = {
    soDongNhap: ketQua?.soDongNhap ?? 0,
    soVatTuXoa: ketQua?.soVatTuXoa ?? 0,
    soVatTuGiu: ketQua?.soVatTuGiu ?? 0,
    tonAm: [],
  };
  return { message: t("phieuGiao.daGoDaDuyet", { phieu: tenPhieu, tx: tomTat.soDongNhap, moi: tomTat.soVatTuXoa, giu: tomTat.soVatTuGiu }), success: true, tomTat };
}
