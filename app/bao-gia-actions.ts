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
import { LAP_DON_MUA, QUAN_LY_NCC } from "@/lib/donMuaQuyTrinh";
import { sinhSoDonMua } from "@/lib/soDonMua";
import { DUOI_BAO_GIA, ghepVaoDonMua, ngayTuDdMm, sachDongBaoGiaNhap, type DongBaoGia } from "@/lib/baoGia";

/*
 * BÁO GIÁ NHÀ CUNG CẤP → ĐƠN MUA.
 *   1. taiBaoGia: Word / Excel đọc ngay; PDF (số hoặc scan) để bộ đọc AI đọc
 *      nền (chưa có AI thì thử lớp chữ PDF).
 *   2. Trang báo giá: sửa đầu báo giá + từng dòng (mô tả, Part No., ĐVT, số
 *      lượng, đơn giá) — luuBaoGia.
 *   3. apDungVaoPo: áp đơn giá vào PO NHÁP có sẵn (ghép dòng theo Part No. / mô
 *      tả), thêm dòng chưa có nếu chọn; hoặc taoPoTuBaoGia: tạo PO nháp mới.
 * Sau đó đơn đi tiếp quy trình duyệt (app/don-mua-actions.ts).
 */

export type KetQuaBaoGia = { message: string; success?: boolean };

const TIEN_TO_TEP = "bao-gia-";
type NguoiThaoTac = { id: number; email: string; role: string; name: string };

const chuanTen = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(co|company|ltd|limited|jsc|joint|stock|corp|corporation|inc|pte|cong ty|tnhh|cp)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");

/** Nhà cung cấp có sẵn trùng tên đọc được trên báo giá (bỏ đuôi Co., Ltd / JSC...). */
async function timNccTheoTen(ten: string | null): Promise<number | null> {
  const k = chuanTen(ten);
  if (k.length < 3) return null;
  const ds = await prisma.supplier.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const trung = ds.filter((s) => {
    const n = chuanTen(s.name);
    return n.length >= 3 && (n === k || n.includes(k) || k.includes(n));
  });
  return trung.length === 1 ? trung[0].id : null;
}

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

