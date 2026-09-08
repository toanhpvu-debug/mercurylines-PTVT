"use client";

import { startTransition, useActionState, useState } from "react";
import { createPaintJob, deletePaintJob } from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";

type Option = { id: number; label: string };
type StockOption = { id: number; label: string; uom: string; onHand: number };

let lineKey = 0;

export function PaintJobForm({
  vesselId,
  areas,
  products,
  defaultDate,
}: {
  vesselId: number;
  areas: Option[];
  products: StockOption[];
  defaultDate: string;
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(createPaintJob, {
    message: "",
  });
  const [lines, setLines] = useState<number[]>([lineKey++]);

  if (products.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {t("paint.chuaCoSonTruoc")}{" "}
        <span className="font-medium">{t("paint.tonSon")}</span>{" "}
        {t("paint.chuaCoSonSau")}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="vesselId" value={vesselId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.ngayThiCong")} *
          </span>
          <input
            name="jobDate"
            type="date"
            defaultValue={defaultDate}
            required
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.khuVuc")}
          </span>
          <select name="areaId" className="w-full rounded border p-2">
            <option value="">{t("paint.khongGanKhuVuc")}</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.dienTichSon")}
          </span>
          <input
            name="paintedM2"
            type="number"
            step="0.1"
            min="0"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.soLopPhu")}
          </span>
          <input
            name="coats"
            type="number"
            min="1"
            step="1"
            defaultValue={1}
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.thoiTiet")}
          </span>
          <input
            name="weather"
            placeholder={t("paint.phThoiTiet")}
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.nhietDoKhongKhi")}
          </span>
          <input
            name="airTemp"
            type="number"
            step="0.1"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.doAm")}
          </span>
          <input
            name="humidity"
            type="number"
            step="1"
            min="0"
            max="100"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.nhietDoBeMat")}
          </span>
          <input
            name="surfaceTemp"
            type="number"
            step="0.1"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block md:col-span-3">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.nguoiThucHienGoiY")}
          </span>
          <input name="performedBy" className="w-full rounded border p-2" />
        </label>
        <label className="block md:col-span-4">
          <span className="mb-1 block text-sm text-slate-600">
            {t("chung.ghiChu")}
          </span>
          <input name="notes" className="w-full rounded border p-2" />
        </label>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
        <p className="mb-2 text-sm font-semibold text-blue-950">
          {t("paint.sonDaDungTuTru")}
        </p>
        <div className="space-y-2">
          {lines.map((key) => (
            <div key={key} className="flex flex-wrap items-end gap-2">
              <label className="block flex-1 min-w-[220px]">
                <span className="mb-1 block text-xs text-slate-600">
                  {t("paint.loaiSon")}
                </span>
                <select
                  name="lineProductId"
                  className="w-full rounded border p-2"
                >
                  <option value="">{t("paint.chonSon")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}{" "}
                      {t("paint.conLaiN", { n: p.onHand, dv: p.uom })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block w-32">
                <span className="mb-1 block text-xs text-slate-600">
                  {t("chung.soLuong")}
                </span>
                <input
                  name="lineQuantity"
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full rounded border p-2"
                />
              </label>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLines((ls) => ls.filter((k) => k !== key))}
                  className="pb-2 text-sm text-red-600 hover:underline"
                >
                  {t("paint.xoaDong")}
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLines((ls) => [...ls, lineKey++])}
          className="mt-2 text-sm text-blue-700 hover:underline"
        >
          + {t("paint.themDong")}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-blue-700 px-6 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? t("paint.dangGhi") : t("paint.nutGhiNhatKy")}
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

export function PaintJobDeleteButton({
  vesselId,
  jobId,
}: {
  vesselId: number;
  jobId: number;
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(deletePaintJob, {
    message: "",
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirm(t("paint.xacNhanXoaThiCong"))) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="vesselId" value={vesselId} />
      <input type="hidden" name="id" value={jobId} />
      <button
        disabled={pending}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
        title={state.message || undefined}
      >
        {t("chung.xoa")}
      </button>
    </form>
  );
}
