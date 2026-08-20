"use client";

import { useActionState, useState } from "react";
import { createMaterial } from "@/app/actions";

type CategoryOption = {
  id: number;
  name: string;
};

export default function MaterialForm({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const [state, formAction, pending] = useActionState(createMaterial, {
    message: "",
  });
  const v = state.values ?? {};
  const [materialType, setMaterialType] = useState(v.materialType ?? "STORE");
  const isSpare = materialType === "SPARE";
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm text-slate-600">Loại</label>
        <select
          name="materialType"
          className="w-full rounded border p-2"
          value={materialType}
          onChange={(e) => setMaterialType(e.target.value)}
        >
          <option value="STORE">Vật tư (Store) — MLS-11-05B</option>
          <option value="SPARE">Phụ tùng (Spare part) — MLS-11-05A</option>
        </select>
      </div>
      <input
        name="code"
        placeholder="Mã vật tư"
        className="w-full rounded border p-2"
        defaultValue={v.code ?? ""}
        required
      />
      <input
        name="nameVn"
        placeholder="Tên vật tư / phụ tùng (tiếng Việt)"
        className="w-full rounded border p-2"
        defaultValue={v.nameVn ?? ""}
        required
      />
      <input
        name="nameEn"
        placeholder="Tên tiếng Anh / Name of part"
        className="w-full rounded border p-2"
        defaultValue={v.nameEn ?? ""}
      />
      {isSpare && (
        <input
          name="equipment"
          placeholder="Thiết bị / máy (Equipment)"
          className="w-full rounded border p-2"
          defaultValue={v.equipment ?? ""}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <input
          name="impa"
          placeholder="Mã IMPA"
          className="w-full rounded border p-2"
          defaultValue={v.impa ?? ""}
        />
        <input
          name="partNumber"
          placeholder="Số phụ tùng / Part No."
          className="w-full rounded border p-2"
          defaultValue={v.partNumber ?? ""}
        />
      </div>
      <input
        name="manufacturer"
        placeholder="Nhà sản xuất / Maker"
        className="w-full rounded border p-2"
        defaultValue={v.manufacturer ?? ""}
      />
      <select
        name="categoryId"
        className="w-full rounded border p-2"
        defaultValue={v.categoryId ?? ""}
      >
        <option value="">Chọn nhóm (Boong/Máy/Điện/...)</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <input
        name="uom"
        placeholder="Đơn vị tính: PCS, LIT, M..."
        className="w-full rounded border p-2"
        defaultValue={v.uom ?? "PCS"}
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          name="minStock"
          type="number"
          step="0.01"
          placeholder="Tồn tối thiểu"
          className="w-full rounded border p-2"
          defaultValue={v.minStock ?? "0"}
        />
        <input
          name="maxStock"
          type="number"
          step="0.01"
          placeholder="Tồn tối đa"
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
        Vật tư quan trọng / critical
      </label>
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : "Thêm vật tư"}
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
