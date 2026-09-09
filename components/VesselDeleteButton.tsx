"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteVessel } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button } from "@/components/ui";

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
        <Button type="button" variant="danger" disabled icon={<Trash2 className="size-4" />}>
          {t("vessels.xoaTau")}
        </Button>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
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
      <Button
        type="submit"
        variant="danger"
        loading={pending}
        icon={<Trash2 className="size-4" />}
      >
        {pending ? t("vessels.dangXoa") : t("vessels.xoaTau")}
      </Button>
      {state.message && (
        <p className="mt-2 text-sm text-[var(--text-danger)]">{state.message}</p>
      )}
    </form>
  );
}
