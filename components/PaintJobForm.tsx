"use client";

import { startTransition, useActionState, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { createPaintJob, deletePaintJob } from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import {
  Button,
  Field,
  Input,
  Notice,
  Select,
} from "@/components/ui";

type Option = { id: number; label: string };
type StockOption = { id: number; label: string; uom: string; onHand: number };

let lineKey = 0;

export function PaintJobForm({
  vesselId,
  areas,
  products,
  defaultDate,
}: {
  vesselId: number;
  areas: Option[];
  products: StockOption[];
  defaultDate: string;
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(createPaintJob, {
    message: "",
  });
  const [lines, setLines] = useState<number[]>([lineKey++]);

  if (products.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        {t("paint.chuaCoSonTruoc")}{" "}
        <span className="font-medium text-[var(--text-primary)]">
          {t("paint.tonSon")}
        </span>{" "}
        {t("paint.chuaCoSonSau")}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="vesselId" value={vesselId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label={`${t("paint.ngayThiCong")} *`}>
          <Input
            name="jobDate"
            type="date"
            defaultValue={defaultDate}
            required
          />
        </Field>
        <Field label={t("paint.khuVuc")} className="md:col-span-2">
          <Select name="areaId">
            <option value="">{t("paint.khongGanKhuVuc")}</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("paint.dienTichSon")}>
          <Input
            name="paintedM2"
            type="number"
            step="0.1"
            min="0"
            className="tabular"
          />
        </Field>
        <Field label={t("paint.soLopPhu")}>
          <Input
            name="coats"
            type="number"
            min="1"
            step="1"
            defaultValue={1}
            className="tabular"
          />
        </Field>
        <Field label={t("paint.thoiTiet")}>
          <Input name="weather" placeholder={t("paint.phThoiTiet")} />
        </Field>
        <Field label={t("paint.nhietDoKhongKhi")}>
          <Input name="airTemp" type="number" step="0.1" className="tabular" />
        </Field>
        <Field label={t("paint.doAm")}>
          <Input
            name="humidity"
            type="number"
            step="1"
            min="0"
            max="100"
            className="tabular"
          />
        </Field>
        <Field label={t("paint.nhietDoBeMat")}>
          <Input
            name="surfaceTemp"
            type="number"
            step="0.1"
            className="tabular"
          />
        </Field>
        <Field
          label={t("paint.nguoiThucHienGoiY")}
          className="md:col-span-3"
        >
          <Input name="performedBy" />
        </Field>
        <Field label={t("chung.ghiChu")} className="md:col-span-4">
          <Input name="notes" />
        </Field>
      </div>

      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
        <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
          {t("paint.sonDaDungTuTru")}
        </p>
        <div className="space-y-2">
          {lines.map((key) => (
            <div key={key} className="flex flex-wrap items-end gap-2">
              <Field
                label={t("paint.loaiSon")}
                className="min-w-[220px] flex-1"
              >
                <Select name="lineProductId">
                  <option value="">{t("paint.chonSon")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}{" "}
                      {t("paint.conLaiN", { n: p.onHand, dv: p.uom })}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("chung.soLuong")} className="w-32">
                <Input
                  name="lineQuantity"
                  type="number"
                  step="0.01"
                  min="0"
                  className="tabular"
                />
              </Field>
              {lines.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setLines((ls) => ls.filter((k) => k !== key))}
                  icon={<Trash2 className="size-4" />}
                >
                  {t("paint.xoaDong")}
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2"
          onClick={() => setLines((ls) => [...ls, lineKey++])}
          icon={<Plus className="size-4" />}
        >
          {t("paint.themDong")}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          loading={pending}
          icon={<Save className="size-4" />}
        >
          {pending ? t("paint.dangGhi") : t("paint.nutGhiNhatKy")}
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

export function PaintJobDeleteButton({
  vesselId,
  jobId,
}: {
  vesselId: number;
  jobId: number;
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(deletePaintJob, {
    message: "",
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirm(t("paint.xacNhanXoaThiCong"))) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="vesselId" value={vesselId} />
      <input type="hidden" name="id" value={jobId} />
      <Button
        size="sm"
        variant="ghost"
        loading={pending}
        icon={<Trash2 className="size-4" />}
        title={state.message || undefined}
      >
        {t("chung.xoa")}
      </Button>
    </form>
  );
}
