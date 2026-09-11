/**
 * IP thật của người gửi khi app đứng sau reverse proxy.
 *
 * Traefik (Dokploy) NỐI THÊM IP thật vào cuối `X-Forwarded-For` chứ không thay
 * thế chuỗi sẵn có, nên phần tử ĐẦU luôn là thứ khách tự viết vào header. Lấy
 * phần tử đầu là: trần chống dò mật khẩu theo IP (lib/chanDangNhap.ts) bị vô
 * hiệu chỉ bằng cách đổi header mỗi lần gửi, và cột IP trong nhật ký kiểm toán
 * ghi đúng cái IP kẻ thao tác tự khai. Cách đúng: đếm ngược từ cuối đủ số chặng
 * proxy tin cậy — ở đây một chặng.
 *
 * Thêm một tầng proxy/CDN trước Traefik thì phải tăng SO_PROXY_TIN_CAY; quên là
 * IP ghi ra thành IP của proxy (sai nhưng không nguy hiểm). Chạy thẳng không
 * qua proxy (máy văn phòng): header trống → rơi về x-real-ip → vẫn đúng.
 */
const SO_PROXY_TIN_CAY = 1;

export function ipThat(xForwardedFor: string | null, xRealIp: string | null): string | null {
  const ds = (xForwardedFor ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ds.length >= SO_PROXY_TIN_CAY) return ds[ds.length - SO_PROXY_TIN_CAY];
  return xRealIp ?? null;
}