/** Bộ đọc AI đọc báo giá PDF ở chế độ nền; mọi đường ra gỡ dấu aiDangDocTu. */
async function chayDocAiBaoGia(id: number, actor: NguoiThaoTac): Promise<void> {
  const bg = await prisma.baoGiaNcc.findUnique({ where: { id }, select: { id: true, vesselId: true, storedName: true, fileName: true, supplierId: true } }).catch(() => null);
  if (!bg) return;
  const ketThuc = (data: Record<string, unknown>) =>
    prisma.baoGiaNcc.update({ where: { id: bg.id }, data: { ...data, aiDangDocTu: null, aiTienDo: null } }).catch(() => undefined);
  try {
    const { layCauHinhAi } = await import("@/lib/cauHinhAi");
    const cauHinh = await layCauHinhAi();
    if (!cauHinh) {
      await ketThuc({ loiAi: "Chưa cấu hình bộ đọc AI." });
      return;
    }
    const fullPath = path.join(getUploadDir(), path.basename(bg.storedName));
    const buffer = await readFile(fullPath);
    const { docPhieuGiaoBangAi } = await import("@/lib/docPhieuBangAi");
    const { demTrangPdf } = await import("@/lib/pdfChu");
    const bd = Date.now();
    const ai = await docPhieuGiaoBangAi(buffer, cauHinh, {
      banDoc: "baoGia",
      fileName: bg.fileName,
      soTrang: await demTrangPdf(buffer),
      chuPdf: await chuChoAi(cauHinh.nhaCungCap, buffer, fullPath),
      onTienDo: (xong, tong) => {
        void prisma.baoGiaNcc.update({ where: { id: bg.id }, data: { aiTienDo: `${xong}/${tong}` } }).catch(() => undefined);
      },
    });
    const giay = Math.round((Date.now() - bd) / 1000);
    if (!ai.ok) {
      console.error(`[bao-gia] Bộ đọc AI lỗi #${bg.id} sau ${giay}s: ${ai.loi}`);
      await ketThuc({ loiAi: ai.loi.slice(0, 500) });
      return;
    }
    const dong: DongBaoGia[] = ai.dong.map((d) => ({
      moTa: d.ten.slice(0, 300),
      tenEn: d.tenEn,
      partNo: d.partNo,
      impa: d.impa,
      donVi: d.donVi,
      soLuong: d.soLuongTrong ? null : d.soLuong,
      donGia: d.donGia ?? null,
      ghiChu: null,
      canhBao: d.canhBao,
      trang: d.trang,
      boQua: false,
    }));
    await ketThuc({
      dong,
      loiAi: ai.canhBaoChung ? ai.canhBaoChung.slice(0, 500) : null,
      nhaCungCapDoc: ai.nhaCungCap?.slice(0, 200) ?? null,
      soBaoGia: ai.soPhieu?.slice(0, 80) ?? null,
      ngayBaoGia: ngayTuDdMm(ai.ngayGiao),
      tienTe: ai.tienTe?.slice(0, 8) ?? null,
      supplierId: bg.supplierId ?? (await timNccTheoTen(ai.nhaCungCap)),
      ghiChuDoc: `AI (${ai.model}, ${ai.soLuotGoi} lượt, ${giay}s) đọc ${dong.length} dòng, ${ai.soDongCanKiem} dòng cần kiểm.`,
    });
    await ghiNhatKyNguoiDung(actor, {
      action: "bao-gia-doc-ai",
      path: `/purchasing/bao-gia/${bg.id}`,
      vesselId: bg.vesselId,
      detail: `AI đọc báo giá ${bg.fileName}: ${dong.length} dòng, ${giay}s, token ${ai.tokenVao}/${ai.tokenRa}`,
    });
  } catch (e) {
    console.error(`[bao-gia] Đọc nền #${bg.id} lỗi:`, e);
    await ketThuc({ loiAi: `Lỗi khi đọc file: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500) });
  }
}

// ─── 1. Tải báo giá ──────────────────────────────────────────────────────────

export async function taiBaoGia(_prev: KetQuaBaoGia, formData: FormData): Promise<KetQuaBaoGia> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAP_DON_MUA]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const vesselId = Number(formData.get("vesselId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) return { message: t("actions.vuiLongChonTau") };
  if (!trongPhamVi(vesselScopeDayDu(actor), vesselId)) return { message: t("chung.khongCoQuyen") };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: t("actions.nhap_vuiLongChonFile") };
  const ext = fileExtension(file.name);
  if (!(DUOI_BAO_GIA as readonly string[]).includes(ext)) return { message: t("purchasing.baoGiaSaiDinhDang") };
  if (file.size > MAX_UPLOAD_BYTES) return { message: t("actionsModule.nhienLieu_fileVuot20Mb") };
  // PO gắn kèm (tùy chọn): phải là PO NHÁP của đúng tàu.
  const poId = Number(formData.get("poId")) || null;
  if (poId) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, select: { vesselId: true, status: true } });
    if (!po || po.vesselId !== vesselId || po.status !== "DRAFT") return { message: t("purchasing.poKhongPhaiNhap") };
  }
  const nccChon = Number(formData.get("supplierId")) || null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const laPdf = ext === ".pdf";
  const { layCauHinhAi } = await import("@/lib/cauHinhAi");
  const coAi = laPdf && (await layCauHinhAi()) !== null;
  let dong: DongBaoGia[] = [];
  let dau: { nhaCungCap: string | null; soBaoGia: string | null; ngayBaoGia: string | null; tienTe: string | null } = { nhaCungCap: null, soBaoGia: null, ngayBaoGia: null, tienTe: null };
  let ghiChuDoc: string | null = null;
  if (!coAi) {
    const { docBaoGiaKhongAi } = await import("@/lib/baoGiaTep");
    const kq = await docBaoGiaKhongAi(buffer, file.name);
    if (!kq.ok) return { message: laPdf ? `${kq.loi} ${t("purchasing.baoGiaPdfCanAi")}` : kq.loi };
    dong = kq.dong;
    dau = kq.dau;
    ghiChuDoc = kq.ghiChu;
  }

  const storedName = `${TIEN_TO_TEP}${randomUUID()}${ext}`;
  await writeFile(path.join(await ensureUploadDir(), storedName), buffer);
  const bg = await prisma.baoGiaNcc.create({
    data: {
      vesselId,
      supplierId: nccChon ?? (await timNccTheoTen(dau.nhaCungCap)),
      poId,
      fileName: file.name.slice(0, 200),
      storedName,
      loaiTep: laPdf ? "PDF" : [".docx", ".doc"].includes(ext) ? "WORD" : "EXCEL",
      size: file.size,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      nhaCungCapDoc: dau.nhaCungCap?.slice(0, 200) ?? null,
      soBaoGia: dau.soBaoGia?.slice(0, 80) ?? null,
      ngayBaoGia: ngayTuDdMm(dau.ngayBaoGia),
      tienTe: dau.tienTe,
      dong,
      ghiChuDoc,
      aiDangDocTu: coAi ? new Date() : null,
      aiTienDo: coAi ? "0" : null,
      nguoiTaiId: actor.id,
      nguoiTai: actor.name,
    },
    select: { id: true },
  });
  await ghiNhatKyNguoiDung(actor, {
    action: "bao-gia-tai-len",
    path: `/purchasing/bao-gia/${bg.id}`,
    vesselId,
    detail: `Tải báo giá ${file.name}${coAi ? " (AI đọc nền)" : `: ${dong.length} dòng`}${poId ? ` cho PO #${poId}` : ""}`,
  });
  if (coAi) {
    const nguoi = { id: actor.id, email: actor.email, role: actor.role, name: actor.name };
    after(() => chayDocAiBaoGia(bg.id, nguoi));
  }
  revalidatePath("/purchasing/bao-gia");
  redirect(`/purchasing/bao-gia/${bg.id}`);
}

// ─── 2. Lưu chỉnh sửa ────────────────────────────────────────────────────────

export type LuuBaoGiaNhap = {
  supplierId: number | null;
  poId: number | null;
  soBaoGia: string;
  ngayBaoGia: string;
  tienTe: string;
  chietKhau: string | number;
  phiVanChuyen: string | number;
  phiGiaoHang: string | number;
  dong: unknown[];
};

async function timBaoGia(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.baoGiaNcc.findUnique({ where: { id }, include: { vessel: { select: { code: true, name: true } } } });
}

type HamT = Awaited<ReturnType<typeof layT>>["t"];

async function kiemVaLuu(id: number, x: LuuBaoGiaNhap) {
  const bg = await timBaoGia(id);
  if (!bg) return { loi: "khongThay" as const };
  if (bg.trangThai !== "CHO_XU_LY") return { loi: "daXuLy" as const };
  if (dangDocAi(bg.aiDangDocTu)) return { loi: "dangDoc" as const };
  const sach = sachDongBaoGiaNhap(x?.dong);
  if (!sach.ok) return { loi: "soSai" as const, n: sach.n };
  const soTien = (v: unknown) => {
    const s = String(v ?? "").trim().replace(",", ".");
    const n = s ? Number(s) : 0;
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };
  const chietKhau = soTien(x.chietKhau);
  const phiVc = soTien(x.phiVanChuyen);
  const phiGh = soTien(x.phiGiaoHang);
  if ([chietKhau, phiVc, phiGh].some(Number.isNaN) || chietKhau > 100) return { loi: "dauSai" as const };
  const supplierId = x.supplierId ? ((await prisma.supplier.findUnique({ where: { id: Number(x.supplierId) }, select: { id: true } }))?.id ?? null) : null;
  let poId: number | null = null;
  if (x.poId) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: Number(x.poId) }, select: { id: true, vesselId: true, status: true } });
    if (!po || po.vesselId !== bg.vesselId || po.status !== "DRAFT") return { loi: "poKhongNhap" as const };
    poId = po.id;
  }
  const capNhat = await prisma.baoGiaNcc.update({
    where: { id: bg.id },
    data: {
      supplierId,
      poId,
      soBaoGia: String(x.soBaoGia ?? "").trim().slice(0, 80) || null,
      ngayBaoGia: /^\d{4}-\d{2}-\d{2}$/.test(String(x.ngayBaoGia ?? "")) ? new Date(`${x.ngayBaoGia}T12:00:00`) : null,
      tienTe: String(x.tienTe ?? "").trim().toUpperCase().slice(0, 8) || null,
      chietKhau,
      phiVanChuyen: phiVc,
      phiGiaoHang: phiGh,
      dong: sach.dong,
    },
    include: { vessel: { select: { code: true, name: true } } },
  });
  return { bg: capNhat, dong: sach.dong };
}

function loiLuu(t: HamT, r: { loi: string; n?: number }): string {
  switch (r.loi) {
    case "daXuLy":
      return t("purchasing.baoGiaDaXuLy");
    case "dangDoc":
      return t("purchasing.baoGiaDangDoc");
    case "soSai":
      return t("purchasing.dongSoSai", { n: r.n ?? 0 });
    case "dauSai":
      return t("purchasing.soDauDonSai");
    case "poKhongNhap":
      return t("purchasing.poKhongPhaiNhap");
    default:
      return t("chung.duLieuKhongHopLe");
  }
}

export async function luuBaoGia(id: number, x: LuuBaoGiaNhap): Promise<KetQuaBaoGia> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAP_DON_MUA]);
  const bg0 = actor ? await timBaoGia(Number(id)) : null;
  if (!actor || !bg0 || !trongPhamVi(vesselScopeDayDu(actor), bg0.vesselId)) return { message: t("chung.khongCoQuyen") };
  const r = await kiemVaLuu(bg0.id, x);
  if (r.loi) return { message: loiLuu(t, r) };
  revalidatePath(`/purchasing/bao-gia/${bg0.id}`);
  return { message: t("purchasing.daLuuBaoGia"), success: true };
}

// ─── 3. Áp vào PO có sẵn / tạo PO mới ────────────────────────────────────────

/**
 * Áp báo giá vào PO NHÁP đã gắn: dòng ghép được → cập nhật đơn giá (và số
 * lượng nếu chọn, trừ dòng lấy từ yêu cầu vật tư); dòng báo giá chưa có trong
 * PO → thêm vào nếu chọn. Đầu PO: nhà cung cấp, tiền tệ, Y/ref = số báo giá,
 * chiết khấu, phí.
 */
export async function apDungVaoPo(id: number, x: LuuBaoGiaNhap, tuyChon: { themDongMoi: boolean; capNhatSoLuong: boolean }): Promise<KetQuaBaoGia> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAP_DON_MUA]);
  const bg0 = actor ? await timBaoGia(Number(id)) : null;
  if (!actor || !bg0 || !trongPhamVi(vesselScopeDayDu(actor), bg0.vesselId)) return { message: t("chung.khongCoQuyen") };
  const r = await kiemVaLuu(bg0.id, x);
  if (r.loi) return { message: loiLuu(t, r) };
  const { bg, dong } = r;
  if (!bg.poId) return { message: t("purchasing.baoGiaChuaGanPo") };
  if (!bg.supplierId) return { message: t("purchasing.chonNccHopLe") };
  const po = await prisma.purchaseOrder.findUnique({ where: { id: bg.poId }, include: { items: { select: { id: true, description: true, partNo: true, requestItemId: true } } } });
  if (!po || po.status !== "DRAFT") return { message: t("purchasing.poKhongPhaiNhap") };
  const dung = dong.filter((d) => !d.boQua);
  const ghep = ghepVaoDonMua(dung, po.items);
  let capNhat = 0;
  let them = 0;
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < dung.length; i++) {
      const d = dung[i];
      const itemId = ghep[i];
      if (itemId) {
        const it = po.items.find((x2) => x2.id === itemId)!;
        await tx.purchaseOrderItem.update({
          where: { id: itemId },
          data: {
            ...(d.donGia !== null ? { unitPrice: d.donGia } : {}),
            ...(tuyChon.capNhatSoLuong && !it.requestItemId && d.soLuong ? { quantity: d.soLuong } : {}),
            ...(d.partNo && !it.partNo ? { partNo: d.partNo } : {}),
          },
        });
        capNhat++;
      } else if (tuyChon.themDongMoi && d.soLuong) {
        await tx.purchaseOrderItem.create({
          data: { poId: po.id, description: d.moTa, partNo: d.partNo ?? d.impa, uom: d.donVi, quantity: d.soLuong, unitPrice: d.donGia ?? 0 },
        });
        them++;
      }
    }
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        supplierId: bg.supplierId!,
        ...(bg.tienTe ? { currency: bg.tienTe } : {}),
        supplierRef: bg.soBaoGia ?? po.supplierRef,
        discountPercent: bg.chietKhau,
        transportFee: bg.phiVanChuyen,
        deliveryFee: bg.phiGiaoHang,
      },
    });
    await tx.baoGiaNcc.update({ where: { id: bg.id }, data: { trangThai: "DA_AP_DUNG", apDungBoi: actor.name, apDungLuc: new Date() } });
  });
  await ghiNhatKyNguoiDung(actor, {
    action: "bao-gia-ap-dung",
    path: `/purchasing/${po.id}`,
    vesselId: po.vesselId,
    detail: `Áp báo giá ${bg.soBaoGia ?? bg.fileName} vào ${po.poNo}: ${capNhat} dòng cập nhật giá, ${them} dòng thêm`,
  });
  revalidatePath(`/purchasing/${po.id}`);
  revalidatePath("/purchasing");
  redirect(`/purchasing/${po.id}?baoGia=${capNhat}-${them}`);
}

/** Tạo PO NHÁP mới từ báo giá (mọi dòng không bỏ qua, có số lượng). */
export async function taoPoTuBaoGia(id: number, x: LuuBaoGiaNhap): Promise<KetQuaBaoGia> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAP_DON_MUA]);
  const bg0 = actor ? await timBaoGia(Number(id)) : null;
  if (!actor || !bg0 || !trongPhamVi(vesselScopeDayDu(actor), bg0.vesselId)) return { message: t("chung.khongCoQuyen") };
  const r = await kiemVaLuu(bg0.id, { ...x, poId: null });
  if (r.loi) return { message: loiLuu(t, r) };
  const { bg, dong } = r;
  if (!bg.supplierId) return { message: t("purchasing.chonNccHopLe") };
  const dung = dong.filter((d) => !d.boQua && d.soLuong && d.soLuong > 0);
  if (!dung.length) return { message: t("purchasing.donCanItNhatMotDong") };
  // Ghép mặt hàng trong danh mục tàu theo Part No. / IMPA (để nhận hàng vào kho được).
  const lienKet = await prisma.vesselMaterial.findMany({ where: { vesselId: bg.vesselId }, select: { material: { select: { id: true, partNumber: true, impa: true } } } });
  const chuan = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const theoMa = new Map<string, number>();
  for (const { material: m } of lienKet) {
    for (const ma of [m.partNumber, m.impa]) {
      const k = chuan(ma);
      if (k.length >= 3 && !theoMa.has(k)) theoMa.set(k, m.id);
    }
  }
  const po = await prisma.$transaction(async (tx) => {
    const poNo = await sinhSoDonMua(tx, bg.vesselId);
    const moi = await tx.purchaseOrder.create({
      data: {
        poNo,
        supplierId: bg.supplierId!,
        vesselId: bg.vesselId,
        status: "DRAFT",
        currency: bg.tienTe || "USD",
        subject: bg.soBaoGia ? `Theo báo giá ${bg.soBaoGia}` : null,
        supplierRef: bg.soBaoGia,
        discountPercent: bg.chietKhau,
        transportFee: bg.phiVanChuyen,
        deliveryFee: bg.phiGiaoHang,
        createdBy: `${actor.name} (KT-VT)`,
        items: {
          create: dung.map((d) => ({
            description: d.moTa,
            partNo: d.partNo ?? d.impa,
            uom: d.donVi,
            quantity: d.soLuong as number,
            unitPrice: d.donGia ?? 0,
            materialId: theoMa.get(chuan(d.partNo)) ?? theoMa.get(chuan(d.impa)) ?? null,
          })),
        },
      },
      select: { id: true, poNo: true },
    });
    await tx.baoGiaNcc.update({ where: { id: bg.id }, data: { poId: moi.id, trangThai: "DA_AP_DUNG", apDungBoi: actor.name, apDungLuc: new Date() } });
    return moi;
  });
  await ghiNhatKyNguoiDung(actor, {
    action: "bao-gia-tao-po",
    path: `/purchasing/${po.id}`,
    vesselId: bg.vesselId,
    detail: `Tạo ${po.poNo} từ báo giá ${bg.soBaoGia ?? bg.fileName}: ${dung.length} dòng`,
  });
  revalidatePath("/purchasing");
  redirect(`/purchasing/${po.id}`);
}

/** Thêm nhanh nhà cung cấp từ tên đọc được trên báo giá (quản trị). */
export async function taoNccTuBaoGia(id: number, tenRaw: string): Promise<KetQuaBaoGia & { supplierId?: number }> {
  const { t } = await layT();
  const actor = await requireActiveRole([...QUAN_LY_NCC]);
  const bg = actor ? await timBaoGia(Number(id)) : null;
  if (!actor || !bg) return { message: t("chung.khongCoQuyen") };
  const ten = String(tenRaw ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (ten.length < 3) return { message: t("chung.duLieuKhongHopLe") };
  const goc =
    ten
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/\b(CO|COMPANY|LTD|LIMITED|JSC|JOINT|STOCK|CORP|INC|PTE|CONG TY|TNHH)\b/g, "")
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 8) || "NCC";
  let code = goc;
  for (let n = 2; await prisma.supplier.findUnique({ where: { code } }); n++) code = `${goc}${n}`;
  const ncc = await prisma.supplier.create({ data: { code, name: ten }, select: { id: true } });
  await prisma.baoGiaNcc.update({ where: { id: bg.id }, data: { supplierId: ncc.id } });
  await ghiNhatKyNguoiDung(actor, { action: "ncc-them-tu-bao-gia", path: `/purchasing/bao-gia/${bg.id}`, vesselId: bg.vesselId, detail: `Thêm nhà cung cấp ${code} — ${ten} từ báo giá` });
  revalidatePath(`/purchasing/bao-gia/${bg.id}`);
  return { message: t("purchasing.daThemNcc", { ma: code }), success: true, supplierId: ncc.id };
}

export async function docLaiBaoGiaAi(id: number): Promise<KetQuaBaoGia> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAP_DON_MUA]);
  const bg = actor ? await timBaoGia(Number(id)) : null;
  if (!actor || !bg || !trongPhamVi(vesselScopeDayDu(actor), bg.vesselId)) return { message: t("chung.khongCoQuyen") };
  if (bg.loaiTep !== "PDF" || bg.trangThai !== "CHO_XU_LY") return { message: t("chung.duLieuKhongHopLe") };
  if (dangDocAi(bg.aiDangDocTu)) return { message: t("purchasing.baoGiaDangDoc") };
  const { layCauHinhAi } = await import("@/lib/cauHinhAi");
  if (!(await layCauHinhAi())) return { message: t("purchasing.baoGiaPdfCanAi") };
  await prisma.baoGiaNcc.update({ where: { id: bg.id }, data: { aiDangDocTu: new Date(), aiTienDo: "0", loiAi: null } });
  const nguoi = { id: actor.id, email: actor.email, role: actor.role, name: actor.name };
  after(() => chayDocAiBaoGia(bg.id, nguoi));
  revalidatePath(`/purchasing/bao-gia/${bg.id}`);
  return { message: t("purchasing.baoGiaDangDoc"), success: true };
}

export async function xoaBaoGia(id: number): Promise<KetQuaBaoGia> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAP_DON_MUA]);
  const bg = actor ? await timBaoGia(Number(id)) : null;
  if (!actor || !bg || !trongPhamVi(vesselScopeDayDu(actor), bg.vesselId)) return { message: t("chung.khongCoQuyen") };
  if (bg.trangThai !== "CHO_XU_LY") return { message: t("purchasing.baoGiaDaXuLy") };
  await prisma.baoGiaNcc.delete({ where: { id: bg.id } });
  await unlink(path.join(getUploadDir(), path.basename(bg.storedName))).catch(() => undefined);
  await ghiNhatKyNguoiDung(actor, { action: "bao-gia-xoa", path: "/purchasing/bao-gia", vesselId: bg.vesselId, detail: `Xóa báo giá chưa xử lý ${bg.fileName}` });
  revalidatePath("/purchasing/bao-gia");
  return { message: t("purchasing.daXoaBaoGia"), success: true };
}
