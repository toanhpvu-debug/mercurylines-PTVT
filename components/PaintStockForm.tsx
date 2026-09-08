"use client";

import { useActionState, useState } from "react";
import { paintStockMove, savePaintStockMin } from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { PAINT_TYPE_LABEL } from "@/lib/paintTypes";

export type StockProductOption = { id: number; label: string; uom: string };

export function PaintStockMoveForm({
  vesselId,
  products,
}: {
  vesselId: number;
  products: StockProductOption[];
}) {
  const { t, tTuDo } = useNgonNgu();
  const [state, action, pending] = useActionState(paintStockMove, {
    message: "",
  });
  const [type, setType] = useState("IN");
  // "moi" = khai một loại sơn chưa có trong danh mục ngay tại đây. Chưa có loại
  // nào thì mở sẵn ở chế độ này, vì lúc đó chọn từ danh mục là vô nghĩa.
  const [nguon, setNguon] = useState<"cu" | "moi">(
    products.length === 0 ? "moi" : "cu"
  );
  const laMoi = nguon === "moi";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="vesselId" value={vesselId} />
      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() => setNguon("cu")}
          disabled={products.length === 0}
          className={`rounded px-3 py-1 disabled:opacity-40 ${
            !laMoi ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          {t("paint.chonTuDanhMuc")}
        </button>
        <button
          type="button"
          onClick={() => {
            setNguon("moi");
            // Bỏ mục "Xuất" khỏi ô chọn mà không kéo state về IN thì ô hiện
            // trống trong khi vẫn gửi OUT lên server.
            setType("IN");
          }}
          className={`rounded px-3 py-1 ${
            laMoi ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          {t("paint.loaiSonMoi")}
        </button>
        {products.length === 0 && (
          <span className="self-center text-xs text-slate-500">
            {t("paint.danhMucRong")}
          </span>
        )}
      </div>

      {laMoi && (
        <div className="grid grid-cols-1 gap-3 rounded border border-blue-200 bg-blue-50 p-3 md:grid-cols-5">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-600">
              {t("paint.tenSonMoi")} *
            </span>
            <input
              name="newName"
              required={laMoi}
              placeholder={t("paint.phVdMarathon")}
              className="w-full rounded border p-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">
              {t("paint.hangSanXuat")}
            </span>
            <input
              name="newMaker"
              placeholder="Jotun, Chugoku..."
              className="w-full rounded border p-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">
              {t("paint.heSon")}
            </span>
            <select name="newPaintType" className="w-full rounded border p-2">
              {Object.keys(PAINT_TYPE_LABEL).map((v) => (
                <option key={v} value={v}>
                  {tTuDo(`paint.loaiSon_${v}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">
              {t("paint.cotMau")}
            </span>
            <input
              name="newColorName"
              placeholder={t("paint.phMau")}
              className="w-full rounded border p-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">
              {t("chung.donVi")}
            </span>
            <input
              name="newUom"
              defaultValue="L"
              className="w-full rounded border p-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">
              {t("paint.dungTichLonThung")}
            </span>
            <input
              name="newPackSize"
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded border p-2"
            />
          </label>
          <p className="text-xs text-slate-600 md:col-span-4 md:self-end">
            {t("paint.loaiMoiGhiChu")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {!laMoi && (
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-600">
              {t("paint.loaiSon")} *
            </span>
            <select
              name="productId"
              required={!laMoi}
              className="w-full rounded border p-2"
            >
              <option value="">{t("paint.chonSon")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("chung.thaoTac")} *
          </span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded border p-2"
          >
            <option value="IN">{t("paint.optNhanSon")}</option>
            {/* Loại mới thì chưa có tồn để xuất — bỏ hẳn lựa chọn thay vì để
                người dùng chọn rồi mới bị server báo lỗi. */}
            {!laMoi && (
              <option value="OUT">{t("paint.optXuatHaoHut")}</option>
            )}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("chung.soLuong")} *
          </span>
          <input
            name="quantity"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.thoiDiemGoiY")}
          </span>
          <input
            name="occurredAt"
            type="datetime-local"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block md:col-span-5">
          <span className="mb-1 block text-sm text-slate-600">
            {t("chung.ghiChu")}
          </span>
          <input
            name="note"
            placeholder={t("paint.phGhiChuGiaoDich")}
            className="w-full rounded border p-2"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-blue-700 px-5 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? t("paint.dangGhi") : t("paint.nutGhiGiaoDich")}
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

export function PaintStockMinForm({
  vesselId,
  productId,
  minQty,
}: {
  vesselId: number;
  productId: number;
  minQty: number;
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(savePaintStockMin, {
    message: "",
  });
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="vesselId" value={vesselId} />
      <input type="hidden" name="productId" value={productId} />
      <input
        name="minQty"
        type="number"
        step="0.01"
        min="0"
        defaultValue={minQty || ""}
        className="w-20 rounded border p-1 text-right text-sm"
      />
      <button
        disabled={pending}
        className="text-xs text-blue-700 hover:underline disabled:opacity-50"
        title={state.message || t("paint.luuDinhMucToiThieu")}
      >
        {t("chung.luu")}
      </button>
    </form>
  );
}
