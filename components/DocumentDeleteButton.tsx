"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteReportDocument } from "@/app/actions";
import { Button } from "@/components/ui";
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
      <Button
        type="submit"
        variant="danger"
        size="sm"
        loading={pending}
        icon={<Trash2 className="size-4" />}
      >
        {t("chung.xoa")}
      </Button>
      {state.message && (
        <p className="mt-1 text-xs text-[var(--text-danger)]">{state.message}</p>
      )}
    </form>
  );
}
