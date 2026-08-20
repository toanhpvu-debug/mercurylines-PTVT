"use client";

import { useActionState } from "react";
import { createUser } from "@/app/actions";

type VesselOption = {
  id: number;
  label: string;
};

export default function UserForm({ vessels }: { vessels: VesselOption[] }) {
  const [state, formAction, pending] = useActionState(createUser, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <input
        name="name"
        placeholder="Họ tên"
        className="w-full rounded border p-2"
        defaultValue={v.name ?? ""}
        required
      />
      <input
        name="email"
        type="email"
        placeholder="Email đăng nhập"
        className="w-full rounded border p-2"
        defaultValue={v.email ?? ""}
        required
      />
      <input
        name="password"
        type="password"
        placeholder="Mật khẩu (tối thiểu 8 ký tự)"
        className="w-full rounded border p-2"
        minLength={8}
        required
      />
      <select
        name="role"
        className="w-full rounded border p-2"
        defaultValue={v.role ?? "CREW"}
      >
        <option value="CREW">Thuyền viên (CREW)</option>
        <option value="MASTER">Thuyền trưởng (MASTER)</option>
        <option value="ADMIN">Quản trị viên (ADMIN)</option>
      </select>
      <select
        name="vesselId"
        className="w-full rounded border p-2"
        defaultValue={v.vesselId ?? ""}
      >
        <option value="">Không gán tàu (toàn đội / văn phòng)</option>
        {vessels.map((vessel) => (
          <option key={vessel.id} value={vessel.id}>
            {vessel.label}
          </option>
        ))}
      </select>
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Đang tạo..." : "Tạo người dùng"}
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
