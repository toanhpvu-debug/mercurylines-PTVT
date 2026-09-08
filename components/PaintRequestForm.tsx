"use client";

import { useActionState, useMemo, useState } from "react";
import { taoYeuCauSon } from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";

export type PaintRequestLine = {
  productId: number;
  label: string;
  uom: string;
  /** Tồn hiện tại trên tàu. */
  ton: number;
  /** Định mức tối thiểu, 0 = chưa đặt. */
  minQty: number;
};

/**
 * Lập yêu cầu cấp sơn gửi lên phê duyệt.
 *
 * Đề xuất sẵn phần thiếu so với định mức (min − tồn) cho những loại đang dưới
 * mức, còn lại để trống. Đây là lý do thường gặp nhất để xin sơn, gõ lại từng
 * số vừa mất công vừa dễ sai.
 */
export default function PaintRequestForm({
  vesselId,
  lines,
}: {
  vesselId: number;
  lines: PaintRequestLine[];
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(taoYeuCauSon, {
    message: "",
  });

  const thieu = useMemo(
    () =>
      new Map(
        lines.map((l) => [
          l.productId,
          l.minQty > 0 && l.ton < l.minQty
            ? Math.round((l.minQty - l.ton) * 100) / 100
            : 0,
        ])
      ),
    [lines]
  );

  const [chiThieu, setChiThieu] = useState(true);
  const hienThi = chiThieu
    ? lines.filter((l) => (thieu.get(l.productId) ?? 0) > 0)
    : lines;

  if (lines.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {t("paint.chuaCoLoaiTruoc")}{" "}
        <span className="font-medium">{t("paint.danhMucSon")}</span>{" "}
        {t("paint.chuaCoLoaiSau")}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="vesselId" value={vesselId} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {t("paint.xinCap1")} <b>{t("paint.xinCapDam1")}</b>{" "}
          {t("paint.xinCap2")} <b>{t("paint.xinCapDam2")}</b>.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={chiThieu}
            onChange={(e) => setChiThieu(e.target.checked)}
          />
          {t("paint.chiHienDuoiDinhMuc")}
        </label>
      </div>

      {hienThi.length === 0 ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {t("paint.khongCoLoaiDuoiDinhMuc")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                <th className="p-2">{t("paint.loaiSon")}</th>
                <th className="p-2">{t("chung.donVi")}</th>
                <th className="p-2">{t("paint.cotTon")}</th>
                <th className="p-2">{t("paint.cotDinhMuc")}</th>
                <th className="p-2">{t("paint.cotSoLuongXin")}</th>
              </tr>
            </thead>
            <tbody>
              {hienThi.map((l) => {
                const goiY = thieu.get(l.productId) ?? 0;
                return (
                  <tr key={l.productId} className="border-b">
                    <td className="p-2">{l.label}</td>
                    <td className="p-2 text-slate-600">{l.uom}</td>
                    <td
                      className={`p-2 ${
                        goiY > 0 ? "font-medium text-amber-700" : ""
                      }`}
                    >
                      {l.ton}
                    </td>
                    <td className="p-2 text-slate-600">
                      {l.minQty > 0 ? l.minQty : "—"}
                    </td>
                    <td className="p-2">
                      <input
                        name={`sl_${l.productId}`}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={goiY > 0 ? goiY : ""}
                        placeholder="0"
                        className="w-28 rounded border p-1"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.lyDoMucDich")}
          </span>
          <input
            name="purpose"
            placeholder={t("paint.phLyDo")}
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("paint.mucUuTien")}
          </span>
          <select name="priority" className="w-full rounded border p-2">
            <option value="NORMAL">{t("labels.priority_NORMAL")}</option>
            <option value="HIGH">{t("labels.priority_HIGH")}</option>
            <option value="URGENT">{t("labels.priority_URGENT")}</option>
            <option value="LOW">{t("labels.priority_LOW")}</option>
          </select>
        </label>
      </div>

      <button
        disabled={pending || hienThi.length === 0}
        className="rounded bg-blue-700 px-5 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? t("paint.dangGui") : t("paint.nutGuiYeuCau")}
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
