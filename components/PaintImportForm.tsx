"use client";

import { startTransition, useActionState, useState } from "react";
import { importPaintProducts } from "@/app/paint-actions";

type VesselOption = { id: number; label: string };

export default function PaintImportForm({
  vessels,
}: {
  vessels: VesselOption[];
}) {
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
      <label className="block max-w-md">
        <span className="mb-1 block text-sm text-slate-600">
          Ghi tồn cho tàu — tùy chọn
        </span>
        <select name="vesselId" className="w-full rounded border p-2">
          <option value="">— Chỉ nạp danh mục, không ghi tồn —</option>
          {vessels.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-slate-500">
          Chọn tàu thì cột số lượng / tồn trong file sẽ được ghi thành tồn sơn
          của tàu đó.
        </span>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("excel")}
          className={`rounded px-4 py-2 text-sm ${
            mode === "excel"
              ? "bg-blue-700 text-white"
              : "border border-blue-200 bg-white text-blue-800 hover:bg-blue-50"
          }`}
        >
          Từ file Excel
        </button>
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`rounded px-4 py-2 text-sm ${
            mode === "paste"
              ? "bg-blue-700 text-white"
              : "border border-blue-200 bg-white text-blue-800 hover:bg-blue-50"
          }`}
        >
          Dán từ PDF
        </button>
      </div>

      {mode === "excel" ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
          <p className="mb-1 font-semibold text-blue-950">
            File Excel (.xls / .xlsx)
          </p>
          <p className="mb-3 text-xs text-slate-600">
            App tự dò cột theo tiêu đề, đọc mọi sheet. Nhận các tên cột thường
            gặp: <b>Tên sơn</b> (bắt buộc) · Hãng · Loại · Mã màu · Tên màu ·
            Đơn vị · Dung tích · Độ phủ (m²/L) · DFT · Dung môi · Tồn/Số lượng.
            Tiếng Anh cũng nhận: Product, Maker, Type, Colour, Unit, Coverage,
            Thinner, Q&apos;ty.
          </p>
          <input
            type="file"
            name="file"
            accept=".xls,.xlsx"
            className="text-sm"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
          <p className="mb-1 font-semibold text-blue-950">Dán nội dung từ PDF</p>
          <p className="mb-2 text-xs text-slate-600">
            Mở file PDF → bôi đen bảng danh mục (<b>Ctrl+A</b>) → copy (
            <b>Ctrl+C</b>) → dán vào ô dưới. App tách cột theo Tab, dấu | hoặc
            khoảng trắng liền nhau. Không có dòng tiêu đề thì mỗi dòng được coi
            là một tên sơn.
          </p>
          <textarea
            name="pasted"
            rows={10}
            placeholder={
              "Tên sơn\tHãng\tLoại\tĐơn vị\tĐộ phủ\n" +
              "Marathon 500\tJotun\tAnti-corrosive\tL\t7.5\n" +
              "SeaQuantum X200\tJotun\tAnti-fouling\tL\t5.6"
            }
            className="w-full rounded border p-2 font-mono text-xs"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-blue-700 px-6 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Đang đọc..." : "Nhập vào danh mục sơn"}
        </button>
        {state.message && (
          <span
            className={`text-sm ${
              state.success ? "text-green-700" : "text-red-600"
            }`}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
