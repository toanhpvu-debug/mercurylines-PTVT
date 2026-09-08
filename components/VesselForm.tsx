"use client";

import { useActionState } from "react";
import { createVessel } from "@/app/actions";
import ChonMayChinh from "@/components/ChonMayChinh";
import { useNgonNgu } from "@/lib/i18n/client";

export default function VesselForm() {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(createVessel, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <input
        name="code"
        placeholder={t("vessels.phMaTau")}
        className="w-full rounded border p-2"
        defaultValue={v.code ?? ""}
        required
      />
      <input
        name="name"
        placeholder={t("vessels.phTenTau")}
        className="w-full rounded border p-2"
        defaultValue={v.name ?? ""}
        required
      />
      <input
        name="imo"
        placeholder="IMO number"
        className="w-full rounded border p-2"
        defaultValue={v.imo ?? ""}
      />
      <input
        name="flag"
        placeholder={t("vessels.coTau")}
        className="w-full rounded border p-2"
        defaultValue={v.flag ?? ""}
      />
      <input
        name="vesselType"
        placeholder={t("vessels.loaiTau")}
        className="w-full rounded border p-2"
        defaultValue={v.vesselType ?? ""}
      />
      <ChonMayChinh
        nhom={v.mainEngineGroup ?? ""}
        model={v.mainEngineModel ?? ""}
      />
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? t("chung.dangLuu") : t("vessels.themTau")}
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
