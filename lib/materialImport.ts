import "server-only";
import { docSo } from "@/lib/docSo";

import * as XLSX from "xlsx";

// Đọc file danh mục vật tư/phụ tùng theo form công ty:
// - Excel (MLS-11-06 Store & Spare Part Inventory): cột Description/IMPA/Unit/R.O.B/Group...
//   File kiểm kê thực tế tách nhiều sheet theo bộ phận nên ĐỌC TOÀN BỘ SHEET,
//   không chỉ sheet đầu (có file sheet đầu rỗng, dữ liệu nằm ở các sheet sau).
// - Word .doc/.docx (MLS-11-04 DM phụ tùng thiết yếu): bảng tab-separated, nhóm theo thiết bị.

export type ImportedItem = {
  name: string;
  impa: string | null;
  partNumber: string | null;
  uom: string;
  equipment: string | null;
  group: string | null;
  minStock: number;
  rob: number | null; // tồn trên tàu (R.O.B) nếu file có
  sheet: string | null; // sheet Excel chứa dòng này
  materialType: "STORE" | "SPARE" | null; // suy từ tên sheet; null = để người dùng quyết
};

// Tóm tắt từng sheet, để báo cho người dùng biết file được đọc ra sao.
export type SheetSummary = {
  name: string;
  count: number;
  materialType: "STORE" | "SPARE" | null;
  skipped: boolean; // true = sheet không có bảng danh mục (Dashboard, ghi chú...)
};

export type ImportParseResult = {
  items: ImportedItem[];
  skippedRows: number;
  sheets?: SheetSummary[];
  truncated?: boolean;
  error?: string;
};

const MAX_ITEMS = 3000;

// Tên sheet quyết định loại vật tư — form kiểm kê của công ty tách sẵn theo bộ phận:
// "Phụ tùng (Spare Parts)" · "Vật tư (Stores)" · "Vật tư Boong (Deck Stores)" ·
// "Vật tư Phục vụ (Catering)" · "Vật tư Bảo hộ (Safety)".
const SHEET_SPARE_RE = /phụ\s*tùng|phu\s*tung|spare/i;
const SHEET_STORE_RE =
  /vật\s*tư|vat\s*tu|store|boong|deck|phục\s*vụ|phuc\s*vu|catering|bảo\s*hộ|bao\s*ho|safety|provision/i;

// Kiểm tra SPARE trước: "Phụ tùng (Spare Parts)" chứa cả "phụ tùng" lẫn "parts".
function sheetMaterialType(name: string): "STORE" | "SPARE" | null {
  if (SHEET_SPARE_RE.test(name)) return "SPARE";
  if (SHEET_STORE_RE.test(name)) return "STORE";
  return null;
}

// Bộ phận kho tương ứng với một sheet, dùng cho chế độ ghi tồn "tự động theo sheet".
// Hậu tố khớp với mã kho sinh khi tạo tàu: <mã tàu>-ENG / -DECK / -STORE.
export type WarehouseKind = "ENG" | "DECK" | "STORE";

export function warehouseKindForSheet(sheetName: string | null): WarehouseKind {
  if (!sheetName) return "STORE";
  if (SHEET_SPARE_RE.test(sheetName)) return "ENG";
  if (/boong|deck/i.test(sheetName)) return "DECK";
  // Phục vụ (Catering), Bảo hộ (Safety), Vật tư (Stores) → kho vật tư tiêu hao.
  return "STORE";
}

const DESC_RE = /desc|mô tả|mo ta|tên vật tư|ten vat tu/i;
const IMPA_RE = /impa/i;
const PN_RE = /part\s*no|số phụ tùng|so phu tung|^pn$/i;
const UOM_RE = /^unit$|đơn vị|don vi|đvt|dvt|uom/i;
const GROUP_RE = /group|nhóm|nhom/i;
const MIN_RE = /min|tối thiểu|toi thieu/i;
// "R.O.B" / "Tồn trên tàu" / "Remain onboard" — tránh khớp "Last R.O.B".
const ROB_RE = /^r\.?\s*o\.?\s*b\.?$|tồn trên tàu|ton tren tau|remain|hiện có|hien co/i;

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

