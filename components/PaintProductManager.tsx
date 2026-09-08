"use client";

import { startTransition, useActionState, useState } from "react";
import {
  deletePaintProduct,
  savePaintProduct,
  togglePaintProduct,
} from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";

export type PaintProductRow = {
  id: number;
  code: string;
  name: string;
  maker: string | null;
  paintType: string;
  colorCode: string | null;
  colorName: string | null;
  uom: string;
  packSize: number;
  coverage: number;
  dftPerCoat: number;
  thinner: string | null;
  notes: string | null;
  isActive: boolean;
};

type TypeOption = { value: string; label: string };

const num = (v: number) => (v ? String(v) : "");

function ProductFields({
  product,
  types,
}: {
  product?: PaintProductRow;
  types: readonly TypeOption[];
}) {
  const { t, tTuDo } = useNgonNgu();
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">
          {t("paint.tenSon")} *
        </span>
        <input
          name="name"
          defaultValue={product?.name ?? ""}
          required
          placeholder={t("paint.phVdMarathon")}
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">
          {t("paint.hang")}
        </span>
        <input
          name="maker"
          defaultValue={product?.maker ?? ""}
          placeholder="Jotun / International / Chugoku..."
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">
          {t("paint.kieuSon")} *
        </span>
        <select
          name="paintType"
          defaultValue={product?.paintType ?? "OTHER"}
          className="w-full rounded border p-2"
        >
          {types.map((loai) => (
            <option key={loai.value} value={loai.value}>
              {tTuDo(`paint.loaiSon_${loai.value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">
          {t("paint.maMau")}
        </span>
        <input
          name="colorCode"
          defaultValue={product?.colorCode ?? ""}
          placeholder="RAL 7035..."
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">
          {t("paint.tenMau")}
        </span>
        <input
          name="colorName"
          defaultValue={product?.colorName ?? ""}
          placeholder={t("paint.phTenMau")}
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">
          {t("chung.donVi")}
        </span>
        <input
          name="uom"
          defaultValue={product?.uom ?? "L"}
          placeholder={t("paint.phDonViSon")}
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">
          {t("paint.dungTichLon")}
        </span>
        <input
          name="packSize"
          type="number"
          step="0.01"
          min="0"
          defaultValue={num(product?.packSize ?? 0)}
          placeholder="20"
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">
          {t("paint.doPhuLyThuyet")}
        </span>
        <input
          name="coverage"
          type="number"
          step="0.01"
          min="0"
          defaultValue={num(product?.coverage ?? 0)}
          placeholder="7.5"
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">
          {t("paint.dftMoiLop")}
        </span>
        <input
          name="dftPerCoat"
          type="number"
          step="1"
          min="0"
          defaultValue={num(product?.dftPerCoat ?? 0)}
          placeholder="100"
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block md:col-span-1">
        <span className="mb-1 block text-sm text-slate-600">
          {t("paint.dungMoi")}
        </span>
        <input
          name="thinner"
          defaultValue={product?.thinner ?? ""}
          placeholder="Thinner No.7"
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block md:col-span-2">
        <span className="mb-1 block text-sm text-slate-600">
          {t("chung.ghiChu")}
        </span>
        <input
          name="notes"
          defaultValue={product?.notes ?? ""}
          className="w-full rounded border p-2"
        />
      </label>
    </div>
  );
}

export function PaintProductAddForm({ types }: { types: readonly TypeOption[] }) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(savePaintProduct, {
    message: "",
  });
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800"
      >
        + {t("paint.themLoaiSon")}
      </button>
    );
  }
  return (
    <form
      action={action}
      className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4"
    >
      <p className="font-semibold text-blue-950">{t("paint.themLoaiSon")}</p>
      <ProductFields types={types} />
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-blue-700 px-5 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? t("chung.dangLuu") : t("chung.luu")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-600 hover:underline"
        >
          {t("chung.dong")}
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

export function PaintProductRowActions({
  product,
  types,
  canDelete,
}: {
  product: PaintProductRow;
  types: readonly TypeOption[];
  canDelete: boolean;
}) {
  const { t } = useNgonNgu();
  const [editing, setEditing] = useState(false);
  const [saveState, saveAction, savePending] = useActionState(
    savePaintProduct,
    { message: "" }
  );
  const [toggleState, toggleAction, togglePending] = useActionState(
    togglePaintProduct,
    { message: "" }
  );
  const [delState, delAction, delPending] = useActionState(deletePaintProduct, {
    message: "",
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-sm text-blue-700 hover:underline"
        >
          {editing ? t("chung.dong") : t("chung.sua")}
        </button>
        <form action={toggleAction}>
          <input type="hidden" name="id" value={product.id} />
          <button
            disabled={togglePending}
            className="text-sm text-amber-700 hover:underline disabled:opacity-50"
          >
            {product.isActive
              ? t("paint.nutNgungDung")
              : t("paint.nutDungLai")}
          </button>
        </form>
        {canDelete && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                !confirm(
                  t("paint.xacNhanXoaLoaiSon", { ten: product.name })
                )
              )
                return;
              const fd = new FormData(e.currentTarget);
              startTransition(() => delAction(fd));
            }}
          >
            <input type="hidden" name="id" value={product.id} />
            <button
              disabled={delPending}
              className="text-sm text-red-600 hover:underline disabled:opacity-50"
            >
              {t("chung.xoa")}
            </button>
          </form>
        )}
      </div>
      {(toggleState.message || delState.message) && (
        <p
          className={`text-xs ${
            toggleState.success || delState.success
              ? "text-green-700"
              : "text-red-600"
          }`}
        >
          {toggleState.message || delState.message}
        </p>
      )}
      {editing && (
        <form
          action={saveAction}
          className="space-y-3 rounded border border-blue-200 bg-blue-50/40 p-3"
        >
          <input type="hidden" name="id" value={product.id} />
          <label className="block max-w-xs">
            <span className="mb-1 block text-sm text-slate-600">
              {t("paint.maSon")}
            </span>
            <input
              name="code"
              defaultValue={product.code}
              className="w-full rounded border p-2"
            />
          </label>
          <ProductFields product={product} types={types} />
          <div className="flex items-center gap-3">
            <button
              disabled={savePending}
              className="rounded bg-blue-700 px-5 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {savePending ? t("chung.dangLuu") : t("paint.luuThayDoi")}
            </button>
            {saveState.message && (
              <span
                className={`text-sm ${
                  saveState.success ? "text-green-700" : "text-red-600"
                }`}
              >
                {saveState.message}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
