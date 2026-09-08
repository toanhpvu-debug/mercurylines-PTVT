"use client";

import { useActionState } from "react";
import { createLashingReport } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";

type GearInput = {
  id: number;
  name: string;
  partNo: string | null;
  minQty: number;
  standardQty: number;
  lastInOrder: number | null;
  lastOutOfOrder: number | null;
};

export default function LashingReportForm({
  vesselId,
  gears,
  defaultDate,
}: {
  vesselId: number;
  gears: GearInput[];
  defaultDate: string;
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(createLashingReport, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="vesselId" value={vesselId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            {t("vessels.ngayBaoCao")}
          </label>
          <input
            name="reportDate"
            type="date"
            defaultValue={v.reportDate ?? defaultDate}
            className="w-full rounded border p-2"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            {t("vessels.soChuyen")}
          </label>
          <input
            name="voyageNo"
            placeholder={t("vessels.phSoChuyen")}
            defaultValue={v.voyageNo ?? ""}
            className="w-full rounded border p-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            {t("vessels.viTriBaoCao")}
          </label>
          <input
            name="position"
            placeholder={t("vessels.phViTri")}
            defaultValue={v.position ?? ""}
            className="w-full rounded border p-2"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead>
            <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
              <th className="p-2">{t("vessels.dungCuChangBuoc")}</th>
              <th className="p-2">Part No.</th>
              <th className="p-2">{t("vessels.slToiThieu")}</th>
              <th className="p-2">{t("vessels.trangBiChuan")}</th>
              <th className="p-2">{t("vessels.conDungDuoc")}</th>
              <th className="p-2">{t("vessels.biHong")}</th>
            </tr>
          </thead>
          <tbody>
            {gears.map((gear) => (
              <tr key={gear.id} className="border-b">
                <td className="p-2 font-medium">{gear.name}</td>
                <td className="p-2">{gear.partNo}</td>
                <td className="p-2">{gear.minQty}</td>
                <td className="p-2">{gear.standardQty}</td>
                <td className="p-2">
                  <input
                    name={`inOrder_${gear.id}`}
                    type="number"
                    step="1"
                    min="0"
                    defaultValue={
                      v[`inOrder_${gear.id}`] ?? gear.lastInOrder ?? 0
                    }
                    className="w-28 rounded border p-1"
                    required
                  />
                </td>
                <td className="p-2">
                  <input
                    name={`outOfOrder_${gear.id}`}
                    type="number"
                    step="1"
                    min="0"
                    defaultValue={
                      v[`outOfOrder_${gear.id}`] ?? gear.lastOutOfOrder ?? 0
                    }
                    className="w-28 rounded border p-1"
                    required
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? t("chung.dangLuu") : t("vessels.lapBaoCaoVaIn")}
      </button>
      {state.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}
    </form>
  );
}
