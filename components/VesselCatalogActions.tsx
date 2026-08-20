"use client";

import { useActionState } from "react";
import {
  assignMaterialToVessel,
  unassignMaterialFromVessel,
} from "@/app/actions";

type MaterialOption = {
  id: number;
  code: string;
  nameVn: string;
  materialType: string;
};

export function VesselMaterialAddForm({
  vesselId,
  available,
}: {
  vesselId: number;
  available: MaterialOption[];
}) {
  const [state, formAction, pending] = useActionState(assignMaterialToVessel, {
    message: "",
  });
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="vesselId" value={vesselId} />
      <select
        name="materialId"
        className="min-w-64 rounded border p-2 text-sm"
        defaultValue=""
        required
      >
        <option value="">Chọn vật tư từ danh mục gốc để thêm vào tàu</option>
        {available.map((m) => (
          <option key={m.id} value={m.id}>
            {m.code} - {m.nameVn}
            {m.materialType === "SPARE" ? " (Phụ tùng)" : ""}
          </option>
        ))}
      </select>
      <button
        disabled={pending || available.length === 0}
        className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "..." : "Thêm vào tàu"}
      </button>
      {available.length === 0 && (
        <span className="text-xs text-slate-500">
          Tàu đã có tất cả vật tư trong danh mục gốc.
        </span>
      )}
      {state.message && (
        <span className="text-xs text-red-600">{state.message}</span>
      )}
    </form>
  );
}

export function VesselMaterialRemoveButton({
  vesselId,
  materialId,
  code,
}: {
  vesselId: number;
  materialId: number;
  code: string;
}) {
  const [state, formAction, pending] = useActionState(
    unassignMaterialFromVessel,
    { message: "" }
  );
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Gỡ "${code}" khỏi danh mục tàu này? (Định nghĩa gốc và tồn kho không bị xóa.)`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="vesselId" value={vesselId} />
      <input type="hidden" name="materialId" value={materialId} />
      <button
        disabled={pending}
        className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
      >
        {pending ? "..." : "Gỡ khỏi tàu"}
      </button>
      {state.message && (
        <p className="mt-1 text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}
