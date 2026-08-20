"use client";

import { useActionState } from "react";
import { updateRequestStatus } from "@/app/actions";

export default function RequestStatusForm({
  id,
  status,
  label,
  className,
  returnTo,
}: {
  id: number;
  status: string;
  label: string;
  className: string;
  returnTo?: string;
}) {
  const [state, formAction, pending] = useActionState(updateRequestStatus, {
    message: "",
  });
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <button disabled={pending} className={className}>
        {pending ? "..." : label}
      </button>
      {state.message && (
        <p className="mt-1 text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}
