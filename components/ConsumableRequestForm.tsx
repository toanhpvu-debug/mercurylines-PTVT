"use client";

import { useActionState, useMemo, useState } from "react";
import { taoYeuCauNhienLieu } from "@/app/consumable-actions";
import { CATEGORY_ICON } from "@/lib/consumables";

export type RequestLine = {
  productId: number;
  label: string;
  uom: string;
  category: string;
  ton: number;
  minQty: number;
};

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
  const [state, action, pending] = useActionState(taoYeuCauNhienLieu, {
    message: "",
  });

  const thieu = useMemo(
    () =>
      new Map(
        lines.map((l) => [
          l.productId,
          l.minQty > 0 && l.ton < l.minQty
            ? Math.round((l.minQty - l.ton) * 1000) / 1000
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
        Chưa có mặt hàng nào thuộc nhóm bạn phụ trách.
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
              Yêu cầu về bàn <b>{nguoiDuyet}</b> duyệt cấp tàu, rồi chuyển tiếp
              lên <b>quản lý kỹ thuật công ty</b>, sau đó sang <b>mua sắm</b>.
            </>
          ) : (
            <>
              Bạn là cấp duyệt cao nhất trên tàu nên yêu cầu đi <b>thẳng lên
              quản lý kỹ thuật công ty</b>, sau đó sang <b>mua sắm</b>.
            </>
          )}
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={chiThieu}
            onChange={(e) => setChiThieu(e.target.checked)}
          />
          Chỉ hiện mặt hàng dưới định mức
        </label>
      </div>

      {hienThi.length === 0 ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Không có mặt hàng nào dưới định mức. Bỏ dấu tick ở trên để xin cấp mặt
          hàng khác.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                <th className="p-2">Mặt hàng</th>
                <th className="p-2">ĐVT</th>
                <th className="p-2 text-right">Tồn</th>
                <th className="p-2 text-right">Định mức</th>
                <th className="p-2">Số lượng xin cấp</th>
              </tr>
            </thead>
            <tbody>
              {hienThi.map((l) => {
                const goiY = thieu.get(l.productId) ?? 0;
                return (
                  <tr key={l.productId} className="border-b">
                    <td className="p-2">
                      {CATEGORY_ICON[l.category]} {l.label}
                    </td>
                    <td className="p-2 text-slate-600">{l.uom}</td>
                    <td
                      className={`p-2 text-right ${
                        goiY > 0 ? "font-medium text-amber-700" : ""
                      }`}
                    >
                      {l.ton}
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
            Lý do / mục đích
          </span>
          <input
            name="purpose"
            placeholder="VD: Dự trữ cho chuyến đi Nhật, tồn còn dưới định mức"
            className="w-full rounded border p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">Mức ưu tiên</span>
          <select name="priority" className="w-full rounded border p-2">
            <option value="NORMAL">Bình thường</option>
            <option value="HIGH">Cao</option>
            <option value="URGENT">Khẩn</option>
            <option value="LOW">Thấp</option>
          </select>
        </label>
      </div>

      <button
        disabled={pending || hienThi.length === 0}
        className="rounded bg-blue-700 px-5 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Đang gửi..." : "Gửi yêu cầu phê duyệt"}
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
