/**
 * Chế độ sáng / tối của giao diện — phần THUẦN, dùng được cả hai phía.
 *
 * Lưu bằng cookie `theme` (cùng cách với cookie `lang` của ngôn ngữ) chứ không
 * chỉ localStorage như bản Vite của app Quản lý thuyền viên: ở đây trang được
 * dựng trên server, nên server phải biết chế độ ngay từ đầu để gắn class `dark`
 * vào <html> trước khi trình duyệt vẽ — nếu không, mỗi lần mở trang sẽ lóe nền
 * sáng rồi mới chuyển sang tối.
 *
 * Mặc định TỐI: nền navy đậm là màu chủ đạo của nhận diện Mercury Lines (khớp
 * app Quản lý thuyền viên). Người dùng đổi sang sáng thì lựa chọn được nhớ 1 năm.
 */
export const CHU_DE = ["dark", "light"] as const;
export type ChuDe = (typeof CHU_DE)[number];

export const CHU_DE_MAC_DINH: ChuDe = "dark";

export const COOKIE_CHU_DE = "theme";

export function docChuDe(raw: string | null | undefined): ChuDe {
  return raw === "light" ? "light" : CHU_DE_MAC_DINH;
}
