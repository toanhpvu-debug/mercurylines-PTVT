import "server-only";

import * as XLSX from "xlsx";

// Đọc file danh mục vật tư/phụ tùng theo form công ty:
// - Excel (MLS-11-06 Store & Spare Part Inventory): cột Description/IMPA/Unit/R.O.B/Group...
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
};

export type ImportParseResult = {
  items: ImportedItem[];
  skippedRows: number;
  error?: string;
};

const MAX_ITEMS = 500;

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

function cellNumber(v: unknown): number {
  if (typeof v === "string") {
    let s = v.trim();
    if (s.includes(",")) s = s.replace(/\./g, "").replace(/,/g, ".");
    return Number(s);
  }
  return Number(v);
}

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

export function parseMaterialExcel(buffer: Buffer): ImportParseResult {
  let rows: unknown[][];
  try {
    const wb = XLSX.read(buffer, { type: "buffer", sheetRows: 1000 });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return { items: [], skippedRows: 0, error: "File Excel không có sheet nào." };
    }
    const sheet = wb.Sheets[sheetName];
    const refStr = sheet["!ref"];
    if (!refStr) {
      return { items: [], skippedRows: 0, error: "File Excel trống." };
    }
    const rng = XLSX.utils.decode_range(refStr);
    if (rng.e.r - rng.s.r > 5000 || rng.e.c - rng.s.c > 400) {
      return {
        items: [],
        skippedRows: 0,
        error: "File Excel có vùng dữ liệu bất thường (quá lớn).",
      };
    }
    rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      range: rng,
    }) as unknown[][];
  } catch {
    return {
      items: [],
      skippedRows: 0,
      error: "Không đọc được file Excel (file hỏng hoặc sai định dạng).",
    };
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
  if (headerRowIdx === -1) {
    return {
      items: [],
      skippedRows: 0,
      error:
        "Không tìm thấy bảng danh mục trong file (cần dòng tiêu đề có cột Mô tả/Description như form MLS-11-06).",
    };
  }

  const items: ImportedItem[] = [];
  let skippedRows = 0;
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
    items.push({
      name,
      impa: col.impa >= 0 ? cleanId(cellText(row[col.impa])) : null,
      partNumber: col.pn >= 0 ? cleanId(cellText(row[col.pn])) : null,
      uom,
      equipment: currentEquipment,
      group: col.group >= 0 ? cellText(row[col.group]) || null : null,
      minStock: minParsed.qty ?? 0,
      rob: Number.isFinite(robRaw) && robRaw >= 0 ? robRaw : null,
    });
    if (items.length >= MAX_ITEMS) break;
  }
  if (!items.length) {
    return {
      items: [],
      skippedRows,
      error: "Không có dòng vật tư hợp lệ nào trong file.",
    };
  }
  return { items, skippedRows };
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
