"use client";

import { startTransition, useActionState, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { taiFileKiemKe } from "@/app/kiem-ke-actions";
import { tauTuTenTep } from "@/lib/kiemKe";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select } from "@/components/ui";

type Tau = { id: number; code: string; name: string };
type Kho = { id: number; vesselId: number; label: string };

/** Tải file kiểm kê MLS-11-06 (Excel / PDF scan) của một tàu. */
export default function TaiKiemKeForm({ vessels, warehouses, homNay }: { vessels: Tau[]; warehouses: Kho[]; homNay: string }) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(taiFileKiemKe, { message: "" });
  const [vesselId, setVesselId] = useState(vessels.length === 1 ? String(vessels[0].id) : "");
  const [khoChon, setKhoChon] = useState("AUTO");
  const [tenTep, setTenTep] = useState("");
  const tauTheoTen = tenTep ? tauTuTenTep(tenTep, vessels) : null;
  const tauDung = vesselId ? Number(vesselId) : (tauTheoTen?.id ?? null);
  const khoCuaTau = warehouses.filter((w) => w.vesselId === tauDung);

  return (
    // Gửi thủ công qua startTransition để React không reset form (mất file) khi lỗi.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-3"
    >
      <p className="text-xs text-[var(--text-secondary)]">{t("kiemKe.taiLenMoTa")}</p>
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
        <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <FileSpreadsheet className="size-4 text-[var(--text-muted)]" />
          {t("kiemKe.tepKiemKe")}
        </p>
        <input
          type="file"
          name="file"
          accept=".xlsx,.xls,.pdf"
          required
          onChange={(e) => setTenTep(e.target.files?.[0]?.name ?? "")}
          className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-600"
        />
        {tenTep && !vesselId && (
          <p className={`mt-2 text-xs ${tauTheoTen ? "text-[var(--text-success)]" : "text-[var(--text-warning)]"}`}>
            {tauTheoTen ? t("kiemKe.nhanTheoTen", { tau: `${tauTheoTen.code} ${tauTheoTen.name}` }) : t("kiemKe.khongNhanDuoc")}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("kiemKe.tau")}>
          <Select
            name="vesselId"
            value={vesselId}
            onChange={(e) => {
              setVesselId(e.target.value);
              setKhoChon("AUTO");
            }}
          >
            {vessels.length > 1 && <option value="">{t("kiemKe.tuNhanTheoTen")}</option>}
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} - {v.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("kiemKe.ngayKiemKe")}>
          <Input type="date" name="ngayKiemKe" defaultValue={homNay} max={homNay} />
        </Field>
      </div>
      <Field label={t("kiemKe.kho")} hint={t("kiemKe.khoGoiY")}>
        <Select name="khoChon" value={khoChon} onChange={(e) => setKhoChon(e.target.value)}>
          <option value="AUTO">{t("kiemKe.khoTuDong")}</option>
          {khoCuaTau.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="primary" loading={pending} icon={<Upload className="size-4" />}>
        {pending ? t("kiemKe.dangTai") : t("kiemKe.nutTai")}
      </Button>
      {state.message && <Notice tone={state.success ? "success" : "danger"}>{state.message}</Notice>}
    </form>
  );
}