// Lọc mã định danh (IMPA/Part No): bỏ ký hiệu giữ chỗ như "-", "N/A", "TBA"
// để không gộp nhầm nhiều vật tư khác nhau vào một mã.
function cleanId(s: string): string | null {
  const t = s.trim();
  if (!t || !/[A-Za-z0-9]/.test(t)) return null;
  if (/^(n\/?a|tba|tbd|nil|none|x+|-+)$/i.test(t)) return null;
  return t;
}

/**
 * Giá trị trong cột "Mã IMPA" có đúng là mã IMPA không.
 *
 * IMPA là mã 6 chữ số, có thể viết liền (190115) hoặc ngăn bằng dấu chấm/gạch
 * (19.01.15), và trong file kiểm kê thật đôi khi bị cắt cụt (51.08...).
 * Nhưng file của công ty còn ghi cả MÃ NHÀ SẢN XUẤT vào cột này —
 * VLH-53.06.01, E11108, SY000814, 6310-2Z, hay số máy 10 chữ số 1016815253.
 * Những mã đó phải vào cột Part No., không phải IMPA.
 */
export function looksLikeImpa(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  // Có chữ cái → mã nhà sản xuất.
  if (/[A-Za-z]/.test(v)) return false;
  // Số trơn: IMPA dài đúng 6; dài hơn là số hiệu của hãng.
  if (/^\d+$/.test(v)) return v.length <= 6;
  // Còn lại là dạng có dấu ngăn (19.01.15, 51.08...) — coi là IMPA.
  return true;
}

// Đọc số ô Excel — xem lib/docSo.ts để biết vì sao không đoán tại chỗ.
const cellNumber = docSo;

// "2 set" / "8 pcs" / "1 pce" → { qty: 2, unit: "set" }
function parseQtyUnit(text: string): { qty: number | null; unit: string | null } {
  const m = text.trim().match(/^(\d+(?:[.,]\d+)?)\s*([A-Za-zÀ-ỹ]*)/);
  if (!m) return { qty: null, unit: null };
  const qty = cellNumber(m[1]);
  return {
    qty: Number.isFinite(qty) ? qty : null,
    unit: m[2] ? m[2].toUpperCase() : null,
  };
}

// Đọc MỌI sheet trong file. Sheet nào không có bảng danh mục (Dashboard, trang ghi chú)
// thì bỏ qua chứ không coi là lỗi — chỉ báo lỗi khi cả file không ra dòng nào.
export function parseMaterialExcel(buffer: Buffer): ImportParseResult {
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

  const items: ImportedItem[] = [];
  const sheets: SheetSummary[] = [];
  let skippedRows = 0;
  let truncated = false;

  for (const sheetName of wb.SheetNames) {
    if (items.length >= MAX_ITEMS) {
      truncated = true;
      break;
    }
    const type = sheetMaterialType(sheetName);
    const parsed = parseSheet(wb.Sheets[sheetName], sheetName, type, MAX_ITEMS - items.length);
    if (parsed === null) {
      sheets.push({ name: sheetName, count: 0, materialType: type, skipped: true });
      continue;
    }
    items.push(...parsed.items);
    skippedRows += parsed.skippedRows;
    if (parsed.truncated) truncated = true;
    sheets.push({
      name: sheetName,
      count: parsed.items.length,
      materialType: type,
      skipped: false,
    });
  }

  if (!items.length) {
    return {
      items: [],
      skippedRows,
      sheets,
      error:
        "Không tìm thấy bảng danh mục trong bất kỳ sheet nào của file (cần dòng tiêu đề có cột Mô tả/Description như form kiểm kê của công ty).",
    };
  }
  return { items, skippedRows, sheets, truncated };
}

