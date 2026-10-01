"use client";

import { startTransition, useActionState, useTransition } from "react";
import { FileSpreadsheet, FileUp, Trash2, Upload } from "lucide-react";
import { boFileYeuCau, taiFileYeuCau } from "@/app/yeu-cau-tep-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Card, CardHeader, Notice } from "@/components/ui";

/**
 * Yêu cầu nhanh: tải phiếu MLS-11-05B / MLS-11-05A (Word / Excel / PDF / PDF
 * scan) — đọc xong trang chuyển về /requests?tuTep=<id> và form bên dưới được
 * điền sẵn. Gập lại khi đang điền từ file để form có chỗ.
 */
export default function TaiFileYeuCau({ coAi, moSan = true }: { coAi: boolean; moSan?: boolean }) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(taiFileYeuCau, { message: "" });
  return (
    <Card>
      <details open={moSan} className="group">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <CardHeader icon={<FileSpreadsheet className="size-4" />} title={t("requests.tepTieuDe")} subtitle={t("requests.tepMoTa")} />
        </summary>
        {/* Gửi thủ công qua startTransition để React không reset form (mất file) khi lỗi. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
          className="space-y-3"
        >
          <p className="text-xs text-[var(--text-secondary)]">{coAi ? t("requests.tepDinhDang") : t("requests.tepDinhDangKhongAi")}</p>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
            <label className="min-w-64 flex-1">
              <span className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <FileUp className="size-4 text-[var(--text-muted)]" />
                {t("requests.tepChon")}
              </span>
              <input
                type="file"
                name="file"
                accept=".docx,.doc,.xlsx,.xls,.pdf"
                required
                className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-600"
              />
            </label>
            <Button type="submit" variant="primary" loading={pending} icon={<Upload className="size-4" />}>
              {pending ? t("requests.tepDangDoc") : t("requests.tepNutTai")}
            </Button>
          </div>
          {state.message && <Notice tone={state.success ? "success" : "danger"}>{state.message}</Notice>}
        </form>
      </details>
    </Card>
  );
}

/** Bỏ file yêu cầu chưa dùng (xóa file đã tải, form về trống). */
export function BoFileYeuCauButton({ id }: { id: number }) {
  const { t } = useNgonNgu();
  const [dang, chuyen] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      loading={dang}
      icon={<Trash2 className="size-4" />}
      className="text-[var(--text-danger)]"
      onClick={() =>
        chuyen(async () => {
          await boFileYeuCau(id);
        })
      }
    >
      {t("requests.tepBo")}
    </Button>
  );
}
