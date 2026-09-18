"use client";

import { startTransition, useActionState, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { taoPhieuGiaoTuPdf } from "@/app/phieu-giao-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";

type VesselOption = { id: number; label: string };

/**
 * Ô tải phiếu giao hàng (PDF) lên hàng chờ duyệt. Sau khi máy đọc xong, server
 * action chuyển thẳng sang trang đối chiếu — người tải thấy ngay các dòng máy
 * đọc được cạnh bản scan, không phải đi tìm.
 */
export default function PhieuGiaoUploadForm({ vessels }: { vessels: VesselOption[] }) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(taoPhieuGiaoTuPdf, { message: "" });
  const [vesselId, setVesselId] = useState(vessels.length === 1 ? String(vessels[0].id) : "");

  return (
    // Gửi qua startTransition để React không reset form (mất file đã chọn) khi lỗi.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label={`${t("chung.tau")} *`}>
          <Select name="vesselId" value={vesselId} onChange={(e) => setVesselId(e.target.value)} required>
            <option value="">— {t("chung.chonTau")} —</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("phieuGiao.oNhaCungCap")}>
          <Input name="nhaCungCap" maxLength={200} placeholder="—" />
        </Field>
        <Field label={t("phieuGiao.oSoPhieu")}>
          <Input name="soPhieu" maxLength={80} placeholder="—" />
        </Field>
        <Field label={t("phieuGiao.oNgayGiao")}>
          <Input name="ngayGiao" type="date" />
        </Field>
      </div>
      <Field label={t("phieuGiao.oGhiChu")}>
        <Textarea name="ghiChu" rows={2} maxLength={1000} />
      </Field>

      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
        <p className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <FileText className="size-4 text-[var(--text-muted)]" />
          {t("phieuGiao.oFile")}
        </p>
        <p className="mb-3 text-xs text-[var(--text-secondary)]">{t("phieuGiao.theTaiLenMoTa")}</p>
        <input
          type="file"
          name="file"
          accept=".pdf,application/pdf"
          required
          className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-600"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" loading={pending} icon={<Upload className="size-4" />}>
          {pending ? t("phieuGiao.dangDoc") : t("phieuGiao.nutTaiLen")}
        </Button>
      </div>
      {state.message && <Notice tone={state.success ? "success" : "danger"}>{state.message}</Notice>}
    </form>
  );
}
