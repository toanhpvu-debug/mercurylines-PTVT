"use client";

import { useActionState } from "react";
import { deleteVessel } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";

export default function VesselDeleteButton({
  id,
  name,
  requestCount,
}: {
  id: number;
  name: string;
  requestCount: number;
}) {
  const { t } = useNgonNgu();
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
          {t("vessels.xoaTau")}
        </button>
        <p className="mt-2 text-sm text-slate-500">
          {t("vessels.khongXoaDuocTau", { n: requestCount })}
        </p>
      </div>
    );
  }
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(t("vessels.xacNhanXoaTau", { ten: name }))) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        disabled={pending}
        className="rounded bg-red-100 px-4 py-2 text-red-700 hover:bg-red-200 disabled:opacity-50"
      >
        {pending ? t("vessels.dangXoa") : t("vessels.xoaTau")}
      </button>
      {state.message && (
        <p className="mt-2 text-sm text-red-600">{state.message}</p>
      )}
    </form>
  );
}
