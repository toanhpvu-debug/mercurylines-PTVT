import { chucDanhBaoTrum } from "@/lib/chucDanhChiuTrachNhiem";

/**
 * Chỗ của mặt hàng SAU khi sửa — server action trả về để trang Danh mục đi theo nó: nhóm bộ phận
 * (khóa DEPARTMENTS: DECK · ENGINE · …) và người giữ (mã chức danh). `ids[0]` là dòng để cuộn tới.
 */
export type ViTriSauSua = { ids: number[]; nhom: string; chucDanh: string | null };

/**
 * Đường dẫn để THẤY mặt hàng vừa sửa ở đúng chỗ mới — đổi người giữ là mặt hàng sang bộ phận khác,
 * có khi nằm ở trang 3 của mục đó, hoặc bị chính bộ lọc đang chọn giấu đi:
 *   - giữ tàu / loại / từ khóa đang xem;
 *   - đang lọc MỘT bộ phận mà hàng đã sang bộ phận khác → lọc bộ phận mới;
 *   - đang lọc một chức danh mà người giữ mới không thuộc phần người đó → lọc người giữ mới
 *     ("toi" = chức danh của người xem, chỉ máy chủ biết — để trang báo nếu hàng ra ngoài phần đó);
 *   - `den` = các mặt hàng vừa sửa: trang mở đúng trang chứa chúng và tô sáng;
 *   - `#vat-tu-<id>`: cuộn tới dòng.
 */
export function duongDanSauSua(hienTai: string, vt: ViTriSauSua): string {
  const p = new URLSearchParams(hienTai);
  const bp = p.get("bp");
  if (bp && bp !== vt.nhom) p.set("bp", vt.nhom);
  const rank = p.get("rank");
  if (rank && rank !== "toi" && vt.chucDanh && !chucDanhBaoTrum(rank, vt.chucDanh)) p.set("rank", vt.chucDanh);
  p.set("den", vt.ids.join("-"));
  return `/materials?${p.toString()}#vat-tu-${vt.ids[0]}`;
}

/** Đọc `?den=12-34` → danh sách id theo thứ tự (id đầu là dòng để cuộn tới); bỏ giá trị lạ, tối đa 500. */
export function docDen(raw: unknown): number[] {
  return [
    ...new Set(
      String(raw ?? "")
        .split("-")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ].slice(0, 500);
}
