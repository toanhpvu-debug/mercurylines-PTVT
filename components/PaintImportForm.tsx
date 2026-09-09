"use client";

import { startTransition, useActionState, useState } from "react";
import {
  ClipboardPaste,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { importPaintProducts } from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import {
  Button,
  Field,
  Notice,
  Select,
  Textarea,
} from "@/components/ui";

type VesselOption = { id: number; label: string };

export default function PaintImportForm({
  vessels,
}: {
  vessels: VesselOption[];
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(importPaintProducts, {
    message: "",
  });
  // Hai nguồn loại trừ nhau — chọn một để tránh gửi cả hai rồi không rõ cái nào thắng.
  const [mode, setMode] = useState<"excel" | "paste">("excel");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (mode === "excel") fd.delete("pasted");
        else fd.delete("file");
        startTransition(() => action(fd));
      }}
      className="space-y-4"
    >
      <Field
        label={t("paint.ghiTonChoTau")}
        hint={t("paint.goiYGhiTon")}
        className="max-w-md"
      >
        <Select name="vesselId">
          <option value="">{t("paint.chiNapDanhMuc")}</option>
          {vessels.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={mode === "excel" ? "primary" : "secondary"}
          onClick={() => setMode("excel")}
          icon={<FileSpreadsheet className="size-4" />}
        >
          {t("paint.tuFileExcel")}
        </Button>
        <Button
          type="button"
          variant={mode === "paste" ? "primary" : "secondary"}
          onClick={() => setMode("paste")}
          icon={<ClipboardPaste className="size-4" />}
        >
          {t("paint.danTuPdf")}
        </Button>
      </div>

      {mode === "excel" ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
          <p className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <FileSpreadsheet className="size-4 text-[var(--text-muted)]" />
            File Excel (.xls / .xlsx)
          </p>
          <p className="mb-3 text-xs text-[var(--text-secondary)]">
            {t("paint.nhapExcelHint1")}{" "}
            <b className="text-[var(--text-primary)]">
              {t("paint.nhapExcelCotTenSon")}
            </b>{" "}
            {t("paint.nhapExcelHint2")}
          </p>
          <input
            type="file"
            name="file"
            accept=".xls,.xlsx"
            className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-600"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
          <p className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <ClipboardPaste className="size-4 text-[var(--text-muted)]" />
            {t("paint.danNoiDungPdf")}
          </p>
          <p className="mb-2 text-xs text-[var(--text-secondary)]">
            {t("paint.danHint1")}
            <b className="text-[var(--text-primary)]">Ctrl+A</b>
            {t("paint.danHint2")}
            <b className="text-[var(--text-primary)]">Ctrl+C</b>
            {t("paint.danHint3")}
          </p>
          <Textarea
            name="pasted"
            rows={10}
            placeholder={t("paint.phDanBang")}
            className="font-mono text-xs"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          icon={<Upload className="size-4" />}
        >
          {pending ? t("paint.dangDoc") : t("paint.nutNhapVaoDanhMuc")}
        </Button>
      </div>
      {state.message && (
        <Notice tone={state.success ? "success" : "danger"}>
          {state.message}
        </Notice>
      )}
    </form>
  );
}
