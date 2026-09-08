"use client";

import { useActionState, useState } from "react";
import { createMaterial } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";

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
      <div>
        <label className="mb-1 block text-sm text-slate-600">
          {t("materials.loai")}
        </label>
        <select
          name="materialType"
          className="w-full rounded border p-2"
          value={materialType}
          onChange={(e) => setMaterialType(e.target.value)}
        >
          <option value="STORE">{t("materials.loaiStoreMLS")}</option>
          <option value="SPARE">{t("materials.loaiSpareMLS")}</option>
        </select>
      </div>
      <input
        name="code"
        placeholder={t("materials.phMaVatTu")}
        className="w-full rounded border p-2"
        defaultValue={v.code ?? ""}
        required
      />
      <input
        name="nameVn"
        placeholder={t("materials.phTenVi")}
        className="w-full rounded border p-2"
        defaultValue={v.nameVn ?? ""}
        required
      />
      <input
        name="nameEn"
        placeholder={t("materials.phTenEn")}
        className="w-full rounded border p-2"
        defaultValue={v.nameEn ?? ""}
      />
      {isSpare && (
        <input
          name="equipment"
          placeholder={t("materials.phThietBi")}
          className="w-full rounded border p-2"
          defaultValue={v.equipment ?? ""}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <input
          name="impa"
          placeholder={t("materials.phImpa")}
          className="w-full rounded border p-2"
          defaultValue={v.impa ?? ""}
        />
        <input
          name="partNumber"
          placeholder={t("materials.phPartNo")}
          className="w-full rounded border p-2"
          defaultValue={v.partNumber ?? ""}
        />
      </div>
      <input
        name="manufacturer"
        placeholder={t("materials.phMaker")}
        className="w-full rounded border p-2"
        defaultValue={v.manufacturer ?? ""}
      />
      <select
        name="categoryId"
        className="w-full rounded border p-2"
        defaultValue={v.categoryId ?? ""}
      >
        <option value="">{t("materials.optChonNhom")}</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <input
        name="uom"
        placeholder={t("materials.phDonVi")}
        className="w-full rounded border p-2"
        defaultValue={v.uom ?? "PCS"}
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          name="minStock"
          type="number"
          step="0.01"
          placeholder={t("materials.tonToiThieu")}
          className="w-full rounded border p-2"
          defaultValue={v.minStock ?? "0"}
        />
        <input
          name="maxStock"
          type="number"
          step="0.01"
          placeholder={t("materials.tonToiDa")}
          className="w-full rounded border p-2"
          defaultValue={v.maxStock ?? "0"}
        />
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="isCritical"
          defaultChecked={v.isCritical === "on"}
        />
        {t("materials.vatTuQuanTrong")}
      </label>
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? t("chung.dangLuu") : t("materials.nutThemVatTu")}
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
