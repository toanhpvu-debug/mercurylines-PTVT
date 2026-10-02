"use server";

import path from "path";
import { createHash, randomUUID } from "crypto";
import { readFile, unlink, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveRole } from "@/lib/auth";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import { VAN_HANH_SON, coQuanLySon } from "@/lib/roles";
import { MAX_UPLOAD_BYTES, ensureUploadDir, fileExtension, getUploadDir } from "@/lib/uploads";
import { dangDocAi } from "@/lib/phieuGiao";
import { DUOI_PHIEU_SON, boTickDongThieuSo, dongLoiKhiNhap, dongTuAiSon, ghepDongSon, ngayNhanTuChu, sachDongNhanSon, type DongNhanSon } from "@/lib/phieuSon";

/*
 * NHẬP SƠN TỪ PHIẾU GIAO / NHẬN (Excel MLS-11-05, Excel, Word, PDF, PDF scan):
 *   1. taiPhieuSon — lưu file, đọc dòng (Excel / Word / PDF có chữ / OCR đọc ngay;
 *      PDF scan để bộ đọc AI đọc nền), ghép danh mục sơn. Chưa đụng tới tồn.
 *   2. Trang soát /paint/<tàu>/nhan/<id> — sửa chỗ đọc sai, chọn loại sơn hoặc để
 *      tạo loại mới, bỏ dòng rác (luuPhieuSon).
 *   3. apDungPhieuSon — nhập vào tồn sơn của tàu (phiếu nhập IN từng loại).
 * Giống luồng phiếu giao vật tư: kết quả đọc máy không bao giờ lọt thẳng vào tồn.
 */

export type KetQuaPhieuSon = { message: string; success?: boolean };

const TIEN_TO_TEP = "phieu-son-";
const loaiTepCua = (ext: string) => (ext === ".pdf" ? "PDF" : ext === ".xlsx" || ext === ".xls" ? "EXCEL" : "WORD");

type NguoiThaoTac = { id: number; email: string; role: string; name: string };

/** Danh mục sơn để ghép (mọi loại đang dùng). */
const sonDeGhep = () =>
  prisma.paintProduct.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, maker: true, colorName: true, colorCode: true, uom: true },
  });

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

