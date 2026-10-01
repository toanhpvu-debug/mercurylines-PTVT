"use server";

import path from "path";
import { createHash, randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireActiveRole, trongPhamVi, vesselScopeDayDu } from "@/lib/auth";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import { docSo } from "@/lib/docSo";
import { MAX_UPLOAD_BYTES, ensureUploadDir, fileExtension } from "@/lib/uploads";
import { LAP_DON_MUA, VAI_TRO_DUYET_PO, duocDuyet, laNhap, tenNguoiDuyet } from "@/lib/donMuaQuyTrinh";
import { coLanhDaoDuyetPo, ghiLichSuDuyet, nguoiTrinhId, phamViDonMua } from "@/lib/duyetPoServer";

/*
 * QUY TRÌNH ĐƠN MUA: sửa đơn nháp → trình duyệt → lãnh đạo phòng Kỹ thuật –
 * Vật tư duyệt / trả lại → (gửi nhà cung cấp: app/actions.ts) → nhà cung cấp
 * xác nhận. Bảng chuyển trạng thái và luật duyệt: lib/donMuaQuyTrinh.ts.
 */

export type KetQuaDonMua = { message: string; success?: boolean };

async function timDon(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: { select: { id: true, requestItemId: true, quantity: true, quantityReceived: true } }, vessel: { select: { code: true } } },
  });
}

const soNhap = (v: unknown): number => (typeof v === "number" ? v : docSo(String(v ?? "").trim() || "0"));

export type SuaDonMuaNhap = {
  supplierId: number;
  currency: string;
  subject: string;
  supplierRef: string;
  expectedDate: string;
  notes: string;
  discountPercent: string | number;
  transportFee: string | number;
  deliveryFee: string | number;
  items: { id?: number; description: string; partNo: string; uom: string; quantity: string | number; unitPrice: string | number }[];
};

/**
 * Sửa đơn NHÁP: đầu đơn (nhà cung cấp, tiền tệ, tiêu đề, Y/ref, ngày giao dự
 * kiến, ghi chú, chiết khấu, phí) và các dòng (mô tả, Part No., ĐVT, số lượng,
 * đơn giá; thêm / xóa dòng). Dòng lấy từ yêu cầu vật tư giữ nguyên số lượng đã
 * duyệt cho mua — chỉ sửa được mô tả / mã / đơn giá, hoặc bỏ hẳn khỏi đơn.
 */