// Đọc một sheet. Trả null nếu sheet không chứa bảng danh mục.
function parseSheet(
  sheet: XLSX.WorkSheet | undefined,
  sheetName: string,
  sheetType: "STORE" | "SPARE" | null,
  remaining: number
): { items: ImportedItem[]; skippedRows: number; truncated: boolean } | null {
  if (!sheet) return null;
  const refStr = sheet["!ref"];
  if (!refStr) return null;
  let rows: unknown[][];
  try {
    const rng = XLSX.utils.decode_range(refStr);
    if (rng.e.r - rng.s.r > 20000 || rng.e.c - rng.s.c > 400) return null;
    rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      range: rng,
    }) as unknown[][];
  } catch {
    return null;
  }

  // Dò dòng tiêu đề: có cột Mô tả + ít nhất một cột đặc trưng khác.
  let headerRowIdx = -1;
  const col = { desc: -1, impa: -1, pn: -1, uom: -1, group: -1, min: -1, rob: -1 };
  for (let r = 0; r < Math.min(rows.length, 80); r++) {
    const row = rows[r] ?? [];
    const found = { desc: -1, impa: -1, pn: -1, uom: -1, group: -1, min: -1, rob: -1 };
    for (let c = 0; c < row.length; c++) {
      const text = cellText(row[c]);
      if (!text) continue;
      if (found.desc === -1 && DESC_RE.test(text)) found.desc = c;
      if (found.impa === -1 && IMPA_RE.test(text)) found.impa = c;
      if (found.pn === -1 && PN_RE.test(text)) found.pn = c;
      if (found.uom === -1 && UOM_RE.test(text)) found.uom = c;
      if (found.group === -1 && GROUP_RE.test(text)) found.group = c;
      if (found.min === -1 && MIN_RE.test(text)) found.min = c;
      if (found.rob === -1 && ROB_RE.test(text)) found.rob = c;
    }
    const extras = [found.impa, found.pn, found.uom, found.group, found.min, found.rob].filter(
      (x) => x !== -1
    ).length;
    if (found.desc !== -1 && extras >= 1) {
      headerRowIdx = r;
      Object.assign(col, found);
      break;
    }
  }
  // Sheet không có bảng danh mục (Dashboard, trang ghi chú) — bỏ qua, không phải lỗi.
  if (headerRowIdx === -1) return null;

  const items: ImportedItem[] = [];
  let skippedRows = 0;
  let truncated = false;
  let currentEquipment: string | null = null;
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const rawName = cellText(row[col.desc]);
    if (!rawName) continue;
    // Dòng tiêu đề nhóm: cần CẢ tiền tố chữ cái ("A. ") lẫn từ khóa phụ tùng
    // (như parser Word) — tránh nuốt nhầm vật tư thật kiểu "V. Belt B-52".
    if (/^[A-ZĐ]\.\s/.test(rawName)) {
      if (/phụ tùng|spare/i.test(rawName)) {
        currentEquipment = rawName.replace(/^[A-ZĐ]\.\s*/, "").trim() || null;
      } else {
        // Dòng phân mục khác (VD "A. DECK STORE") — reset ngữ cảnh thiết bị.
        currentEquipment = null;
        skippedRows++;
      }
      continue;
    }
    // Bỏ số thứ tự đầu dòng "12. "
    const name = rawName.replace(/^\d+[.)]\s*/, "").trim();
    if (!name || /^stt|^s\.?\s*no/i.test(name)) {
      skippedRows++;
      continue;
    }
    const minCell = col.min >= 0 ? cellText(row[col.min]) : "";
    const minParsed = parseQtyUnit(minCell);
    // Ô R.O.B trống → null (KHÔNG phải 0 — tránh xóa nhầm tồn kho khi ghi tuyệt đối).
    const robText = col.rob >= 0 ? cellText(row[col.rob]) : "";
    const robRaw = robText ? cellNumber(row[col.rob]) : NaN;
    const uom =
      (col.uom >= 0 ? cellText(row[col.uom]) : "") || minParsed.unit || "PCS";
    const impaCell = col.impa >= 0 ? cleanId(cellText(row[col.impa])) : null;
    const pnCell = col.pn >= 0 ? cleanId(cellText(row[col.pn])) : null;
    const groupCell = col.group >= 0 ? cellText(row[col.group]) || null : null;
    const laPhuTung = currentEquipment !== null || sheetType === "SPARE";
    items.push({
      name,
      // Cột "Mã IMPA" trong file công ty lẫn cả mã nhà sản xuất — phân loại
      // lại chứ không đổ thẳng vào ô IMPA.
      impa: impaCell && looksLikeImpa(impaCell) ? impaCell : null,
      partNumber:
        pnCell ?? (impaCell && !looksLikeImpa(impaCell) ? impaCell : null),
      uom,
      // Sheet phụ tùng thường không có dòng tiêu đề "A. Phụ tùng máy chính"
      // mà ghi thẳng tên máy vào cột Nhóm. Bỏ qua nó thì hai chi tiết trùng tên
      // của hai máy khác nhau bị gộp làm một và tồn kho đè lên nhau.
      equipment: currentEquipment ?? (laPhuTung ? groupCell : null),
      group: groupCell,
      minStock: minParsed.qty ?? 0,
      rob: Number.isFinite(robRaw) && robRaw >= 0 ? robRaw : null,
      sheet: sheetName,
      // Dòng có nhóm thiết bị luôn là phụ tùng, dù sheet đặt tên gì.
      materialType: laPhuTung ? "SPARE" : sheetType,
    });
    if (items.length >= remaining) {
      truncated = true;
      break;
    }
  }
  if (!items.length) return null;
  return { items, skippedRows, truncated };
}

