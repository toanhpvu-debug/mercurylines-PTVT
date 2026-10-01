import { prisma } from "@/lib/prisma";
import { requireActiveRole } from "@/lib/auth";
import { ROLES, trongPhamVi, vesselScopeDayDu } from "@/lib/roles";
import { getStandardForVessel } from "@/lib/formStandardsDb";
import { LOGO_MERCURY_LINES_PNG_BASE64 } from "@/lib/logoMercuryLinesPng";
import { daDuyet } from "@/lib/donMuaQuyTrinh";
import { taoExcelDonMua } from "@/lib/xuatDonMuaExcel";
import { ghiNhatKyNguoiDung } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ngayVN = (d: Date | null | undefined) =>
  d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` : null;

/**
 * Xuất PO ra file Excel theo form công ty (gửi kèm thư cho nhà cung cấp). Đơn
 * chưa duyệt vẫn xuất được để soát, nhưng tiêu đề ghi rõ BẢN NHÁP — CHƯA DUYỆT.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await requireActiveRole([...ROLES]);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { supplier: true, vessel: true, items: { orderBy: { id: "asc" } } },
  });
  if (!po || !trongPhamVi(vesselScopeDayDu(actor), po.vesselId)) return new Response("Not found", { status: 404 });
  const chuan = await getStandardForVessel(po.vessel.formStandard);
  // Logo: logo lấy từ file gốc của chuẩn biểu mẫu; chuẩn MLS không có thì logo Mercury Lines.
  const tep = await prisma.formStandardTep.findUnique({ where: { code: chuan.code }, select: { logo: true, logoMime: true } });
  const logo =
    tep?.logo && tep.logoMime && /png|jpeg|gif/.test(tep.logoMime)
      ? { data: Buffer.from(tep.logo), ext: (tep.logoMime.includes("png") ? "png" : tep.logoMime.includes("gif") ? "gif" : "jpeg") as "png" | "jpeg" | "gif" }
      : chuan.code === "MLS"
        ? { data: Buffer.from(LOGO_MERCURY_LINES_PNG_BASE64, "base64"), ext: "png" as const }
        : null;
  const tep2 = await taoExcelDonMua({
    poNo: po.poNo,
    ngay: ngayVN(po.orderDate ?? po.createdAt)!,
    daDuyet: daDuyet(po.status),
    tienTe: po.currency,
    tieuDe: po.subject,
    yRef: po.supplierRef,
    ghiChu: po.notes,
    chietKhau: po.discountPercent,
    phiVanChuyen: po.transportFee,
    phiGiaoHang: po.deliveryFee,
    dong: po.items.map((it) => ({ moTa: it.description, partNo: it.partNo, donVi: it.uom, soLuong: it.quantity, donGia: it.unitPrice })),
    ncc: { ten: po.supplier.name, diaChi: po.supplier.address, dienThoai: po.supplier.phone, lienHe: po.supplier.contact, email: po.supplier.email },
    tau: { ten: po.vessel.name, hullNo: po.vessel.hullNo, imo: po.vessel.imo },
    congTy: {
      ten: chuan.companyName,
      diaChi: chuan.address,
      vpDaiDien: chuan.repAddress ?? null,
      lienLac: [chuan.tel ? `Tel: ${chuan.tel}` : null, chuan.email ? `Email: ${chuan.email}` : null, chuan.website ?? null].filter(Boolean).join("  ·  ") || null,
    },
    logo,
    nguoiLap: po.submittedBy ?? po.createdBy.replace(/\s*\(KT-VT\)$/, ""),
    ngayLap: ngayVN(po.submittedAt ?? po.createdAt),
    nguoiDuyet: po.approvedBy,
    ngayDuyet: ngayVN(po.approvedAt),
    nccXacNhan: po.supplierConfirmedAt ? `${po.supplierConfirmRef ?? "Confirmed"} — ${ngayVN(po.supplierConfirmedAt)}` : null,
  });
  await ghiNhatKyNguoiDung(actor, { action: "xuat-excel-po", path: `/purchasing/${po.id}`, vesselId: po.vesselId, detail: `Xuất Excel ${po.poNo} (${po.status})` });
  return new Response(new Uint8Array(tep2), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${po.poNo}.xlsx"`,
      "Content-Length": String(tep2.length),
      "Cache-Control": "private, no-store",
    },
  });
}
