"use client";

import { useActionState } from "react";
import { FileSpreadsheet, FileText, Upload } from "lucide-react";
import { uploadBieuMauTep } from "@/app/actions";
import { Button, Card, CardHeader, Notice } from "@/components/ui";
import { useNgonNgu } from "@/lib/i18n/client";
import { BIEU_MAU_TEP, MA_BIEU_MAU_KIEM_KE } from "@/lib/bieuMau";

/**
 * Khối tải một tệp biểu mẫu gốc của công ty lên (Excel MLS-11-06, Word
 * MLS-11-13...). Các chức năng xuất điền dữ liệu vào chính tệp này để giữ
 * nguyên logo, bố cục và khối chữ ký. Tệp là tài liệu nội bộ nên không nằm
 * trong mã nguồn — mỗi bản cài tự nạp lấy một lần, và bản nạp lên sống trong
 * database nên qua được mọi lần dựng lại máy chủ.
 */
export default function BieuMauTepManager({
  code = MA_BIEU_MAU_KIEM_KE,
  hienCo,
}: {
  /** Mã biểu mẫu trong BIEU_MAU_TEP (lib/bieuMau.ts). */
  code?: string;
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
  const bm = BIEU_MAU_TEP[code] ?? BIEU_MAU_TEP[MA_BIEU_MAU_KIEM_KE];
  const laWord = bm.loai === "word";
  return (
    <Card>
      <CardHeader
        icon={laWord ? <FileText className="size-4" /> : <FileSpreadsheet className="size-4" />}
        title={laWord ? t("purchasing.bieuMauTep_tieuDeWord", { ma: code }) : t("purchasing.bieuMauTep_tieuDe", { ma: code })}
        subtitle={laWord ? t("purchasing.bieuMauTep_moTaWord") : t("purchasing.bieuMauTep_moTa")}
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
          {laWord ? t("purchasing.bieuMauTep_chuaCoWord") : t("purchasing.bieuMauTep_chuaCo")}
        </Notice>
      )}
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="code" value={code} />
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
            {t("purchasing.bieuMauTep_chonFileDuoi", { duoi: bm.duoi })}
          </label>
          <input
            type="file"
            name="file"
            accept={bm.duoi}
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
