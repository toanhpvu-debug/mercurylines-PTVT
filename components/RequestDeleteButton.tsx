"use client";

import { useActionState } from "react";
import { deleteMaterialRequest } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";

export default function RequestDeleteButton({
  id,
  requestNo,
  returnTo,
  className,
}: {
  id: number;
  requestNo: string;
  returnTo?: string;
  className?: string;
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(deleteMaterialRequest, {
    message: "",
  });
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(t("requests.xacNhanXoa", { ma: requestNo }))) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <button
        disabled={pending}
        className={
          className ??
          "rounded bg-red-100 px-3 py-1 text-red-700 hover:bg-red-200 disabled:opacity-50"
        }
      >
        {pending ? t("requests.dangXoa") : t("chung.xoa")}
      </button>
      {state.message && (
        <p className="mt-1 text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}
