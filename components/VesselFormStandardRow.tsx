"use client";

import { useActionState } from "react";
import { setVesselFormStandard } from "@/app/actions";

type StandardOption = { key: string; label: string };

export default function VesselFormStandardRow({
  id,
  formStandard,
  hullNo,
  standards,
}: {
  id: number;
  formStandard: string;
  hullNo: string | null;
  standards: StandardOption[];
}) {
  const [state, formAction, pending] = useActionState(setVesselFormStandard, {
    message: "",
  });
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="formStandard"
        defaultValue={formStandard}
        className="rounded border p-1 text-sm"
      >
        {standards.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      <input
        name="hullNo"
        defaultValue={hullNo ?? ""}
        placeholder="Hull No."
        className="w-28 rounded border p-1 text-sm"
      />
      <button
        disabled={pending}
        className="rounded border px-2 py-1 text-sm hover:bg-blue-50 disabled:opacity-50"
      >
        {pending ? "..." : "Lưu"}
      </button>
      {state.message && (
        <span
          className={`text-xs ${
            state.success ? "text-green-700" : "text-red-600"
          }`}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
