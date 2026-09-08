import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import { getStandardForVessel } from "@/lib/formStandardsDb";
import FormDocHeader from "@/components/FormDocHeader";
import PrintButton from "@/components/PrintButton";
import { layT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function RfqPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireScopedUser();
  const { t } = await layT();
  const scope = vesselScopeDayDu(user);
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
      items: { orderBy: { id: "asc" } },
    },
  });
  if (!po) {
    notFound();
  }
  if (!trongPhamVi(scope, po.vesselId)) {
    notFound();
  }
  const standard = await getStandardForVessel(po.vessel.formStandard);
  const dateStr = new Date(po.createdAt).toLocaleDateString("vi-VN");

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/purchasing/${po.id}`}
          className="text-sm text-blue-700 hover:underline"
        >
          {t("purchasing.quayLaiDonMua")}
        </Link>
        <PrintButton label={t("purchasing.inRfq")} />
      </div>

      <p className="no-print text-xs text-slate-500">
        {t("purchasing.chungTuTheoChuan")} <b>{standard.label}</b>
      </p>

      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>
      <div className="print-area rounded-xl bg-white p-8 text-sm shadow-sm ring-1 ring-blue-100 print:rounded-none print:p-0 print:shadow-none print:ring-0">
        <FormDocHeader standard={standard} title="INQUIRY FOR QUOTE" />

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="space-y-0.5 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
            <p>
              <span className="inline-block w-20 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                To
              </span>
              <span className="font-medium">{po.supplier.name}</span>
            </p>
            <p>
              <span className="inline-block w-20 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Attn
              </span>
              {po.supplier.contact}
            </p>
            <p>
              <span className="inline-block w-20 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                From
              </span>
              <span className="font-medium">{standard.companyName}</span>
            </p>
          </div>
          <div className="space-y-0.5 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
            <p>
              <span className="inline-block w-24 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Fax no.
              </span>
              {po.supplier.phone}
            </p>
            <p>
              <span className="inline-block w-24 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                DD
              </span>
              {dateStr}
            </p>
            <p>
              <span className="inline-block w-24 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Our ref
              </span>
              {po.poNo}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <p className="font-semibold">RE: MV: {po.vessel.name}</p>
          <p>
            Please advise us the quotation to supply following ITEMS for MV:{" "}
            <b>{po.vessel.name}</b>
          </p>
          <p>
            * Vessel specification: IMO {po.vessel.imo || "—"}
            {po.vessel.hullNo ? ` / Hull No: ${po.vessel.hullNo}` : ""}
          </p>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border border-slate-300 text-xs">
            <thead>
              <tr className="bg-[#0c2a5c] text-center text-white">
                <th className="border border-slate-300 p-1.5">Item</th>
                <th className="border border-slate-300 p-1.5">Description</th>
                <th className="border border-slate-300 p-1.5">IMPA CODE / PN</th>
                <th className="border border-slate-300 p-1.5">Unit</th>
                <th className="border border-slate-300 p-1.5">Q&apos;ty</th>
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
                  <td className="border border-slate-300 p-1.5" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-lg border border-blue-100 p-3 text-xs">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#0a1f44]">
            Delivery information
          </p>
          <p>- Supply port: to be advised</p>
          <p>- Agent details: to be advised</p>
          <p>- Delivery date: to be advised</p>
          <p>- Handling: Onboard handle</p>
        </div>

        <div className="mt-10 flex justify-end text-sm">
          <div className="text-center">
            <p className="font-bold text-[#0a1f44]">
              Technical &amp; Purchasing Dep.
            </p>
            <p className="italic text-slate-600">{standard.companyName}</p>
            <div className="mt-14 w-56 border-t border-slate-400 pt-1 text-[11px] text-slate-500">
              Authorized signature
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