export async function suaDonMua(poIdRaw: number, x: SuaDonMuaNhap): Promise<KetQuaDonMua> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAP_DON_MUA]);
  const po = actor ? await timDon(Number(poIdRaw)) : null;
  if (!actor || !po || !trongPhamVi(vesselScopeDayDu(actor), po.vesselId)) return { message: t("chung.khongCoQuyen") };
  if (!laNhap(po.status)) return { message: t("purchasing.chiSuaKhiNhap") };
  const ncc = await prisma.supplier.findUnique({ where: { id: Number(x?.supplierId) || -1 }, select: { id: true, isActive: true } });
  if (!ncc || !ncc.isActive) return { message: t("purchasing.chonNccHopLe") };
  const chietKhau = soNhap(x.discountPercent);
  const phiVc = soNhap(x.transportFee);
  const phiGh = soNhap(x.deliveryFee);
  if (![chietKhau, phiVc, phiGh].every((n) => Number.isFinite(n) && n >= 0) || chietKhau > 100) return { message: t("purchasing.soDauDonSai") };
  const dsNhap = Array.isArray(x.items) ? x.items.slice(0, 300) : [];
  const theoId = new Map(po.items.map((it) => [it.id, it]));
  const dong: { id: number | null; description: string; partNo: string | null; uom: string; quantity: number; unitPrice: number }[] = [];
  for (let i = 0; i < dsNhap.length; i++) {
    const d = dsNhap[i];
    const description = String(d.description ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
    if (!description) continue;
    const cu = d.id ? theoId.get(Number(d.id)) : undefined;
    if (d.id && !cu) return { message: t("chung.duLieuKhongHopLe") };
    const quantity = cu?.requestItemId ? cu.quantity : soNhap(d.quantity);
    const unitPrice = soNhap(d.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return { message: t("purchasing.dongSoSai", { n: i + 1 }) };
    dong.push({
      id: cu ? cu.id : null,
      description,
      partNo: String(d.partNo ?? "").trim().slice(0, 80) || null,
      uom: (String(d.uom ?? "").trim() || "PCS").toUpperCase().slice(0, 20),
      quantity: Math.round(quantity * 1000) / 1000,
      unitPrice: Math.round(unitPrice * 10000) / 10000,
    });
  }
  if (!dong.length) return { message: t("purchasing.donCanItNhatMotDong") };
  const giuLai = new Set(dong.filter((d) => d.id !== null).map((d) => d.id as number));
  const ngayGiao = /^\d{4}-\d{2}-\d{2}$/.test(String(x.expectedDate ?? "")) ? new Date(`${x.expectedDate}T12:00:00`) : null;

  await prisma.$transaction(async (tx) => {
    // Đơn có thể vừa được trình / hủy ở tab khác — chỉ ghi khi vẫn là nháp.
    const giu = await tx.purchaseOrder.updateMany({
      where: { id: po.id, status: "DRAFT" },
      data: {
        supplierId: ncc.id,
        currency: String(x.currency ?? "").trim().toUpperCase().slice(0, 8) || "USD",
        subject: String(x.subject ?? "").trim().slice(0, 200) || null,
        supplierRef: String(x.supplierRef ?? "").trim().slice(0, 120) || null,
        expectedDate: ngayGiao,
        notes: String(x.notes ?? "").trim().slice(0, 1000) || null,
        discountPercent: chietKhau,
        transportFee: phiVc,
        deliveryFee: phiGh,
      },
    });
    if (giu.count === 0) throw new Error("KHONG_CON_NHAP");
    await tx.purchaseOrderItem.deleteMany({ where: { poId: po.id, id: { notIn: [...giuLai] }, quantityReceived: 0 } });
    for (const d of dong) {
      const du = { description: d.description, partNo: d.partNo, uom: d.uom, quantity: d.quantity, unitPrice: d.unitPrice };
      if (d.id) await tx.purchaseOrderItem.update({ where: { id: d.id }, data: du });
      else await tx.purchaseOrderItem.create({ data: { poId: po.id, ...du } });
    }
  }).catch((e) => {
    if (e instanceof Error && e.message === "KHONG_CON_NHAP") return "KHONG_CON_NHAP";
    throw e;
  });
  const sau = await prisma.purchaseOrder.findUnique({ where: { id: po.id }, select: { status: true } });
  if (sau?.status !== "DRAFT") return { message: t("purchasing.chiSuaKhiNhap") };
  await ghiNhatKyNguoiDung(actor, {
    action: "don-mua-sua",
    path: `/purchasing/${po.id}`,
    vesselId: po.vesselId,
    detail: `Sửa đơn mua ${po.poNo}: ${dong.length} dòng (bỏ ${po.items.length - giuLai.size}, thêm ${dong.filter((d) => !d.id).length})`,
  });
  revalidatePath(`/purchasing/${po.id}`);
  revalidatePath("/purchasing");
  return { message: t("purchasing.daLuuDon"), success: true };
}

/** Người lập trình duyệt đơn nháp: cần ít nhất một dòng, mọi dòng có đơn giá. */
export async function trinhDuyetDonMua(poIdRaw: number): Promise<KetQuaDonMua> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAP_DON_MUA]);
  const po = actor ? await prisma.purchaseOrder.findUnique({ where: { id: Number(poIdRaw) || -1 }, include: { items: { select: { unitPrice: true, quantity: true } } } }) : null;
  if (!actor || !po || !trongPhamVi(vesselScopeDayDu(actor), po.vesselId)) return { message: t("chung.khongCoQuyen") };
  if (!po.items.length) return { message: t("purchasing.donCanItNhatMotDong") };
  const chuaGia = po.items.filter((it) => !(it.unitPrice > 0)).length;
  if (chuaGia) return { message: t("purchasing.conDongChuaGia", { n: chuaGia }) };
  const daTrinh = await prisma.$transaction(async (tx) => {
    const r = await tx.purchaseOrder.updateMany({
      where: { id: po.id, status: "DRAFT" },
      data: { status: "PENDING_APPROVAL", submittedBy: actor.name, submittedAt: new Date(), approvalNote: null, approvedBy: null, approvedAt: null },
    });
    if (r.count === 0) return false;
    await ghiLichSuDuyet(tx, { po, hanhDong: "TRINH", nguoi: actor });
    return true;
  });
  if (!daTrinh) return { message: t("actions.donMua_daDoiTrangThai") };
  revalidatePath("/purchasing/duyet");
  await ghiNhatKyNguoiDung(actor, { action: "don-mua-trinh", path: `/purchasing/${po.id}`, vesselId: po.vesselId, detail: `Trình duyệt đơn mua ${po.poNo}` });
  revalidatePath(`/purchasing/${po.id}`);
  revalidatePath("/purchasing");
  return { message: t("purchasing.daTrinhDuyet"), success: true };
}

