"use client";

import { BO_PHAN, CHUC_DANH, chucDanhTuVaiTro, type BoPhan } from "@/lib/maVatTu";
import { useNgonNgu } from "@/lib/i18n/client";
import { Field, Select } from "@/components/ui";

/**
 * Ô chọn CHỨC DANH GIỮ VẬT TƯ của một tài khoản.
 *
 * Khác với ô vai trò đăng nhập ngay bên cạnh: vai trò quyết định người này được
 * làm gì trong app, còn chức danh ở đây quyết định "trên tàu anh giữ kho nào" —
 * dùng để lọc ra đúng phần vật tư người ta phải kiểm kê và bàn giao.
 *
 * Bỏ trống thì hệ thống suy từ vai trò (máy hai → Máy hai). Chỉ những chức danh
 * KHÔNG có vai trò riêng — thủy thủ trưởng, thợ máy, sĩ quan điện, bếp trưởng —
 * mới bắt buộc chọn tay, vì cả bốn đều đăng nhập bằng vai trò Thuyền viên.
 */
export default function ChonChucDanhGiuVatTu({
  giaTri,
  vaiTro,
  disabled,
  gonGang,
}: {
  giaTri: string;
  /** Vai trò đăng nhập đang chọn — để nói trước hệ thống sẽ suy ra chức danh gì. */
  vaiTro?: string;
  disabled?: boolean;
  /** Dạng gọn: dùng trong bảng, không có nhãn phía trên. */
  gonGang?: boolean;
}) {
  const { t, tenChucDanh, tenBoPhan } = useNgonNgu();
  const suyRa = vaiTro ? chucDanhTuVaiTro(vaiTro) : null;
  const oChon = (
    <Select
      name="rankCode"
      defaultValue={giaTri}
      disabled={disabled}
      className={gonGang ? "max-w-44" : undefined}
    >
      <option value="">
        {suyRa
          ? `— ${t("materials.theoVaiTro", { ten: tenChucDanh(suyRa) })} —`
          : `— ${t("materials.chuaKhai")} —`}
      </option>
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
  if (gonGang) return oChon;
  return <Field label={t("materials.chucDanhGiuVatTu")}>{oChon}</Field>;
}
