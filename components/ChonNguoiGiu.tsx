"use client";

import type { SelectHTMLAttributes } from "react";
import { BO_PHAN, CHUC_DANH, type BoPhan } from "@/lib/maVatTu";
import { useNgonNgu } from "@/lib/i18n/client";
import { Select } from "@/components/ui";

/**
 * Ô chọn NGƯỜI GIỮ một mặt hàng — cột "Giữ bởi" của danh mục: chức danh gom theo bộ phận (15
 * chức danh xếp phẳng thì phải đọc hết mới thấy người cần). Đầu danh sách là các lựa chọn đặc biệt
 * do nơi dùng truyền vào: "Tự suy theo nhóm" (bỏ gán — app suy từ nhóm như trước), với Sửa hàng
 * loạt thêm "Giữ nguyên".
 *
 * Khác ChonChucDanhGiuVatTu: ô đó là chức danh của một TÀI KHOẢN (người đăng nhập giữ kho nào), ô
 * này là người giữ của một MẶT HÀNG.
 */
export default function ChonNguoiGiu({
  dau,
  ...props
}: { dau: { value: string; label: string }[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  const { tenChucDanh, tenBoPhan } = useNgonNgu();
  return (
    <Select {...props}>
      {dau.map((x) => (
        <option key={x.value} value={x.value}>
          {x.label}
        </option>
      ))}
      {(Object.keys(BO_PHAN) as BoPhan[]).map((bp) => (
        <optgroup key={bp} label={tenBoPhan(bp)}>
          {Object.entries(CHUC_DANH)
            .filter(([, cd]) => cd.boPhan === bp)
            .map(([ma]) => (
              <option key={ma} value={ma}>
                {tenChucDanh(ma)} ({ma})
              </option>
            ))}
        </optgroup>
      ))}
    </Select>
  );
}