/** Người lập rút đơn đang chờ duyệt về nháp để sửa tiếp. */
export async function rutLaiDonMua(poIdRaw: number): Promise<KetQuaDonMua> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAP_DON_MUA]);
  const po = actor ? await prisma.purchaseOrder.findUnique({ where: { id: Number(poIdRaw) || -1 }, include: { items: { select: { unitPrice: true, quantity: true } } } }) : null;
  if (!actor || !po || !trongPhamVi(vesselScopeDayDu(actor), po.vesselId)) return { message: t("chung.khongCoQuyen") };
  const daRut = await prisma.$transaction(async (tx) => {
    const r = await tx.purchaseOrder.updateMany({ where: { id: po.id, status: "PENDING_APPROVAL" }, data: { status: "DRAFT" } });
    if (r.count === 0) return false;
    await ghiLichSuDuyet(tx, { po, hanhDong: "RUT_LAI", nguoi: actor });
    return true;
  });
  if (!daRut) return { message: t("actions.donMua_daDoiTrangThai") };
  revalidatePath("/purchasing/duyet");
  await ghiNhatKyNguoiDung(actor, { action: "don-mua-rut-lai", path: `/purchasing/${po.id}`, vesselId: po.vesselId, detail: `Rút đơn mua ${po.poNo} về nháp` });
  revalidatePath(`/purchasing/${po.id}`);
  revalidatePath("/purchasing");
  return { message: t("purchasing.daRutLai"), success: true };
}

/**
 * Lãnh đạo phòng Kỹ thuật – Vật tư (do quản trị chỉ định) hoặc người được lãnh
 * đạo ủy quyền duyệt (kèm ghi chú tùy chọn) / trả lại (bắt buộc lý do).
 */
export async function duyetDonMua(poIdRaw: number, dongY: boolean, ghiChuRaw: string): Promise<KetQuaDonMua> {
  const { t } = await layT();
  const actor = await requireActiveRole([...VAI_TRO_DUYET_PO]);
  const coLanhDao = await coLanhDaoDuyetPo();
  const po = actor
    ? await prisma.purchaseOrder.findUnique({ where: { id: Number(poIdRaw) || -1 }, include: { items: { select: { unitPrice: true, quantity: true } } } })
    : null;
  if (!actor || !po || !trongPhamVi(phamViDonMua(actor, coLanhDao), po.vesselId)) return { message: t("purchasing.khongCoQuyenDuyet") };
  const kt = duocDuyet(actor, { ...po, submittedById: await nguoiTrinhId(po) }, coLanhDao);
  if (!kt.ok) {
    return {
      message: kt.lyDo === "tuDuyet" ? t("purchasing.khongTuDuyet") : kt.lyDo === "khongChoDuyet" ? t("actions.donMua_daDoiTrangThai") : t("purchasing.khongCoQuyenDuyet"),
    };
  }
  const ghiChu = String(ghiChuRaw ?? "").trim().slice(0, 500);
  if (!dongY && !ghiChu) return { message: t("purchasing.canLyDoTraLai") };
  const tenDuyet = tenNguoiDuyet(actor.name, kt.kyThay);
  const daGhi = await prisma.$transaction(async (tx) => {
    const r = await tx.purchaseOrder.updateMany({
      where: { id: po.id, status: "PENDING_APPROVAL" },
      data: dongY
        ? { status: "APPROVED", approvedBy: tenDuyet, approvedAt: new Date(), approvalNote: ghiChu || null }
        : { status: "DRAFT", approvalNote: ghiChu, approvedBy: null, approvedAt: null },
    });
    if (r.count === 0) return false;
    await ghiLichSuDuyet(tx, { po, hanhDong: dongY ? "DUYET" : "TRA_LAI", nguoi: actor, kyThay: kt.kyThay, ghiChu });
    return true;
  });
  if (!daGhi) return { message: t("actions.donMua_daDoiTrangThai") };
  await ghiNhatKyNguoiDung(actor, {
    action: dongY ? "don-mua-duyet" : "don-mua-tra-lai",
    path: `/purchasing/${po.id}`,
    vesselId: po.vesselId,
    detail:
      `${dongY ? "Duyệt" : "Trả lại"} đơn mua ${po.poNo}${kt.kyThay ? ` (ký thay ${kt.kyThay.name})` : ""}` +
      `${kt.tamThoi ? " (quản trị tạm duyệt — chưa chỉ định lãnh đạo phòng KT-VT)" : ""}` +
      `${ghiChu ? `: ${ghiChu}` : ""}${dongY && po.submittedBy === actor.name ? " (tự duyệt đơn mình trình)" : ""}`,
  });
  revalidatePath(`/purchasing/${po.id}`);
  revalidatePath("/purchasing");
  revalidatePath("/purchasing/duyet");
  return { message: dongY ? t("purchasing.daDuyetDon") : t("purchasing.daTraLaiDon"), success: true };
}

