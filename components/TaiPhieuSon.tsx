"use client";

import { startTransition, useActionState } from "react";
import { FileUp, Upload } from "lucide-react";
import { taiPhieuSon } from "@/app/son-phieu-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Notice } from "@/components/ui";

/** Tải phiếu giao / nhận sơn (Excel MLS-11-05, Excel, Word, PDF, PDF scan) — đọc xong mở trang soát. */
export default function TaiPhieuSon({ vesselId, coAi }: { vesselId: number; coAi: boolean }) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(taiPhieuSon, { message: "" });
  return (
    // Gửi thủ công qua startTransition để React không reset form (mất file) khi lỗi.
    <form
      // action: trang chưa kịp nạp JS (máy chậm) mà người dùng đã bấm thì form vẫn
      // gửi thẳng server action thay vì rơi về GET; nạp xong thì onSubmit lo.
      action={formAction}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-3"
    >
      <input type="hidden" name="vesselId" value={vesselId} />
      <p className="text-sm text-[var(--text-secondary)]">{t("paint.pgMoTa")}</p>
      <p className="text-xs text-[var(--text-muted)]">{coAi ? t("paint.pgDinhDang") : t("paint.pgDinhDangKhongAi")}</p>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
        <label className="min-w-64 flex-1">
          <span className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <FileUp className="size-4 text-[var(--text-muted)]" />
            {t("paint.pgChonTep")}
          </span>
          <input
            type="file"
            name="file"
            accept=".xlsx,.xls,.docx,.doc,.pdf"
            required
            className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-600"
          />
        </label>
        <Button type="submit" variant="primary" loading={pending} icon={<Upload className="size-4" />}>
          {pending ? t("paint.pgDangTai") : t("paint.pgNutTai")}
        </Button>
      </div>
      {state.message && <Notice tone={state.success ? "success" : "danger"}>{state.message}</Notice>}
    </form>
  );
}
