"use client";

import { useActionState } from "react";
import { deleteReportDocument } from "@/app/actions";

export default function DocumentDeleteButton({
  id,
  fileName,
}: {
  id: number;
  fileName: string;
}) {
  const [state, formAction, pending] = useActionState(deleteReportDocument, {
    message: "",
  });
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Xóa vĩnh viễn hồ sơ "${fileName}"? Hành động này không hoàn tác được.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        disabled={pending}
        className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
      >
        {pending ? "..." : "Xóa"}
      </button>
      {state.message && (
        <p className="mt-1 text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}
