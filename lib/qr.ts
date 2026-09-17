/**
 * Mã QR gắn lên từng mặt hàng — phần THUẦN, không đụng server, để kiểm thử được
 * và dùng chung cho cả trang in nhãn (server) lẫn màn quét (client).
 *
 * Nội dung mã là một ĐỊA CHỈ WEB, không phải mã vật tư trần: `<gốc>/qr/<mã>`.
 * Lý do: ứng dụng camera có sẵn trên điện thoại (iPhone, Android) nhận ra địa
 * chỉ web và mở thẳng trình duyệt — người trên tàu không cần cài gì, quét là
 * vào đúng thẻ kho của mặt hàng đó (qua cửa đăng nhập nếu chưa đăng nhập). Mã
 * trần thì camera chỉ hiện một chuỗi chữ, không biết làm gì với nó.
 *
 * Phần <gốc> là địa chỉ của bản cài ĐANG IN nhãn: in ở văn phòng thì là địa chỉ
 * site trên mạng, in trên tàu (chạy nội bộ) thì là địa chỉ nội bộ của tàu.
 * Màn quét trong app không quan tâm phần gốc — chỉ bóc lấy <mã> rồi mở trang
 * tương ứng trên chính bản cài đang dùng, nên nhãn in ở đâu cũng quét được ở
 * bất kỳ bản cài nào.
 */

/** Đường dẫn trang mặt hàng theo mã, dùng trong app. */
export function duongDanQr(ma: string): string {
  return `/qr/${encodeURIComponent(ma)}`;
}

/** Nội dung ghi vào mã QR: địa chỉ tuyệt đối của bản cài đang in. */
export function noiDungQr(goc: string, ma: string): string {
  return `${goc.replace(/\/+$/, "")}${duongDanQr(ma)}`;
}

/**
 * Mã vật tư hợp lệ: chữ, số, gạch ngang, gạch dưới, chấm — tối đa 64 ký tự.
 * Đúng bằng những gì bộ tạo mã (E-SPR-0001, C-IMPA-0014) và ô nhập tay sinh ra;
 * chặt hơn để một mã QR lạ không biến thành đường dẫn kỳ quặc.
 */
const MAU_MA = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/**
 * Bóc mã vật tư từ nội dung vừa quét (hoặc vừa gõ tay).
 *
 * Nhận được:
 *   - địa chỉ đầy đủ  https://site/qr/E-SPR-0001      → "E-SPR-0001"
 *   - đường dẫn        /qr/E-SPR-0001                  → "E-SPR-0001"
 *   - mã trần          E-SPR-0001  (nhãn in kiểu khác, hoặc gõ tay)
 *   - có kèm ?/#       .../qr/E-SPR-0001?x=1#y         → vẫn "E-SPR-0001"
 *   - mã đã mã hóa URL .../qr/E%2DSPR%2D0001           → giải mã rồi kiểm
 * Trả về null khi không rút ra được một mã hợp lệ — người gọi báo "mã không
 * đọc được" chứ không mở một trang nào cả.
 */
export function docMaTuQr(noiDung: string): string | null {
  const t = (noiDung ?? "").trim();
  if (!t) return null;
  const khop = t.match(/\/qr\/([^/?#\s]+)/);
  let ma = khop ? khop[1] : t;
  try {
    ma = decodeURIComponent(ma);
  } catch {
    return null;
  }
  ma = ma.trim();
  return MAU_MA.test(ma) ? ma : null;
}
