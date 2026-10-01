"use client";

import { useState, useTransition, type RefObject } from "react";
import { FileSearch } from "lucide-react";
import { docTepBieuMau, type KetQuaDocTepBieuMau } from "@/app/bieu-mau-tep-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Notice } from "@/components/ui";

const TRUONG = ["companyName", "address", "repAddress", "tel", "email", "website"] as const;

/**
 * Ô "Lấy từ file Word / Excel gốc" trong form thêm / sửa chuẩn biểu mẫu: chọn
 * file, bấm Đọc → các ô của form được điền theo đầu chứng từ trong file, xem
 * trước logo và các dòng chữ đã đọc. File vẫn nằm trong ô chọn (name="tepGoc")
 * nên bấm Thêm / Lưu là file gốc + logo được lưu kèm chuẩn biểu mẫu.
 */
export default function DocTepBieuMau({ formRef }: { formRef: RefObject<HTMLFormElement | null> }) {
  const { t } = useNgonNgu();
  const [kq, setKq] = useState<KetQuaDocTepBieuMau | null>(null);
  const [coTep, setCoTep] = useState(false);
  const [dang, startTransition] = useTransition();

  const doc = () => {
    const form = formRef.current;
    const input = form?.elements.namedItem("tepGoc") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!form || !file) return;
    const fd = new FormData();
    fd.set("tepGoc", file);
    startTransition(async () => {
      const r = await docTepBieuMau(fd);
      setKq(r);
      if (!r.ok) return;
      for (const k of TRUONG) {
        const o = form.elements.namedItem(k) as HTMLInputElement | null;
        if (o && r.truong[k]) o.value = r.truong[k];
      }
    });
  };

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{t("purchasing.tepGocTieuDe")}</p>
      <p className="text-xs text-[var(--text-secondary)]">{t("purchasing.tepGocMoTa")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="tepGoc"
          accept=".docx,.doc,.xlsx,.xls"
          onChange={(e) => {
            setCoTep(Boolean(e.target.files?.length));
            setKq(null);
          }}
          className="min-w-0 flex-1 text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-600"
        />
        <Button type="button" size="sm" onClick={doc} disabled={!coTep} loading={dang} icon={<FileSearch className="size-4" />}>
          {t("purchasing.tepGocDoc")}
        </Button>
      </div>
      {kq && !kq.ok && <Notice tone="danger">{kq.loi}</Notice>}
      {kq && kq.ok && (
        <div className="space-y-2">
          <Notice tone="success">{t("purchasing.tepGocDaDien")}</Notice>
          <div className="flex flex-wrap items-start gap-3">
            {kq.logo ? (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={kq.logo} alt="logo" className="h-14 w-auto max-w-[180px] object-contain" />
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">{t("purchasing.tepGocKhongLogo")}</p>
            )}
            {kq.dongChu.length > 0 && (
              <details className="min-w-0 flex-1 text-xs text-[var(--text-secondary)]">
                <summary className="cursor-pointer">{t("purchasing.tepGocChuDoc", { n: kq.dongChu.length })}</summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {kq.dongChu.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          {kq.canhBao.map((c, i) => (
            <Notice key={i} tone="warning">
              {c}
            </Notice>
          ))}
        </div>
      )}
    </div>
  );
}
