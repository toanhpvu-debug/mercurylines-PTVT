import { BO_PHAN, CHUC_DANH, type BoPhan } from "@/lib/maVatTu";
import { layT } from "@/lib/i18n/server";
import { Select } from "@/components/ui";

/**
 * Ô chọn "Chức danh quản lý" (?rank=) của báo cáo theo quý và thống kê xuất nhập tồn —
 * cùng danh sách, cùng cách gom theo bộ phận với ô lọc chức danh ở Danh mục vật tư.
 * Người đang xem có chức danh giữ hàng thì thêm lối tắt "Phần tôi phụ trách" (rank=toi).
 */
export default async function ChonChucDanh({ giaTri, chucDanhCuaToi }: { giaTri: string; chucDanhCuaToi: string | null }) {
  const { t, tenChucDanh, tenBoPhan } = await layT();
  return (
    <Select name="rank" defaultValue={giaTri}>
      <option value="">{t("tonQuy.chucDanhTatCa")}</option>
      {chucDanhCuaToi && CHUC_DANH[chucDanhCuaToi] ? <option value="toi">{t("tonQuy.chucDanhCuaToi", { ten: tenChucDanh(chucDanhCuaToi) })}</option> : null}
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
