"use client";

import { useActionState, useState } from "react";
import { X } from "lucide-react";
import { updateRequestStatus } from "@/app/actions";
import { Button, Notice, Textarea } from "@/components/ui";
import { useNgonNgu } from "@/lib/i18n/client";

// Từ chối yêu cầu phải nêu lý do — người lập cần biết sửa gì để trình lại.
export default function RequestRejectForm({
  id,
  returnTo,
}: {
  id: number;
  returnTo?: string;
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(updateRequestStatus, {
    message: "",
  });
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
        icon={<X className="size-4 text-[var(--text-danger)]" />}
      >
        {t("requests.nutTuChoi")}
      </Button>
    );
  }

  return (
    <form action={action} className="w-full">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value="REJECTED" />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <Notice tone="danger" className="space-y-2 p-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">
            {t("requests.lyDoTuChoi")}
          </span>
          <Textarea
            name="note"
            required
            rows={2}
            placeholder={t("requests.phLyDoTuChoi")}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="danger"
            size="sm"
            loading={pending}
            icon={<X className="size-4" />}
          >
            {pending ? t("requests.dangGui") : t("requests.xacNhanTuChoi")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            {t("chung.huy")}
          </Button>
          {state.message && (
            <span className="text-sm text-[var(--text-danger)]">
              {state.message}
            </span>
          )}
        </div>
      </Notice>
    </form>
  );
}
