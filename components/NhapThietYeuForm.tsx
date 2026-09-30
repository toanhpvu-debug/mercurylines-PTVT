"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { nhapThietYeuTuWord } from "@/app/thiet-yeu-actions";
import { xoaBanInCuaTau } from "@/lib/thietYeu";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Notice, Select } from "@/components/ui";

/** Nhập danh mục phụ tùng thiết yếu của một tàu từ tệp Word MLS-11-04. */
export default function NhapThietYeuForm({ vesselId, soMucHienCo }: { vesselId: number; soMucHienCo: number }) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(nhapThietYeuTuWord, { message: "" });
  // Nhập xong thì danh mục đã đổi: bản in sửa tay cũ của tàu trên máy này không
  // còn khớp (sẽ che mất mục mới) — bỏ đi.
  useEffect(() => {
    if (state.success) xoaBanInCuaTau(vesselId);
  }, [state, vesselId]);
  const [cheDo, setCheDo] = useState(soMucHienCo > 0 ? "them" : "thay");

  return (
    // Gửi thủ công qua startTransition để React không reset form (mất tệp) khi lỗi.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (cheDo === "thay" && soMucHienCo > 0 && !window.confirm(t("thietYeu.xacNhanThay", { n: soMucHienCo }))) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-3"
    >
      <input type="hidden" name="vesselId" value={vesselId} />
      <p className="text-xs text-[var(--text-secondary)]">{t("thietYeu.nhapMoTa")}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_16rem]">
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <FileText className="size-4 text-[var(--text-muted)]" />
            {t("thietYeu.tepWord")}
          </p>
          <input
            type="file"
            name="file"
            accept=".doc,.docx"
            required
            className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-600"
          />
        </div>
        {soMucHienCo > 0 ? (
          <Field label={t("thietYeu.cheDo")}>
            <Select name="cheDo" value={cheDo} onChange={(e) => setCheDo(e.target.value)}>
              <option value="them">{t("thietYeu.cheDo_them")}</option>
              <option value="thay">{t("thietYeu.cheDo_thay")}</option>
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="cheDo" value="thay" />
        )}
      </div>
      <Button type="submit" variant="primary" loading={pending} icon={<Upload className="size-4" />}>
        {pending ? t("thietYeu.dangNhap") : t("thietYeu.nutNhap")}
      </Button>
      {state.message && <Notice tone={state.success ? "success" : "danger"}>{state.message}</Notice>}
    </form>
  );
}
