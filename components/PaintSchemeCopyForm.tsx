"use client";

import { useActionState, useState } from "react";
import { Copy } from "lucide-react";
import { copyPaintScheme } from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Notice, Select } from "@/components/ui";

export default function PaintSchemeCopyForm({
  vesselId,
  sources,
}: {
  vesselId: number;
  sources: { id: number; label: string; areaCount: number }[];
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(copyPaintScheme, {
    message: "",
  });
  const [open, setOpen] = useState(false);

  const usable = sources.filter((s) => s.id !== vesselId && s.areaCount > 0);
  if (usable.length === 0) return null;

  if (!open) {
    return (
      <Button
        type="button"
        onClick={() => setOpen(true)}
        icon={<Copy className="size-4" />}
      >
        {t("paint.saoChepTuTauKhac")}
      </Button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
      <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <Copy className="size-4 text-[var(--text-muted)]" />
        {t("paint.saoChepSoDo")}
      </p>
      <form action={action} className="space-y-3">
        <input type="hidden" name="vesselId" value={vesselId} />
        <p className="text-sm text-[var(--text-secondary)]">
          {t("paint.saoChepMoTa1")}{" "}
          <b className="text-[var(--text-primary)]">
            {t("paint.saoChepMoTaDam")}
          </b>
          {t("paint.saoChepMoTa2")}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field
            label={`${t("paint.tauNguon")} *`}
            className="min-w-[260px] flex-1"
          >
            <Select name="fromVesselId" required>
              <option value="">{t("paint.chonTauOption")}</option>
              {usable.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({t("paint.nKhuVuc", { n: s.areaCount })})
                </option>
              ))}
            </Select>
          </Field>
          <Button
            variant="primary"
            loading={pending}
            icon={<Copy className="size-4" />}
          >
            {pending ? t("paint.dangChep") : t("paint.nutSaoChep")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t("chung.dong")}
          </Button>
        </div>
        {state.message && (
          <Notice tone={state.success ? "success" : "danger"}>
            {state.message}
          </Notice>
        )}
      </form>
    </div>
  );
}