/** Bộ đọc AI (chế độ phiếu giao) đọc PDF / PDF scan ở chế độ nền; mọi đường ra đều gỡ dấu aiDangDocTu. */
async function chayDocAiSon(id: number, actor: NguoiThaoTac): Promise<void> {
  const tep = await prisma.sonPhieuTep
    .findUnique({ where: { id }, select: { id: true, vesselId: true, storedName: true, fileName: true, soPhieu: true, nhaCungCap: true, ngayNhan: true, vessel: { select: { code: true } } } })
    .catch(() => null);
  if (!tep) return;
  const ketThuc = (data: { loiAi?: string | null; dong?: DongNhanSon[]; ghiChuDoc?: string | null; nguonDoc?: string; soPhieu?: string | null; nhaCungCap?: string | null; ngayNhan?: Date | null }) =>
    prisma.sonPhieuTep.update({ where: { id: tep.id }, data: { ...data, aiDangDocTu: null, aiTienDo: null } }).catch(() => undefined);
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
      banDoc: "phieuSon",
      fileName: tep.fileName,
      soTrang: await demTrangPdf(buffer),
      chuPdf: await chuChoAi(cauHinh.nhaCungCap, buffer, fullPath),
      onTienDo: (xong, tong) => {
        void prisma.sonPhieuTep.update({ where: { id: tep.id }, data: { aiTienDo: `${xong}/${tong}` } }).catch(() => undefined);
      },
    });
    const giay = Math.round((Date.now() - bd) / 1000);
    if (!ai.ok) {
      console.error(`[phieu-son] Bộ đọc AI (${cauHinh.nhaCungCap} · ${cauHinh.model}) lỗi #${tep.id} sau ${giay}s: ${ai.loi}`);
      await ketThuc({ loiAi: ai.loi.slice(0, 500) });
      return;
    }
    const dong = boTickDongThieuSo(ghepDongSon(dongTuAiSon(ai.dong), await sonDeGhep()));
    const ngay = ngayNhanTuChu(ai.ngayGiao);
    await ketThuc({
      dong,
      nguonDoc: "AI",
      soPhieu: tep.soPhieu ?? ai.soPhieu,
      nhaCungCap: tep.nhaCungCap ?? ai.nhaCungCap,
      ngayNhan: tep.ngayNhan ?? (ngay ? new Date(`${ngay}T12:00:00`) : null),
      loiAi: !dong.length ? "Bộ đọc AI không thấy dòng hàng nào trong file." : ai.canhBaoChung ? ai.canhBaoChung.slice(0, 500) : null,
      ghiChuDoc: `AI (${ai.model}, ${ai.soLuotGoi} lượt, ${giay}s) đọc ${dong.length} dòng, ${ai.soDongCanKiem} dòng cần kiểm.`.slice(0, 1000),
    });
    await ghiNhatKyNguoiDung(actor, {
      action: "phieu-son-doc-ai",
      path: `/paint/${tep.vesselId}/nhan/${tep.id}`,
      vesselId: tep.vesselId,
      detail: `AI (${ai.model}, ${giay}s) đọc phiếu giao sơn ${tep.fileName} (${tep.vessel.code}): ${dong.length} dòng, token ${ai.tokenVao}/${ai.tokenRa}`,
    });
  } catch (e) {
    console.error(`[phieu-son] Đọc nền #${tep.id} lỗi:`, e);
    await ketThuc({ loiAi: `Lỗi khi đọc file: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500) });
  }
}

// ─── 1. Tải file ─────────────────────────────────────────────────────────────

export async function taiPhieuSon(_prev: KetQuaPhieuSon, formData: FormData): Promise<KetQuaPhieuSon> {
  const { t } = await layT();
  const actor = await requireActiveRole([...VAN_HANH_SON]);
  const vesselId = Number(formData.get("vesselId"));
  if (!actor || !Number.isInteger(vesselId) || vesselId <= 0 || !coQuanLySon(actor, vesselId)) return { message: t("chung.khongCoQuyen") };
  const tau = await prisma.vessel.findUnique({ where: { id: vesselId }, select: { id: true, code: true } });
  if (!tau) return { message: t("actionsModule.tauKhongTonTai") };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: t("actions.nhap_vuiLongChonFile") };
  const ext = fileExtension(file.name);
  if (!(DUOI_PHIEU_SON as readonly string[]).includes(ext)) return { message: t("paint.pgSaiDinhDang") };
  if (file.size > MAX_UPLOAD_BYTES) return { message: t("actionsModule.nhienLieu_fileVuot20Mb") };

  const buffer = Buffer.from(await file.arrayBuffer());
  const dir = await ensureUploadDir();
  const storedName = `${TIEN_TO_TEP}${randomUUID()}${ext}`;
  const fullPath = path.join(dir, storedName);
  await writeFile(fullPath, buffer);

  // Đọc không AI trước (nhanh, không tốn lượt AI). PDF đọc không ra dòng nào thì
  // để bộ đọc AI đọc nền nếu đã cấu hình; không có AI thì vẫn lưu phiếu để gõ tay
  // (như phiếu giao vật tư). Excel / Word không đọc được thì báo lỗi luôn.
  const { docPhieuSonKhongAi } = await import("@/lib/phieuSonTep");
  const kq = await docPhieuSonKhongAi(buffer, file.name, fullPath);
  // PDF đọc ra dòng mà KHÔNG dòng nào có số lượng (lớp chữ lẫn của bản scan, bảng
  // lạ): có bộ đọc AI thì để AI đọc luôn — giữ tạm các dòng đã đọc tới khi AI xong.
  const pdfKhongCoSo = kq.ok && ext === ".pdf" && !kq.dong.some((d) => d.soLuong !== null && d.soLuong > 0);
  let dungAi = false;
  if ((!kq.ok && kq.canAi) || pdfKhongCoSo) {
    const { layCauHinhAi } = await import("@/lib/cauHinhAi");
    dungAi = Boolean(await layCauHinhAi());
  }
  if (!kq.ok && !kq.canAi) {
    await unlink(fullPath).catch(() => undefined);
    return { message: kq.loi };
  }
  // Dòng không có số lượng bỏ tick sẵn (kèm lời nhắc) — không để cả phiếu kẹt ở bước Nhập.
  const dong = kq.ok ? boTickDongThieuSo(ghepDongSon(kq.dong, await sonDeGhep())) : [];
  const ngay = kq.ok ? kq.ngay : null;
  const tep = await prisma.sonPhieuTep.create({
    data: {
      vesselId,
      fileName: file.name.slice(0, 200),
      storedName,
      loaiTep: loaiTepCua(ext),
      size: file.size,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      nguonDoc: dungAi ? "AI" : kq.ok ? kq.nguon : "TAY",
      soPhieu: kq.ok ? kq.soPhieu?.slice(0, 80) ?? null : null,
      nhaCungCap: kq.ok ? kq.nhaCungCap?.slice(0, 200) ?? null : null,
      ngayNhan: ngay ? new Date(`${ngay}T12:00:00`) : null,
      dong,
      ghiChuDoc: kq.ok ? kq.ghiChu : dungAi ? null : kq.loi,
      loiAi: !kq.ok && !dungAi ? t("paint.pgCanAiHoacGoTay") : null,
      aiDangDocTu: dungAi ? new Date() : null,
      aiTienDo: dungAi ? "0" : null,
      nguoiTaiId: actor.id,
      nguoiTai: actor.name,
    },
    select: { id: true },
  });
  await ghiNhatKyNguoiDung(actor, {
    action: "phieu-son-tai-len",
    path: `/paint/${vesselId}/nhan/${tep.id}`,
    vesselId,
    detail: `Tải phiếu giao sơn ${file.name} (${tau.code}, ${dungAi ? "PDF — AI đọc nền" : kq.ok ? `${dong.length} dòng, ${kq.nguon}` : "chưa đọc được — gõ tay"})`,
  });
  if (dungAi) {
    const nguoi = { id: actor.id, email: actor.email, role: actor.role, name: actor.name };
    after(() => chayDocAiSon(tep.id, nguoi));
  }
  revalidatePath(`/paint/${vesselId}`);
  redirect(`/paint/${vesselId}/nhan/${tep.id}`);
}

async function moPhieu(id: number) {
  const { t } = await layT();
  const actor = await requireActiveRole([...VAN_HANH_SON]);
  const tep =
    actor && Number.isInteger(id) && id > 0
      ? await prisma.sonPhieuTep.findUnique({
          where: { id },
          select: { id: true, vesselId: true, fileName: true, storedName: true, loaiTep: true, trangThai: true, aiDangDocTu: true, soPhieu: true, nhaCungCap: true, vessel: { select: { code: true } } },
        })
      : null;
  if (!actor || !tep || !coQuanLySon(actor, tep.vesselId)) return { ok: false, t, loi: t("chung.khongCoQuyen") } as const;
  if (tep.trangThai !== "CHO_XU_LY") return { ok: false, t, loi: t("paint.pgDaNhapRoi") } as const;
  if (dangDocAi(tep.aiDangDocTu)) return { ok: false, t, loi: t("paint.pgAiDangDocChan") } as const;
  return { ok: true, t, actor, tep } as const;
}

export type DauPhieuSon = { soPhieu: string; nhaCungCap: string; ngayNhan: string };

/** Đầu phiếu người dùng sửa: số phiếu, nhà cung cấp, ngày nhận (yyyy-mm-dd từ ô date). */
function docDauSua(x: DauPhieuSon | undefined): { soPhieu: string | null; nhaCungCap: string | null; ngayNhan: Date | null } | null {
  const soPhieu = String(x?.soPhieu ?? "").trim().slice(0, 80) || null;
  const nhaCungCap = String(x?.nhaCungCap ?? "").trim().slice(0, 200) || null;
  const s = String(x?.ngayNhan ?? "").trim();
  if (!s) return { soPhieu, nhaCungCap, ngayNhan: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : { soPhieu, nhaCungCap, ngayNhan: d };
}

// ─── 2. Lưu / đọc lại ────────────────────────────────────────────────────────

export async function luuPhieuSon(id: number, dongSua: unknown, dauSua: DauPhieuSon): Promise<KetQuaPhieuSon> {
  const m = await moPhieu(id);
  if (!m.ok) return { message: m.loi };
  const { t, tep } = m;
  const r = sachDongNhanSon(dongSua);
  if (!r.ok) return { message: t("paint.pgSoSai", { n: r.n }) };
  const dau = docDauSua(dauSua);
  if (!dau) return { message: t("chung.duLieuKhongHopLe") };
  await prisma.sonPhieuTep.update({ where: { id: tep.id }, data: { dong: r.dong, ...dau } });
  revalidatePath(`/paint/${tep.vesselId}/nhan/${tep.id}`);
  return { message: t("paint.pgDaLuu"), success: true };
}

export async function docLaiPhieuSonAi(id: number): Promise<KetQuaPhieuSon> {
  const m = await moPhieu(id);
  if (!m.ok) return { message: m.loi };
  const { t, actor, tep } = m;
  if (tep.loaiTep !== "PDF") return { message: t("chung.duLieuKhongHopLe") };
  const { layCauHinhAi } = await import("@/lib/cauHinhAi");
  if (!(await layCauHinhAi())) return { message: t("paint.pgCanAiHoacGoTay") };
  await prisma.sonPhieuTep.update({ where: { id: tep.id }, data: { aiDangDocTu: new Date(), aiTienDo: "0", loiAi: null } });
  const nguoi = { id: actor.id, email: actor.email, role: actor.role, name: actor.name };
  after(() => chayDocAiSon(tep.id, nguoi));
  revalidatePath(`/paint/${tep.vesselId}/nhan/${tep.id}`);
  return { message: t("paint.pgDangDocLai"), success: true };
}

// ─── 3. Nhập vào tồn sơn ─────────────────────────────────────────────────────

export async function apDungPhieuSon(id: number, dongSua: unknown, dauSua: DauPhieuSon): Promise<KetQuaPhieuSon> {
  const m = await moPhieu(id);
  if (!m.ok) return { message: m.loi };
  const { t, actor, tep } = m;
  const r = sachDongNhanSon(dongSua);
  if (!r.ok) return { message: t("paint.pgSoSai", { n: r.n }) };
  const dau = docDauSua(dauSua);
  if (!dau) return { message: t("chung.duLieuKhongHopLe") };
  if (!r.dong.some((d) => !d.boQua)) return { message: t("paint.pgKhongCoDong") };
  const loi = dongLoiKhiNhap(r.dong);
  if (loi) return { message: loi.lyDo === "thieuSo" ? t("paint.pgDongThieuSo", { n: loi.n }) : t("paint.pgDongThieuTen", { n: loi.n }) };
  // Giữ chỗ: chỉ MỘT lần bấm được đi tiếp.
  const giu = await prisma.sonPhieuTep.updateMany({ where: { id: tep.id, trangThai: "CHO_XU_LY" }, data: { trangThai: "DANG_AP_DUNG", dong: r.dong, ...dau } });
  if (giu.count === 0) return { message: t("paint.pgDaNhapRoi") };
  try {
    const { nhapPhieuSonTx } = await import("@/lib/phieuSonServer");
    const ngay = dau.ngayNhan && dau.ngayNhan <= new Date() ? dau.ngayNhan : new Date();
    const soPhieu = dau.soPhieu ?? tep.fileName;
    const { ghiChuNhapPhieu } = await import("@/lib/tonSonServer");
    // Trạng thái "đã nhập" ghi CÙNG giao dịch với tồn: không bao giờ có cảnh tồn
    // đã cộng mà phiếu vẫn treo "đang nhập" (khi đó không gỡ phiếu được).
    const kq = await prisma.$transaction(
      async (tx) => {
        const k = await nhapPhieuSonTx(tx, {
          vesselId: tep.vesselId,
          dong: r.dong,
          ghiChu: ghiChuNhapPhieu(soPhieu, dau.nhaCungCap),
          ngayNhan: ngay,
          nguoi: actor.name,
          phieuSonId: tep.id,
        });
        await tx.sonPhieuTep.update({ where: { id: tep.id }, data: { trangThai: "DA_AP_DUNG", apDungBoi: actor.name, apDungLuc: new Date(), ketQua: k } });
        return k;
      },
      { timeout: 60000, maxWait: 10000 }
    );
    await ghiNhatKyNguoiDung(actor, {
      action: "phieu-son-nhap",
      path: `/paint/${tep.vesselId}/nhan/${tep.id}`,
      vesselId: tep.vesselId,
      detail: `Nhập phiếu giao sơn ${soPhieu} (${tep.vessel.code}): ${kq.soLoai} loại / ${kq.soDong} dòng, tổng ${kq.tongSoLuong}, tạo mới ${kq.taoMoi} loại sơn`,
    });
    revalidatePath("/paint");
    revalidatePath("/paint/products");
    revalidatePath(`/paint/${tep.vesselId}`);
    revalidatePath(`/paint/${tep.vesselId}/nhan/${tep.id}`);
    return { message: t("paint.pgDaNhap", { loai: kq.soLoai, sl: kq.tongSoLuong, moi: kq.taoMoi }), success: true };
  } catch (e) {
    console.error(`[phieu-son] Nhập #${tep.id} lỗi:`, e);
    await prisma.sonPhieuTep.update({ where: { id: tep.id }, data: { trangThai: "CHO_XU_LY" } }).catch(() => undefined);
    return { message: t("paint.pgLoiNhap", { loi: e instanceof Error ? e.message.slice(0, 200) : String(e) }) };
  }
}

// ─── 4. Xóa (chưa nhập) ──────────────────────────────────────────────────────

export async function xoaPhieuSon(id: number): Promise<KetQuaPhieuSon> {
  const m = await moPhieu(id);
  if (!m.ok) return { message: m.loi };
  const { actor, tep } = m;
  await prisma.sonPhieuTep.delete({ where: { id: tep.id } });
  try {
    await unlink(path.join(getUploadDir(), path.basename(tep.storedName)));
  } catch {
    /* tệp đã không còn */
  }
  await ghiNhatKyNguoiDung(actor, {
    action: "phieu-son-xoa",
    path: `/paint/${tep.vesselId}`,
    vesselId: tep.vesselId,
    detail: `Xóa phiếu giao sơn chưa nhập ${tep.fileName} (#${tep.id}, ${tep.vessel.code})`,
  });
  revalidatePath(`/paint/${tep.vesselId}`);
  redirect(`/paint/${tep.vesselId}`);
}

// ─── 5. Gỡ phiếu đã nhập (nhập nhầm) ─────────────────────────────────────────

/**
 * Hoàn tác một phiếu giao sơn đã nhập: trừ lại đúng số đã nhập theo phiếu, xóa
 * các dòng nhập của phiếu, loại sơn do phiếu tạo mới mà chưa ai dùng thì xóa
 * khỏi danh mục; phiếu trở lại "chờ xử lý" để sửa dòng rồi nhập lại (hoặc xóa).
 * Sơn của phiếu đã dùng / xuất bớt thì không gỡ được — khi đó sửa từng dòng tồn.
 */
export async function goPhieuSon(id: number, lyDo: string): Promise<KetQuaPhieuSon> {
  const { t, ngayGio } = await layT();
  const actor = await requireActiveRole([...VAN_HANH_SON]);
  const tep =
    actor && Number.isInteger(id) && id > 0
      ? await prisma.sonPhieuTep.findUnique({ where: { id }, select: { id: true, vesselId: true, fileName: true, vessel: { select: { code: true } } } })
      : null;
  if (!actor || !tep || !coQuanLySon(actor, tep.vesselId)) return { message: t("chung.khongCoQuyen") };
  const { LoiTonSon, chuLoiTonSon, goPhieuSonTx } = await import("@/lib/tonSonServer");
  const lyDoGon = String(lyDo ?? "").trim().slice(0, 200);
  try {
    const kq = await prisma.$transaction(
      (tx) => goPhieuSonTx(tx, { tepId: tep.id, lyDo: lyDoGon, nguoi: actor.name, luc: ngayGio(new Date()) }),
      { timeout: 60000, maxWait: 10000 }
    );
    await ghiNhatKyNguoiDung(actor, {
      action: "phieu-son-go",
      path: `/paint/${tep.vesselId}/nhan/${tep.id}`,
      vesselId: tep.vesselId,
      detail: `Gỡ phiếu giao sơn đã nhập ${kq.soPhieu} (${tep.vessel.code}): trừ lại ${kq.soLoai} loại / ${kq.soDong} dòng, tổng ${kq.tong}, xóa ${kq.xoaLoai} loại sơn khỏi danh mục; lý do: ${lyDoGon}`,
    });
    revalidatePath("/paint");
    revalidatePath("/paint/products");
    revalidatePath(`/paint/${tep.vesselId}`);
    revalidatePath(`/paint/${tep.vesselId}/bao-cao`);
    revalidatePath(`/paint/${tep.vesselId}/nhan/${tep.id}`);
    return { message: t("paint.pgDaGo", { loai: kq.soLoai, sl: kq.tong, xoa: kq.xoaLoai }), success: true };
  } catch (e) {
    if (e instanceof LoiTonSon) return { message: chuLoiTonSon(e, t) };
    console.error(`[phieu-son] Gỡ #${tep.id} lỗi:`, e);
    return { message: t("paint.pgLoiNhap", { loi: e instanceof Error ? e.message.slice(0, 200) : String(e) }) };
  }
}
