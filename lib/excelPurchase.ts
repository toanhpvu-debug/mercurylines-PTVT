import "server-only";
import { docSo } from "@/lib/docSo";

import * as XLSX from "xlsx";

// Đọc file Excel mua vật tư theo form công ty (PURCHASING ORDER / INQUIRY FOR QUOTE
// hoặc bảng phẳng bất kỳ). Tự dò dòng tiêu đề bảng rồi map cột theo tên.

export type ParsedPurchaseLine = {
  description: string;
  partNo: string | null;
  uom: string;
  quantity: number;
  unitPrice: number;
};

export type ParsePurchaseResult = {
  lines: ParsedPurchaseLine[];
  // Số dòng có mô tả nhưng số lượng thiếu/không đọc được — bị bỏ qua, cần cảnh báo.
  skippedRows: number;
  error?: string;
};

const DESC_RE = /desc|mô tả|mo ta|tên vật tư|ten vat tu|item name/i;
const QTY_RE = /q\s*'?\s*ty|quantity|số lượng|so luong|^sl$/i;
const PN_RE = /^pn$|part\s*no|impa|mã|ma vt/i;
const UOM_RE = /^unit$|uom|đvt|dvt|đơn vị|don vi/i;
const PRICE_RE = /u\.?\s*price|unit\s*price|đơn giá|don gia/i;
// Dòng chân bảng/tổng kết — không tính là dòng vật tư bị bỏ sót.
const FOOTER_RE = /total|amount|cộng|tổng|discount|fee|ghi chú|note|supply port|agent|delivery|handling/i;

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

// Đọc số ô Excel — xem lib/docSo.ts để biết vì sao không đoán tại chỗ.
const cellNumber = docSo;

export function parsePurchaseExcel(buffer: Buffer): ParsePurchaseResult {
  let rows: unknown[][];
  try {
    // sheetRows chặn file khai vùng dữ liệu khổng lồ (chống treo/OOM server).
    const wb = XLSX.read(buffer, { type: "buffer", sheetRows: 500 });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return { lines: [], skippedRows: 0, error: "File Excel không có sheet nào." };
    }
    const sheet = wb.Sheets[sheetName];
    const refStr = sheet["!ref"];
    if (!refStr) {
      return { lines: [], skippedRows: 0, error: "File Excel trống." };
    }
    const rng = XLSX.utils.decode_range(refStr);
    // Form công ty dùng tới cột II (~243) — chặn trên mức đó để chống vùng dị dạng.
    if (rng.e.r - rng.s.r > 5000 || rng.e.c - rng.s.c > 400) {
      return {
        lines: [],
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
      lines: [],
      skippedRows: 0,
      error: "Không đọc được file Excel (file hỏng hoặc sai định dạng).",
    };
  }

  // Dò dòng tiêu đề bảng: phải có cột Description và cột Q'ty.
  let headerRowIdx = -1;
  let col = { desc: -1, qty: -1, pn: -1, uom: -1, price: -1 };
  for (let r = 0; r < Math.min(rows.length, 80); r++) {
    const row = rows[r] ?? [];
    let descIdx = -1;
    let qtyIdx = -1;
    for (let c = 0; c < row.length; c++) {
      const text = cellText(row[c]);
      if (!text) continue;
      if (descIdx === -1 && DESC_RE.test(text)) descIdx = c;
      if (qtyIdx === -1 && QTY_RE.test(text)) qtyIdx = c;
    }
    if (descIdx !== -1 && qtyIdx !== -1) {
      headerRowIdx = r;
      col = { desc: descIdx, qty: qtyIdx, pn: -1, uom: -1, price: -1 };
      for (let c = 0; c < row.length; c++) {
        const text = cellText(row[c]);
        if (!text || c === descIdx || c === qtyIdx) continue;
        if (col.pn === -1 && PN_RE.test(text)) col.pn = c;
        if (col.uom === -1 && UOM_RE.test(text)) col.uom = c;
        if (col.price === -1 && PRICE_RE.test(text)) col.price = c;
      }
      break;
    }
  }
  if (headerRowIdx === -1) {
    return {
      lines: [],
      skippedRows: 0,
      error:
        "Không tìm thấy bảng vật tư trong file (cần dòng tiêu đề có cột Description và Q'ty như form công ty).",
    };
  }

  const lines: ParsedPurchaseLine[] = [];
  let skippedRows = 0;
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const description = cellText(row[col.desc]);
    const qty = cellNumber(row[col.qty]);
    if (!description || !Number.isFinite(qty) || qty <= 0) {
      // Dòng có mô tả thật nhưng số lượng thiếu/hỏng → đếm để cảnh báo người dùng.
      if (description && !FOOTER_RE.test(description)) skippedRows++;
      continue;
    }
    const priceRaw = col.price >= 0 ? cellNumber(row[col.price]) : 0;
    lines.push({
      description,
      partNo: col.pn >= 0 ? cellText(row[col.pn]) || null : null,
      uom: (col.uom >= 0 ? cellText(row[col.uom]) : "") || "PCS",
      quantity: qty,
      unitPrice: Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw : 0,
    });
    if (lines.length >= 200) break; // chặn file bất thường
  }
  if (!lines.length) {
    return {
      lines: [],
      skippedRows,
      error: "Không có dòng vật tư hợp lệ nào trong file (cần Mô tả + Số lượng > 0).",
    };
  }
  return { lines, skippedRows };
}
