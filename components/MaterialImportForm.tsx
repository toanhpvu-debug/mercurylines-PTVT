"use client";

import { startTransition, useActionState, useState } from "react";
import { importMaterials } from "@/app/actions";

type VesselOption = { id: number; label: string };
type WarehouseOption = { id: number; vesselId: number; label: string };

export default function MaterialImportForm({
  vessels,
  warehouses,
}: {
  vessels: VesselOption[];
  warehouses: WarehouseOption[];
}) {
  const [state, formAction, pending] = useActionState(importMaterials, {
    message: "",
  });
  const [vesselId, setVesselId] = useState("");
  const [kind, setKind] = useState("STORE");
  const [warehouseId, setWarehouseId] = useState("");
  const vesselWarehouses = warehouses.filter(
    (w) => String(w.vesselId) === vesselId
  );

  return (
    // Gửi thủ công qua startTransition để React không reset form (mất file) khi lỗi.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">Tàu *</span>
          <select
            name="vesselId"
            value={vesselId}
            onChange={(e) => {
              setVesselId(e.target.value);
              setWarehouseId("");
            }}
            className="w-full rounded border p-2"
            required
          >
            <option value="">— Chọn tàu —</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            Loại mặc định (khi không có nhóm thiết bị)
          </span>
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full rounded border p-2"
          >
            <option value="STORE">Vật tư (Store)</option>
            <option value="SPARE">Phụ tùng (Spare)</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            Ghi tồn (R.O.B) vào kho — tùy chọn
          </span>
          <select
            name="warehouseId"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full rounded border p-2"
            disabled={!vesselId}
          >
            <option value="">— Không ghi tồn —</option>
            {vesselWarehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
        <p className="mb-1 font-semibold text-blue-950">
          File danh mục (.xls / .xlsx / .doc / .docx)
        </p>
        <p className="mb-3 text-xs text-slate-600">
          Nhận trực tiếp form công ty: <b>MLS-11-06</b> Store &amp; Spare Part
          Inventory (Excel — cột Description/IMPA/Unit/R.O.B) và{" "}
          <b>MLS-11-04</b> Danh mục phụ tùng thiết yếu (Word — tự nhận nhóm
          thiết bị, số lượng tối thiểu). Vật tư trùng (theo IMPA/Part No/tên) sẽ
          được gán vào tàu thay vì tạo mới.
        </p>
        <input
          type="file"
          name="file"
          accept=".xls,.xlsx,.doc,.docx"
          required
          className="text-sm"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-blue-700 px-6 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Đang nhập dữ liệu..." : "Nhập vào danh mục tàu"}
        </button>
      </div>
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
