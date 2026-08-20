"use client";

import { useActionState, useState } from "react";
import { updateRequestStatus } from "@/app/actions";

// Từ chối yêu cầu phải nêu lý do — người lập cần biết sửa gì để trình lại.
export default function RequestRejectForm({
  id,
  returnTo,
}: {
  id: number;
  returnTo?: string;
}) {
  const [state, action, pending] = useActionState(updateRequestStatus, {
    message: "",
  });
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
      >
        Từ chối
      </button>
    );
  }

  return (
    <form
      action={action}
      className="w-full space-y-2 rounded-lg border border-red-200 bg-red-50/50 p-3"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value="REJECTED" />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-red-800">
          Lý do từ chối *
        </span>
        <textarea
          name="note"
          required
          rows={2}
          placeholder="VD: Vật tư còn đủ trên tàu, đề nghị dùng hết trước khi đặt thêm"
          className="w-full rounded border border-red-200 p-2 text-sm"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Đang gửi..." : "Xác nhận từ chối"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-600 hover:underline"
        >
          Hủy
        </button>
        {state.message && (
          <span className="text-sm text-red-700">{state.message}</span>
        )}
      </div>
    </form>
  );
}
