import "server-only";

import * as XLSX from "xlsx";

import { PAINT_TYPE_VALUES } from "@/lib/paintTypes";

// Đọc danh mục sơn từ hai nguồn:
//  - Excel (.xls/.xlsx): dò cột theo tiêu đề, đọc mọi sheet.
//  - Text dán tay: dùng cho PDF — trình đọc PDF lo phần trích xuất (Ctrl+A,
//    Ctrl+C), ở đây chỉ tách cột. Máy này không có thư viện đọc PDF và cũng
//    không cài thêm được, mà tự viết bộ đọc PDF thì kết quả hên xui — với dữ
//    liệu thật thì đoán sai còn tệ hơn không đọc.

export type ImportedPaint = {
  name: string;
  maker: string | null;
  paintType: string | null;
  colorCode: string | null;
  colorName: string | null;
  uom: string | null;
  packSize: number | null;
  coverage: number | null;
  dftPerCoat: number | null;
  thinner: string | null;
  /** Tồn trên tàu nếu file có cột số lượng. */
  quantity: number | null;
  sheet: string | null;
};

export type PaintParseResult = {
  items: ImportedPaint[];
  skippedRows: number;
  sheets?: { name: string; count: number; skipped: boolean }[];
  error?: string;
};

const MAX_ITEMS = 2000;

// ─── Dò cột theo tiêu đề ─────────────────────────────────────────────────────
const COL = {
  name: /tên sơn|ten son|^sơn$|^son$|product|paint|description|mô tả|mo ta|tên hàng|ten hang/i,
  maker: /hãng|hang sx|maker|manufacturer|brand|nhà sản xuất|nha san xuat|supplier/i,
  type: /loại|loai|type|hệ sơn|he son/i,
  colorCode: /mã màu|ma mau|color code|colour code|ral|mã màu sơn/i,
  colorName: /tên màu|ten mau|^màu$|^mau$|colou?r(?! code)/i,
  uom: /đơn vị|don vi|^đvt$|^dvt$|unit|uom/i,
  packSize: /dung tích|dung tich|pack|thùng|thung|lon|can size|volume/i,
  coverage: /độ phủ|do phu|coverage|spreading|m2\/l|m²\/l/i,
  dft: /dft|chiều dày|chieu day|micron|µm|um\b/i,
  thinner: /dung môi|dung moi|thinner|pha loãng|pha loang/i,
  qty: /tồn|ton|số lượng|so luong|q'?ty|quantity|r\.?o\.?b|còn lại|con lai/i,
} as const;

type ColIndex = Partial<Record<keyof typeof COL, number>>;

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function toNumber(s: string): number | null {
  if (!s) return null;
  // "7,5" (dấu phẩy thập phân) và "1.234,5" đều gặp trong file Việt Nam.
  let t = s.replace(/[^\d.,-]/g, "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Suy loại sơn từ chữ mô tả; không rõ thì trả null để người dùng tự chọn. */
export function guessPaintType(text: string): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/anti[- ]?foul|chống hà|chong ha|\baf\b/.test(t)) return "ANTI_FOULING";
  if (/anti[- ]?corros|chống ăn mòn|chong an mon|chống rỉ|chong ri|\bac\b/.test(t))
    return "ANTI_CORROSIVE";
  if (/primer|sơn lót|son lot|lót/.test(t)) return "PRIMER";
  if (/topcoat|top coat|sơn phủ|son phu|finish/.test(t)) return "TOPCOAT";
  if (/deck|boong/.test(t)) return "DECK";
  if (/tank|két|ket\b/.test(t)) return "TANK";
  // Giá trị đã chuẩn ghi thẳng trong file thì nhận luôn.
  const upper = text.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (PAINT_TYPE_VALUES.includes(upper)) return upper;
  return null;
}

function findHeader(rows: unknown[][]): { rowIdx: number; col: ColIndex } | null {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const row = rows[r] ?? [];
    const col: ColIndex = {};
    for (let c = 0; c < row.length; c++) {
      const text = cellText(row[c]);
      if (!text) continue;
      for (const key of Object.keys(COL) as (keyof typeof COL)[]) {
        if (col[key] === undefined && COL[key].test(text)) col[key] = c;
      }
    }
    // Cần ít nhất cột tên + một cột đặc trưng khác, tránh nhận nhầm dòng tiêu đề chung.
    const extras = (Object.keys(col) as (keyof typeof COL)[]).filter(
      (k) => k !== "name"
    ).length;
    if (col.name !== undefined && extras >= 1) return { rowIdx: r, col };
  }
  return null;
}

