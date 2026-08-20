"use client";

import { useActionState, useState } from "react";
import { copyPaintScheme } from "@/app/paint-actions";

export default function PaintSchemeCopyForm({
  vesselId,
  sources,
}: {
  vesselId: number;
  sources: { id: number; label: string; areaCount: number }[];
}) {
  const [state, action, pending] = useActionState(copyPaintScheme, {
    message: "",
  });
  const [open, setOpen] = useState(false);

  const usable = sources.filter((s) => s.id !== vesselId && s.areaCount > 0);
  if (usable.length === 0) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-blue-300 bg-white px-4 py-2 text-sm text-blue-800 hover:bg-blue-50"
      >
        Sao chép sơ đồ từ tàu khác
      </button>
    );
  }

  return (
    <form
      action={action}
      className="w-full space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4"
    >
      <input type="hidden" name="vesselId" value={vesselId} />
      <p className="font-semibold text-blue-950">Sao chép sơ đồ sơn</p>
      <p className="text-sm text-slate-600">
        Chép toàn bộ khu vực và các lớp sơn của tàu nguồn sang tàu này. Khu vực
        trùng tên sẽ được <b>bỏ qua</b>, không ghi đè.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[260px] flex-1">
          <span className="mb-1 block text-sm text-slate-600">Tàu nguồn *</span>
          <select
            name="fromVesselId"
            required
            className="w-full rounded border p-2"
          >
            <option value="">— Chọn tàu —</option>
            {usable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.areaCount} khu vực)
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={pending}
          className="rounded bg-blue-700 px-5 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Đang chép..." : "Sao chép"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="pb-2 text-sm text-slate-600 hover:underline"
        >
          Đóng
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
