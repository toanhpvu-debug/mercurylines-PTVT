"use client";

import { useActionState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { createInventoryTransaction } from "@/app/actions";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
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
      <Field label={t("chung.vatTu")}>
        <Select name="materialId" required defaultValue={v.materialId ?? ""}>
          <option value="">{t("inventory.chonVatTu")}</option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.code} - {material.nameVn}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("chung.kho")}>
        <Select name="warehouseId" required defaultValue={v.warehouseId ?? ""}>
          <option value="">{t("inventory.chonKho")}</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.code} - {warehouse.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("inventory.loai")}>
        <Select name="type" required defaultValue={v.type ?? "IN"}>
          <option value="IN">{t("inventory.optNhapKho")}</option>
          <option value="OUT">{t("inventory.optXuatKho")}</option>
        </Select>
      </Field>
      <Field label={t("chung.soLuong")}>
        <Input
          name="quantity"
          type="number"
          step="0.01"
          min="0.01"
          placeholder={t("chung.soLuong")}
          className="tabular"
          defaultValue={v.quantity ?? ""}
          required
        />
      </Field>
      <Field label={t("chung.ghiChu")}>
        <Input
          name="note"
          placeholder={t("chung.ghiChu")}
          defaultValue={v.note ?? ""}
        />
      </Field>
      <Field label={t("inventory.goiYThoiDiem")} className="md:col-span-3">
        <Input
          name="occurredAt"
          type="datetime-local"
          defaultValue={v.occurredAt ?? ""}
        />
      </Field>
      <div className="flex items-end md:col-span-2">
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          icon={<ArrowLeftRight className="size-4" />}
          className="w-full"
        >
          {pending ? t("chung.dangXuLy") : t("inventory.nutThucHien")}
        </Button>
      </div>
      {state.message && (
        <Notice tone={state.success ? "success" : "danger"} className="md:col-span-5">
          {state.message}
        </Notice>
      )}
    </form>
  );
}
