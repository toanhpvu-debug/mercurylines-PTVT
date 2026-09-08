"use client";

import { useActionState, type ReactNode } from "react";
import { updateRequestStatus } from "@/app/actions";
import { Button } from "@/components/ui";

export default function RequestStatusForm({
  id,
  status,
  label,
  variant = "secondary",
  size = "md",
  icon,
  className,
  returnTo,
}: {
  id: number;
  status: string;
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: ReactNode;
  className?: string;
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
      <Button
        variant={variant}
        size={size}
        icon={icon}
        loading={pending}
        className={className}
      >
        {label}
      </Button>
      {state.message && (
        <p className="mt-1 text-xs text-[var(--text-danger)]">{state.message}</p>
      )}
    </form>
  );
}
