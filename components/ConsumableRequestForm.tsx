"use client";

import { useActionState, useMemo, useState } from "react";
import { taoYeuCauNhienLieu } from "@/app/consumable-actions";
import { CATEGORY_ICON } from "@/lib/consumables";
import { useNgonNgu } from "@/lib/i18n/client";

export type RequestLine = {
  productId: number;
  label: string;
  uom: string;
  category: string;
  ton: number;
  minQty: number;
  /** Tiêu thụ trung bình mỗi ngày, tính trên 30 ngày gần nhất. 0 = chưa có. */
  moiNgay: number;
};

/** Số ngày dự trữ mặc định khi đề xuất số lượng xin cấp. */
const SO_NGAY_DU_TRU_MAC_DINH = 60;

/**
 * Xin cấp dầu · dầu nhờn · hóa chất, gửi vào đúng dây chuyền phê duyệt của
 * yêu cầu vật tư (tàu duyệt → công ty duyệt → mua sắm).
 *
 * Đề xuất sẵn phần thiếu so với định mức cho những mặt hàng đang dưới mức — đó
 * là lý do thường gặp nhất để xin cấp.
 */
export default function ConsumableRequestForm({
  vesselId,
  lines,
  nguoiDuyet,
}: {
  vesselId: number;
  lines: RequestLine[];
  /** Chức danh sẽ duyệt ở cấp tàu, hoặc null nếu đi thẳng lên công ty. */
  nguoiDuyet: string | null;
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(taoYeuCauNhienLieu, {
    message: "",
  });

  const [soNgay, setSoNgay] = useState(SO_NGAY_DU_TRU_MAC_DINH);

  /**
   * Đề xuất số lượng xin cấp = phần LỚN HƠN giữa hai cách tính:
   *   - bù cho đủ định mức tối thiểu, và
   *   - đủ dùng cho <soNgay> ngày theo tốc độ tiêu thụ 30 ngày qua.
   *
   * Chỉ dựa vào định mức thì mặt hàng tiêu thụ nhanh vẫn hết trước khi hàng
   * về; chỉ dựa vào tốc độ thì mặt hàng chưa từng ghi tiêu thụ sẽ đề xuất 0.
   * Lấy số lớn hơn nên cách nào cũng không bỏ sót.
   */
  const deXuat = useMemo(() => {
    const m = new Map<number, { sl: number; vi: string }>();
    for (const l of lines) {
      const buDinhMuc =
        l.minQty > 0 && l.ton < l.minQty ? l.minQty - l.ton : 0;
      const duDung = l.moiNgay > 0 ? l.moiNgay * soNgay - l.ton : 0;
      const sl = Math.max(buDinhMuc, duDung, 0);
      const vi =
        sl === 0
          ? ""
          : duDung > buDinhMuc
            ? t("consumables.duDungNNgay", { n: soNgay })
            : t("consumables.buChoDuDinhMuc");
      m.set(l.productId, { sl: Math.ceil(sl * 1000) / 1000, vi });
    }
    return m;
  }, [lines, soNgay, t]);

  const [chiThieu, setChiThieu] = useState(true);
  const hienThi = chiThieu
    ? lines.filter((l) => (deXuat.get(l.productId)?.sl ?? 0) > 0)
    : lines;

  if (lines.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {t("consumables.chuaCoMatHangNhom")}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="vesselId" value={vesselId} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {nguoiDuyet ? (
            <>
              {t("consumables.luongDuyetTruoc")} <b>{nguoiDuyet}</b>{" "}
              {t("consumables.luongDuyetGiua")}{" "}
              <b>{t("consumables.quanLyKyThuat")}</b>
              {t("consumables.luongDuyetSau")}{" "}
              <b>{t("consumables.muaSam")}</b>.
            </>
          ) : (
            <>
              {t("consumables.luongDuyetThangTruoc")}{" "}
              <b>{t("consumables.luongDuyetThangDam")}</b>
              {t("consumables.luongDuyetSau")}{" "}
              <b>{t("consumables.muaSam")}</b>.
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            {t("consumables.duTruDuDung")}
            <select
              value={soNgay}
              onChange={(e) => setSoNgay(Number(e.target.value))}
              className="rounded border p-1"
            >
              {[30, 45, 60, 90, 120].map((n) => (
                <option key={n} value={n}>
                  {t("consumables.nNgay", { n })}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={chiThieu}
              onChange={(e) => setChiThieu(e.target.checked)}
            />
            {t("consumables.chiHienCanCap")}
          </label>
        </div>
      </div>

      {hienThi.length === 0 ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {t("consumables.khongCanCap", { n: soNgay })}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                <th className="p-2">{t("consumables.matHang")}</th>
                <th className="p-2">{t("chung.donVi")}</th>
                <th className="p-2 text-right">{t("consumables.ton")}</th>
                <th className="p-2 text-right">
                  {t("consumables.dungMoiNgay")}
                </th>
                <th className="p-2 text-right">
                  {t("consumables.conDungDuoc")}
                </th>
                <th className="p-2 text-right">{t("consumables.dinhMuc")}</th>
                <th className="p-2">{t("consumables.cotSoLuongXinCap")}</th>
              </tr>
            </thead>
            <tbody>
              {hienThi.map((l) => {
                const dx = deXuat.get(l.productId) ?? { sl: 0, vi: "" };
                const conDung =
                  l.moiNgay > 0 ? Math.floor(l.ton / l.moiNgay) : null;
                return (
                  <tr key={l.productId} className="border-b">
                    <td className="p-2">
                      {CATEGORY_ICON[l.category]} {l.label}
                    </td>
                    <td className="p-2 text-slate-600">{l.uom}</td>
                    <td
                      className={`p-2 text-right ${
                        dx.sl > 0 ? "font-medium text-amber-700" : ""
                      }`}
                    >
                      {l.ton}
                    </td>
                    <td className="p-2 text-right text-slate-600">
                      {l.moiNgay > 0
                        ? Math.round(l.moiNgay * 100) / 100
                        : "—"}
                    </td>
                    <td className="p-2 text-right">
                      {conDung === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={
                            conDung < soNgay
                              ? "font-semibold text-orange-700"
                              : "text-slate-700"
                          }
                        >
                          {t("consumables.nNgay", { n: conDung })}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right text-slate-600">
                      {l.minQty > 0 ? l.minQty : "—"}
                    </td>
                    <td className="p-2">
                      <input
                        name={`sl_${l.productId}`}
                        type="number"
                        step="0.001"
                        min="0"
                        key={`${l.productId}-${soNgay}`}
                        defaultValue={dx.sl > 0 ? dx.sl : ""}
                        placeholder="0"
                        className="w-28 rounded border p-1"
                      />
                      {dx.vi && (
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {dx.vi}
                        </span>
                      )}
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
            {t("consumables.lyDoMucDich")}
          </span>
          <input
            name="purpose"
            placeholder={t("consumables.lyDoPlaceholder")}
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            {t("consumables.mucUuTien")}
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
        {pending
          ? t("consumables.dangGui")
          : t("consumables.nutGuiYeuCau")}
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
