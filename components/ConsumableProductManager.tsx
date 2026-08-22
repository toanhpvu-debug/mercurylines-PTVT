"use client";

import { useActionState, useState } from "react";
import {
  deleteConsumableProduct,
  saveConsumableProduct,
  toggleConsumableProduct,
} from "@/app/consumable-actions";
import {
  CONSUMABLE_CATEGORIES,
  GRADES,
  UOM_GOI_Y,
} from "@/lib/consumables";

export type ProductRow = {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  category: string;
  grade: string;
  maker: string | null;
  uom: string;
  sulphurMax: number | null;
  viscosity: number | null;
  density: number | null;
  bnValue: number | null;
  hazardClass: string | null;
  shelfLifeMonths: number | null;
  isActive: boolean;
};

function Nhan({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-sm text-slate-600">{children}</span>;
}

/**
 * Form thêm / sửa một mặt hàng.
 *
 * Ô nhập đổi theo NHÓM: hỏi lưu huỳnh của một can hóa chất tẩy rửa, hay hỏi
 * hạn dùng của một lô HFO, đều là ô trống vô nghĩa mà người dùng vẫn phải đọc
 * qua rồi bỏ trống.
 */
export function ConsumableProductForm({ row }: { row?: ProductRow }) {
  const [state, action, pending] = useActionState(saveConsumableProduct, {
    message: "",
  });
  const [category, setCategory] = useState(row?.category ?? "FUEL");
  const laDau = category === "FUEL";
  const laNhon = category === "LUBE";
  const laHoaChat = category === "CHEMICAL";

  return (
    <form action={action} className="space-y-3">
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="grid gap-3 md:grid-cols-4">
        <label className="block">
          <Nhan>Nhóm *</Nhan>
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded border p-2"
          >
            {CONSUMABLE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <Nhan>Chủng loại *</Nhan>
          <select
            name="grade"
            defaultValue={row?.grade}
            key={category}
            className="w-full rounded border p-2"
          >
            {GRADES[category].map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block md:col-span-2">
          <Nhan>Tên mặt hàng *</Nhan>
          <input
            name="name"
            required
            defaultValue={row?.name}
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <Nhan>Mã (trống = tự sinh)</Nhan>
          <input
            name="code"
            defaultValue={row?.code}
            placeholder={laDau ? "FO-0001" : laNhon ? "LO-0001" : "CH-0001"}
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <Nhan>Hãng SX</Nhan>
          <input
            name="maker"
            defaultValue={row?.maker ?? ""}
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <Nhan>Đơn vị tính *</Nhan>
          <input
            name="uom"
            list="uom-goi-y"
            defaultValue={row?.uom ?? (laDau ? "MT" : "L")}
            className="w-full rounded border p-2"
          />
          <datalist id="uom-goi-y">
            {(UOM_GOI_Y[category] ?? []).map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <Nhan>Dung tích 1 thùng/can (L)</Nhan>
          <input
            name="packSize"
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded border p-2"
          />
        </label>
      </div>

      {(laDau || laNhon) && (
        <fieldset className="rounded border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">
            Đặc tính danh nghĩa
          </legend>
          <p className="mb-2 text-xs text-slate-500">
            Đây là đặc tính của MẶT HÀNG. Đặc tính thực của từng lô ghi ở phiếu
            nhận — hai lô cùng mặt hàng có thể khác nhau.
          </p>
          <div className="grid gap-3 md:grid-cols-4">
            {laDau && (
              <label className="block">
                <Nhan>Lưu huỳnh tối đa (% m/m)</Nhan>
                <input
                  name="sulphurMax"
                  type="number"
                  step="0.001"
                  defaultValue={row?.sulphurMax ?? ""}
                  className="w-full rounded border p-2"
                />
              </label>
            )}
            <label className="block">
              <Nhan>Độ nhớt (cSt)</Nhan>
              <input
                name="viscosity"
                type="number"
                step="0.1"
                defaultValue={row?.viscosity ?? ""}
                className="w-full rounded border p-2"
              />
            </label>
            <label className="block">
              <Nhan>Khối lượng riêng @15°C</Nhan>
              <input
                name="density"
                type="number"
                step="0.1"
                defaultValue={row?.density ?? ""}
                className="w-full rounded border p-2"
              />
            </label>
            {laNhon && (
              <label className="block">
                <Nhan>TBN (mgKOH/g)</Nhan>
                <input
                  name="bnValue"
                  type="number"
                  step="0.1"
                  defaultValue={row?.bnValue ?? ""}
                  className="w-full rounded border p-2"
                />
              </label>
            )}
          </div>
        </fieldset>
      )}

      {laHoaChat && (
        <fieldset className="rounded border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">
            An toàn &amp; hạn dùng
          </legend>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <Nhan>Phân loại nguy hiểm (IMDG/GHS)</Nhan>
              <input
                name="hazardClass"
                defaultValue={row?.hazardClass ?? ""}
                placeholder="VD: Class 8 — ăn mòn"
                className="w-full rounded border p-2"
              />
            </label>
            <label className="block">
              <Nhan>Hạn dùng (tháng)</Nhan>
              <input
                name="shelfLifeMonths"
                type="number"
                min="0"
                step="1"
                defaultValue={row?.shelfLifeMonths ?? ""}
                className="w-full rounded border p-2"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Khai ở đây thì mỗi lô nhận tự tính hạn dùng.
              </span>
            </label>
            <label className="block">
              <Nhan>Ghi chú an toàn / nơi lưu MSDS</Nhan>
              <input name="msdsNote" className="w-full rounded border p-2" />
            </label>
          </div>
        </fieldset>
      )}

      <label className="block">
        <Nhan>Ghi chú</Nhan>
        <input name="notes" className="w-full rounded border p-2" />
      </label>

      <button
        disabled={pending}
        className="rounded bg-blue-700 px-5 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : row ? "Lưu thay đổi" : "Thêm mặt hàng"}
      </button>
      {state.message && (
        <p
          className={`text-sm ${
            state.success ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

export function ConsumableProductActions({ row }: { row: ProductRow }) {
  const [tState, tAction, tPending] = useActionState(toggleConsumableProduct, {
    message: "",
  });
  const [dState, dAction, dPending] = useActionState(deleteConsumableProduct, {
    message: "",
  });
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <form action={tAction}>
          <input type="hidden" name="id" value={row.id} />
          <button
            disabled={tPending}
            className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            {row.isActive ? "Ngừng dùng" : "Dùng lại"}
          </button>
        </form>
        <form
          action={dAction}
          onSubmit={(e) => {
            if (!confirm(`Xóa hẳn "${row.name}" khỏi danh mục?`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={row.id} />
          <button
            disabled={dPending}
            className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            Xóa
          </button>
        </form>
      </div>
      {[tState.message, dState.message]
        .filter((m) => m)
        .map((m, i) => (
          <span key={i} className="max-w-72 text-right text-xs text-red-600">
            {m}
          </span>
        ))}
    </div>
  );
}
