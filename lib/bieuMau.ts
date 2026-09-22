/**
 * Mã của các tệp biểu mẫu gốc lưu trong database (model BieuMauTep).
 *
 * Để riêng một chỗ vì chuỗi này xuất hiện ở ba nơi không nhìn thấy nhau: route
 * xuất đọc nó, server action tải lên ghi nó, trang quản trị hiển thị theo nó.
 * Gõ tay ở cả ba chỗ thì một lần gõ lệch là tải lên một đằng đọc một nẻo, mà
 * không có gì báo lỗi — chỉ là nút xuất vẫn kêu thiếu biểu mẫu.
 */
export const MA_BIEU_MAU_KIEM_KE = "MLS-11-06";
export const MA_BIEU_MAU_CHANG_BUOC = "MLS-11-13";

/** Phần mở rộng và kiểu MIME chấp nhận cho tệp biểu mẫu Excel (MLS-11-06). */
export const DUOI_BIEU_MAU = ".xlsx";
export const MIME_BIEU_MAU =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/** ... và cho tệp biểu mẫu Word (MLS-11-13). */
export const DUOI_BIEU_MAU_WORD = ".docx";
export const MIME_BIEU_MAU_WORD =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type LoaiBieuMauTep = "excel" | "word";

/**
 * Mỗi biểu mẫu tệp: đuôi, MIME, loại và tên tệp trên đĩa (templates/, gitignore
 * — tài liệu nội bộ, không đi theo mã nguồn). Thêm biểu mẫu mới = thêm một dòng.
 */
export const BIEU_MAU_TEP: Record<string, { duoi: string; mime: string; loai: LoaiBieuMauTep; tep: string }> = {
  [MA_BIEU_MAU_KIEM_KE]: { duoi: DUOI_BIEU_MAU, mime: MIME_BIEU_MAU, loai: "excel", tep: "MLS-11-06.xlsx" },
  [MA_BIEU_MAU_CHANG_BUOC]: { duoi: DUOI_BIEU_MAU_WORD, mime: MIME_BIEU_MAU_WORD, loai: "word", tep: "MLS-11-13.docx" },
};

/** Trần kích thước tệp biểu mẫu: biểu mẫu là form trống, vài chục KB là cùng. */
export const MAX_BIEU_MAU_BYTES = 5 * 1024 * 1024;
