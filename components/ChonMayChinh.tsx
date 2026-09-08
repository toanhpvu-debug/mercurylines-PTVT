"use client";

import { NHOM_MAY_CHINH } from "@/lib/maVatTu";
import { useNgonNgu } from "@/lib/i18n/client";

/**
 * Khai máy chính của tàu: họ máy (MAN B&W / Mitsubishi UEC) và model cụ thể.
 *
 * Đội tàu Mercury Lines chạy CẢ HAI họ máy hai kỳ, mà hai họ gần như không dùng
 * chung chi tiết nào. Không khai ở đây thì phụ tùng máy chính không xếp được
 * vào đúng nhóm, và khi dự trù người ta phải tự nhớ tàu nào máy gì — nhớ nhầm
 * một lần là đặt về một thùng hàng không lắp được.
 *
 * Model in thẳng lên đơn đặt hàng nên để ô chữ tự do: nhà cung cấp cần đúng
 * chuỗi "6UEC50LSII" chứ không cần biết cách hệ thống phân nhóm.
 */
export default function ChonMayChinh({
  nhom,
  model,
}: {
  nhom: string;
  model: string;
}) {
  const { t, tenNhomThietBi } = useNgonNgu();
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm text-slate-600">
          {t("vessels.mayChinh")}
        </label>
        <select
          name="mainEngineGroup"
          defaultValue={nhom}
          className="w-full rounded border p-2"
        >
          <option value="">{t("vessels.chuaKhaiMay")}</option>
          {NHOM_MAY_CHINH.map((ma) => (
            <option key={ma} value={ma}>
              {tenNhomThietBi(ma)} ({ma})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">
          {t("vessels.modelMay")}
        </label>
        <input
          name="mainEngineModel"
          defaultValue={model}
          placeholder="6UEC50LSII, 6S50MC-C..."
          className="w-full rounded border p-2"
        />
      </div>
    </div>
  );
}
