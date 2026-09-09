import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  FileText,
  ListChecks,
  PackageCheck,
  Send,
  X,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import { getStandardForVessel } from "@/lib/formStandardsDb";
import FormDocHeader from "@/components/FormDocHeader";
import PrintButton from "@/components/PrintButton";
import PurchaseOrderDeleteButton from "@/components/PurchaseOrderDeleteButton";
import {
  POStatusButton,
  ReceiveGoodsForm,
} from "@/components/PurchaseOrderForms";
import { layT } from "@/lib/i18n/server";
import {
  Badge,
  Card,
  CardHeader,
  Notice,
  PageHeader,
  TONE_DON_MUA,
  buttonClass,
} from "@/components/ui";

export const dynamic = "force-dynamic";

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
  const { t, tTuDo } = await layT();
  const scope = vesselScopeDayDu(user);
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
  if (!trongPhamVi(scope, po.vesselId)) {
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
    <div className="space-y-5">
      <div className="no-print">
        <Link
          href="/purchasing"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeft className="size-4" />
          {t("purchasing.quayLaiMuaSam")}
        </Link>
        <PageHeader
          title={<span className="font-display tracking-wide">{po.poNo}</span>}
          subtitle={
            <>
              {po.supplier.name} · {po.vessel.name} ·{" "}
              {t("purchasing.chungTuTheoChuan")} <b>{standard.label}</b> (
              {t("purchasing.doiO")}{" "}
              <Link
                href="/purchasing/forms"
                className="text-brand-700 hover:underline dark:text-brand-300"
              >
                {t("purchasing.nutMauBieu")}
              </Link>
              )
            </>
          }
          action={
            <>
              <Badge tone={TONE_DON_MUA[po.status] ?? "neutral"} dot>
                {tTuDo(`labels.poStatus_${po.status}`)}
              </Badge>
              <Link
                href={`/purchasing/${po.id}/rfq`}
                className={buttonClass("secondary")}
              >
                <FileText className="size-4" />
                {t("purchasing.nutRfq")}
              </Link>
              <PrintButton label={t("purchasing.inDonMua")} />
              {/* Dọn đơn đã hủy — điều kiện kiểm lại ở server. */}
              {user.role === "ADMIN" && po.status === "CANCELLED" && (
                <PurchaseOrderDeleteButton id={po.id} poNo={po.poNo} />
              )}
            </>
          }
        />
      </div>

      {Number.isInteger(skippedRows) && skippedRows > 0 && (
        <Notice tone="warning" className="no-print flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{t("purchasing.boQuaDong", { n: skippedRows })}</span>
        </Notice>
      )}

      {/* Bản in PO theo form công ty */}
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>
      <div className="print-area surface rounded-xl border p-6 text-sm shadow-sm print:rounded-none print:p-0 print:shadow-none print:border-0">
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
        <Card className="no-print">
          <CardHeader
            icon={<ListChecks className="size-4" />}
            title={t("purchasing.tienTrinhDon")}
          />
          <div className="flex flex-wrap items-center gap-2">
            {po.status === "DRAFT" && (
              <POStatusButton
                id={po.id}
                status="SENT"
                label={t("purchasing.nutGuiNcc")}
                variant="primary"
                icon={<Send className="size-4" />}
              />
            )}
            {po.status === "SENT" && (
              <POStatusButton
                id={po.id}
                status="CONFIRMED"
                label={t("purchasing.nutNccXacNhan")}
                variant="primary"
                icon={<Check className="size-4" />}
              />
            )}
            {po.status === "RECEIVED" && (
              <POStatusButton
                id={po.id}
                status="CLOSED"
                label={t("purchasing.nutHoanTat")}
                variant="primary"
                icon={<PackageCheck className="size-4" />}
              />
            )}
            {po.status === "PARTIALLY_RECEIVED" && (
              <POStatusButton
                id={po.id}
                status="CLOSED"
                label={t("purchasing.nutDongDonThieu")}
                variant="secondary"
                icon={<PackageCheck className="size-4" />}
              />
            )}
            {["DRAFT", "SENT", "CONFIRMED"].includes(po.status) && (
              <POStatusButton
                id={po.id}
                status="CANCELLED"
                label={t("purchasing.nutHuyDon")}
                variant="danger"
                icon={<X className="size-4" />}
              />
            )}
          </div>
        </Card>
      )}

      {/* Nhận hàng */}
      {canReceive && (
        <Card className="no-print">
          <CardHeader
            icon={<PackageCheck className="size-4" />}
            title={t("purchasing.nhanHang")}
            subtitle={t("purchasing.nhanHangMoTa")}
          />
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
        </Card>
      )}
    </div>
  );
}
