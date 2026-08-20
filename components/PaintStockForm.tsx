"use client";

import { useActionState, useState } from "react";
import { paintStockMove, savePaintStockMin } from "@/app/paint-actions";

export type StockProductOption = { id: number; label: string; uom: string };

export function PaintStockMoveForm({
  vesselId,
  products,
}: {
  vesselId: number;
  products: StockProductOption[];
}) {
  const [state, action, pending] = useActionState(paintStockMove, {
    message: "",
  });
  const [type, setType] = useState("IN");

  if (products.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Chưa có loại sơn nào đang dùng. Thêm ở trang{" "}
        <span className="font-medium">Danh mục sơn</span> trước.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="vesselId" value={vesselId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm text-slate-600">Loại sơn *</span>
          <select name="productId" required className="w-full rounded border p-2">
            <option value="">— Chọn sơn —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">Thao tác *</span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded border p-2"
          >
            <option value="IN">Nhận sơn lên tàu</option>
            <option value="OUT">Xuất / hao hụt</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">Số lượng *</span>
          <input
            name="quantity"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            Thời điểm (để trống = bây giờ)
          </span>
          <input
            name="occurredAt"
            type="datetime-local"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block md:col-span-5">
          <span className="mb-1 block text-sm text-slate-600">Ghi chú</span>
          <input
            name="note"
            placeholder="Số lô, cảng nhận, lý do xuất..."
            className="w-full rounded border p-2"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-blue-700 px-5 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Đang ghi..." : "Ghi giao dịch"}
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

export function PaintStockMinForm({
  vesselId,
  productId,
  minQty,
}: {
  vesselId: number;
  productId: number;
  minQty: number;
}) {
  const [state, action, pending] = useActionState(savePaintStockMin, {
    message: "",
  });
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="vesselId" value={vesselId} />
      <input type="hidden" name="productId" value={productId} />
      <input
        name="minQty"
        type="number"
        step="0.01"
        min="0"
        defaultValue={minQty || ""}
        className="w-20 rounded border p-1 text-right text-sm"
      />
      <button
        disabled={pending}
        className="text-xs text-blue-700 hover:underline disabled:opacity-50"
        title={state.message || "Lưu định mức tối thiểu"}
      >
        Lưu
      </button>
    </form>
  );
}
