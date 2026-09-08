/**
 * Khuôn của một KHÔNG GIAN TÊN trong từ điển: cùng một bộ khóa, hai bảng chữ.
 *
 * `tuDien(vi, en)` ép ở tầng kiểu: bảng tiếng Anh phải có ĐÚNG những khóa của
 * bảng tiếng Việt — thiếu hay thừa một khóa là tsc báo ngay tại file từ điển,
 * không đợi tới lúc người dùng bấm sang tiếng Anh mới thấy một ô trống.
 *
 * Quy ước viết từ điển (mỗi module một file, tên file = tên không gian):
 *   - Khóa: chữ thường camelCase tiếng Việt không dấu, ngắn, nói về NỘI DUNG
 *     ("chuaCoYeuCau"), không nói về vị trí ("dongThu3").
 *   - Tham số trong chuỗi: {ten} — cùng tên và cùng bộ tham số ở cả hai bảng.
 *   - Không nhét HTML/JSX vào chuỗi; cần in đậm một phần thì tách thành 2 khóa.
 *   - Nhãn dùng chung toàn app (vai trò, trạng thái, bộ phận, loại hàng) nằm ở
 *     `labels`; từ chung (Lưu, Hủy, Tìm...) ở `chung` — module KHÔNG định nghĩa
 *     lại những thứ đó.
 */
export type BangChu = Record<string, string>;

export type TuDienNamespace<V extends BangChu = BangChu> = {
  vi: V;
  en: Record<keyof V, string>;
};

export function tuDien<const V extends BangChu>(
  vi: V,
  en: Record<keyof V, string>
): TuDienNamespace<V> {
  return { vi, en };
}
