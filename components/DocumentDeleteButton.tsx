"use client";

import { useActionState } from "react";
import { deleteReportDocument } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";

export default function DocumentDeleteButton({
  id,
  fileName,
}: {
  id: number;
  fileName: string;
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(deleteReportDocument, {
    message: "",
  });
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            t("inventory.xacNhanXoaHoSo", { ten: fileName })
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
        {pending ? "..." : t("chung.xoa")}
      </button>
      {state.message && (
        <p className="mt-1 text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}
