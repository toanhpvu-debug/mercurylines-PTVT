"use client";

import { useActionState } from "react";
import {
  receivePurchaseOrder,
  updatePurchaseOrderStatus,
} from "@/app/actions";

export function POStatusButton({
  id,
  status,
  label,
  className,
}: {
  id: number;
  status: string;
  label: string;
  className: string;
}) {
  const [state, formAction, pending] = useActionState(
    updatePurchaseOrderStatus,
    { message: "" }
  );
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          status === "CANCELLED" &&
          !window.confirm("Hủy đơn mua này? Không hoàn tác được.")
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button disabled={pending} className={className}>
        {pending ? "..." : label}
      </button>
      {state.message && (
        <p className="mt-1 text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}

type ReceiveLine = {
  id: number;
  description: string;
  partNo: string | null;
  uom: string;
  quantity: number;
  quantityReceived: number;
  hasMaterial: boolean;
};

type WarehouseOption = { id: number; code: string; name: string };

export function ReceiveGoodsForm({
  poId,
  lines,
  warehouses,
}: {
  poId: number;
  lines: ReceiveLine[];
  warehouses: WarehouseOption[];
}) {
  const [state, formAction, pending] = useActionState(receivePurchaseOrder, {
    message: "",
  });
  const anyMaterial = lines.some((l) => l.hasMaterial);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={poId} />
      {anyMaterial && (
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            Kho nhận vào (cho vật tư có trong danh mục)
          </label>
          <select
            name="warehouseId"
            className="rounded border p-2"
            defaultValue=""
            required
          >
            <option value="">Chọn kho</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead>
            <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
              <th className="p-2">Mô tả</th>
              <th className="p-2">Part No.</th>
              <th className="p-2">ĐVT</th>
              <th className="p-2">SL đặt</th>
              <th className="p-2">Đã nhận</th>
              <th className="p-2">Nhận lần này</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const remaining = Math.max(0, l.quantity - l.quantityReceived);
              return (
                <tr key={l.id} className="border-b">
                  <td className="p-2">
                    {l.description}
                    {!l.hasMaterial && (
                      <span className="ml-1 text-xs text-slate-400">
                        (ngoài danh mục — không nhập kho)
                      </span>
                    )}
                  </td>
                  <td className="p-2">{l.partNo}</td>
                  <td className="p-2">{l.uom}</td>
                  <td className="p-2">{l.quantity}</td>
                  <td className="p-2">{l.quantityReceived}</td>
                  <td className="p-2">
                    <input
                      name={`recv_${l.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      max={remaining}
                      defaultValue={0}
                      disabled={remaining <= 0}
                      className="w-24 rounded border p-1 disabled:bg-slate-100"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        disabled={pending}
        className="rounded bg-green-100 px-4 py-2 text-green-700 hover:bg-green-200 disabled:opacity-50"
      >
        {pending ? "Đang ghi nhận..." : "Ghi nhận nhận hàng"}
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
