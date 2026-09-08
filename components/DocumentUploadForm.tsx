"use client";

import { useActionState, useState } from "react";
import { Upload } from "lucide-react";
import { uploadReportDocument } from "@/app/actions";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { useNgonNgu } from "@/lib/i18n/client";

type VesselOption = {
  id: number;
  code: string;
  name: string;
};

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export default function DocumentUploadForm({
  vessels,
}: {
  vessels: VesselOption[];
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(uploadReportDocument, {
    message: "",
  });
  const [clientError, setClientError] = useState("");
  const v = state.values ?? {};
  const single = vessels.length === 1;
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const input = e.currentTarget.elements.namedItem(
          "file"
        ) as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (file && file.size > MAX_UPLOAD_BYTES) {
          e.preventDefault();
          setClientError(
            t("inventory.fileQuaNang", {
              ten: file.name,
              mb: (file.size / (1024 * 1024)).toFixed(1),
            })
          );
        } else {
          setClientError("");
        }
      }}
      className="space-y-3"
    >
      {single ? (
        <input type="hidden" name="vesselId" value={vessels[0].id} />
      ) : (
        <Field label={t("chung.tau")}>
          <Select name="vesselId" defaultValue={v.vesselId ?? ""} required>
            <option value="">{t("chung.chonTau")}</option>
            {vessels.map((vessel) => (
              <option key={vessel.id} value={vessel.id}>
                {vessel.code} - {vessel.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={t("inventory.loaiBaoCao")}>
          <Select name="reportType" defaultValue={v.reportType ?? "MLS-11-01"}>
            <option value="MLS-11-01">{t("inventory.docMLS1101")}</option>
            <option value="MLS-11-04">{t("inventory.docMLS1104")}</option>
            <option value="MLS-11-13">{t("inventory.docMLS1113")}</option>
            {/* Giá trị "KHÁC" là dữ liệu lưu xuống database — chỉ dịch nhãn. */}
            <option value="KHÁC">{t("inventory.docKhac")}</option>
          </Select>
        </Field>
        <Field label={t("inventory.kyBaoCao")}>
          <Input name="period" type="month" defaultValue={v.period ?? ""} />
        </Field>
      </div>
      <Input
        name="title"
        placeholder={t("inventory.tieuDePlaceholder")}
        defaultValue={v.title ?? ""}
      />
      <Field label={t("inventory.fileBaoCao")}>
        <Input
          name="file"
          type="file"
          accept=".pdf,.xls,.xlsx"
          className="file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-sunken)] file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-[var(--text-primary)]"
          required
        />
      </Field>
      <Input
        name="note"
        placeholder={t("inventory.ghiChuTuyChon")}
        defaultValue={v.note ?? ""}
      />
      <Button
        type="submit"
        variant="primary"
        loading={pending}
        icon={<Upload className="size-4" />}
      >
        {pending ? t("inventory.dangTaiLen") : t("inventory.taiBaoCaoLen")}
      </Button>
      {clientError && <Notice tone="danger">{clientError}</Notice>}
      {state.message && (
        <Notice tone={state.success ? "success" : "danger"}>
          {state.message}
        </Notice>
      )}
      <p className="text-xs text-[var(--text-muted)]">
        {t("inventory.luuYTruoc")}{" "}
        <b className="text-[var(--text-secondary)]">{t("inventory.luuYDam")}</b>{" "}
        {t("inventory.luuYSau")}
      </p>
    </form>
  );
}
