import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FileInput,
  History,
  FileText,
  ListChecks,
  Mail,
  PackageCheck,
  Paperclip,
  Pencil,
  Send,
  X,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, trongPhamVi } from "@/lib/auth";
import { coLanhDaoDuyetPo, nguoiTrinhId, phamViDonMua } from "@/lib/duyetPoServer";
import { getStandardForVessel } from "@/lib/formStandardsDb";
import FormDocHeader from "@/components/FormDocHeader";
import PrintButton from "@/components/PrintButton";
import PurchaseOrderDeleteButton from "@/components/PurchaseOrderDeleteButton";
import {
  POStatusButton,
  ReceiveGoodsForm,
} from "@/components/PurchaseOrderForms";
import { layT } from "@/lib/i18n/server";
import SuaDonMuaForm from "@/components/SuaDonMuaForm";
import { DuyetDonMuaForm, RutLaiButton, TrinhDuyetButton, XacNhanNccForm } from "@/components/DonMuaQuyTrinh";
import { LAP_DON_MUA, NHAN_HANG_PO, daDuyet, duocDuyet, thuGuiNcc, tongDonMua } from "@/lib/donMuaQuyTrinh";
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
  searchParams: Promise<{ skipped?: string; baoGia?: string }>;
}) {
  const { skipped: skippedRaw, baoGia: baoGiaRaw } = await searchParams;
  const skippedRows = Number(skippedRaw);
  const user = await requireScopedUser();
  const { t, tTuDo, ngayGio } = await layT();
  const coLanhDao = await coLanhDaoDuyetPo();
  // Lãnh đạo phòng KT-VT / người được ủy quyền duyệt PO của mọi tàu.
  const scope = phamViDonMua(user, coLanhDao);
  const canManage = LAP_DON_MUA.includes(user.role);
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
  const ktDuyet = duocDuyet(user, { ...po, submittedById: await nguoiTrinhId(po) }, coLanhDao);
  const laNguoiDuyet = ktDuyet.ok;
  const tuDuyet = !ktDuyet.ok && ktDuyet.lyDo === "tuDuyet";
  const [warehouses, suppliers, baoGiaGan, tepDinhKem, lichSuDuyet] = await Promise.all([
    prisma.warehouse.findMany({
      where: { vesselId: po.vesselId },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.supplier.findMany({ where: { OR: [{ isActive: true }, { id: po.supplierId }] }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.baoGiaNcc.findMany({ where: { poId: po.id }, orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, soBaoGia: true, createdAt: true } }),
    prisma.tepDonMua.findMany({ where: { poId: po.id }, orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, loai: true, nguoiTai: true, createdAt: true } }),
    prisma.lichSuDuyetPo.findMany({ where: { poId: po.id }, orderBy: { id: "asc" }, take: 50 }),
  ]);

  const standard = await getStandardForVessel(po.vessel.formStandard);
  const tongDon = tongDonMua(po.items, po.discountPercent, po.transportFee, po.deliveryFee);
  const subtotal = tongDon.cong;
  const discountAmount = tongDon.giam;
  const afterDiscount = tongDon.sauGiam;
  const grandTotal = tongDon.tong;
  const daQuaDuyet = daDuyet(po.status);
  const ngayVN = (d: Date | null) => (d ? d.toLocaleDateString("vi-VN") : "");
  const homNay = new Date();
  const homNayStr = `${homNay.getFullYear()}-${String(homNay.getMonth() + 1).padStart(2, "0")}-${String(homNay.getDate()).padStart(2, "0")}`;
  const thu = thuGuiNcc({
    poNo: po.poNo,
    congTy: standard.companyName,
    tau: po.vessel.name,
    tong: grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    tienTe: po.currency,
    lienHe: po.supplier.contact,
  });
  const mailto = po.supplier.email
    ? `mailto:${encodeURIComponent(po.supplier.email)}?subject=${encodeURIComponent(thu.tieuDe)}&body=${encodeURIComponent(thu.noiDung)}`
    : null;
  const [baoGiaCapNhat, baoGiaThem] = (baoGiaRaw ?? "").split("-").map(Number);
  const money = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Nhận hàng vào kho tàu: quản trị / thuyền trưởng (không phải chuyên viên mua sắm).
  const canReceive =
    NHAN_HANG_PO.includes(user.role) &&
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
              <a href={`/api/export/po/${po.id}`} className={buttonClass("secondary")}>
                <Download className="size-4" />
                {t("purchasing.xuatExcel")}
              </a>
              {canManage && po.status === "DRAFT" && (
                <Link href={`/purchasing/bao-gia?vessel=${po.vesselId}&po=${po.id}`} className={buttonClass("secondary")}>
                  <FileInput className="size-4" />
                  {t("purchasing.nutNhapBaoGia")}
                </Link>
              )}
              {/* Dọn đơn đã hủy — điều kiện kiểm lại ở server. */}
              {user.role === "ADMIN" && po.status === "CANCELLED" && (
                <PurchaseOrderDeleteButton id={po.id} poNo={po.poNo} />
              )}
            </>
          }
        />
      </div>

      {baoGiaRaw && Number.isInteger(baoGiaCapNhat) && (
        <Notice tone="success" className="no-print">
          {t("purchasing.daApBaoGia", { capNhat: baoGiaCapNhat || 0, them: baoGiaThem || 0 })}
        </Notice>
      )}
      {po.status === "DRAFT" && po.approvalNote && (
        <Notice tone="warning" className="no-print">
          {t("purchasing.biTraLai", { lyDo: po.approvalNote })}
        </Notice>
      )}
      {po.status === "PENDING_APPROVAL" && (
        <Notice tone="info" className="no-print">
          {t("purchasing.dangChoDuyet", { nguoi: po.submittedBy ?? "—", luc: po.submittedAt ? ngayGio(po.submittedAt) : "—" })}{" "}
          <Link href="/purchasing/duyet" className="font-medium underline">
            {t("purchasing.moKiemSoatDuyet")}
          </Link>
        </Notice>
      )}
      {po.status === "PENDING_APPROVAL" && tuDuyet && (
        <Notice tone="warning" className="no-print">
          {t("purchasing.khongTuDuyet")}
        </Notice>
      )}
      {daQuaDuyet && po.approvedBy && (
        <Notice tone="success" className="no-print">
          {t("purchasing.daDuyetBoi", { nguoi: po.approvedBy, luc: po.approvedAt ? ngayGio(po.approvedAt) : "—" })}
          {po.approvalNote ? ` — ${po.approvalNote}` : ""}
        </Notice>
      )}

      {canManage && po.status === "DRAFT" && (
        <details className="no-print surface rounded-xl border p-4" open={po.items.some((it) => !(it.unitPrice > 0))}>
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Pencil className="size-4" />
            {t("purchasing.suaDonNhap")}
          </summary>
          <div className="mt-3">
            <SuaDonMuaForm
              poId={po.id}
              suppliers={suppliers}
              dau={{
                supplierId: po.supplierId,
                currency: po.currency,
                subject: po.subject ?? "",
                supplierRef: po.supplierRef ?? "",
                expectedDate: po.expectedDate ? po.expectedDate.toISOString().slice(0, 10) : "",
                notes: po.notes ?? "",
                discountPercent: String(po.discountPercent || ""),
                transportFee: String(po.transportFee || ""),
                deliveryFee: String(po.deliveryFee || ""),
              }}
              dong={po.items.map((it) => ({
                id: it.id,
                description: it.description,
                partNo: it.partNo ?? "",
                uom: it.uom,
                quantity: String(it.quantity),
                unitPrice: it.unitPrice ? String(it.unitPrice) : "",
                tuYeuCau: it.requestItemId !== null,
              }))}
            />
          </div>
        </details>
      )}

      {Number.isInteger(skippedRows) && skippedRows > 0 && (
        <Notice tone="warning" className="no-print flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{t("purchasing.boQuaDong", { n: skippedRows })}</span>
        </Notice>
      )}

      {/* Bản in PO theo form công ty */}
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>
      <div className="print-area surface rounded-xl border p-6 text-sm shadow-sm print:rounded-none print:p-0 print:shadow-none print:border-0">
        {!daQuaDuyet && po.status !== "CANCELLED" && (
          <p className="mb-2 rounded border-2 border-dashed border-rose-500 px-2 py-1 text-center text-xs font-bold tracking-wide text-rose-600 print:text-rose-700">
            BẢN NHÁP — CHƯA DUYỆT · DRAFT — NOT APPROVED
          </p>
        )}
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

        {/* Ba ô ký: người lập · lãnh đạo phòng KT-VT duyệt · nhà cung cấp xác nhận */}
        <div className="mt-8 grid grid-cols-3 gap-6 text-center text-sm">
          <div>
            <p className="font-bold text-[#0a1f44]">Prepared by</p>
            <p className="text-[11px] text-slate-500">Người lập</p>
            <div className="mt-12 border-t border-slate-400 pt-1 text-xs">
              <p className="font-medium">{po.submittedBy ?? po.createdBy.replace(/\s*\(KT-VT\)$/, "")}</p>
              <p className="text-[11px] text-slate-500">Date: {ngayVN(po.submittedAt ?? po.createdAt)}</p>
            </div>
          </div>
          <div>
            <p className="font-bold text-[#0a1f44]">Approved by</p>
            <p className="text-[11px] text-slate-500">Lãnh đạo phòng Kỹ thuật – Vật tư</p>
            <div className="mt-12 border-t border-slate-400 pt-1 text-xs">
              <p className="font-medium">{po.approvedBy ?? " "}</p>
              <p className="text-[11px] text-slate-500">Date: {po.approvedAt ? ngayVN(po.approvedAt) : "............"}</p>
            </div>
          </div>
          <div>
            <p className="font-bold text-[#0a1f44]">Supplier confirmation</p>
            <p className="text-[11px] text-slate-500">Nhà cung cấp xác nhận (sign &amp; stamp)</p>
            <div className="mt-12 border-t border-slate-400 pt-1 text-xs">
              <p className="font-medium">{po.supplierConfirmRef ?? " "}</p>
              <p className="text-[11px] text-slate-500">Date: {po.supplierConfirmedAt ? ngayVN(po.supplierConfirmedAt) : "............"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Điều khiển quy trình */}
      {(canManage || laNguoiDuyet || canReceive) && po.status !== "CANCELLED" && po.status !== "CLOSED" && (
        <Card className="no-print">
          <CardHeader
            icon={<ListChecks className="size-4" />}
            title={t("purchasing.tienTrinhDon")}
          />
          <div className="flex flex-wrap items-center gap-2">
            {canManage && po.status === "DRAFT" && <TrinhDuyetButton poId={po.id} />}
            {ktDuyet.ok && (
              <div className="w-full space-y-1">
                <p className="text-xs text-[var(--text-muted)]">
                  {ktDuyet.kyThay
                    ? t("purchasing.duyetKyThay", { ten: ktDuyet.kyThay.name })
                    : ktDuyet.tamThoi
                      ? t("purchasing.duyetTamThoi")
                      : t("purchasing.duyetLanhDao")}
                </p>
                <DuyetDonMuaForm poId={po.id} />
              </div>
            )}
            {po.status === "PENDING_APPROVAL" && canManage && (!laNguoiDuyet || po.submittedBy === user.name) && <RutLaiButton poId={po.id} />}
            {canManage && po.status === "APPROVED" && (
              <>
                {mailto && (
                  <a href={mailto} className={buttonClass("secondary")}>
                    <Mail className="size-4" />
                    {t("purchasing.nutSoanThuNcc")}
                  </a>
                )}
                <POStatusButton
                  id={po.id}
                  status="SENT"
                  label={t("purchasing.nutDaGuiNcc")}
                  variant="primary"
                  icon={<Send className="size-4" />}
                />
              </>
            )}
            {canManage && po.status === "SENT" && <XacNhanNccForm poId={po.id} homNay={homNayStr} />}
            {canManage && po.status === "RECEIVED" && (
              <POStatusButton
                id={po.id}
                status="CLOSED"
                label={t("purchasing.nutHoanTat")}
                variant="primary"
                icon={<PackageCheck className="size-4" />}
              />
            )}
            {canManage && po.status === "PARTIALLY_RECEIVED" && (
              <POStatusButton
                id={po.id}
                status="CLOSED"
                label={t("purchasing.nutDongDonThieu")}
                variant="secondary"
                icon={<PackageCheck className="size-4" />}
              />
            )}
            {canManage && ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "CONFIRMED"].includes(po.status) && (
              <POStatusButton
                id={po.id}
                status="CANCELLED"
                label={t("purchasing.nutHuyDon")}
                variant="danger"
                icon={<X className="size-4" />}
              />
            )}
          </div>
          {canManage && po.status === "APPROVED" && <p className="mt-2 text-xs text-[var(--text-muted)]">{t("purchasing.goiYGuiNcc")}</p>}
        </Card>
      )}

      {lichSuDuyet.length > 0 && (
        <Card className="no-print">
          <CardHeader icon={<History className="size-4" />} title={t("purchasing.lichSuDuyetPo")} />
          <ol className="space-y-1.5 text-sm">
            {lichSuDuyet.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="tabular text-xs text-[var(--text-muted)]">{ngayGio(l.createdAt)}</span>
                <Badge tone={l.hanhDong === "DUYET" ? "success" : l.hanhDong === "TRA_LAI" ? "danger" : l.hanhDong === "TRINH" ? "info" : "muted"}>
                  {tTuDo(`purchasing.hanhDong_${l.hanhDong}`)}
                </Badge>
                <span className="text-[var(--text-primary)]">
                  {l.nguoi}
                  {l.kyThay ? ` (${t("purchasing.kyThayNgan", { ten: l.kyThay })})` : ""}
                </span>
                {l.ghiChu && <span className="text-[var(--text-secondary)]">— {l.ghiChu}</span>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {(baoGiaGan.length > 0 || tepDinhKem.length > 0) && (
        <Card className="no-print">
          <CardHeader icon={<Paperclip className="size-4" />} title={t("purchasing.chungTuKem")} />
          <ul className="space-y-1 text-sm">
            {baoGiaGan.map((b) => (
              <li key={`bg${b.id}`}>
                <Link href={`/purchasing/bao-gia/${b.id}`} className="text-[var(--text-brand)] hover:underline">
                  {t("purchasing.baoGiaSo", { so: b.soBaoGia ?? b.fileName })}
                </Link>{" "}
                <span className="text-xs text-[var(--text-muted)]">· {ngayGio(b.createdAt)}</span>
              </li>
            ))}
            {tepDinhKem.map((tf) => (
              <li key={`f${tf.id}`}>
                <a href={`/api/don-mua/tep/${tf.id}`} target="_blank" rel="noopener noreferrer" className="text-[var(--text-brand)] hover:underline">
                  {tf.loai === "XAC_NHAN_NCC" ? t("purchasing.tepXacNhanNcc") : tf.fileName}
                </a>{" "}
                <span className="text-xs text-[var(--text-muted)]">
                  · {tf.fileName} · {tf.nguoiTai}, {ngayGio(tf.createdAt)}
                </span>
              </li>
            ))}
          </ul>
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
