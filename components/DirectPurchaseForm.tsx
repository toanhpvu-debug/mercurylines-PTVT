"use client";

import { startTransition, useActionState, useState } from "react";
import { createDirectPurchaseOrder } from "@/app/actions";

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
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">Tàu *</span>
          <select
            name="vesselId"
            value={vesselId}
            onChange={(e) => setVesselId(e.target.value)}
            className="w-full rounded border p-2"
            required
          >
            <option value="">— Chọn tàu —</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            Nhà cung cấp *
          </span>
          <select
            name="supplierId"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full rounded border p-2"
            required
          >
            <option value="">— Chọn nhà cung cấp —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            Subject / Nội dung
          </span>
          <input
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="VD: Supply Lashing Equipment"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            Y/ref nhà cung cấp
          </span>
          <input
            name="supplierRef"
            value={supplierRef}
            onChange={(e) => setSupplierRef(e.target.value)}
            className="w-full rounded border p-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">Tiền tệ</span>
          <input
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">Cần hàng</span>
          <input
            name="expectedDate"
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            Chiết khấu (%)
          </span>
          <input
            name="discountPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            Phí vận chuyển
          </span>
          <input
            name="transportFee"
            type="number"
            step="0.01"
            min="0"
            value={transportFee}
            onChange={(e) => setTransportFee(e.target.value)}
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            Phí giao lên tàu
          </span>
          <input
            name="deliveryFee"
            type="number"
            step="0.01"
            min="0"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            className="w-full rounded border p-2"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">Ghi chú</span>
        <input
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded border p-2"
        />
      </label>

      {/* Upload Excel theo form công ty */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
        <p className="mb-1 font-semibold text-blue-950">
          Upload file Excel vật tư (theo form công ty)
        </p>
        <p className="mb-3 text-xs text-slate-600">
          Nhận file .xls/.xlsx có bảng vật tư với cột <b>Description</b> và{" "}
          <b>Q&apos;ty</b> (các cột PN/IMPA, Unit, U.Price tự nhận nếu có) —
          dùng được trực tiếp form PURCHASING ORDER / INQUIRY FOR QUOTE của công
          ty. Các dòng trong file sẽ được thêm vào đơn cùng các dòng nhập tay
          bên dưới.
        </p>
        <input
          type="file"
          name="excel"
          accept=".xls,.xlsx"
          className="text-sm"
        />
      </div>

      {/* Dòng nhập tay */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-semibold text-blue-950">Dòng vật tư nhập tay</p>
          <button
            type="button"
            onClick={() => setManualLines((prev) => [...prev, blankLine()])}
            className="rounded border border-blue-200 px-3 py-1 text-sm text-blue-700 hover:bg-blue-50"
          >
            + Thêm dòng
          </button>
        </div>
        <div className="space-y-2">
          {manualLines.map((line, index) => (
            <div
              key={index}
              className="grid grid-cols-2 gap-2 rounded-lg border border-blue-100 p-3 md:grid-cols-[1fr_10rem_6rem_6rem_7rem_2.5rem]"
            >
              <input
                name={`line_desc_${index}`}
                value={line.description}
                onChange={(e) => setLine(index, { description: e.target.value })}
                placeholder="Mô tả vật tư (Description)"
                className="col-span-2 rounded border p-2 md:col-span-1"
              />
              <input
                name={`line_pn_${index}`}
                value={line.partNo}
                onChange={(e) => setLine(index, { partNo: e.target.value })}
                placeholder="PN / IMPA"
                className="rounded border p-2"
              />
              <input
                name={`line_uom_${index}`}
                value={line.uom}
                onChange={(e) => setLine(index, { uom: e.target.value })}
                placeholder="ĐVT"
                className="rounded border p-2"
              />
              <input
                name={`line_qty_${index}`}
                type="number"
                step="0.01"
                min="0"
                value={line.quantity}
                onChange={(e) => setLine(index, { quantity: e.target.value })}
                placeholder="SL"
                className="rounded border p-2"
              />
              <input
                name={`line_price_${index}`}
                type="number"
                step="0.01"
                min="0"
                value={line.unitPrice}
                onChange={(e) => setLine(index, { unitPrice: e.target.value })}
                placeholder="Đơn giá"
                className="rounded border p-2"
              />
              <button
                type="button"
                onClick={() =>
                  setManualLines((prev) =>
                    prev.length > 1
                      ? prev.filter((_, i) => i !== index)
                      : [blankLine()]
                  )
                }
                aria-label="Xóa dòng"
                title="Xóa dòng"
                className="rounded border border-red-200 text-red-600 hover:bg-red-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-blue-700 px-6 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Đang tạo đơn..." : "Tạo đơn (IFQ / PO)"}
        </button>
        {state.message && (
          <p className="text-sm text-red-600">{state.message}</p>
        )}
      </div>
    </form>
  );
}
