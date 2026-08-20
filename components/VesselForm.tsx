"use client";

import { useActionState } from "react";
import { createVessel } from "@/app/actions";

export default function VesselForm() {
  const [state, formAction, pending] = useActionState(createVessel, {
    message: "",
  });
  const v = state.values ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <input
        name="code"
        placeholder="Mã tàu, ví dụ: ML-016"
        className="w-full rounded border p-2"
        defaultValue={v.code ?? ""}
        required
      />
      <input
        name="name"
        placeholder="Tên tàu, ví dụ: MERCURY FORTUNE"
        className="w-full rounded border p-2"
        defaultValue={v.name ?? ""}
        required
      />
      <input
        name="imo"
        placeholder="IMO number"
        className="w-full rounded border p-2"
        defaultValue={v.imo ?? ""}
      />
      <input
        name="flag"
        placeholder="Cờ tàu"
        className="w-full rounded border p-2"
        defaultValue={v.flag ?? ""}
      />
      <input
        name="vesselType"
        placeholder="Loại tàu"
        className="w-full rounded border p-2"
        defaultValue={v.vesselType ?? ""}
      />
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : "Thêm tàu"}
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
