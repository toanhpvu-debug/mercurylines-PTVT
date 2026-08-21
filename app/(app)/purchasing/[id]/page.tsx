import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselScope } from "@/lib/auth";
import { getStandardForVessel } from "@/lib/formStandardsDb";
import FormDocHeader from "@/components/FormDocHeader";
import PrintButton from "@/components/PrintButton";
import PurchaseOrderDeleteButton from "@/components/PurchaseOrderDeleteButton";
import {
  POStatusButton,
  ReceiveGoodsForm,
} from "@/components/PurchaseOrderForms";

export const dynamic = "force-dynamic";

const poStatusLabels: Record<string, string> = {
  DRAFT: "Nháp",
  SENT: "Đã gửi NCC",
  CONFIRMED: "NCC xác nhận",
  PARTIALLY_RECEIVED: "Nhận một phần",
  RECEIVED: "Đã nhận đủ",
  CLOSED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ skipped?: string }>;
}) {
  const { skipped: skippedRaw } = await searchParams;
  const skippedRows = Number(skippedRaw);
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  const canManage = ["ADMIN", "MASTER"].includes(user.role);
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      vessel: true,
      items: {
        include: { material: true, requestItem: true },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!po) {
    notFound();
  }
  if (!scope.all && po.vesselId !== scope.vesselId) {
    notFound();
  }
  const warehouses = await prisma.warehouse.findMany({
    where: { vesselId: po.vesselId },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  const standard = await getStandardForVessel(po.vessel.formStandard);
  const subtotal = po.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const discountAmount = (subtotal * po.discountPercent) / 100;
  const afterDiscount = subtotal - discountAmount;
  const grandTotal = afterDiscount + po.transportFee + po.deliveryFee;
  const money = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const canReceive =
    canManage &&
    ["SENT", "CONFIRMED", "PARTIALLY_RECEIVED"].includes(po.status);
  const orderDateStr = (po.orderDate ?? po.createdAt).toLocaleDateString(
    "vi-VN"
  );

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/purchasing"
          className="text-sm text-blue-700 hover:underline"
        >
          ← Quay lại mua sắm
        </Link>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-2 py-1 text-sm">
            {poStatusLabels[po.status] ?? po.status}
          </span>
          <Link
            href={`/purchasing/${po.id}/rfq`}
            className="rounded border px-4 py-2 text-sm hover:bg-blue-50"
          >
            Yêu cầu báo giá (RFQ)
          </Link>
          <PrintButton label="In đơn mua (PO)" />
          {/* Dọn đơn đã hủy — điều kiện kiểm lại ở server. */}
          {user.role === "ADMIN" && po.status === "CANCELLED" && (
            <PurchaseOrderDeleteButton
              id={po.id}
              poNo={po.poNo}
              className="rounded border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            />
          )}
        </div>
      </div>

      {Number.isInteger(skippedRows) && skippedRows > 0 && (
        <div className="no-print rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          ⚠ {skippedRows} dòng trong file Excel đã bị bỏ qua vì thiếu hoặc không
          đọc được số lượng — hãy đối chiếu lại với file gốc.
        </div>
      )}

      <p className="no-print text-xs text-slate-500">
        Chứng từ theo chuẩn:{" "}
        <b>{standard.label}</b> (đổi ở{" "}
        <Link href="/purchasing/forms" className="text-blue-700 hover:underline">
          Mẫu biểu theo tàu
        </Link>
        )
      </p>

      {/* Bản in PO theo form công ty */}
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>
      <div className="print-area rounded-xl bg-white p-8 text-sm shadow-sm ring-1 ring-blue-100 print:rounded-none print:p-0 print:shadow-none print:ring-0">
        <FormDocHeader standard={standard} title="PURCHASING ORDER" />

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="space-y-0.5 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
            <p>
              <span className="inline-block w-24 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                To
              </span>
              <span className="font-medium">{po.supplier.name}</span>
            </p>
            <p>
              <span className="inline-block w-24 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Add
              </span>
              {po.supplier.address}
            </p>
            <p>
              <span className="inline-block w-24 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Tel/Fax
              </span>
              {po.supplier.phone}
            </p>
            <p>
              <span className="inline-block w-24 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Attn
              </span>
              {po.supplier.contact}
            </p>
            <p>
              <span className="inline-block w-24 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Y/ref
              </span>
              {po.supplierRef}
            </p>
          </div>
          <div className="space-y-0.5 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
            <p>
              <span className="inline-block w-24 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                From
              </span>
              <span className="font-medium">{standard.companyName}</span>
            </p>
            <p>
              <span className="inline-block w-24 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Our ref
              </span>
              {po.poNo}
            </p>
            <p>
              <span className="inline-block w-24 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Date
              </span>
              {orderDateStr}
            </p>
            <p>
              <span className="inline-block w-24 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Subject
              </span>
              {po.subject || "Supply ship stores"}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <p>Dear {po.supplier.contact || "Sirs"},</p>
          <p>
            Pls arrange to supply these ship store for MV:{" "}
            <b>{po.vessel.name}</b>
            {po.vessel.hullNo ? ` / Hull No: ${po.vessel.hullNo}` : ""}
          </p>
          <p>* Vessel specification: IMO {po.vessel.imo || "—"}</p>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border border-slate-300 text-xs">
            <thead>
              <tr className="bg-[#0c2a5c] text-center text-white">
                <th className="border border-slate-300 p-1.5">Item</th>
                <th className="border border-slate-300 p-1.5">Description</th>
                <th className="border border-slate-300 p-1.5">PN</th>
                <th className="border border-slate-300 p-1.5">Unit</th>
                <th className="border border-slate-300 p-1.5">Q&apos;ty</th>
                <th className="border border-slate-300 p-1.5">
                  U.Price ({po.currency})
                </th>
                <th className="border border-slate-300 p-1.5">
                  Amount ({po.currency})
                </th>
                <th className="border border-slate-300 p-1.5">Remark</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((it, index) => (
                <tr key={it.id} className="text-center even:bg-blue-50/40">
                  <td className="border border-slate-300 p-1.5">{index + 1}</td>
                  <td className="border border-slate-300 p-1 text-left">
                    {it.description}
                  </td>
                  <td className="border border-slate-300 p-1.5">{it.partNo}</td>
                  <td className="border border-slate-300 p-1.5">{it.uom}</td>
                  <td className="border border-slate-300 p-1.5">{it.quantity}</td>
                  <td className="border border-slate-300 p-1 text-right">
                    {it.unitPrice ? money(it.unitPrice) : ""}
                  </td>
                  <td className="border border-slate-300 p-1 text-right">
                    {it.quantity * it.unitPrice
                      ? money(it.quantity * it.unitPrice)
                      : ""}
                  </td>
                  <td className="border border-slate-300 p-1.5" />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="border border-slate-300 p-1 text-right">
                  Total
                </td>
                <td className="border border-slate-300 p-1 text-right">
                  {money(subtotal)}
                </td>
                <td className="border border-slate-300 p-1.5" />
              </tr>
              {po.discountPercent > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={6}
                      className="border border-slate-300 p-1 text-right"
                    >
                      Special discount ({po.discountPercent}%)
                    </td>
                    <td className="border border-slate-300 p-1 text-right">
                      {money(discountAmount)}
                    </td>
                    <td className="border border-slate-300 p-1.5" />
                  </tr>
                  <tr>
                    <td
                      colSpan={6}
                      className="border border-slate-300 p-1 text-right"
                    >
                      Total after discount
                    </td>
                    <td className="border border-slate-300 p-1 text-right">
                      {money(afterDiscount)}
                    </td>
                    <td className="border border-slate-300 p-1.5" />
                  </tr>
                </>
              )}
              {po.transportFee > 0 && (
                <tr>
                  <td colSpan={6} className="border border-slate-300 p-1 text-right">
                    Transportation fee
                  </td>
                  <td className="border border-slate-300 p-1 text-right">
                    {money(po.transportFee)}
                  </td>
                  <td className="border border-slate-300 p-1.5" />
                </tr>
              )}
              {po.deliveryFee > 0 && (
                <tr>
                  <td colSpan={6} className="border border-slate-300 p-1 text-right">
                    Onboard delivery fee
                  </td>
                  <td className="border border-slate-300 p-1 text-right">
                    {money(po.deliveryFee)}
                  </td>
                  <td className="border border-slate-300 p-1.5" />
                </tr>
              )}
              <tr className="bg-blue-50 font-bold text-[#0a1f44]">
                <td colSpan={6} className="border border-slate-300 p-1.5 text-right">
                  TOTAL
                </td>
                <td className="border border-slate-300 p-1.5 text-right">
                  {money(grandTotal)} {po.currency}
                </td>
                <td className="border border-slate-300 p-1.5" />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4 rounded-lg border border-blue-100 p-3 text-xs">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#0a1f44]">
            Terms and Condition
          </p>
          <p>* Quality: New 100%</p>
          <p>* Delivery term: onboard delivery</p>
          <p>* Packing: Standard as marine ship&apos;s spare shipment</p>
          <p>
            * Damage or incorrect parts can be refused or accepted for changing
            with good ones under your account.
          </p>
          <p>* Payment term: By TT after delivery with delivery note</p>
          <p>* Documents required: Signed Delivery Note, Final Invoice</p>
          {po.notes && <p>* Note: {po.notes}</p>}
        </div>

        <div className="mt-10 flex justify-end text-sm">
          <div className="text-center">
            <p className="font-bold text-[#0a1f44]">{standard.companyName}</p>
            <div className="mt-16 w-56 border-t border-slate-400 pt-1 text-[11px] text-slate-500">
              Authorized signature
            </div>
          </div>
        </div>
      </div>

      {/* Điều khiển quy trình */}
      {canManage && po.status !== "CANCELLED" && po.status !== "CLOSED" && (
        <div className="no-print rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <h3 className="mb-3 text-lg font-semibold">Tiến trình đơn mua</h3>
          <div className="flex flex-wrap items-center gap-2">
            {po.status === "DRAFT" && (
              <POStatusButton
                id={po.id}
                status="SENT"
                label="Gửi nhà cung cấp"
                className="rounded bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200 disabled:opacity-50"
              />
            )}
            {po.status === "SENT" && (
              <POStatusButton
                id={po.id}
                status="CONFIRMED"
                label="NCC đã xác nhận"
                className="rounded bg-indigo-100 px-3 py-1 text-sm text-indigo-700 hover:bg-indigo-200 disabled:opacity-50"
              />
            )}
            {po.status === "RECEIVED" && (
              <POStatusButton
                id={po.id}
                status="CLOSED"
                label="Hoàn tất đơn"
                className="rounded bg-green-100 px-3 py-1 text-sm text-green-700 hover:bg-green-200 disabled:opacity-50"
              />
            )}
            {po.status === "PARTIALLY_RECEIVED" && (
              <POStatusButton
                id={po.id}
                status="CLOSED"
                label="Đóng đơn (nhận thiếu, không nhận thêm)"
                className="rounded bg-green-100 px-3 py-1 text-sm text-green-700 hover:bg-green-200 disabled:opacity-50"
              />
            )}
            {["DRAFT", "SENT", "CONFIRMED"].includes(po.status) && (
              <POStatusButton
                id={po.id}
                status="CANCELLED"
                label="Hủy đơn"
                className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200 disabled:opacity-50"
              />
            )}
          </div>
        </div>
      )}

      {/* Nhận hàng */}
      {canReceive && (
        <div className="no-print rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <h3 className="mb-3 text-lg font-semibold">Nhận hàng (Goods Receipt)</h3>
          <ReceiveGoodsForm
            poId={po.id}
            warehouses={warehouses}
            lines={po.items.map((it) => ({
              id: it.id,
              description: it.description,
              partNo: it.partNo,
              uom: it.uom,
              quantity: it.quantity,
              quantityReceived: it.quantityReceived,
              hasMaterial: it.materialId !== null,
            }))}
          />
          <p className="mt-2 text-xs text-slate-500">
            Nhận hàng sẽ tự nhập kho cho vật tư có trong danh mục và cập nhật
            tiến độ giao của yêu cầu liên quan.
          </p>
        </div>
      )}
    </div>
  );
}
