"use server";

import path from "path";
import { createHash, randomUUID } from "crypto";
import { readFile, unlink, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  kiemTraDongNhap,
  ngayTuChuoi,
  type DongNhap,
  type DongSach,
  type ThongTinPhieuNhap,
} from "@/lib/phieuGiao";
import type { ImportedItem } from "@/lib/materialImport";
import type { DongPhieuGiao } from "@/lib/phieuGiaoParse";

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

type KetQuaDocDong = {
  chuDoc: string | null;
  nguonChu: "AI" | "TEXT" | "OCR" | "TAY";
  dong: DongPhieuGiao[];
  nhaCungCap: string | null;
  soPhieu: string | null;
  ngayGiao: string | null;
  /** AI đã cấu hình nhưng đọc hỏng (mạng, hạn mức...) — ghi nhật ký và báo người dùng. */
  loiAi: string | null;
};

/**
 * Lấy dòng hàng từ PDF theo thứ tự ưu tiên:
 *   1. Bộ đọc AI (Claude) nếu đã cấu hình khóa — đọc cả bản scan, ở mọi máy.
 *   2. Lớp chữ PDF (pdfjs) + bộ tách chuỗi — PDF số, không tốn phí.
 *   3. OCR Windows (máy văn phòng) + bộ tách chuỗi — bản scan khi không có AI.
 *   4. Không đọc được: phiếu vẫn lưu, người duyệt gõ tay.
 */
async function docDongTuPdf(buffer: Buffer, fullPath: string, fileName: string): Promise<KetQuaDocDong> {
  let loiAi: string | null = null;
  const { layCauHinhAi } = await import("@/lib/cauHinhAi");
  const cauHinh = await layCauHinhAi();
  if (cauHinh) {
    const { docPhieuGiaoBangAi } = await import("@/lib/docPhieuBangAi");
    const ai = await docPhieuGiaoBangAi(buffer, cauHinh, { fileName });
    if (ai.ok) {
      return {
        chuDoc: ai.chuTomTat,
        nguonChu: "AI",
        dong: ai.dong,
        nhaCungCap: ai.nhaCungCap,
        soPhieu: ai.soPhieu,
        ngayGiao: ai.ngayGiao,
        loiAi: null,
      };
    }
    loiAi = ai.loi;
    // Ra log máy chủ (Dokploy → Logs) để tra được khi người dùng chỉ thấy câu tóm tắt.
    console.error(`[phieu-giao] Bộ đọc AI (${cauHinh.nhaCungCap} · ${cauHinh.model}) lỗi khi đọc "${fileName}": ${ai.loi}`);
  }
  let chuDoc: string | null = null;
  let nguonChu: KetQuaDocDong["nguonChu"] = "TAY";
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
    dong: doc?.dong ?? [],
    nhaCungCap: doc?.nhaCungCap ?? null,
    soPhieu: doc?.soPhieu ?? null,
    ngayGiao: doc?.ngayGiao ?? null,
    loiAi,
  };
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

  // Không đọc được thì vẫn lưu phiếu, người duyệt gõ tay: bản scan đã ở trong
  // hệ thống là được việc chính.
  const doc = await docDongTuPdf(buffer, fullPath, file.name);
  const { chuDoc, nguonChu, dong } = doc;
  const khop = dong.length ? await khopMatHang(vesselId, dong) : [];

  const nhaCungCap = String(formData.get("nhaCungCap") || "").trim() || doc.nhaCungCap || null;
  const soPhieu = String(formData.get("soPhieu") || "").trim() || doc.soPhieu || null;
  const ngayGiao = ngayTuChuoi(String(formData.get("ngayGiao") || "")) ?? ngayTuChuoi(doc.ngayGiao);
  const ghiChu = String(formData.get("ghiChu") || "").trim() || null;

  const phieu = await prisma.phieuGiaoNhan.create({
    data: {
      vesselId,
      fileName: file.name.slice(0, 200),
      storedName,
      mimeType: "application/pdf",
      size: file.size,
      sha256,
      nguonChu,
      chuDoc: chuDoc ? chuDoc.slice(0, 60000) : null,
      nhaCungCap: nhaCungCap?.slice(0, 200) ?? null,
      soPhieu: soPhieu?.slice(0, 80) ?? null,
      ngayGiao,
      ghiChu,
      loiAi: doc.loiAi ? doc.loiAi.slice(0, 500) : null,
      uploadedById: actor.id,
      dong: {
        create: dong.map((d, i) => ({
          thuTu: i + 1,
          chuGoc: d.chuGoc.slice(0, 500),
          ten: d.ten.slice(0, 200),
          partNo: d.partNo,
          impa: d.impa,
          soLuong: d.soLuong,
          donVi: d.donVi.slice(0, 20),
          loai: d.loai,
          thietBi: d.thietBi?.slice(0, 120) ?? null,
          materialId: khop[i] ?? null,
        })),
      },
    },
    select: { id: true },
  });

  await ghiNhatKyNguoiDung(actor, {
    action: "phieu-giao-tai-len",
    path: `/materials/phieu-giao/${phieu.id}`,
    vesselId,
    detail: `Tải phiếu giao ${soPhieu ?? file.name} (${vessel.code}) — ${dong.length} dòng, nguồn ${nguonChu}${
      doc.loiAi ? ` — AI lỗi: ${doc.loiAi.slice(0, 160)}` : ""
    }`,
  });
  revalidatePath("/materials/phieu-giao");
  redirect(`/materials/phieu-giao/${phieu.id}?doc=${dong.length}&nguon=${nguonChu}${doc.loiAi ? "&ai=loi" : ""}`);
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
      vessel: { select: { code: true } },
    },
  });
}

