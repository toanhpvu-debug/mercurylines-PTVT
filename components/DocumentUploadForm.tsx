"use client";

import { useActionState, useState } from "react";
import { uploadReportDocument } from "@/app/actions";
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
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            {t("chung.tau")}
          </label>
          <select
            name="vesselId"
            defaultValue={v.vesselId ?? ""}
            className="w-full rounded border p-2"
            required
          >
            <option value="">{t("chung.chonTau")}</option>
            {vessels.map((vessel) => (
              <option key={vessel.id} value={vessel.id}>
                {vessel.code} - {vessel.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            {t("inventory.loaiBaoCao")}
          </label>
          <select
            name="reportType"
            defaultValue={v.reportType ?? "MLS-11-01"}
            className="w-full rounded border p-2"
          >
            <option value="MLS-11-01">{t("inventory.docMLS1101")}</option>
            <option value="MLS-11-04">{t("inventory.docMLS1104")}</option>
            <option value="MLS-11-13">{t("inventory.docMLS1113")}</option>
            {/* Giá trị "KHÁC" là dữ liệu lưu xuống database — chỉ dịch nhãn. */}
            <option value="KHÁC">{t("inventory.docKhac")}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">
            {t("inventory.kyBaoCao")}
          </label>
          <input
            name="period"
            type="month"
            defaultValue={v.period ?? ""}
            className="w-full rounded border p-2"
          />
        </div>
      </div>
      <input
        name="title"
        placeholder={t("inventory.tieuDePlaceholder")}
        defaultValue={v.title ?? ""}
        className="w-full rounded border p-2"
      />
      <div>
        <label className="mb-1 block text-sm text-slate-600">
          {t("inventory.fileBaoCao")}
        </label>
        <input
          name="file"
          type="file"
          accept=".pdf,.xls,.xlsx"
          className="w-full rounded border p-2"
          required
        />
      </div>
      <input
        name="note"
        placeholder={t("inventory.ghiChuTuyChon")}
        defaultValue={v.note ?? ""}
        className="w-full rounded border p-2"
      />
      <button
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? t("inventory.dangTaiLen") : t("inventory.taiBaoCaoLen")}
      </button>
      {clientError && <p className="text-sm text-red-600">{clientError}</p>}
      {state.message && (
        <p
          className={`text-sm ${
            state.success ? "text-green-700" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      )}
      <p className="text-xs text-slate-500">
        {t("inventory.luuYTruoc")} <b>{t("inventory.luuYDam")}</b>{" "}
        {t("inventory.luuYSau")}
      </p>
    </form>
  );
}
