/**
 * Ngôn ngữ giao diện — phần THUẦN, dùng được cả phía server lẫn trình duyệt.
 *
 * Cách chọn ngôn ngữ: một cookie `lang` (vi | en), KHÔNG đổi đường dẫn
 * (/en/... ). Mọi trang sau đăng nhập đều là trang động (đọc phiên đăng nhập)
 * nên đọc thêm một cookie không tốn gì; còn đổi đường dẫn thì phải sửa toàn bộ
 * liên kết, chuyển hướng và bộ chặn cửa (proxy.ts) — cho cùng một kết quả.
 *
 * Mặc định tiếng Việt: đội tàu là người Việt, tiếng Anh dành cho thuyền viên
 * nước ngoài và đăng kiểm / khách hàng xem chung.
 */
export const NGON_NGU = ["vi", "en"] as const;
export type NgonNgu = (typeof NGON_NGU)[number];

export const NGON_NGU_MAC_DINH: NgonNgu = "vi";

/** Tên cookie giữ lựa chọn — sống 1 năm, đặt ở /api/ngon-ngu. */
export const COOKIE_NGON_NGU = "lang";

export const TEN_NGON_NGU: Record<NgonNgu, string> = {
  vi: "Tiếng Việt",
  en: "English",
};

/** Mã locale cho Intl (định dạng ngày, số). */
export const MA_LOCALE: Record<NgonNgu, string> = {
  vi: "vi-VN",
  en: "en-GB",
};

export function laNgonNgu(x: unknown): x is NgonNgu {
  return typeof x === "string" && (NGON_NGU as readonly string[]).includes(x);
}

/** Đọc giá trị cookie / tham số; sai hay trống thì về mặc định. */
export function docNgonNgu(raw: string | null | undefined): NgonNgu {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return laNgonNgu(s) ? s : NGON_NGU_MAC_DINH;
}
