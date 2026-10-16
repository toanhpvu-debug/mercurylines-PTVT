import "server-only";

import { moTepWord } from "@/lib/docWord";
import { docBangThietYeu, ghepHangWord, type KetQuaDocMLS1104 } from "@/lib/thietYeu";

/** Đuôi tệp danh mục phụ tùng thiết yếu nhận được: Word của tàu hoặc bảng Excel. */
export const DUOI_TEP_THIET_YEU = [".doc", ".docx", ".xlsx", ".xls"] as const;

/**
 * Đọc tệp danh mục phụ tùng thiết yếu (MLS-11-04) tàu gửi — Word .doc / .docx (bảng trong
 * tệp, chữ đã sửa lỗi "undefined" của word-extractor) hoặc Excel .xlsx / .xls (sheet đọc
 * ra nhiều mục nhất). Không đụng database; đọc bảng ở lib/thietYeu.ts docBangThietYeu.
 */
export async function docTepThietYeu(
  duoi: string,
  buffer: Buffer
): Promise<{ ok: true; kq: KetQuaDocMLS1104 } | { ok: false; loi: "duoi" | "doc" }> {
  try {
    if (duoi === ".doc" || duoi === ".docx") {
      const doc = await moTepWord(buffer);
      return { ok: true, kq: docBangThietYeu(ghepHangWord(doc.than())) };
    }
    if (duoi === ".xlsx" || duoi === ".xls") {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "buffer", sheetRows: 1500 });
      let tot: KetQuaDocMLS1104 | null = null;
      for (const ten of wb.SheetNames) {
        const hang = (XLSX.utils.sheet_to_json(wb.Sheets[ten], { header: 1, raw: false, defval: "" }) as unknown[][]).map((r) =>
          r.map((c) => String(c ?? "").replace(/\s*\r?\n\s*/g, " "))
        );
        const kq = docBangThietYeu(hang);
        if (!tot || kq.muc.length > tot.muc.length) tot = kq;
      }
      return { ok: true, kq: tot ?? docBangThietYeu([]) };
    }
  } catch {
    return { ok: false, loi: "doc" };
  }
  return { ok: false, loi: "duoi" };
}
