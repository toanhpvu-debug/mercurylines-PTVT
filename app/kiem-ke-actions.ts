"use server";

import path from "path";
import { createHash, randomUUID } from "crypto";
import { readFile, unlink, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageVesselCatalog, requireActiveRole, trongPhamVi, vesselIdWhere, vesselScopeDayDu } from "@/lib/auth";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { VAN_HANH_TAU } from "@/lib/roles";
import { layT } from "@/lib/i18n/server";
import { MAX_UPLOAD_BYTES, ensureUploadDir, fileExtension, getUploadDir } from "@/lib/uploads";
import { dangDocAi } from "@/lib/phieuGiao";
import {
  DUOI_KIEM_KE,
  NGUOI_TAI_KIEM_KE,
  apSuaDong,
  docDongJson,
  dongTuAi,
  dongTuExcel,
  ngayKiemKeTu,
  tauTuTenTep,
  type DongKiemKe,
} from "@/lib/kiemKe";

/*
 * KIỂM KÊ THEO FILE (MLS-11-06) — thuyền viên đếm hàng, điền biểu mẫu kiểm kê
 * (Excel, hoặc giấy rồi scan PDF), tải lên đây:
 *   1. taiFileKiemKe — lưu file, đọc dòng (Excel đọc ngay; PDF để bộ đọc AI
 *      đọc nền). Chưa đụng tới tồn kho.
 *   2. Trang đối chiếu — mỗi dòng ghép với mặt hàng ĐÃ CÓ: tồn hiện tại → số
 *      đếm → chênh lệch; sửa số đọc sai, bỏ dòng, chọn thêm mặt hàng mới.
 *   3. apDungKiemKe — người vận hành kho (Thuyền trưởng / Máy trưởng / quản trị)
 *      bấm áp dụng: tồn của mặt hàng có sẵn được đặt ĐÚNG BẰNG số đếm, kèm giao
 *      dịch điều chỉnh vào thẻ kho; không nhập lại mặt hàng đã có.
 */

export type KetQuaKiemKe = { message: string; success?: boolean };

const TIEN_TO_TEP = "kiem-ke-";

type NguoiThaoTac = { id: number; email: string; role: string; name: string };

/** Ai sửa / đọc lại / xóa được một lần kiểm kê chưa áp dụng: người tải lên, hoặc người quản lý danh mục tàu. */
function duocSua(actor: Parameters<typeof canManageVesselCatalog>[0] & { id: number }, kk: { vesselId: number; nguoiTaiId: number }) {
  return kk.nguoiTaiId === actor.id || canManageVesselCatalog(actor, kk.vesselId);
}

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

/**
 * Đọc bản scan kiểm kê bằng AI ở CHẾ ĐỘ NỀN (after()) — bảng kiểm kê dài
 * hàng chục trang, AI đọc mất vài phút; trang đối chiếu hiện tiến độ và tự
 * làm mới. Mọi đường ra đều gỡ dấu aiDangDocTu.
 */
