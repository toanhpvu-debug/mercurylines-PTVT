import "server-only";
import { docSoLoc } from "@/lib/docSo";

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
  /** Đã phải cắt bớt nội dung (quá số dòng/cột cho phép) — báo để người dùng tách file. */
  truncated?: boolean;
  error?: string;
};

const MAX_ITEMS = 2000;

// Chặn kích thước phạm vi đọc từ "!ref".
//
// "!ref" là do FILE tự khai, không phải do nội dung thật: một file .xlsx hợp lệ
// vẫn có thể khai A1:XFD1048576 (16384 × 1048576 ô) trong khi chỉ có vài dòng
// chữ. Cứ tin con số đó mà duyệt thì sheet_to_json phải dựng hàng tỉ ô, ăn sạch
// bộ nhớ rồi Node bị hệ điều hành giết — mà đây là file người dùng tự tải lên
// nên bất kỳ ai cũng kích hoạt được, chỉ bằng một file dựng sẵn.
//
// Danh mục sơn của MỘT tàu thực tế chỉ vài trăm dòng và hơn chục cột, nên vài
// nghìn dòng / vài trăm cột đã dư sức chứa cả file làm ẩu (thừa dòng trống,
// thừa cột phụ). Vượt ngưỡng thì cắt phần thừa và bật cờ "truncated" để người
// dùng biết còn sót, thay vì âm thầm mất dữ liệu.
//
// Trên đường .xlsx thì lớp chặn thật sự là kẹp CỘT: XLSX.read bên dưới đã
// truyền sheetRows: 5000 nên "!ref" đọc về luôn có e.r ≤ 4999, kẹp dòng không
// bao giờ cắt được gì. Kẹp dòng là lớp dự phòng — cho khi ai đó gỡ sheetRows,
// hoặc cho đường đọc khác (.xls/BIFF) không đi qua tuỳ chọn ấy. Gỡ bất kỳ lớp
// nào trong ba lớp (sheetRows, kẹp dòng, kẹp cột) là mở lại lỗi cũ.
const MAX_SHEET_ROWS = 5000;
const MAX_SHEET_COLS = 200;

// Phạm vi khai to vô lý thì TỪ CHỐI hẳn sheet chứ không kẹp: đó là dấu hiệu
// file rác / file dựng sẵn để phá, không phải danh mục sơn cần cắt bớt. Kẹp
// không cứu được, vì kẹp xong vẫn phải trả giá dựng 5000 × 200 = 1.000.000 ô
// cho MỖI sheet — một file .xlsx 137 KB gồm 200 sheet rỗng ruột nhưng đều khai
// <dimension ref="A1:XFD5000"/> đo được 87 giây và trả về 0 dòng; đủ 10MB cho
// phép tải lên thì thành hàng giờ CPU. Ngưỡng đặt rộng hơn hẳn ngưỡng kẹp để
// file làm ẩu (thừa cột phụ, thừa dòng trống) vẫn được cắt bớt như cũ —
// lib/materialImport.ts chặn theo đúng cách này.
const REJECT_SHEET_ROWS = 20000;
const REJECT_SHEET_COLS = 400;

// Trần chung cho CẢ workbook, đếm số ô đã duyệt sau khi kẹp, cộng dồn qua mọi
// sheet. Cần trần này vì MAX_ITEMS không thể là hàng rào duy nhất: MAX_ITEMS
// đếm dòng ĐỌC ĐƯỢC, nên file dựng sẵn chỉ cần bỏ dòng tiêu đề ở mọi sheet là
// items đứng yên ở 0, vòng lặp sheet không bao giờ break, mà mỗi sheet vẫn tốn
// trọn chi phí sheet_to_json. Hàm này chạy đồng bộ ngay trong server action
// (không có worker) nên chi phí đó ghim thẳng event loop của Node — một người
// nhập sơn làm cả app đứng với mọi người còn lại.
//
// 5 triệu ô = 5 sheet đã kẹp hết cỡ, dư xa cho một danh mục sơn thật (vài
// sheet, mỗi sheet vài trăm dòng) mà đo được vẫn dưới một giây — tức chi phí
// tệ nhất của cả hàm giờ chặn theo trần này, không theo kích thước file nữa.
const MAX_WORKBOOK_CELLS = 5_000_000;

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

