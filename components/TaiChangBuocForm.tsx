"use client";

import { startTransition, useActionState } from "react";
import { FileUp, Upload } from "lucide-react";
import { taiFileChangBuoc } from "@/app/chang-buoc-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Notice } from "@/components/ui";

/** Tải file MLS-11-13 (Word / Excel / PDF / PDF scan) để nhập dụng cụ chằng buộc của tàu đang xem. */
export default function TaiChangBuocForm({ vesselId, coAi }: { vesselId: number; coAi: boolean }) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(taiFileChangBuoc, { message: "" });
  return (
    // Gửi thủ công qua startTransition để React không reset form (mất file) khi lỗi.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-3"
    >
      <input type="hidden" name="vesselId" value={vesselId} />
      <p className="text-xs text-[var(--text-secondary)]">{coAi ? t("changBuoc.taiMoTa") : t("changBuoc.taiMoTaKhongAi")}</p>
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
        <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <FileUp className="size-4 text-[var(--text-muted)]" />
          {t("changBuoc.tepMls1113")}
        </p>
        <input
          type="file"
          name="file"
          accept=".docx,.doc,.xlsx,.xls,.pdf"
          required
          className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-600"
        />
      </div>
      <Button type="submit" variant="primary" loading={pending} icon={<Upload className="size-4" />}>
        {pending ? t("changBuoc.dangTai") : t("changBuoc.nutTai")}
      </Button>
      {state.message && <Notice tone={state.success ? "success" : "danger"}>{state.message}</Notice>}
    </form>
  );
}