/**
 * Nhà cung cấp xác nhận đơn (SENT → CONFIRMED): ngày xác nhận, số / người xác
 * nhận, và (tùy chọn) file PO đã ký xác nhận họ gửi lại.
 */
export async function nccXacNhanDonMua(_prev: KetQuaDonMua, formData: FormData): Promise<KetQuaDonMua> {
  const { t } = await layT();
  const actor = await requireActiveRole([...LAP_DON_MUA]);
  const po = actor ? await prisma.purchaseOrder.findUnique({ where: { id: Number(formData.get("poId")) || -1 }, select: { id: true, poNo: true, vesselId: true } }) : null;
  if (!actor || !po || !trongPhamVi(vesselScopeDayDu(actor), po.vesselId)) return { message: t("chung.khongCoQuyen") };
  const ngayRaw = String(formData.get("ngay") || "");
  const ngay = /^\d{4}-\d{2}-\d{2}$/.test(ngayRaw) ? new Date(`${ngayRaw}T12:00:00`) : new Date();
  const ref = String(formData.get("ref") || "").trim().slice(0, 200) || null;
  const file = formData.get("file");
  let tep: { ten: string; buffer: Buffer; ext: string } | null = null;
  if (file instanceof File && file.size > 0) {
    const ext = fileExtension(file.name);
    if (![".pdf", ".jpg", ".jpeg", ".png", ".docx", ".doc", ".xlsx", ".xls"].includes(ext)) return { message: t("purchasing.tepXacNhanSaiDinhDang") };
    if (file.size > MAX_UPLOAD_BYTES) return { message: t("actionsModule.nhienLieu_fileVuot20Mb") };
    tep = { ten: file.name.slice(0, 200), buffer: Buffer.from(await file.arrayBuffer()), ext };
  }
  const r = await prisma.purchaseOrder.updateMany({
    where: { id: po.id, status: "SENT" },
    data: { status: "CONFIRMED", supplierConfirmedAt: ngay, supplierConfirmRef: ref },
  });
  if (r.count === 0) return { message: t("actions.donMua_daDoiTrangThai") };
  if (tep) {
    const storedName = `don-mua-${randomUUID()}${tep.ext}`;
    await writeFile(path.join(await ensureUploadDir(), storedName), tep.buffer);
    const mime: Record<string, string> = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc": "application/msword",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls": "application/vnd.ms-excel",
    };
    await prisma.tepDonMua.create({
      data: {
        poId: po.id,
        loai: "XAC_NHAN_NCC",
        fileName: tep.ten,
        storedName,
        mimeType: mime[tep.ext] ?? "application/octet-stream",
        size: tep.buffer.length,
        sha256: createHash("sha256").update(tep.buffer).digest("hex"),
        nguoiTai: actor.name,
      },
    });
  }
  await ghiNhatKyNguoiDung(actor, {
    action: "don-mua-ncc-xac-nhan",
    path: `/purchasing/${po.id}`,
    vesselId: po.vesselId,
    detail: `Nhà cung cấp xác nhận đơn ${po.poNo}${ref ? ` (${ref})` : ""}${tep ? ` — đính kèm ${tep.ten}` : ""}`,
  });
  revalidatePath(`/purchasing/${po.id}`);
  revalidatePath("/purchasing");
  return { message: t("purchasing.daGhiNccXacNhan"), success: true };
}