// ─── 2b. Đọc lại bằng AI (phiếu đã tải, còn chờ duyệt) ───────────────────────

export type KetQuaDocLai = KetQuaPhieuGiao & {
  dong?: (DongNhap & { materialLabel: string | null })[];
  thongTin?: ThongTinPhieuNhap;
};

/**
 * Cho phiếu đã tải lên mà máy chưa đọc được (bản scan ở máy chủ trước khi bật
 * AI) hoặc đọc kém: gửi lại bản scan cho AI, THAY toàn bộ dòng hiện có. Trả về
 * dòng mới để giao diện cập nhật ngay, không phải tải lại trang.
 */
export async function docLaiPhieuGiaoBangAi(phieuId: number): Promise<KetQuaDocLai> {
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
  const { layCauHinhAi } = await import("@/lib/cauHinhAi");
  const cauHinh = await layCauHinhAi();
  if (!cauHinh) return { message: t("phieuGiao.aiChuaCauHinh") };
  const { docPhieuGiaoBangAi } = await import("@/lib/docPhieuBangAi");
  let buffer: Buffer;
  try {
    buffer = await readFile(path.join(getUploadDir(), path.basename(phieu.storedName)));
  } catch {
    return { message: t("phieuGiao.tepKhongCon") };
  }
  const tenPhieu = phieu.soPhieu ?? phieu.fileName;
  const ai = await docPhieuGiaoBangAi(buffer, cauHinh, { fileName: phieu.fileName });
  if (!ai.ok) {
    console.error(`[phieu-giao] Bộ đọc AI (${cauHinh.nhaCungCap} · ${cauHinh.model}) lỗi khi đọc lại phiếu #${phieu.id}: ${ai.loi}`);
    await prisma.phieuGiaoNhan.update({ where: { id: phieu.id }, data: { loiAi: ai.loi.slice(0, 500) } });
    await ghiNhatKyNguoiDung(actor, {
      action: "phieu-giao-ai-loi",
      path: `/materials/phieu-giao/${phieu.id}`,
      vesselId: phieu.vesselId,
      detail: `AI (${cauHinh.nhaCungCap} · ${cauHinh.model}) đọc lại phiếu ${tenPhieu} lỗi: ${ai.loi.slice(0, 200)}`,
    });
    return { message: t("phieuGiao.aiLoi", { loi: ai.loi }) };
  }
  const khop = ai.dong.length ? await khopMatHang(phieu.vesselId, ai.dong) : [];
  // Đầu phiếu: giữ cái người dùng đã gõ, chỉ điền chỗ trống bằng kết quả AI.
  const thongTin: ThongTinPhieuNhap = {
    nhaCungCap: phieu.nhaCungCap ?? ai.nhaCungCap ?? "",
    soPhieu: phieu.soPhieu ?? ai.soPhieu ?? "",
    ngayGiao: chuoiNgay(phieu.ngayGiao ?? ngayTuChuoi(ai.ngayGiao)),
    ghiChu: phieu.ghiChu ?? "",
  };
  await prisma.$transaction(async (tx) => {
    await tx.phieuGiaoNhan.update({
      where: { id: phieu.id },
      data: {
        nguonChu: "AI",
        loiAi: null,
        chuDoc: ai.chuTomTat.slice(0, 60000),
        nhaCungCap: thongTin.nhaCungCap.slice(0, 200) || null,
        soPhieu: thongTin.soPhieu.slice(0, 80) || null,
        ngayGiao: ngayTuChuoi(thongTin.ngayGiao),
      },
    });
    await tx.phieuGiaoNhanDong.deleteMany({ where: { phieuId: phieu.id } });
    if (ai.dong.length) {
      await tx.phieuGiaoNhanDong.createMany({
        data: ai.dong.map((d, i) => ({
          phieuId: phieu.id,
          thuTu: i + 1,
          chuGoc: d.chuGoc.slice(0, 500),
          ten: d.ten.slice(0, 200),
          partNo: d.partNo,
          impa: d.impa,
          soLuong: d.soLuong,
          donVi: d.donVi.slice(0, 20),
          loai: d.loai,
          thietBi: d.thietBi?.slice(0, 120) ?? null,
          materialId: khop[i] ?? null,
        })),
      });
    }
  });
  const dongDb = await prisma.phieuGiaoNhanDong.findMany({
    where: { phieuId: phieu.id },
    orderBy: { thuTu: "asc" },
    include: { material: { select: { code: true, nameVn: true } } },
  });
  await ghiNhatKyNguoiDung(actor, {
    action: "phieu-giao-doc-lai-ai",
    path: `/materials/phieu-giao/${phieu.id}`,
    vesselId: phieu.vesselId,
    detail: `AI (${ai.model}) đọc lại phiếu ${tenPhieu}: ${ai.dong.length} dòng, token ${ai.tokenVao}/${ai.tokenRa}`,
  });
  revalidatePath("/materials/phieu-giao");
  revalidatePath(`/materials/phieu-giao/${phieu.id}`);
  return {
    message: t("phieuGiao.daDocLaiAi", { n: ai.dong.length }),
    success: true,
    thongTin,
    dong: dongDb.map((d) => ({
      id: d.id,
      chon: d.chon,
      ten: d.ten,
      partNo: d.partNo ?? "",
      impa: d.impa ?? "",
      soLuong: d.soLuong,
      donVi: d.donVi,
      loai: d.loai === "STORE" ? "STORE" : "SPARE",
      thietBi: d.thietBi ?? "",
      materialId: d.materialId,
      chuGoc: d.chuGoc,
      materialLabel: d.material ? `${d.material.code} — ${d.material.nameVn}` : null,
    })),
  };
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
  const kq = kiemTraDongNhap(Array.isArray(dong) ? dong.slice(0, 500) : []);
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
  const kq = kiemTraDongNhap(Array.isArray(dong) ? dong.slice(0, 500) : []);
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
  let taoMoi = 0;
  let gan = 0;
  if (chuaKhop.length) {
    const items: ImportedItem[] = chuaKhop.map((d, i) => ({
      name: d.ten,
      impa: d.impa,
      partNumber: d.partNo,
      uom: d.donVi,
      equipment: d.thietBi,
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
    for (const x of r.resolved ?? []) if (x.ref) idTheoRef.set(x.ref, x.materialId);
    taoMoi = r.createdCount;
    gan += r.linkedCount;
  }
  const materialCuaDong = (d: DongSach) =>
    d.materialId ?? idTheoRef.get(`m${chuaKhop.indexOf(d)}`) ?? null;

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
      await tx.phieuGiaoNhanDong.update({ where: { id: row.id }, data: { materialId } });
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
