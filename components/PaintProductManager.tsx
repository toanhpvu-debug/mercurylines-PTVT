"use client";

import { startTransition, useActionState, useState } from "react";
import {
  deletePaintProduct,
  savePaintProduct,
  togglePaintProduct,
} from "@/app/paint-actions";

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
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">Tên sơn *</span>
        <input
          name="name"
          defaultValue={product?.name ?? ""}
          required
          placeholder="VD: Marathon 500"
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">Hãng</span>
        <input
          name="maker"
          defaultValue={product?.maker ?? ""}
          placeholder="Jotun / International / Chugoku..."
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">Loại sơn *</span>
        <select
          name="paintType"
          defaultValue={product?.paintType ?? "OTHER"}
          className="w-full rounded border p-2"
        >
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">Mã màu</span>
        <input
          name="colorCode"
          defaultValue={product?.colorCode ?? ""}
          placeholder="RAL 7035..."
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">Tên màu</span>
        <input
          name="colorName"
          defaultValue={product?.colorName ?? ""}
          placeholder="Xám nhạt"
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">Đơn vị</span>
        <input
          name="uom"
          defaultValue={product?.uom ?? "L"}
          placeholder="L / Lon / Thùng"
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">
          Dung tích 1 lon (lít)
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
          Độ phủ lý thuyết (m²/lít)
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
          DFT mỗi lớp (micron)
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
        <span className="mb-1 block text-sm text-slate-600">Dung môi pha</span>
        <input
          name="thinner"
          defaultValue={product?.thinner ?? ""}
          placeholder="Thinner No.7"
          className="w-full rounded border p-2"
        />
      </label>
      <label className="block md:col-span-2">
        <span className="mb-1 block text-sm text-slate-600">Ghi chú</span>
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
        + Thêm loại sơn
      </button>
    );
  }
  return (
    <form
      action={action}
      className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4"
    >
      <p className="font-semibold text-blue-950">Thêm loại sơn</p>
      <ProductFields types={types} />
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-blue-700 px-5 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Đang lưu..." : "Lưu"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-600 hover:underline"
        >
          Đóng
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
          {editing ? "Đóng" : "Sửa"}
        </button>
        <form action={toggleAction}>
          <input type="hidden" name="id" value={product.id} />
          <button
            disabled={togglePending}
            className="text-sm text-amber-700 hover:underline disabled:opacity-50"
          >
            {product.isActive ? "Ngừng dùng" : "Dùng lại"}
          </button>
        </form>
        {canDelete && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                !confirm(
                  `Xóa vĩnh viễn loại sơn "${product.name}"? Chỉ xóa được khi chưa dùng ở đâu.`
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
              Xóa
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
            <span className="mb-1 block text-sm text-slate-600">Mã sơn</span>
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
              {savePending ? "Đang lưu..." : "Lưu thay đổi"}
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
