import "server-only";

import QRCode from "qrcode";

/**
 * Sinh ảnh QR dạng SVG ngay trên máy chủ, nhúng thẳng vào trang.
 *
 * SVG chứ không phải PNG: nét in ra sắc ở mọi cỡ nhãn (máy in nhãn 203 dpi hay
 * máy in văn phòng 600 dpi đều được), và không phải tạo tệp ảnh nào để phục vụ.
 * Sinh trên máy chủ chứ không phải trên trình duyệt: app chạy trên tàu không
 * có mạng, mọi thứ phải nằm trong bản cài — không gọi dịch vụ tạo QR bên ngoài.
 *
 * Mức sửa lỗi M (khôi phục được ~15% diện tích hỏng): nhãn dán trong buồng máy
 * bị dầu mỡ, trầy xước là chuyện thường; mức cao hơn làm mã dày ô, khó quét ở
 * cỡ nhãn nhỏ. Lề 1 ô: đủ cho máy quét nhận biên, không phí chỗ trên nhãn.
 *
 * Kết quả chỉ chứa <path> mô tả ô đen/trắng — nội dung mã KHÔNG bao giờ xuất
 * hiện dưới dạng chữ trong SVG, nên nhúng bằng dangerouslySetInnerHTML là an toàn
 * dù mã vật tư do người dùng đặt.
 */
export async function taoQrSvg(noiDung: string): Promise<string> {
  return QRCode.toString(noiDung, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
  });
}
