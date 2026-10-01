"use server";

import path from "path";
import { createHash, randomUUID } from "crypto";
import { readFile, unlink, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveRole, trongPhamVi, vesselScopeDayDu } from "@/lib/auth";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import { MAX_UPLOAD_BYTES, ensureUploadDir, fileExtension, getUploadDir } from "@/lib/uploads";
import { dangDocAi } from "@/lib/phieuGiao";
import {
  DUOI_CHANG_BUOC,
  NHAP_CHANG_BUOC,
  chuanNgay,
  dongTuAiChangBuoc,
  ngayTuDdMm,
  sachDongChangBuocNhap,
  type DongChangBuocNhap,
} from "@/lib/changBuocNhap";

/*
 * NHẬP DỤNG CỤ CHẰNG BUỘC TỪ FILE MLS-11-13:
 *   1. taiFileChangBuoc — lưu file, đọc dòng (Word / Excel / PDF có chữ đọc
 *      ngay; PDF scan để bộ đọc AI đọc nền). Chưa đụng tới danh mục.
 *   2. Trang soát (/lashing/nhap/[id]) — sửa chỗ đọc sai, bỏ dòng, xem dòng nào
 *      thêm mới / cập nhật dụng cụ đã có.
 *   3. apDungChangBuoc — áp vào danh mục dụng cụ của tàu; tùy chọn lưu số còn
 *      dùng / hỏng thành báo cáo MLS-11-13.
 */

export type KetQuaChangBuoc = { message: string; success?: boolean };

const TIEN_TO_TEP = "chang-buoc-";

type NguoiThaoTac = { id: number; email: string; role: string; name: string };

const loaiTepCua = (ext: string) => (ext === ".pdf" ? "PDF" : ext === ".xlsx" || ext === ".xls" ? "EXCEL" : "WORD");

/** Chữ tách sẵn cho nhà cung cấp AI chỉ đọc chữ (DeepSeek): lớp chữ PDF, không có thì OCR (Windows). */
async function chuChoAi(nhaCungCap: string, buffer: Buffer, fullPath: string): Promise<string | null> {
  const { CHI_DOC_CHU } = await import("@/lib/docPhieuBangAi");
  if (!(CHI_DOC_CHU as readonly string[]).includes(nhaCungCap)) return null;
  const { docChuTuPdf } = await import("@/lib/pdfChu");
  const lop = await docChuTuPdf(buffer, 100);
  if (lop.ok) return lop.text;
  if (process.platform === "win32") {
    const { docPdfBangOcr } = await import("@/lib/pdfOcr");
    const ocr = await docPdfBangOcr(fullPath, 30);
    if (ocr.ok && ocr.text.trim().length >= 10) return ocr.text;
  }
  return null;
}

