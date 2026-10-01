"use client";

import { startTransition, useActionState, useState } from "react";
import { FileInput, Upload } from "lucide-react";
import { taiBaoGia } from "@/app/bao-gia-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Notice, Select } from "@/components/ui";

/** Tải báo giá nhà cung cấp (Word / Excel / PDF / PDF scan) cho một tàu, gắn PO nháp nếu có. */
export default function TaiBaoGiaForm({
  vessels,
  suppliers,
  poNhap,
  macDinh,
}: {
  vessels: { id: number; code: string; name: string }[];
  suppliers: { id: number; name: string }[];
  poNhap: { id: number; poNo: string; vesselId: number; nhaCungCap: string }[];
  macDinh: { vesselId: number | null; poId: number | null };
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(taiBaoGia, { message: "" });
  const [vesselId, setVesselId] = useState(String(macDinh.vesselId ?? (vessels.length === 1 ? vessels[0].id : "")));
  const [poId, setPoId] = useState(String(macDinh.poId ?? ""));
  const poCuaTau = poNhap.filter((p) => String(p.vesselId) === vesselId);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-3"
    >
      <p className="text-xs text-[var(--text-secondary)]">{t("purchasing.taiBaoGiaMoTa")}</p>
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
        <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <FileInput className="size-4 text-[var(--text-muted)]" />
          {t("purchasing.tepBaoGia")}
        </p>
        <input
          type="file"
          name="file"
          accept=".xlsx,.xls,.docx,.doc,.pdf"
          required
          className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-600"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={`${t("chung.tau")} *`}>
          <Select
            name="vesselId"
            value={vesselId}
            required
            onChange={(e) => {
              setVesselId(e.target.value);
              setPoId("");
            }}
          >
            <option value="">— {t("chung.chonTau")} —</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} - {v.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("purchasing.nhaCungCap")}>
          <Select name="supplierId" defaultValue="">
            <option value="">{t("purchasing.nccTheoTep")}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("purchasing.ganVaoPo")} hint={t("purchasing.ganVaoPoGoiY")}>
        <Select name="poId" value={poId} onChange={(e) => setPoId(e.target.value)} disabled={!vesselId}>
          <option value="">{t("purchasing.taoPoMoiSau")}</option>
          {poCuaTau.map((p) => (
            <option key={p.id} value={p.id}>
              {p.poNo} · {p.nhaCungCap}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="primary" loading={pending} icon={<Upload className="size-4" />}>
        {pending ? t("purchasing.dangDocBaoGia") : t("purchasing.nutTaiBaoGia")}
      </Button>
      {state.message && <Notice tone={state.success ? "success" : "danger"}>{state.message}</Notice>}
    </form>
  );
}
