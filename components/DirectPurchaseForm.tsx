"use client";

import { startTransition, useActionState, useState } from "react";
import { Plus, ShoppingCart, Upload, X } from "lucide-react";
import { createDirectPurchaseOrder } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select } from "@/components/ui";

type Option = { id: number; label: string };

type ManualLine = {
  description: string;
  partNo: string;
  uom: string;
  quantity: string;
  unitPrice: string;
};

const blankLine = (): ManualLine => ({
  description: "",
  partNo: "",
  uom: "PCS",
  quantity: "",
  unitPrice: "",
});

export default function DirectPurchaseForm({
  vessels,
  suppliers,
}: {
  vessels: Option[];
  suppliers: Option[];
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(
    createDirectPurchaseOrder,
    { message: "" }
  );
  const [vesselId, setVesselId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [subject, setSubject] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [transportFee, setTransportFee] = useState("0");
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [manualLines, setManualLines] = useState<ManualLine[]>([blankLine()]);

  const setLine = (index: number, patch: Partial<ManualLine>) => {
    setManualLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  };

  return (
    // Gửi thủ công qua startTransition để React không tự reset form khi lỗi —
    // giữ nguyên file Excel đã chọn cùng mọi ô nhập.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={`${t("chung.tau")} *`}>
          <Select
            name="vesselId"
            value={vesselId}
            onChange={(e) => setVesselId(e.target.value)}
            required
          >
            <option value="">— {t("chung.chonTau")} —</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`${t("purchasing.nhaCungCap")} *`}>
          <Select
            name="supplierId"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            required
          >
            <option value="">— {t("purchasing.chonNcc")} —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={t("purchasing.labelSubject")}>
          <Input
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("purchasing.phViDuSubject")}
          />
        </Field>
        <Field label={t("purchasing.labelYref")}>
          <Input
            name="supplierRef"
            value={supplierRef}
            onChange={(e) => setSupplierRef(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Field label={t("purchasing.tienTe")}>
          <Input
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
        </Field>
        <Field label={t("purchasing.canHang")}>
          <Input
            name="expectedDate"
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
        </Field>
        <Field label={t("purchasing.chietKhau")}>
          <Input
            name="discountPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            className="tabular"
          />
        </Field>
        <Field label={t("purchasing.phiVanChuyen")}>
          <Input
            name="transportFee"
            type="number"
            step="0.01"
            min="0"
            value={transportFee}
            onChange={(e) => setTransportFee(e.target.value)}
            className="tabular"
          />
        </Field>
        <Field label={t("purchasing.phiGiaoLenTau")}>
          <Input
            name="deliveryFee"
            type="number"
            step="0.01"
            min="0"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            className="tabular"
          />
        </Field>
      </div>

      <Field label={t("chung.ghiChu")}>
        <Input
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      {/* Upload Excel theo form công ty */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Upload className="size-4 text-[var(--text-muted)]" />
          {t("purchasing.uploadExcel")}
        </p>
        <p className="mb-3 text-xs text-[var(--text-secondary)]">
          {t("purchasing.uploadExcelMoTaDau")} <b>Description</b>{" "}
          {t("chung.va")} <b>Q&apos;ty</b>{" "}
          {t("purchasing.uploadExcelMoTaCuoi")}
        </p>
        <input
          type="file"
          name="excel"
          accept=".xls,.xlsx"
          className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-600"
        />
      </div>

      {/* Dòng nhập tay */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {t("purchasing.dongNhapTay")}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Plus className="size-4" />}
            onClick={() => setManualLines((prev) => [...prev, blankLine()])}
          >
            {t("purchasing.themDong")}
          </Button>
        </div>
        <div className="space-y-2">
          {manualLines.map((line, index) => (
            <div
              key={index}
              className="grid grid-cols-2 items-center gap-2 rounded-lg border border-[var(--border-subtle)] p-3 md:grid-cols-[1fr_10rem_6rem_6rem_7rem_2.5rem]"
            >
              <Input
                name={`line_desc_${index}`}
                value={line.description}
                onChange={(e) => setLine(index, { description: e.target.value })}
                placeholder={t("purchasing.phMoTaVatTu")}
                className="col-span-2 md:col-span-1"
              />
              <Input
                name={`line_pn_${index}`}
                value={line.partNo}
                onChange={(e) => setLine(index, { partNo: e.target.value })}
                placeholder="PN / IMPA"
              />
              <Input
                name={`line_uom_${index}`}
                value={line.uom}
                onChange={(e) => setLine(index, { uom: e.target.value })}
                placeholder={t("chung.donVi")}
              />
              <Input
                name={`line_qty_${index}`}
                type="number"
                step="0.01"
                min="0"
                value={line.quantity}
                onChange={(e) => setLine(index, { quantity: e.target.value })}
                placeholder={t("purchasing.phSl")}
                className="tabular"
              />
              <Input
                name={`line_price_${index}`}
                type="number"
                step="0.01"
                min="0"
                value={line.unitPrice}
                onChange={(e) => setLine(index, { unitPrice: e.target.value })}
                placeholder={t("purchasing.cotDonGia")}
                className="tabular"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setManualLines((prev) =>
                    prev.length > 1
                      ? prev.filter((_, i) => i !== index)
                      : [blankLine()]
                  )
                }
                aria-label={t("purchasing.xoaDong")}
                title={t("purchasing.xoaDong")}
                icon={<X className="size-4" />}
                className="justify-self-end text-[var(--text-danger)]"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          icon={<ShoppingCart className="size-4" />}
          loading={pending}
        >
          {pending
            ? t("purchasing.dangTaoDon")
            : t("purchasing.nutTaoDonIfqPo")}
        </Button>
        {state.message && <Notice tone="danger">{state.message}</Notice>}
      </div>
    </form>
  );
}
