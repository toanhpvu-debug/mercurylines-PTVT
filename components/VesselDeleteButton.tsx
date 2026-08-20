"use client";

import { useActionState } from "react";
import { deleteVessel } from "@/app/actions";

export default function VesselDeleteButton({
  id,
  name,
  requestCount,
}: {
  id: number;
  name: string;
  requestCount: number;
}) {
  const [state, formAction, pending] = useActionState(deleteVessel, {
    message: "",
  });
  if (requestCount > 0) {
    return (
      <div>
        <button
          disabled
          className="cursor-not-allowed rounded bg-slate-100 px-4 py-2 text-slate-400"
        >
          Xóa tàu
        </button>
        <p className="mt-2 text-sm text-slate-500">
          Tàu đang có {requestCount} yêu cầu vật tư nên không thể xóa.
        </p>
      </div>
    );
  }
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Xóa tàu "${name}"? Toàn bộ kho và tồn kho của tàu sẽ bị xóa theo. Hành động này không hoàn tác được.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        disabled={pending}
        className="rounded bg-red-100 px-4 py-2 text-red-700 hover:bg-red-200 disabled:opacity-50"
      >
        {pending ? "Đang xóa..." : "Xóa tàu"}
      </button>
      {state.message && (
        <p className="mt-2 text-sm text-red-600">{state.message}</p>
      )}
    </form>
  );
}
