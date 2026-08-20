"use client";

import { useActionState, useMemo, useState } from "react";
import { createPurchaseOrder } from "@/app/actions";

type PendingLine = {
  id: number;
  requestNo: string;
  kind: string;
  description: string;
  partNo: string | null;
  uom: string;
  remaining: number;
};

type SupplierOption = { id: number; code: string; name: string };

export default function CreatePurchaseOrderForm({
  vesselId,
  suppliers,
  lines,
  defaultDate,
}: {
  vesselId: number;
  suppliers: SupplierOption[];
  lines: PendingLine[];
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState(createPurchaseOrder, {
    message: "",
  });
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [prices, setPrices] = useState<Record<number, string>>({});
  const selectedCount = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked]
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="vesselId" value={vesselId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Nhà cung cấp
          </label>
          <select
            name="supplierId"
            className="w-full rounded border p-2"
            defaultValue=""
            required
          >
            <option value="">Chọn nhà cung cấp</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Tiền tệ</label>
          <select
            name="currency"
            className="w-full rounded border p-2"
            defaultValue="USD"
          >
            <option value="USD">USD</option>
            <option value="VND">VND</option>
            <option value="SGD">SGD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Ngày cần hàng
          </label>
          <input
            name="expectedDate"
            type="date"
            defaultValue={defaultDate}
            className="w-full rounded border p-2"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          name="subject"
          placeholder="Subject / Nội dung (VD: Supply Lashing Equipment)"
          className="rounded border p-2"
        />
        <input
          name="supplierRef"
          placeholder="Y/ref của nhà cung cấp (nếu có)"
          className="rounded border p-2"
        />
      </div>
      <input
        name="notes"
        placeholder="Ghi chú đơn hàng"
        className="w-full rounded border p-2"
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Chiết khấu (%)
          </label>
          <input
            name="discountPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={0}
            className="w-full rounded border p-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Phí vận chuyển
          </label>
          <input
            name="transportFee"
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            className="w-full rounded border p-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Phí giao lên tàu
          </label>
          <input
            name="deliveryFee"
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            className="w-full rounded border p-2"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead>
            <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
              <th className="p-2">Chọn</th>
              <th className="p-2">Số yêu cầu</th>
              <th className="p-2">Mô tả</th>
              <th className="p-2">Part No.</th>
              <th className="p-2">ĐVT</th>
              <th className="p-2">SL cần mua</th>
              <th className="p-2">Đơn giá</th>
              <th className="p-2">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const isChecked = !!checked[l.id];
              const price = Number(prices[l.id] ?? 0);
              const amount = (Number.isFinite(price) ? price : 0) * l.remaining;
              return (
                <tr key={l.id} className="border-b">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      name={`chk_${l.id}`}
                      checked={isChecked}
                      onChange={(e) =>
                        setChecked({ ...checked, [l.id]: e.target.checked })
                      }
                    />
                  </td>
                  <td className="p-2">{l.requestNo}</td>
                  <td className="p-2">{l.description}</td>
                  <td className="p-2">{l.partNo}</td>
                  <td className="p-2">{l.uom}</td>
                  <td className="p-2">
                    <input
                      name={`qty_${l.id}`}
                      type="number"
                      step="0.01"
                      min="0.01"
                      defaultValue={l.remaining}
                      className="w-24 rounded border p-1"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      name={`price_${l.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={prices[l.id] ?? ""}
                      onChange={(e) =>
                        setPrices({ ...prices, [l.id]: e.target.value })
                      }
                      placeholder="0.00"
                      className="w-28 rounded border p-1"
                    />
                  </td>
                  <td className="p-2 text-slate-600">
                    {amount ? amount.toLocaleString("vi-VN") : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        disabled={pending || selectedCount === 0}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending
          ? "Đang tạo..."
          : `Tạo đơn mua (${selectedCount} dòng đã chọn)`}
      </button>
      {state.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}
    </form>
  );
}