// Word .doc/.docx (MLS-11-04): bảng dạng text, ô tách bằng tab.
// Cột: Mô tả | Số phụ tùng | Tối thiểu | Ban đầu | Nhận trong tháng | Tổng tiêu thụ | Hiện có | Vị trí
export async function parseMaterialDoc(buffer: Buffer): Promise<ImportParseResult> {
  let body: string;
  try {
    const { default: WordExtractor } = await import("word-extractor");
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    body = doc.getBody();
  } catch {
    return {
      items: [],
      skippedRows: 0,
      error: "Không đọc được file Word (file hỏng hoặc sai định dạng).",
    };
  }
  const lines = body.split(/\r?\n/);
  const items: ImportedItem[] = [];
  let skippedRows = 0;
  let currentEquipment: string | null = null;
  for (const line of lines) {
    const cells = line.split("\t").map((c) => c.replace(/\s+/g, " ").trim());
    const first = cells[0] ?? "";
    if (!first) continue;
    // Nhóm thiết bị: "A. Phụ tùng cho Máy chính (Spare Parts for Main Engine)"
    if (/^[A-ZĐ]\.\s/.test(first) && /phụ tùng|spare/i.test(first)) {
      currentEquipment = first.replace(/^[A-ZĐ]\.\s*/, "").trim() || null;
      continue;
    }
    // Dòng phụ tùng: bắt đầu bằng số thứ tự "12. "
    if (!/^\d+[.)]\s/.test(first)) continue;
    const name = first.replace(/^\d+[.)]\s*/, "").replace(/[:：]\s*$/, "").trim();
    if (!name) {
      skippedRows++;
      continue;
    }
    const partNumber = cells[1] ? cleanId(cells[1]) : null;
    const minParsed = parseQtyUnit(cells[2] ?? "");
    const remain = cellNumber(cells[6] ?? "");
    items.push({
      name,
      impa: null,
      partNumber,
      uom: minParsed.unit || "PCS",
      equipment: currentEquipment,
      group: null,
      minStock: minParsed.qty ?? 0,
      rob: Number.isFinite(remain) && remain >= 0 && cells[6] ? remain : null,
      sheet: null,
      // MLS-11-04 là danh mục phụ tùng thiết yếu — toàn bộ là phụ tùng.
      materialType: "SPARE",
    });
    if (items.length >= MAX_ITEMS) break;
  }
  if (!items.length) {
    return {
      items: [],
      skippedRows,
      error:
        "Không tìm thấy dòng phụ tùng nào trong file Word (cần bảng như form MLS-11-04).",
    };
  }
  return { items, skippedRows };
}