async function chayDocAiKiemKe(id: number, actor: NguoiThaoTac): Promise<void> {
  const kk = await prisma.kiemKeTep
    .findUnique({ where: { id }, select: { id: true, vesselId: true, storedName: true, fileName: true, vessel: { select: { code: true } } } })
    .catch(() => null);
  if (!kk) return;
  const ketThuc = (data: { loiAi?: string | null; dong?: DongKiemKe[]; ghiChuDoc?: string | null }) =>
    prisma.kiemKeTep.update({ where: { id: kk.id }, data: { ...data, aiDangDocTu: null, aiTienDo: null } }).catch(() => undefined);
  try {
    const { layCauHinhAi } = await import("@/lib/cauHinhAi");
    const cauHinh = await layCauHinhAi();
    if (!cauHinh) {
      await ketThuc({ loiAi: "Chưa cấu hình bộ đọc AI." });
      return;
    }
    const fullPath = path.join(getUploadDir(), path.basename(kk.storedName));
    const buffer = await readFile(fullPath);
    const { docPhieuGiaoBangAi } = await import("@/lib/docPhieuBangAi");
    const { demTrangPdf } = await import("@/lib/pdfChu");
    const bd = Date.now();
    const ai = await docPhieuGiaoBangAi(buffer, cauHinh, {
      banDoc: "kiemKe",
      fileName: kk.fileName,
      soTrang: await demTrangPdf(buffer),
      chuPdf: await chuChoAi(cauHinh.nhaCungCap, buffer, fullPath),
      onTienDo: (xong, tong) => {
        void prisma.kiemKeTep.update({ where: { id: kk.id }, data: { aiTienDo: `${xong}/${tong}` } }).catch(() => undefined);
      },
    });
    const giay = Math.round((Date.now() - bd) / 1000);
    if (!ai.ok) {
      console.error(`[kiem-ke] Bộ đọc AI (${cauHinh.nhaCungCap} · ${cauHinh.model}) lỗi #${kk.id} sau ${giay}s: ${ai.loi}`);
      await ketThuc({ loiAi: ai.loi.slice(0, 500) });
      await ghiNhatKyNguoiDung(actor, {
        action: "kiem-ke-ai-loi",
        path: `/inventory/kiem-ke/${kk.id}`,
        vesselId: kk.vesselId,
        detail: `AI đọc file kiểm kê ${kk.fileName} lỗi sau ${giay}s: ${ai.loi.slice(0, 200)}`,
      });
      return;
    }
    const dong = dongTuAi(ai.dong);
    await ketThuc({
      dong,
      loiAi: ai.canhBaoChung ? ai.canhBaoChung.slice(0, 500) : null,
      ghiChuDoc: `AI (${ai.model}, ${ai.soLuotGoi} lượt, ${giay}s) đọc ${dong.length} dòng — ${dong.filter((d) => d.ton !== null).length} dòng có số tồn, ${ai.soDongCanKiem} dòng cần kiểm${
        ai.tau ? ` · tàu ghi trên biểu mẫu: ${ai.tau}` : ""
      }${ai.ngayGiao ? ` · ngày kiểm kê ghi trên biểu mẫu: ${ai.ngayGiao}` : ""}`.slice(0, 1000),
    });
    await ghiNhatKyNguoiDung(actor, {
      action: "kiem-ke-doc-ai",
      path: `/inventory/kiem-ke/${kk.id}`,
      vesselId: kk.vesselId,
      detail: `AI (${ai.model}, ${giay}s) đọc file kiểm kê ${kk.fileName} (${kk.vessel.code}): ${dong.length} dòng, token ${ai.tokenVao}/${ai.tokenRa}`,
    });
  } catch (e) {
    console.error(`[kiem-ke] Đọc nền #${kk.id} lỗi:`, e);
    await ketThuc({ loiAi: `Lỗi khi đọc file: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500) });
  }
}

// ─── 1. Tải file kiểm kê ─────────────────────────────────────────────────────

export async function taiFileKiemKe(_prev: KetQuaKiemKe, formData: FormData): Promise<KetQuaKiemKe> {
  const { t } = await layT();
  const actor = await requireActiveRole([...NGUOI_TAI_KIEM_KE]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: t("actions.nhap_vuiLongChonFile") };
  const ext = fileExtension(file.name);
  if (!(DUOI_KIEM_KE as readonly string[]).includes(ext)) return { message: t("kiemKe.chiNhanExcelPdf") };
  if (file.size > MAX_UPLOAD_BYTES) return { message: t("actionsModule.nhienLieu_fileVuot20Mb") };

  // Tàu: chọn tay, hoặc nhận theo tên file. Chọn tay mà tên file ghi tàu khác → chặn.
  const scope = vesselScopeDayDu(actor);
  const [tauTrongPhamVi, tatCaTau] = await Promise.all([
    prisma.vessel.findMany({ where: vesselIdWhere(scope), select: { id: true, code: true, name: true } }),
    prisma.vessel.findMany({ select: { id: true, code: true, name: true } }),
  ]);
  const tauTheoTen = tauTuTenTep(file.name, tatCaTau);
  const chonTay = Number(formData.get("vesselId"));
  const tau = Number.isInteger(chonTay) && chonTay > 0 ? tauTrongPhamVi.find((v) => v.id === chonTay) : tauTheoTen && tauTrongPhamVi.find((v) => v.id === tauTheoTen.id);
  if (!tau) return { message: Number.isInteger(chonTay) && chonTay > 0 ? t("actions.danhMuc_chiTauMinhPhuTrach") : t("kiemKe.chonTauHoacTenFile") };
  if (!trongPhamVi(scope, tau.id)) return { message: t("actions.danhMuc_chiTauMinhPhuTrach") };
  if (tauTheoTen && tauTheoTen.id !== tau.id) {
    return { message: t("kiemKe.tenFileKhacTau", { tauFile: `${tauTheoTen.code} ${tauTheoTen.name}`, tau: `${tau.code} ${tau.name}` }) };
  }

  const khoRaw = String(formData.get("khoChon") || "AUTO");
  let khoChon = "AUTO";
  if (khoRaw !== "AUTO") {
    const kho = await prisma.warehouse.findUnique({ where: { id: Number(khoRaw) || -1 }, select: { id: true, vesselId: true } });
    if (!kho || kho.vesselId !== tau.id) return { message: t("actions.kho_khongThuocTauDaChon") };
    khoChon = String(kho.id);
  }
  const ngayKiemKe = ngayKiemKeTu(String(formData.get("ngayKiemKe") || ""));

  const buffer = Buffer.from(await file.arrayBuffer());
  const laPdf = ext === ".pdf";
  let dong: DongKiemKe[] = [];
  let ghiChuDoc: string | null = null;
  if (laPdf) {
    const { layCauHinhAi } = await import("@/lib/cauHinhAi");
    if (!(await layCauHinhAi())) return { message: t("kiemKe.pdfCanBoDocAi") };
  } else {
    const { parseMaterialExcel } = await import("@/lib/materialImport");
    const kq = parseMaterialExcel(buffer);
    if (kq.error) return { message: kq.error };
    dong = dongTuExcel(kq.items);
    const coSo = dong.filter((d) => d.ton !== null).length;
    if (!coSo) return { message: t("kiemKe.fileKhongCoCotTon") };
    const sheets = (kq.sheets ?? []).filter((s) => !s.skipped);
    ghiChuDoc = `Đọc ${dong.length} dòng (${coSo} dòng có số tồn) từ ${sheets.length} sheet: ${sheets.map((s) => `${s.name} (${s.count})`).join(", ")}${
      kq.skippedRows ? ` · bỏ qua ${kq.skippedRows} dòng không phải mặt hàng` : ""
    }${kq.truncated ? " · file quá dài, chỉ đọc 3000 dòng đầu" : ""}`.slice(0, 1000);
  }

  const dir = await ensureUploadDir();
  const storedName = `${TIEN_TO_TEP}${randomUUID()}${ext}`;
  await writeFile(path.join(dir, storedName), buffer);
  const kk = await prisma.kiemKeTep.create({
    data: {
      vesselId: tau.id,
      fileName: file.name.slice(0, 200),
      storedName,
      loaiTep: laPdf ? "PDF" : "EXCEL",
      size: file.size,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      khoChon,
      ngayKiemKe,
      dong,
      ghiChuDoc,
      aiDangDocTu: laPdf ? new Date() : null,
      aiTienDo: laPdf ? "0" : null,
      nguoiTaiId: actor.id,
      nguoiTai: actor.name,
    },
    select: { id: true },
  });
  await ghiNhatKyNguoiDung(actor, {
    action: "kiem-ke-tai-len",
    path: `/inventory/kiem-ke/${kk.id}`,
    vesselId: tau.id,
    detail: `Tải file kiểm kê ${file.name} (${tau.code}, ${laPdf ? "PDF — AI đọc nền" : `Excel, ${dong.length} dòng`})`,
  });
  if (laPdf) {
    const nguoi = { id: actor.id, email: actor.email, role: actor.role, name: actor.name };
    after(() => chayDocAiKiemKe(kk.id, nguoi));
  }
  revalidatePath("/inventory/kiem-ke");
  redirect(`/inventory/kiem-ke/${kk.id}`);
}

async function timKiemKe(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.kiemKeTep.findUnique({
    where: { id },
    select: {
      id: true,
      vesselId: true,
      fileName: true,
      storedName: true,
      loaiTep: true,
      khoChon: true,
      ngayKiemKe: true,
      dong: true,
      trangThai: true,
      aiDangDocTu: true,
      nguoiTaiId: true,
      vessel: { select: { code: true, name: true } },
    },
  });
}

// ─── 2. Lưu chỉnh sửa / đọc lại ──────────────────────────────────────────────

export async function luuKiemKe(id: number, sua: unknown): Promise<KetQuaKiemKe> {
  const { t } = await layT();
  const actor = await requireActiveRole([...NGUOI_TAI_KIEM_KE]);
  const kk = actor ? await timKiemKe(Number(id)) : null;
  if (!actor || !kk || !duocSua(actor, kk)) return { message: t("chung.khongCoQuyen") };
  if (kk.trangThai !== "CHO_DUYET") return { message: t("kiemKe.daApDungRoi") };
  if (dangDocAi(kk.aiDangDocTu)) return { message: t("kiemKe.aiDangDoc2") };
  const r = apSuaDong(docDongJson(kk.dong), sua);
  if (!r.ok) return { message: t("kiemKe.soSai", { n: r.n }) };
  await prisma.kiemKeTep.update({ where: { id: kk.id }, data: { dong: r.dong } });
  revalidatePath(`/inventory/kiem-ke/${kk.id}`);
  return { message: t("kiemKe.daLuu"), success: true };
}

export async function docLaiKiemKe(id: number): Promise<KetQuaKiemKe> {
  const { t } = await layT();
  const actor = await requireActiveRole([...NGUOI_TAI_KIEM_KE]);
  const kk = actor ? await timKiemKe(Number(id)) : null;
  if (!actor || !kk || !duocSua(actor, kk)) return { message: t("chung.khongCoQuyen") };
  if (kk.loaiTep !== "PDF") return { message: t("chung.duLieuKhongHopLe") };
  if (kk.trangThai !== "CHO_DUYET") return { message: t("kiemKe.daApDungRoi") };
  if (dangDocAi(kk.aiDangDocTu)) return { message: t("kiemKe.aiDangDoc2") };
  const { layCauHinhAi } = await import("@/lib/cauHinhAi");
  if (!(await layCauHinhAi())) return { message: t("kiemKe.pdfCanBoDocAi") };
  await prisma.kiemKeTep.update({ where: { id: kk.id }, data: { aiDangDocTu: new Date(), aiTienDo: "0", loiAi: null } });
  const nguoi = { id: actor.id, email: actor.email, role: actor.role, name: actor.name };
  after(() => chayDocAiKiemKe(kk.id, nguoi));
  revalidatePath(`/inventory/kiem-ke/${kk.id}`);
  return { message: t("kiemKe.dangDocLai"), success: true };
}

// ─── 3. Áp dụng ──────────────────────────────────────────────────────────────

export async function apDungKiemKe(id: number, sua: unknown): Promise<KetQuaKiemKe> {
  const { t } = await layT();
  const actor = await requireActiveRole([...VAN_HANH_TAU]);
  const kk = actor ? await timKiemKe(Number(id)) : null;
  if (!actor || !kk || !canManageVesselCatalog(actor, kk.vesselId)) return { message: t("kiemKe.khongCoQuyenApDung") };
  if (kk.trangThai !== "CHO_DUYET") return { message: t("kiemKe.daApDungRoi") };
  if (dangDocAi(kk.aiDangDocTu)) return { message: t("kiemKe.aiDangDoc2") };
  const r = apSuaDong(docDongJson(kk.dong), sua);
  if (!r.ok) return { message: t("kiemKe.soSai", { n: r.n }) };
  const dong = r.dong;

  // Giữ chỗ: chỉ MỘT lần bấm được đi tiếp (bấm hai lần / hai người cùng lúc).
  const giu = await prisma.kiemKeTep.updateMany({ where: { id: kk.id, trangThai: "CHO_DUYET" }, data: { trangThai: "DANG_AP_DUNG", dong } });
  if (giu.count === 0) return { message: t("kiemKe.daApDungRoi") };
  const traLai = () => prisma.kiemKeTep.update({ where: { id: kk.id }, data: { trangThai: "CHO_DUYET" } }).catch(() => undefined);

  try {
    const { lapKeHoachKiemKe, apDungKeHoachKiemKe } = await import("@/lib/kiemKeServer");
    const keHoach = await lapKeHoachKiemKe(kk.vesselId, dong, kk.khoChon);
    const ghiChu = `Kiểm kê theo file ${kk.fileName} (#${kk.id})`;
    const occurredAt = kk.ngayKiemKe > new Date() ? new Date() : kk.ngayKiemKe;

    // Mặt hàng CHƯA CÓ mà người đối chiếu chọn thêm: đi đúng đường nhập danh mục
    // (cùng luật sinh mã, ghép trùng), số đếm thành tồn ban đầu.
    const themMoi = keHoach.dong.filter((k) => k.trangThai === "MOI" && dong[k.i].themMoi && dong[k.i].ton !== null).map((k) => dong[k.i]);
    let taoMoi = 0;
    if (themMoi.length) {
      const kho = await prisma.warehouse.findMany({ where: { vesselId: kk.vesselId }, select: { id: true, code: true } });
      const theoLoai: Partial<Record<"ENG" | "DECK" | "STORE", number>> = {};
      for (const w of kho) {
        if (/-ENG$/i.test(w.code)) theoLoai.ENG ??= w.id;
        else if (/-DECK$/i.test(w.code)) theoLoai.DECK ??= w.id;
        else if (/-STORE$/i.test(w.code)) theoLoai.STORE ??= w.id;
      }
      const { applyMaterialImport } = await import("@/lib/materialImportApply");
      const nhap = await applyMaterialImport({
        vesselId: kk.vesselId,
        warehouseId: kk.khoChon !== "AUTO" ? Number(kk.khoChon) : null,
        warehouseByKind: kk.khoChon === "AUTO" ? theoLoai : null,
        fallbackKind: "STORE",
        items: themMoi.map((d) => ({
          name: d.ten,
          nameEn: d.tenEn,
          impa: d.impa,
          partNumber: d.partNo,
          uom: d.donVi,
          equipment: d.thietBi,
          group: d.nhom,
          minStock: 0,
          rob: d.ton,
          // Bản scan không có sheet: phụ tùng → kho máy như sheet "Spare Parts".
          sheet: d.sheet ?? (d.loai === "SPARE" ? "Spare Parts" : null),
          materialType: d.loai,
        })),
        fileName: kk.fileName,
        actorName: actor.name,
      });
      if (nhap.conflict) {
        await traLai();
        return { message: t("actions.nhap_trungMaDoDongThoi") };
      }
      taoMoi = nhap.createdCount;
    }

    const kq = await prisma.$transaction(
      (tx) => apDungKeHoachKiemKe(tx, { vesselId: kk.vesselId, keHoach, ghiChu, occurredAt, nguoi: actor.name }),
      { timeout: 120_000, maxWait: 10_000 }
    );
    const tong = keHoach.tong;
    const ketQua = {
      thayDoi: kq.soDong,
      tang: kq.tang,
      giam: kq.giam,
      khongDoi: tong.KHONG_DOI,
      themMoi: taoMoi,
      moiKhongThem: tong.MOI - themMoi.length,
      khongSo: tong.KHONG_SO,
      boQua: tong.BO_QUA,
      gop: tong.GOP,
      khongKho: tong.KHONG_KHO,
    };
    await prisma.kiemKeTep.update({
      where: { id: kk.id },
      data: { trangThai: "DA_AP_DUNG", apDungBoi: actor.name, apDungLuc: new Date(), ketQua },
    });
    await ghiNhatKyNguoiDung(actor, {
      action: "kiem-ke-ap-dung",
      path: `/inventory/kiem-ke/${kk.id}`,
      vesselId: kk.vesselId,
      detail: `Áp dụng kiểm kê ${kk.fileName} (${kk.vessel.code}): ${kq.soDong} mặt hàng đổi tồn (${kq.tang} tăng, ${kq.giam} giảm), ${tong.KHONG_DOI} không đổi, ${taoMoi} thêm mới, ${ketQua.moiKhongThem} chưa có trong danh mục không thêm`,
    });
    revalidatePath("/inventory");
    revalidatePath("/inventory/kiem-ke");
    revalidatePath(`/inventory/kiem-ke/${kk.id}`);
    revalidatePath("/dashboard");
    return { message: t("kiemKe.daApDung", { doi: kq.soDong, tang: kq.tang, giam: kq.giam, moi: taoMoi }), success: true };
  } catch (e) {
    console.error(`[kiem-ke] Áp dụng #${kk.id} lỗi:`, e);
    await traLai();
    return { message: t("kiemKe.loiApDung", { loi: e instanceof Error ? e.message.slice(0, 200) : String(e) }) };
  }
}

// ─── 4. Xóa (chưa áp dụng) ───────────────────────────────────────────────────

export async function xoaKiemKe(id: number): Promise<KetQuaKiemKe> {
  const { t } = await layT();
  const actor = await requireActiveRole([...NGUOI_TAI_KIEM_KE]);
  const kk = actor ? await timKiemKe(Number(id)) : null;
  if (!actor || !kk || !duocSua(actor, kk)) return { message: t("chung.khongCoQuyen") };
  if (kk.trangThai !== "CHO_DUYET") return { message: t("kiemKe.daApDungRoi") };
  await prisma.kiemKeTep.delete({ where: { id: kk.id } });
  try {
    await unlink(path.join(getUploadDir(), path.basename(kk.storedName)));
  } catch {
    /* tệp đã không còn */
  }
  await ghiNhatKyNguoiDung(actor, {
    action: "kiem-ke-xoa",
    path: "/inventory/kiem-ke",
    vesselId: kk.vesselId,
    detail: `Xóa file kiểm kê chưa áp dụng ${kk.fileName} (#${kk.id}, ${kk.vessel.code})`,
  });
  revalidatePath("/inventory/kiem-ke");
  return { message: t("kiemKe.daXoa"), success: true };
}
