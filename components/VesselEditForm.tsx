"use client";

import { useActionState } from "react";
import { updateVessel } from "@/app/actions";
import ChonMayChinh from "@/components/ChonMayChinh";
import { useNgonNgu } from "@/lib/i18n/client";

type VesselData = {
  id: number;
  code: string;
  name: string;
  imo: string | null;
  flag: string | null;
  vesselType: string | null;
  status: string;
  mainEngineGroup: string | null;
  mainEngineModel: string | null;
};

export default function VesselEditForm({ vessel }: { vessel: VesselData }) {
  const { t, tTuDo } = useNgonNgu();
  const [state, formAction, pending] = useActionState(updateVessel, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={vessel.id} />
      <div>
        <label className="mb-1 block text-sm text-slate-600">
          {t("vessels.maTau")}
        </label>
        <input
          name="code"
          className="w-full rounded border p-2"
          defaultValue={v.code ?? vessel.code}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">
          {t("vessels.tenTau")}
        </label>
        <input
          name="name"
          className="w-full rounded border p-2"
          defaultValue={v.name ?? vessel.name}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">IMO number</label>
        <input
          name="imo"
          className="w-full rounded border p-2"
          defaultValue={v.imo ?? vessel.imo ?? ""}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">
          {t("vessels.coTau")}
        </label>
        <input
          name="flag"
          className="w-full rounded border p-2"
          defaultValue={v.flag ?? vessel.flag ?? ""}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">
          {t("vessels.loaiTau")}
        </label>
        <input
          name="vesselType"
          className="w-full rounded border p-2"
          defaultValue={v.vesselType ?? vessel.vesselType ?? ""}
        />
      </div>
      <ChonMayChinh
        nhom={v.mainEngineGroup ?? vessel.mainEngineGroup ?? ""}
        model={v.mainEngineModel ?? vessel.mainEngineModel ?? ""}
      />
      <div>
        <label className="mb-1 block text-sm text-slate-600">
          {t("chung.trangThai")}
        </label>
        <select
          name="status"
          className="w-full rounded border p-2"
          defaultValue={v.status ?? vessel.status}
        >
          <option value="ACTIVE">{tTuDo("labels.vesselStatus_ACTIVE")}</option>
          <option value="MAINTENANCE">{t("vessels.trangThaiBaoDuong")}</option>
          <option value="INACTIVE">
            {tTuDo("labels.vesselStatus_INACTIVE")}
          </option>
        </select>
      </div>
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? t("chung.dangLuu") : t("vessels.luuThayDoi")}
      </button>
      {state.message && (
        <p
          className={`text-sm ${
            state.success ? "text-green-700" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