function rowToPaint(
  row: unknown[],
  col: ColIndex,
  sheet: string | null
): ImportedPaint | null {
  const at = (k: keyof typeof COL) =>
    col[k] !== undefined ? cellText(row[col[k] as number]) : "";
  const name = at("name").replace(/^\d+[.)]\s*/, "").trim();
  if (!name || /^(stt|no\.?|s\.? ?no)$/i.test(name)) return null;
  const typeText = at("type");
  return {
    name,
    maker: at("maker") || null,
    paintType: guessPaintType(typeText || name),
    colorCode: at("colorCode") || null,
    colorName: at("colorName") || null,
    uom: at("uom") || null,
    packSize: toNumber(at("packSize")),
    coverage: toNumber(at("coverage")),
    dftPerCoat: toNumber(at("dft")),
    thinner: at("thinner") || null,
    quantity: toNumber(at("qty")),
    sheet,
  };
}

/** Đọc danh mục sơn từ file Excel — duyệt mọi sheet, bỏ qua sheet không có bảng. */
export function parsePaintExcel(buffer: Buffer): PaintParseResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer", sheetRows: 5000 });
  } catch {
    return {
      items: [],
      skippedRows: 0,
      error: "Không đọc được file Excel (file hỏng hoặc sai định dạng).",
    };
  }
  if (!wb.SheetNames.length) {
    return { items: [], skippedRows: 0, error: "File Excel không có sheet nào." };
  }

  const items: ImportedPaint[] = [];
  const sheets: { name: string; count: number; skipped: boolean }[] = [];
  let skippedRows = 0;

  for (const sheetName of wb.SheetNames) {
    if (items.length >= MAX_ITEMS) break;
    const sheet = wb.Sheets[sheetName];
    const ref = sheet?.["!ref"];
    if (!ref) {
      sheets.push({ name: sheetName, count: 0, skipped: true });
      continue;
    }
    let rows: unknown[][];
    try {
      rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
        range: XLSX.utils.decode_range(ref),
      }) as unknown[][];
    } catch {
      sheets.push({ name: sheetName, count: 0, skipped: true });
      continue;
    }
    const head = findHeader(rows);
    if (!head) {
      sheets.push({ name: sheetName, count: 0, skipped: true });
      continue;
    }
    let count = 0;
    for (let r = head.rowIdx + 1; r < rows.length; r++) {
      if (items.length >= MAX_ITEMS) break;
      const paint = rowToPaint(rows[r] ?? [], head.col, sheetName);
      if (!paint) {
        skippedRows++;
        continue;
      }
      items.push(paint);
      count++;
    }
    sheets.push({ name: sheetName, count, skipped: false });
  }

  if (!items.length) {
    return {
      items: [],
      skippedRows,
      sheets,
      error:
        "Không tìm thấy bảng danh mục sơn trong file (cần dòng tiêu đề có cột Tên sơn cùng ít nhất một cột như Hãng / Loại / Đơn vị / Độ phủ).",
    };
  }
  return { items, skippedRows, sheets };
}

/**
 * Đọc danh mục sơn từ text dán tay (thường copy từ PDF).
 * Cột tách bằng Tab, dấu | hoặc từ 2 khoảng trắng trở lên — đây là những gì
 * nhận được khi copy một bảng từ trình đọc PDF.
 * Không có dòng tiêu đề thì coi mỗi dòng là một tên sơn.
 */
export function parsePaintText(input: string): PaintParseResult {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (!lines.length) {
    return { items: [], skippedRows: 0, error: "Chưa dán nội dung nào." };
  }
  const split = (l: string) =>
    l.split(/\t|\s*\|\s*|\s{2,}/).map((c) => c.trim());
  const rows: unknown[][] = lines.map(split);

  const head = findHeader(rows);
  const items: ImportedPaint[] = [];
  let skippedRows = 0;

  if (head) {
    for (let r = head.rowIdx + 1; r < rows.length; r++) {
      const paint = rowToPaint(rows[r] ?? [], head.col, null);
      if (!paint) {
        skippedRows++;
        continue;
      }
      items.push(paint);
      if (items.length >= MAX_ITEMS) break;
    }
  } else {
    // Không có tiêu đề: mỗi dòng là một loại sơn, ô đầu là tên.
    for (const cells of rows) {
      const name = String(cells[0] ?? "").replace(/^\d+[.)]\s*/, "").trim();
      if (!name) {
        skippedRows++;
        continue;
      }
      items.push({
        name,
        maker: (cells[1] as string) || null,
        paintType: guessPaintType(name),
        colorCode: null,
        colorName: null,
        uom: null,
        packSize: null,
        coverage: null,
        dftPerCoat: null,
        thinner: null,
        quantity: null,
        sheet: null,
      });
      if (items.length >= MAX_ITEMS) break;
    }
  }

  if (!items.length) {
    return {
      items: [],
      skippedRows,
      error: "Không tách được dòng sơn nào từ nội dung đã dán.",
    };
  }
  return { items, skippedRows };
}
