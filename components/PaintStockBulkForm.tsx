"use client";

import { useActionState, useState } from "react";
import { nhapXuatSonHangLoat } from "@/app/paint-actions";

/**
 * Nhập / xuất sơn hàng loạt từ file Excel hoặc bảng dán từ PDF.
 *
 * Cột số lượng ở đây là SỐ CỘNG THÊM / TRỪ ĐI theo phiếu, không phải tồn chốt
 * lại — khác hẳn trang "Nhập danh mục sơn từ file". Nói rõ ngay trên form vì
 * lẫn hai cái này là sai tồn kho.
 */
export default function PaintStockBulkForm({
  vesselId,
}: {
  vesselId: number;
}) {
  const [state, action, pending] = useActionState(nhapXuatSonHangLoat, {
    message: "",
  });
  const [type, setType] = useState("IN");
  const [nguon, setNguon] = useState<"file" | "dan">("file");

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="vesselId" value={vesselId} />

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">Loại phiếu *</span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded border p-2"
          >
            <option value="IN">Nhập sơn lên tàu</option>
            <option value="OUT">Xuất sơn ra dùng</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">Thời điểm</span>
          <input
            type="datetime-local"
            name="occurredAt"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            Ghi chú (số phiếu, cảng…)
          </span>
          <input
            name="note"
            placeholder="VD: Phiếu giao hàng 1234, cảng Hải Phòng"
            className="w-full rounded border p-2"
          />
        </label>
      </div>

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Cột số lượng trong file là <b>số cộng thêm / trừ đi</b> theo phiếu này,
        không phải tồn chốt lại. Muốn <i>đặt</i> tồn bằng đúng số trong file
        (dựng dữ liệu ban đầu, kiểm kê) thì dùng trang{" "}
        <b>Nhập danh mục sơn từ file</b>.
        {type === "OUT" && (
          <>
            {" "}
            Nếu có dòng thiếu tồn thì <b>dừng cả lô</b>, không ghi dòng nào.
          </>
        )}
      </div>

      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setNguon("file")}
          className={`rounded px-3 py-1 ${
            nguon === "file"
              ? "bg-blue-700 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          Từ file Excel
        </button>
        <button
          type="button"
          onClick={() => setNguon("dan")}
          className={`rounded px-3 py-1 ${
            nguon === "dan"
              ? "bg-blue-700 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          Dán bảng (từ PDF)
        </button>
      </div>

      {nguon === "file" ? (
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            File Excel (.xls / .xlsx)
          </span>
          <input
            type="file"
            name="file"
            accept=".xls,.xlsx"
            className="w-full rounded border p-2"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Bảng cần cột <b>tên sơn</b> và cột <b>số lượng</b> (Tồn / Số lượng /
            Qty). Các cột hãng, loại, màu, ĐVT, dung tích, độ phủ nếu có sẽ được
            đọc kèm. Loại sơn chưa có trong danh mục sẽ được thêm tự động.
          </span>
        </label>
      ) : (
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            Dán bảng từ PDF
          </span>
          <textarea
            name="pasted"
            rows={6}
            placeholder="Mở PDF, bôi đen bảng (Ctrl+A), copy (Ctrl+C) rồi dán vào đây"
            className="w-full rounded border p-2 font-mono text-xs"
          />
        </label>
      )}

      <button
        disabled={pending}
        className="rounded bg-blue-700 px-5 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending
          ? "Đang xử lý..."
          : type === "IN"
            ? "Nhập hàng loạt"
            : "Xuất hàng loạt"}
      </button>

      {state.message && (
        <p
          className={`text-sm ${
            state.success ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
