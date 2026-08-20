"use client";

import { useActionState } from "react";
import { deleteMaterial, setMaterialActive } from "@/app/actions";

export default function MaterialRowActions({
  id,
  code,
  isActive,
}: {
  id: number;
  code: string;
  isActive: boolean;
}) {
  const [toggleState, toggleAction, togglePending] = useActionState(
    setMaterialActive,
    { message: "" }
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteMaterial,
    { message: "" }
  );
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <form action={toggleAction}>
          <input type="hidden" name="id" value={id} />
          <input
            type="hidden"
            name="active"
            value={isActive ? "false" : "true"}
          />
          <button
            disabled={togglePending}
            className={`rounded px-2 py-1 text-xs disabled:opacity-50 ${
              isActive
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            {togglePending
              ? "..."
              : isActive
                ? "Ngừng sử dụng"
                : "Dùng lại"}
          </button>
        </form>
        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (
              !window.confirm(
                `Xóa vĩnh viễn vật tư "${code}"? Chỉ xóa được khi chưa có tồn kho và chưa dùng trong yêu cầu nào.`
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button
            disabled={deletePending}
            className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
          >
            {deletePending ? "..." : "Xóa"}
          </button>
        </form>
      </div>
      {(toggleState.message || deleteState.message) && (
        <p className="text-xs text-red-600">
          {toggleState.message || deleteState.message}
        </p>
      )}
    </div>
  );
}
