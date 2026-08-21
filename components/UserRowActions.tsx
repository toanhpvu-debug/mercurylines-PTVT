"use client";

import { useActionState } from "react";
import { toggleUserActive, updateUserRole } from "@/app/actions";

type VesselOption = {
  id: number;
  label: string;
};

export function UserRoleForm({
  id,
  role,
  vesselId,
  vessels,
  disabled,
}: {
  id: number;
  role: string;
  vesselId: number | null;
  vessels: VesselOption[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateUserRole, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-center gap-2">
        <select
          name="role"
          defaultValue={v.role ?? role}
          disabled={disabled}
          className="rounded border p-1 text-sm disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="CREW">CREW</option>
          <option value="CHIEF_ENGINEER">CHIEF_ENGINEER</option>
          <option value="MASTER">MASTER</option>
          <option value="TECH_MANAGER">TECH_MANAGER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select
          name="vesselId"
          defaultValue={v.vesselId ?? vesselId ?? ""}
          disabled={disabled}
          className="max-w-44 rounded border p-1 text-sm disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="">Không gán tàu</option>
          {vessels.map((vessel) => (
            <option key={vessel.id} value={vessel.id}>
              {vessel.label}
            </option>
          ))}
        </select>
        {!disabled && (
          <button
            disabled={pending}
            className="rounded border px-2 py-1 text-sm hover:bg-blue-50 disabled:opacity-50"
          >
            {pending ? "..." : "Lưu"}
          </button>
        )}
      </div>
      {state.message && (
        <p className="text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}

export function UserActiveToggle({
  id,
  isActive,
  disabled,
}: {
  id: number;
  isActive: boolean;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(toggleUserActive, {
    message: "",
  });
  if (disabled) {
    return null;
  }
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        disabled={pending}
        className={`rounded px-3 py-1 text-sm disabled:opacity-50 ${
          isActive
            ? "bg-red-100 text-red-700 hover:bg-red-200"
            : "bg-green-100 text-green-700 hover:bg-green-200"
        }`}
      >
        {pending ? "..." : isActive ? "Khóa" : "Mở khóa"}
      </button>
      {state.message && (
        <p className="mt-1 text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}
