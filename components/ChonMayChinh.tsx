"use client";

import { NHOM_MAY_CHINH } from "@/lib/maVatTu";
import { useNgonNgu } from "@/lib/i18n/client";
import { Field, Input, Select } from "@/components/ui";

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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label={t("vessels.mayChinh")}>
        <Select name="mainEngineGroup" defaultValue={nhom}>
          <option value="">{t("vessels.chuaKhaiMay")}</option>
          {NHOM_MAY_CHINH.map((ma) => (
            <option key={ma} value={ma}>
              {tenNhomThietBi(ma)} ({ma})
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("vessels.modelMay")}>
        <Input
          name="mainEngineModel"
          defaultValue={model}
          placeholder="6UEC50LSII, 6S50MC-C..."
        />
      </Field>
    </div>
  );
}
