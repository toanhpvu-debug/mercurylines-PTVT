"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteMaterialRequest } from "@/app/actions";
import { Button } from "@/components/ui";
import { useNgonNgu } from "@/lib/i18n/client";

export default function RequestDeleteButton({
  id,
  requestNo,
  returnTo,
  size = "md",
  className,
}: {
  id: number;
  requestNo: string;
  returnTo?: string;
  size?: "sm" | "md";
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
      <Button
        variant="danger"
        size={size}
        icon={<Trash2 className="size-4" />}
        loading={pending}
        className={className}
      >
        {pending ? t("requests.dangXoa") : t("chung.xoa")}
      </Button>
      {state.message && (
        <p className="mt-1 text-xs text-[var(--text-danger)]">{state.message}</p>
      )}
    </form>
  );
}
