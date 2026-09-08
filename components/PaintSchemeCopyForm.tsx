"use client";

import { useActionState, useState } from "react";
import { copyPaintScheme } from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";

export default function PaintSchemeCopyForm({
  vesselId,
  sources,
}: {
  vesselId: number;
  sources: { id: number; label: string; areaCount: number }[];
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(copyPaintScheme, {
    message: "",
  });
  const [open, setOpen] = useState(false);

  const usable = sources.filter((s) => s.id !== vesselId && s.areaCount > 0);
  if (usable.length === 0) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-blue-300 bg-white px-4 py-2 text-sm text-blue-800 hover:bg-blue-50"
      >
        {t("paint.saoChepTuTauKhac")}
      </button>
    );
  }

  return (
    <form
      action={action}
      className="w-full space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4"
    >
      <input type="hidden" name="vesselId" value={vesselId} />
      <p className="font-semibold text-blue-950">{t("paint.saoChepSoDo")}</p>
      <p className="text-sm text-slate-600">
        {t("paint.saoChepMoTa1")} <b>{t("paint.saoChepMoTaDam")}</b>
        {t("paint.saoChepMoTa2")}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[260px] flex-1">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.tauNguon")} *
          </span>
          <select
            name="fromVesselId"
            required
            className="w-full rounded border p-2"
          >
            <option value="">{t("paint.chonTauOption")}</option>
            {usable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({t("paint.nKhuVuc", { n: s.areaCount })})
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={pending}
          className="rounded bg-blue-700 px-5 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? t("paint.dangChep") : t("paint.nutSaoChep")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="pb-2 text-sm text-slate-600 hover:underline"
        >
          {t("chung.dong")}
        </button>
      </div>
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
