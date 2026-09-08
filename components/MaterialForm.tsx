"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createMaterial } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select } from "@/components/ui";

type CategoryOption = {
  id: number;
  name: string;
};

export default function MaterialForm({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(createMaterial, {
    message: "",
  });
  const v = state.values ?? {};
  const [materialType, setMaterialType] = useState(v.materialType ?? "STORE");
  const isSpare = materialType === "SPARE";
  return (
    <form action={formAction} className="space-y-3">
      <Field label={t("materials.loai")}>
        <Select
          name="materialType"
          value={materialType}
          onChange={(e) => setMaterialType(e.target.value)}
        >
          <option value="STORE">{t("materials.loaiStoreMLS")}</option>
          <option value="SPARE">{t("materials.loaiSpareMLS")}</option>
        </Select>
      </Field>
      <Field label={t("materials.phMaVatTu")}>
        <Input name="code" defaultValue={v.code ?? ""} required />
      </Field>
      <Field label={t("materials.phTenVi")}>
        <Input name="nameVn" defaultValue={v.nameVn ?? ""} required />
      </Field>
      <Field label={t("materials.phTenEn")}>
        <Input name="nameEn" defaultValue={v.nameEn ?? ""} />
      </Field>
      {isSpare && (
        <Field label={t("materials.phThietBi")}>
          <Input name="equipment" defaultValue={v.equipment ?? ""} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("materials.phImpa")}>
          <Input name="impa" defaultValue={v.impa ?? ""} />
        </Field>
        <Field label={t("materials.phPartNo")}>
          <Input name="partNumber" defaultValue={v.partNumber ?? ""} />
        </Field>
      </div>
      <Field label={t("materials.phMaker")}>
        <Input name="manufacturer" defaultValue={v.manufacturer ?? ""} />
      </Field>
      <Field label={t("chung.nhom")}>
        <Select name="categoryId" defaultValue={v.categoryId ?? ""}>
          <option value="">{t("materials.optChonNhom")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("chung.donVi")}>
        <Input
          name="uom"
          placeholder={t("materials.phDonVi")}
          defaultValue={v.uom ?? "PCS"}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("materials.tonToiThieu")}>
          <Input
            name="minStock"
            type="number"
            step="0.01"
            defaultValue={v.minStock ?? "0"}
          />
        </Field>
        <Field label={t("materials.tonToiDa")}>
          <Input
            name="maxStock"
            type="number"
            step="0.01"
            defaultValue={v.maxStock ?? "0"}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
        <input
          type="checkbox"
          name="isCritical"
          defaultChecked={v.isCritical === "on"}
          className="size-4 accent-brand-600"
        />
        {t("materials.vatTuQuanTrong")}
      </label>
      <Button
        type="submit"
        variant="primary"
        loading={pending}
        icon={<Plus className="size-4" />}
      >
        {pending ? t("chung.dangLuu") : t("materials.nutThemVatTu")}
      </Button>
      {state.message && (
        <Notice tone={state.success ? "success" : "danger"}>
          {state.message}
        </Notice>
      )}
    </form>
  );
}