/** Bộ đọc AI đọc MLS-11-13 (PDF / PDF scan) ở chế độ nền; mọi đường ra đều gỡ dấu aiDangDocTu. */
async function chayDocAiChangBuoc(id: number, actor: NguoiThaoTac): Promise<void> {
  const tep = await prisma.changBuocTep
    .findUnique({ where: { id }, select: { id: true, vesselId: true, storedName: true, fileName: true, vessel: { select: { code: true } } } })
    .catch(() => null);
  if (!tep) return;
  const ketThuc = (data: { loiAi?: string | null; dong?: DongChangBuocNhap[]; ghiChuDoc?: string | null; tenTauDoc?: string | null; cangDoc?: string | null; ngayDoc?: Date | null }) =>
    prisma.changBuocTep.update({ where: { id: tep.id }, data: { ...data, aiDangDocTu: null, aiTienDo: null } }).catch(() => undefined);
  try {
    const { layCauHinhAi } = await import("@/lib/cauHinhAi");
    const cauHinh = await layCauHinhAi();
    if (!cauHinh) {
      await ketThuc({ loiAi: "Chưa cấu hình bộ đọc AI." });
      return;
    }
    const fullPath = path.join(getUploadDir(), path.basename(tep.storedName));
    const buffer = await readFile(fullPath);
    const { docPhieuGiaoBangAi } = await import("@/lib/docPhieuBangAi");
    const { demTrangPdf } = await import("@/lib/pdfChu");
    const bd = Date.now();
    const ai = await docPhieuGiaoBangAi(buffer, cauHinh, {
      banDoc: "changBuoc",
      fileName: tep.fileName,
      soTrang: await demTrangPdf(buffer),
      chuPdf: await chuChoAi(cauHinh.nhaCungCap, buffer, fullPath),
      onTienDo: (xong, tong) => {
        void prisma.changBuocTep.update({ where: { id: tep.id }, data: { aiTienDo: `${xong}/${tong}` } }).catch(() => undefined);
      },
    });
    const giay = Math.round((Date.now() - bd) / 1000);
    if (!ai.ok) {
      console.error(`[chang-buoc] Bộ đọc AI (${cauHinh.nhaCungCap} · ${cauHinh.model}) lỗi #${tep.id} sau ${giay}s: ${ai.loi}`);
      await ketThuc({ loiAi: ai.loi.slice(0, 500) });
      return;
    }
    const dong = dongTuAiChangBuoc(ai.dong);
    const ngay = ai.ngayGiao ? chuanNgay(ai.ngayGiao) : null;
    await ketThuc({
      dong,
      tenTauDoc: ai.tau,
      cangDoc: ai.cang ?? null,
      ngayDoc: ngayTuDdMm(ngay),
      loiAi: ai.canhBaoChung ? ai.canhBaoChung.slice(0, 500) : null,
      ghiChuDoc: `AI (${ai.model}, ${ai.soLuotGoi} lượt, ${giay}s) đọc ${dong.length} dụng cụ, ${ai.soDongCanKiem} dòng cần kiểm.`.slice(0, 1000),
    });
    await ghiNhatKyNguoiDung(actor, {
      action: "chang-buoc-doc-ai",
      path: `/lashing/nhap/${tep.id}`,
      vesselId: tep.vesselId,
      detail: `AI (${ai.model}, ${giay}s) đọc file MLS-11-13 ${tep.fileName} (${tep.vessel.code}): ${dong.length} dòng, token ${ai.tokenVao}/${ai.tokenRa}`,
    });
  } catch (e) {
    console.error(`[chang-buoc] Đọc nền #${tep.id} lỗi:`, e);
    await ketThuc({ loiAi: `Lỗi khi đọc file: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500) });
  }
}

// ─── 1. Tải file ─────────────────────────────────────────────────────────────

export async function taiFileChangBuoc(_prev: KetQuaChangBuoc, formData: FormData): Promise<KetQuaChangBuoc> {
  const { t } = await layT();
  const actor = await requireActiveRole([...NHAP_CHANG_BUOC]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const vesselId = Number(formData.get("vesselId"));
  const tau = Number.isInteger(vesselId) && vesselId > 0 ? await prisma.vessel.findUnique({ where: { id: vesselId }, select: { id: true, code: true, name: true } }) : null;
  if (!tau || !trongPhamVi(vesselScopeDayDu(actor), tau.id)) return { message: t("actions.danhMuc_chiTauMinhPhuTrach") };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: t("actions.nhap_vuiLongChonFile") };
  const ext = fileExtension(file.name);
  if (!(DUOI_CHANG_BUOC as readonly string[]).includes(ext)) return { message: t("changBuoc.saiDinhDang") };
  if (file.size > MAX_UPLOAD_BYTES) return { message: t("actionsModule.nhienLieu_fileVuot20Mb") };

  const buffer = Buffer.from(await file.arrayBuffer());
  const laPdf = ext === ".pdf";
  const { layCauHinhAi } = await import("@/lib/cauHinhAi");
  // PDF: có bộ đọc AI thì để AI đọc (đọc được cả bản scan); không có thì thử lớp chữ.
  const dungAi = laPdf && Boolean(await layCauHinhAi());
  let dong: DongChangBuocNhap[] = [];
  let ghiChuDoc: string | null = null;
  let dau: { tenTau: string | null; cang: string | null; ngay: string | null } = { tenTau: null, cang: null, ngay: null };
  if (!dungAi) {
    const { docChangBuocKhongAi } = await import("@/lib/changBuocTep");
    const kq = await docChangBuocKhongAi(buffer, file.name);
    if (!kq.ok) return { message: laPdf ? `${kq.loi} ${t("changBuoc.pdfCanAi")}` : kq.loi };
    dong = kq.dong;
    dau = kq.dau;
    ghiChuDoc = kq.ghiChu;
  }

  const dir = await ensureUploadDir();
  const storedName = `${TIEN_TO_TEP}${randomUUID()}${ext}`;
  await writeFile(path.join(dir, storedName), buffer);
  const tep = await prisma.changBuocTep.create({
    data: {
      vesselId: tau.id,
      fileName: file.name.slice(0, 200),
      storedName,
      loaiTep: loaiTepCua(ext),
      size: file.size,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      tenTauDoc: dau.tenTau,
      cangDoc: dau.cang,
      ngayDoc: ngayTuDdMm(dau.ngay),
      dong,
      ghiChuDoc,
      aiDangDocTu: dungAi ? new Date() : null,
      aiTienDo: dungAi ? "0" : null,
      nguoiTaiId: actor.id,
      nguoiTai: actor.name,
    },
    select: { id: true },
  });
  await ghiNhatKyNguoiDung(actor, {
    action: "chang-buoc-tai-len",
    path: `/lashing/nhap/${tep.id}`,
    vesselId: tau.id,
    detail: `Tải file MLS-11-13 ${file.name} (${tau.code}, ${dungAi ? "PDF — AI đọc nền" : `${dong.length} dụng cụ`})`,
  });
  if (dungAi) {
    const nguoi = { id: actor.id, email: actor.email, role: actor.role, name: actor.name };
    after(() => chayDocAiChangBuoc(tep.id, nguoi));
  }
  revalidatePath("/lashing");
  redirect(`/lashing/nhap/${tep.id}`);
}

async function timTep(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.changBuocTep.findUnique({
    where: { id },
    select: { id: true, vesselId: true, fileName: true, storedName: true, loaiTep: true, dong: true, trangThai: true, aiDangDocTu: true, ngayDoc: true, cangDoc: true, vessel: { select: { code: true, name: true } } },
  });
}

async function moTep(id: number) {
  const { t } = await layT();
  const actor = await requireActiveRole([...NHAP_CHANG_BUOC]);
  const tep = actor ? await timTep(Number(id)) : null;
  if (!actor || !tep || !trongPhamVi(vesselScopeDayDu(actor), tep.vesselId)) return { ok: false, t, loi: t("chung.khongCoQuyen") } as const;
  if (tep.trangThai !== "CHO_XU_LY") return { ok: false, t, loi: t("changBuoc.daApDungRoi") } as const;
  if (dangDocAi(tep.aiDangDocTu)) return { ok: false, t, loi: t("changBuoc.aiDangDocChan") } as const;
  return { ok: true, t, actor, tep } as const;
}

export type DauSuaChangBuoc = { cang: string; ngay: string };

/** Đầu biểu mẫu người dùng sửa: cảng, ngày (yyyy-mm-dd từ ô date). */
function docDauSua(x: DauSuaChangBuoc | undefined): { cangDoc: string | null; ngayDoc: Date | null } | null {
  const cang = String(x?.cang ?? "").trim().slice(0, 120) || null;
  const s = String(x?.ngay ?? "").trim();
  if (!s) return { cangDoc: cang, ngayDoc: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : { cangDoc: cang, ngayDoc: d };
}

// ─── 2. Lưu / đọc lại ────────────────────────────────────────────────────────

export async function luuChangBuoc(id: number, dongSua: unknown, dauSua: DauSuaChangBuoc): Promise<KetQuaChangBuoc> {
  const m = await moTep(id);
  if (!m.ok) return { message: m.loi };
  const { t, tep } = m;
  const r = sachDongChangBuocNhap(dongSua);
  if (!r.ok) return { message: t("changBuoc.soSai", { n: r.n }) };
  const dau = docDauSua(dauSua);
  if (!dau) return { message: t("chung.duLieuKhongHopLe") };
  await prisma.changBuocTep.update({ where: { id: tep.id }, data: { dong: r.dong, ...dau } });
  revalidatePath(`/lashing/nhap/${tep.id}`);
  return { message: t("changBuoc.daLuu"), success: true };
}

export async function docLaiChangBuocAi(id: number): Promise<KetQuaChangBuoc> {
  const m = await moTep(id);
  if (!m.ok) return { message: m.loi };
  const { t, actor, tep } = m;
  if (tep.loaiTep !== "PDF") return { message: t("chung.duLieuKhongHopLe") };
  const { layCauHinhAi } = await import("@/lib/cauHinhAi");
  if (!(await layCauHinhAi())) return { message: t("changBuoc.pdfCanAi") };
  await prisma.changBuocTep.update({ where: { id: tep.id }, data: { aiDangDocTu: new Date(), aiTienDo: "0", loiAi: null } });
  const nguoi = { id: actor.id, email: actor.email, role: actor.role, name: actor.name };
  after(() => chayDocAiChangBuoc(tep.id, nguoi));
  revalidatePath(`/lashing/nhap/${tep.id}`);
  return { message: t("changBuoc.dangDocLai"), success: true };
}

// ─── 3. Áp dụng ──────────────────────────────────────────────────────────────

export async function apDungChangBuoc(
  id: number,
  dongSua: unknown,
  dauSua: DauSuaChangBuoc,
  tuyChon: { capNhatSo: boolean; taoBaoCao: boolean }
): Promise<KetQuaChangBuoc> {
  const m = await moTep(id);
  if (!m.ok) return { message: m.loi };
  const { t, actor, tep } = m;
  const r = sachDongChangBuocNhap(dongSua);
  if (!r.ok) return { message: t("changBuoc.soSai", { n: r.n }) };
  const dau = docDauSua(dauSua);
  if (!dau) return { message: t("chung.duLieuKhongHopLe") };
  if (!r.dong.some((d) => !d.boQua)) return { message: t("changBuoc.khongCoDong") };
  // Giữ chỗ: chỉ MỘT lần bấm được đi tiếp.
  const giu = await prisma.changBuocTep.updateMany({ where: { id: tep.id, trangThai: "CHO_XU_LY" }, data: { trangThai: "DANG_AP_DUNG", dong: r.dong, ...dau } });
  if (giu.count === 0) return { message: t("changBuoc.daApDungRoi") };
  try {
    const { apDungChangBuocTx } = await import("@/lib/changBuocServer");
    const ngay = dau.ngayDoc && dau.ngayDoc <= new Date() ? dau.ngayDoc : new Date();
    const kq = await prisma.$transaction((tx) =>
      apDungChangBuocTx(tx, {
        vesselId: tep.vesselId,
        dong: r.dong,
        capNhatSo: Boolean(tuyChon?.capNhatSo),
        taoBaoCao: Boolean(tuyChon?.taoBaoCao),
        ngay,
        cang: dau.cangDoc,
        nguoi: `${actor.name} (nhập từ file)`,
      })
    );
    await prisma.changBuocTep.update({
      where: { id: tep.id },
      data: { trangThai: "DA_AP_DUNG", apDungBoi: actor.name, apDungLuc: new Date(), reportId: kq.reportId, ketQua: kq },
    });
    await ghiNhatKyNguoiDung(actor, {
      action: "chang-buoc-ap-dung",
      path: `/lashing/nhap/${tep.id}`,
      vesselId: tep.vesselId,
      detail: `Áp dụng file MLS-11-13 ${tep.fileName} (${tep.vessel.code}): thêm ${kq.them}, cập nhật ${kq.capNhat}, không đổi ${kq.giong}, trùng ${kq.trung}, bỏ ${kq.boQua}${
        kq.reportId ? `; lưu báo cáo #${kq.reportId} (${kq.soDongBaoCao} dòng)` : ""
      }`,
    });
    revalidatePath("/lashing");
    revalidatePath(`/lashing/nhap/${tep.id}`);
    return {
      message: t("changBuoc.daApDung", { them: kq.them, capNhat: kq.capNhat, giong: kq.giong }) + (kq.reportId ? ` ${t("changBuoc.daLuuBaoCao", { n: kq.soDongBaoCao })}` : ""),
      success: true,
    };
  } catch (e) {
    console.error(`[chang-buoc] Áp dụng #${tep.id} lỗi:`, e);
    await prisma.changBuocTep.update({ where: { id: tep.id }, data: { trangThai: "CHO_XU_LY" } }).catch(() => undefined);
    return { message: t("changBuoc.loiApDung", { loi: e instanceof Error ? e.message.slice(0, 200) : String(e) }) };
  }
}

// ─── 4. Xóa (chưa áp dụng) ───────────────────────────────────────────────────

export async function xoaChangBuoc(id: number): Promise<KetQuaChangBuoc> {
  const m = await moTep(id);
  if (!m.ok) return { message: m.loi };
  const { actor, tep } = m;
  await prisma.changBuocTep.delete({ where: { id: tep.id } });
  try {
    await unlink(path.join(getUploadDir(), path.basename(tep.storedName)));
  } catch {
    /* tệp đã không còn */
  }
  await ghiNhatKyNguoiDung(actor, {
    action: "chang-buoc-xoa",
    path: "/lashing",
    vesselId: tep.vesselId,
    detail: `Xóa file MLS-11-13 chưa áp dụng ${tep.fileName} (#${tep.id}, ${tep.vessel.code})`,
  });
  revalidatePath("/lashing");
  redirect(`/lashing?vessel=${tep.vesselId}`);
}
