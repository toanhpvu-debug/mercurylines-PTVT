"use client";

import { useActionState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { uploadBieuMauTep } from "@/app/actions";
import { Button, Card, CardHeader, Notice } from "@/components/ui";
import { useNgonNgu } from "@/lib/i18n/client";
import { MA_BIEU_MAU_KIEM_KE } from "@/lib/bieuMau";

/**
 * Khối tải tệp biểu mẫu Excel gốc của công ty lên (MLS-11-06).
 *
 * Chức năng "Xuất kiểm kê" điền dữ liệu vào chính tệp này để giữ nguyên logo,
 * bố cục và khối chữ ký. Tệp là tài liệu nội bộ nên không nằm trong mã nguồn —
 * mỗi bản cài tự nạp lấy một lần, và bản nạp lên sống trong database nên qua
 * được mọi lần dựng lại máy chủ.
 */
export default function BieuMauTepManager({
  hienCo,
}: {
  hienCo: {
    fileName: string;
    size: number;
    sha256: string;
    uploadedBy: string | null;
    uploadedAt: string;
  } | null;
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(uploadBieuMauTep, {
    message: "",
  });
  return (
    <Card>
      <CardHeader
        icon={<FileSpreadsheet className="size-4" />}
        title={t("purchasing.bieuMauTep_tieuDe", { ma: MA_BIEU_MAU_KIEM_KE })}
        subtitle={t("purchasing.bieuMauTep_moTa")}
      />
      {hienCo ? (
        <div className="mb-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sm">
          <p className="font-medium text-[var(--text-primary)]">
            {hienCo.fileName}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {t("purchasing.bieuMauTep_daCo", {
              kb: String(Math.round(hienCo.size / 1024)),
              nguoi: hienCo.uploadedBy ?? "—",
              luc: hienCo.uploadedAt,
            })}
          </p>
          <p className="mt-0.5 font-mono text-xs break-all text-[var(--text-muted)]">
            sha256 {hienCo.sha256.slice(0, 32)}
          </p>
        </div>
      ) : (
        <Notice tone="warning" className="mb-4">
          {t("purchasing.bieuMauTep_chuaCo")}
        </Notice>
      )}
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="code" value={MA_BIEU_MAU_KIEM_KE} />
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
            {t("purchasing.bieuMauTep_chonFile")}
          </label>
          <input
            type="file"
            name="file"
            accept=".xlsx"
            required
            className="block w-full cursor-pointer rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-sunken)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--text-primary)]"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          icon={<Upload className="size-4" />}
        >
          {pending
            ? t("chung.dangXuLy")
            : hienCo
              ? t("purchasing.bieuMauTep_thayThe")
              : t("purchasing.bieuMauTep_taiLen")}
        </Button>
      </form>
      {state.message && (
        <Notice tone={state.success ? "success" : "danger"} className="mt-3">
          {state.message}
        </Notice>
      )}
    </Card>
  );
}
