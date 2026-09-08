"use client";

import { useActionState, useState } from "react";
import { nhapXuatSonHangLoat } from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";

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
  const { t } = useNgonNgu();
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
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.loaiPhieu")} *
          </span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded border p-2"
          >
            <option value="IN">{t("paint.optNhapSon")}</option>
            <option value="OUT">{t("paint.optXuatSon")}</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.thoiDiem")}
          </span>
          <input
            type="datetime-local"
            name="occurredAt"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.ghiChuPhieu")}
          </span>
          <input
            name="note"
            placeholder={t("paint.phGhiChuPhieu")}
            className="w-full rounded border p-2"
          />
        </label>
      </div>

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        {t("paint.luuY1")} <b>{t("paint.luuYDam1")}</b> {t("paint.luuY2")}{" "}
        <i>{t("paint.luuYDam2")}</i> {t("paint.luuY3")}{" "}
        <b>{t("paint.nhapDanhMucTieuDe")}</b>.
        {type === "OUT" && (
          <>
            {" "}
            {t("paint.luuYXuat1")} <b>{t("paint.luuYXuatDam")}</b>
            {t("paint.luuYXuat2")}
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
          {t("paint.tuFileExcel")}
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
          {t("paint.danBangPdf")}
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
            {t("paint.bangCanCot1")} <b>{t("paint.bangCanCotTen")}</b>{" "}
            {t("paint.bangCanCot2")} <b>{t("paint.bangCanCotSL")}</b>{" "}
            {t("paint.bangCanCot3")}
          </span>
        </label>
      ) : (
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.danBangTuPdf")}
          </span>
          <textarea
            name="pasted"
            rows={6}
            placeholder={t("paint.phDanBangPdf")}
            className="w-full rounded border p-2 font-mono text-xs"
          />
        </label>
      )}

      <button
        disabled={pending}
        className="rounded bg-blue-700 px-5 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending
          ? t("chung.dangXuLy")
          : type === "IN"
            ? t("paint.nutNhapHangLoat")
            : t("paint.nutXuatHangLoat")}
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