// Đọc số ô Excel — xem lib/docSo.ts để biết vì sao không đoán tại chỗ.
const toNumber = docSoLoc;

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
  let truncated = false;
  // Tổng số ô đã duyệt qua mọi sheet — xem chú thích ở MAX_WORKBOOK_CELLS.
  let scannedCells = 0;

  for (const sheetName of wb.SheetNames) {
    // Chạm trần MAX_ITEMS có thể báo thừa: nếu các sheet còn lại vốn không có
    // bảng danh mục thì thật ra chẳng sót dòng sơn nào. Chấp nhận khuyên thừa
    // "hãy tách file" còn hơn im lặng bỏ sót, vì muốn biết chắc thì phải đọc
    // hết các sheet đó ra — đắt hơn lợi ích. lib/materialImport.ts cũng vậy.
    if (items.length >= MAX_ITEMS) {
      truncated = true;
      break;
    }
    const sheet = wb.Sheets[sheetName];
    const ref = sheet?.["!ref"];
    if (!ref) {
      sheets.push({ name: sheetName, count: 0, skipped: true });
      continue;
    }
    let rows: unknown[][];
    // Cờ cắt bớt tính riêng cho từng sheet, chỉ dồn vào cờ chung SAU khi biết
    // sheet thật sự có bảng danh mục. Sheet "Hướng dẫn"/"Dashboard" bị bỏ qua
    // thì không mất dòng sơn nào; để nó kéo cờ của cả file lên chỉ khiến người
    // dùng đi tách file vô ích trên một lần nhập đã trọn vẹn.
    let sheetTruncated = false;
    try {
      const rng = XLSX.utils.decode_range(ref);
      // Kẹp phạm vi lại trước khi duyệt — xem chú thích ở MAX_SHEET_ROWS.
      const r0 = Math.max(0, rng.s.r);
      const c0 = Math.max(0, rng.s.c);
      const rEnd = Math.min(rng.e.r, r0 + MAX_SHEET_ROWS - 1);
      const cEnd = Math.min(rng.e.c, c0 + MAX_SHEET_COLS - 1);
      // "!ref" rác (không parse được thành số, hoặc ô cuối nằm trước ô đầu)
      // khiến decode_range trả về NaN/âm; đưa thẳng vào sheet_to_json thì được
      // vòng lặp vô tận hoặc mảng khổng lồ, nên coi như sheet không đọc được.
      if (
        !Number.isFinite(rEnd) ||
        !Number.isFinite(cEnd) ||
        rEnd < r0 ||
        cEnd < c0
      ) {
        sheets.push({ name: sheetName, count: 0, skipped: true });
        continue;
      }
      // Từ chối TRƯỚC khi gọi sheet_to_json — xem chú thích ở REJECT_SHEET_ROWS.
      // Kiểm trên phạm vi GỐC (chưa kẹp) vì chính con số khai vô lý mới là dấu
      // hiệu file rác.
      if (
        rng.e.r - r0 >= REJECT_SHEET_ROWS ||
        rng.e.c - c0 >= REJECT_SHEET_COLS
      ) {
        sheets.push({ name: sheetName, count: 0, skipped: true });
        continue;
      }
      // Hết ngân sách chung của cả file thì dừng luôn vòng lặp sheet, đừng đọc
      // thêm sheet nào nữa — xem chú thích ở MAX_WORKBOOK_CELLS.
      const cells = (rEnd - r0 + 1) * (cEnd - c0 + 1);
      if (scannedCells + cells > MAX_WORKBOOK_CELLS) {
        truncated = true;
        sheets.push({ name: sheetName, count: 0, skipped: true });
        break;
      }
      scannedCells += cells;
      if (rEnd < rng.e.r || cEnd < rng.e.c) sheetTruncated = true;
      // SheetJS đặt "!fullref" khi phạm vi FILE TỰ KHAI trong thẻ <dimension>
      // chạm sheetRows, rồi mới kẹp "!ref" xuống theo ô CÓ THẬT (xlsx.js,
      // parse_ws_xml ~14579). Vậy riêng việc "!fullref" khác "!ref" KHÔNG chứng
      // minh có dòng bị bỏ: file khai dimension phồng to hơn nội dung là
      // chuyện rất thường gặp — "used range ma" của Excel, hoặc bộ sinh .xlsx
      // của bên thứ ba khai sẵn cả trang. Một file khai A1:H60000 mà chỉ có 3
      // dòng vẫn đọc đủ 100%, báo cắt là báo oan và người dùng đi tách file vô
      // ích. Chỉ coi là bị cắt khi phạm vi CÒN LẠI chạm đúng trần dòng của
      // sheetRows, tức vẫn còn ô THẬT ở dòng 5000 trở đi.
      const fullRef: unknown = sheet["!fullref"];
      if (
        typeof fullRef === "string" &&
        fullRef !== ref &&
        rng.e.r + 1 >= MAX_SHEET_ROWS
      ) {
        sheetTruncated = true;
      }
      rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
        range: { s: { r: r0, c: c0 }, e: { r: rEnd, c: cEnd } },
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
    if (sheetTruncated) truncated = true;
    let count = 0;
    for (let r = head.rowIdx + 1; r < rows.length; r++) {
      if (items.length >= MAX_ITEMS) {
        truncated = true;
        break;
      }
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
      truncated,
      error:
        "Không tìm thấy bảng danh mục sơn trong file (cần dòng tiêu đề có cột Tên sơn cùng ít nhất một cột như Hãng / Loại / Đơn vị / Độ phủ).",
    };
  }
  return { items, skippedRows, sheets, truncated };
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
  // Chạm trần MAX_ITEMS là còn dòng chưa đọc — phải báo, nếu không người dùng
  // tưởng đã nhập hết cả bảng dán vào.
  let truncated = false;

  if (head) {
    for (let r = head.rowIdx + 1; r < rows.length; r++) {
      const paint = rowToPaint(rows[r] ?? [], head.col, null);
      if (!paint) {
        skippedRows++;
        continue;
      }
      items.push(paint);
      if (items.length >= MAX_ITEMS) {
        truncated = r < rows.length - 1;
        break;
      }
    }
  } else {
    // Không có tiêu đề: mỗi dòng là một loại sơn, ô đầu là tên.
    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r] ?? [];
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
      if (items.length >= MAX_ITEMS) {
        truncated = r < rows.length - 1;
        break;
      }
    }
  }

  if (!items.length) {
    return {
      items: [],
      skippedRows,
      error: "Không tách được dòng sơn nào từ nội dung đã dán.",
    };
  }
  return { items, skippedRows, truncated };
}
