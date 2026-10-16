import "server-only";

/**
 * Đọc chữ tệp Word .doc / .docx (word-extractor) — dùng chung cho mọi chỗ nhập tệp Word.
 *
 * Sửa một lỗi của thư viện: nó đổi ký tự 0x80–0x9F theo bảng CP1252 của riêng nó, mà bảng
 * thiếu 0x80, 0x81, 0x8D, 0x8F, 0x90, 0x9D → ký tự đó thành CHUỖI "undefined" chèn giữa từ
 * ("Máy trưundefinedởng", "kín nundefinedước" — tệp gõ bằng bộ gõ tiếng Việt cũ hay lọt
 * các ký tự điều khiển vô hình này). Word không hiện chúng nên bỏ hẳn là đúng chữ người gõ.
 */
export const sachChuWord = (s: string) => s.replace(/undefined/g, "");

export async function moTepWord(buffer: Buffer): Promise<{ than: () => string; dau: (kemChanTrang: boolean) => string }> {
  const { default: WordExtractor } = await import("word-extractor");
  const doc = await new WordExtractor().extract(buffer);
  return {
    than: () => sachChuWord(doc.getBody()),
    dau: (kemChanTrang) => sachChuWord(doc.getHeaders({ includeFooters: kemChanTrang })),
  };
}
