"use client";

import { startTransition, useActionState, useState } from "react";
import { importPaintProducts } from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";

type VesselOption = { id: number; label: string };

export default function PaintImportForm({
  vessels,
}: {
  vessels: VesselOption[];
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(importPaintProducts, {
    message: "",
  });
  // Hai nguồn loại trừ nhau — chọn một để tránh gửi cả hai rồi không rõ cái nào thắng.
  const [mode, setMode] = useState<"excel" | "paste">("excel");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (mode === "excel") fd.delete("pasted");
        else fd.delete("file");
        startTransition(() => action(fd));
      }}
      className="space-y-4"
    >
      <label className="block max-w-md">
        <span className="mb-1 block text-sm text-slate-600">
          {t("paint.ghiTonChoTau")}
        </span>
        <select name="vesselId" className="w-full rounded border p-2">
          <option value="">{t("paint.chiNapDanhMuc")}</option>
          {vessels.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-slate-500">
          {t("paint.goiYGhiTon")}
        </span>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("excel")}
          className={`rounded px-4 py-2 text-sm ${
            mode === "excel"
              ? "bg-blue-700 text-white"
              : "border border-blue-200 bg-white text-blue-800 hover:bg-blue-50"
          }`}
        >
          {t("paint.tuFileExcel")}
        </button>
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`rounded px-4 py-2 text-sm ${
            mode === "paste"
              ? "bg-blue-700 text-white"
              : "border border-blue-200 bg-white text-blue-800 hover:bg-blue-50"
          }`}
        >
          {t("paint.danTuPdf")}
        </button>
      </div>

      {mode === "excel" ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
          <p className="mb-1 font-semibold text-blue-950">
            File Excel (.xls / .xlsx)
          </p>
          <p className="mb-3 text-xs text-slate-600">
            {t("paint.nhapExcelHint1")} <b>{t("paint.nhapExcelCotTenSon")}</b>{" "}
            {t("paint.nhapExcelHint2")}
          </p>
          <input
            type="file"
            name="file"
            accept=".xls,.xlsx"
            className="text-sm"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
          <p className="mb-1 font-semibold text-blue-950">
            {t("paint.danNoiDungPdf")}
          </p>
          <p className="mb-2 text-xs text-slate-600">
            {t("paint.danHint1")}
            <b>Ctrl+A</b>
            {t("paint.danHint2")}
            <b>Ctrl+C</b>
            {t("paint.danHint3")}
          </p>
          <textarea
            name="pasted"
            rows={10}
            placeholder={t("paint.phDanBang")}
            className="w-full rounded border p-2 font-mono text-xs"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-blue-700 px-6 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? t("paint.dangDoc") : t("paint.nutNhapVaoDanhMuc")}
        </button>
        {state.message && (
          <span
            className={`text-sm ${
              state.success ? "text-green-700" : "text-red-600"
            }`}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
