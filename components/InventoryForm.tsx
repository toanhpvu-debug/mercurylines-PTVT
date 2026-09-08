"use client";

import { useActionState } from "react";
import { createInventoryTransaction } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";

type MaterialOption = {
  id: number;
  code: string;
  nameVn: string;
};

type WarehouseOption = {
  id: number;
  code: string;
  name: string;
};

export default function InventoryForm({
  materials,
  warehouses,
  returnTo,
}: {
  materials: MaterialOption[];
  warehouses: WarehouseOption[];
  returnTo?: string;
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(
    createInventoryTransaction,
    { message: "" }
  );
  const v = state.values ?? {};
  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-5">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <select
        name="materialId"
        className="rounded border p-2"
        required
        defaultValue={v.materialId ?? ""}
      >
        <option value="">{t("inventory.chonVatTu")}</option>
        {materials.map((material) => (
          <option key={material.id} value={material.id}>
            {material.code} - {material.nameVn}
          </option>
        ))}
      </select>
      <select
        name="warehouseId"
        className="rounded border p-2"
        required
        defaultValue={v.warehouseId ?? ""}
      >
        <option value="">{t("inventory.chonKho")}</option>
        {warehouses.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouse.code} - {warehouse.name}
          </option>
        ))}
      </select>
      <select
        name="type"
        className="rounded border p-2"
        required
        defaultValue={v.type ?? "IN"}
      >
        <option value="IN">{t("inventory.optNhapKho")}</option>
        <option value="OUT">{t("inventory.optXuatKho")}</option>
      </select>
      <input
        name="quantity"
        type="number"
        step="0.01"
        min="0.01"
        placeholder={t("chung.soLuong")}
        className="rounded border p-2"
        defaultValue={v.quantity ?? ""}
        required
      />
      <input
        name="note"
        placeholder={t("chung.ghiChu")}
        className="rounded border p-2"
        defaultValue={v.note ?? ""}
      />
      <label className="block md:col-span-3">
        <span className="mb-1 block text-xs text-slate-600">
          {t("inventory.goiYThoiDiem")}
        </span>
        <input
          name="occurredAt"
          type="datetime-local"
          className="w-full rounded border p-2"
          defaultValue={v.occurredAt ?? ""}
        />
      </label>
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50 md:col-span-2 md:self-end"
      >
        {pending ? t("chung.dangXuLy") : t("inventory.nutThucHien")}
      </button>
      {state.message && (
        <p
          className={`text-sm md:col-span-5 ${
            state.success ? "text-green-700" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
