/**
 * Mã của các tệp biểu mẫu Excel gốc lưu trong database (model BieuMauTep).
 *
 * Để riêng một chỗ vì chuỗi này xuất hiện ở ba nơi không nhìn thấy nhau: route
 * xuất kiểm kê đọc nó, server action tải lên ghi nó, trang quản trị hiển thị
 * theo nó. Gõ tay ở cả ba chỗ thì một lần gõ lệch là tải lên một đằng đọc một
 * nẻo, mà không có gì báo lỗi — chỉ là nút xuất vẫn kêu thiếu biểu mẫu.
 */
export const MA_BIEU_MAU_KIEM_KE = "MLS-11-06";

/** Phần mở rộng và kiểu MIME chấp nhận cho tệp biểu mẫu. */
export const DUOI_BIEU_MAU = ".xlsx";
export const MIME_BIEU_MAU =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Trần kích thước tệp biểu mẫu: biểu mẫu là form trống, vài chục KB là cùng. */
export const MAX_BIEU_MAU_BYTES = 5 * 1024 * 1024;