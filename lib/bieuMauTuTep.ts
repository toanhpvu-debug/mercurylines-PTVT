/**
 * Đọc ĐẦU CHỨNG TỪ (letterhead) của công ty từ file Word / Excel gốc mà công
 * ty đang dùng: các dòng chữ ở header / đầu trang (tên công ty, địa chỉ trụ sở,
 * văn phòng đại diện, điện thoại, email, website) và LOGO (ảnh nhúng ở header /
 * đầu trang tính) — để chuẩn biểu mẫu trong app in ra giống file gốc.
 *
 *   .docx / .xlsx: chữ + logo.   .doc / .xls (định dạng cũ): chỉ chữ — lưu lại
 *   bằng Word / Excel thành .docx / .xlsx nếu cần logo.
 *
 * Phần nhận dạng trường (phanTichDauChungTu) thuần chuỗi, kiểm ở
 * scripts/kiem-tra-bieu-mau-tu-tep.ts.
 */
import JSZip from "jszip";

export type TruongBieuMau = {
  companyName: string;
  address: string;
  repAddress: string;
  tel: string;
  email: string;
  website: string;
};

export type KetQuaTrichBieuMau =
  | {
      ok: true;
      truong: TruongBieuMau;
      logo: { data: Buffer; mime: string; ten: string } | null;
      /** Các dòng chữ đọc được ở đầu chứng từ — hiện cho người dùng soát. */
      dongChu: string[];
      canhBao: string[];
    }
  | { ok: false; loi: string };

export const DUOI_TEP_BIEU_MAU = [".docx", ".doc", ".xlsx", ".xls"] as const;
export const TOI_DA_TEP_BIEU_MAU = 10 * 1024 * 1024;
const TOI_DA_LOGO = 2 * 1024 * 1024;

const MIME_ANH: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
};

const sach = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const coDauViet = (s: string) => /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/i.test(s);

// ─── Nhận dạng trường từ các dòng chữ (thuần) ────────────────────────────────

// Ranh giới từ theo Unicode: \b của JavaScript chỉ hiểu chữ ASCII, gặp "Điện
// thoại", "đường" là trượt.
const DAU = "(?<![\\p{L}\\p{N}])";
const CUOI = "(?![\\p{L}\\p{N}])";
const RE_CONG_TY = new RegExp(`${DAU}(company|co\\.?,?\\s*ltd|limited|joint\\s*stock|jsc|corporation|corp|inc|group|công\\s*ty|cty)${CUOI}`, "iu");
const RE_TRU_SO = /^(head\s*office|h\.?\s*o\.?|address|add|địa\s*chỉ|trụ\s*sở(\s*chính)?)\s*[:：.\-]/iu;
const RE_DAI_DIEN = /^(rep\.?\s*(add(ress)?|office)?|representative(\s*office)?|branch(\s*office)?|văn\s*phòng\s*đại\s*diện|vpđd|chi\s*nhánh)\s*[:：.\-]?/iu;
const RE_DIA_CHI_MO = new RegExp(`${DAU}(street|str|road|ward|district|city|province|quận|phường|huyện|đường|tp|thành phố|vietnam|việt nam)${CUOI}`, "iu");
const RE_EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const RE_WEB = /(?<![\w@.])(https?:\/\/[^\s,;·|]+|www\.[^\s,;·|]+)/i;
const RE_NHAN_DT = new RegExp(`${DAU}(tel|phone|telephone|điện\\s*thoại|đt|hotline|mobile)${CUOI}\\.?\\s*[:：]?\\s*`, "iu");
const RE_SO_DT = /\+?\(?\d[\d\s().\-/]{6,}\d/;

/**
 * Từ các dòng chữ ở đầu chứng từ → các trường của chuẩn biểu mẫu. Không đoán
 * được trường nào thì để trống (người dùng gõ / sửa trước khi lưu).
 */
export function phanTichDauChungTu(dongVao: string[]): TruongBieuMau {
  const dong = dongVao.map(sach).filter((d) => d.length >= 2);
  const tatCa = dong.join("\n");

  // Tên công ty: ưu tiên dòng IN HOA không dấu (tên tiếng Anh, như các chuẩn
  // đang dùng), sau đó tới bất kỳ dòng nào có "COMPANY / LTD / CÔNG TY".
  const ungVien = dong.filter((d) => RE_CONG_TY.test(d) && d.length <= 120 && !RE_TRU_SO.test(d) && !RE_EMAIL.test(d));
  const companyName =
    ungVien.find((d) => !coDauViet(d) && d === d.toUpperCase()) ?? ungVien.find((d) => !coDauViet(d)) ?? ungVien[0] ?? "";

  const repAddress = dong.find((d) => RE_DAI_DIEN.test(d) && RE_DIA_CHI_MO.test(d)) ?? dong.find((d) => RE_DAI_DIEN.test(d) && d.length > 15) ?? "";
  const address =
    dong.find((d) => RE_TRU_SO.test(d) && d !== repAddress) ??
    dong.find((d) => d !== repAddress && d !== companyName && RE_DIA_CHI_MO.test(d) && !RE_EMAIL.test(d) && !RE_NHAN_DT.test(d)) ??
    "";

  const email = tatCa.match(RE_EMAIL)?.[0] ?? "";
  const web = tatCa.match(RE_WEB)?.[0]?.replace(/[.)]+$/, "") ?? "";

  // Điện thoại: phần số ngay sau nhãn Tel / Phone / Điện thoại (bỏ phần Fax).
  let tel = "";
  for (const d of dong) {
    const m = RE_NHAN_DT.exec(d);
    if (!m) continue;
    const sau = d.slice(m.index + m[0].length).split(/\bfax\b|email|e-mail|website|web\b|·|\|/i)[0];
    const so = sau.match(RE_SO_DT)?.[0];
    if (so) {
      tel = sach(so);
      break;
    }
  }
  return { companyName, address, repAddress, tel, email, website: web };
}

// ─── Đọc file ────────────────────────────────────────────────────────────────

/** Các đoạn chữ của một phần XML Word (mỗi <w:p> một dòng; tab → khoảng trắng). */
function doanWord(xml: string): string[] {
  const giaiMa = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  return (xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [])
    .map((p) => {
      const coKhoang = p.replace(/<w:tab\/>|<w:br\/>/g, "<w:t> </w:t>");
      return sach(giaiMa([...coKhoang.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("")));
    })
    .filter(Boolean);
}

/** Ảnh đầu tiên (định dạng hiển thị được trên web) trong danh sách đích của tệp .rels. */
async function anhTuRels(zip: JSZip, relsPath: string, thuMucGoc: string): Promise<{ path: string } | null> {
  const rels = await zip.file(relsPath)?.async("string");
  if (!rels) return null;
  for (const m of rels.matchAll(/Target="([^"]+)"/g)) {
    const dich = m[1];
    if (!/\.(png|jpe?g|gif|bmp|webp)$/i.test(dich)) continue;
    const day = dich.startsWith("/") ? dich.slice(1) : new URL(dich, `file:///${thuMucGoc}/`).pathname.slice(1);
    if (zip.file(day)) return { path: day };
  }
  return null;
}

async function layAnh(zip: JSZip, p: string, canhBao: string[]) {
  const data = await zip.file(p)!.async("nodebuffer");
  if (data.length > TOI_DA_LOGO) {
    canhBao.push(`Ảnh logo trong file quá lớn (${Math.round(data.length / 1024)} KB > 2 MB) — không lấy.`);
    return null;
  }
  const duoi = p.split(".").pop()!.toLowerCase();
  return { data, mime: MIME_ANH[duoi] ?? "image/png", ten: p.split("/").pop()! };
}

async function docDocx(buffer: Buffer): Promise<KetQuaTrichBieuMau> {
  const zip = await JSZip.loadAsync(buffer);
  const doc = await zip.file("word/document.xml")?.async("string");
  if (!doc) return { ok: false, loi: "Không phải tệp Word .docx (thiếu word/document.xml)." };
  const canhBao: string[] = [];
  const header = Object.keys(zip.files)
    .filter((f) => /^word\/header\d*\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0));
  const dong: string[] = [];
  for (const h of header) dong.push(...doanWord(await zip.file(h)!.async("string")));
  // Đầu chứng từ cũng hay nằm ngay đầu thân văn bản (không dùng header).
  dong.push(...doanWord(doc).slice(0, 25));
  const dongDuyNhat = [...new Set(dong)];

  // Logo: ảnh trong header trước, không có thì ảnh đầu tiên của thân văn bản.
  let logo = null;
  for (const h of header) {
    const anh = await anhTuRels(zip, h.replace(/^word\//, "word/_rels/") + ".rels", "word");
    if (anh) {
      logo = await layAnh(zip, anh.path, canhBao);
      break;
    }
  }
  if (!logo) {
    const anh = await anhTuRels(zip, "word/_rels/document.xml.rels", "word");
    if (anh) logo = await layAnh(zip, anh.path, canhBao);
  }
  if (!logo && Object.keys(zip.files).some((f) => /^word\/media\/.+\.(emf|wmf)$/i.test(f))) {
    canhBao.push("Logo trong file ở dạng EMF/WMF — trình duyệt không hiển thị được. Mở file bằng Word, chèn lại logo dạng PNG rồi tải lên.");
  }
  return { ok: true, truong: phanTichDauChungTu(dongDuyNhat), logo, dongChu: dongDuyNhat.slice(0, 30), canhBao };
}

/** Chữ của header / footer trang tính Excel (bỏ mã định dạng &L &C &R &"font" &12...). */
function chuHeaderExcel(xml: string): string[] {
  const ra: string[] = [];
  for (const m of xml.matchAll(/<(oddHeader|firstHeader|evenHeader)>([^<]*)<\/\1>/g)) {
    const tho = m[2].replace(/&amp;/g, "&");
    for (const phan of tho.split(/&[LCR]/)) {
      const s = sach(phan.replace(/&"[^"]*"/g, "").replace(/&\d+/g, "").replace(/&[A-Z]/g, " "));
      if (s) ra.push(s);
    }
  }
  return ra;
}

async function docXlsx(buffer: Buffer): Promise<KetQuaTrichBieuMau> {
  const zip = await JSZip.loadAsync(buffer);
  if (!zip.file("xl/workbook.xml")) return { ok: false, loi: "Không phải tệp Excel .xlsx (thiếu xl/workbook.xml)." };
  const canhBao: string[] = [];
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer", sheetRows: 25 });
  const ten = wb.SheetNames[0];
  const rows = ten ? (XLSX.utils.sheet_to_json(wb.Sheets[ten], { header: 1, raw: false, blankrows: false }) as unknown[][]) : [];
  const dong: string[] = [];
  const sheet1 = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
  if (sheet1) dong.push(...chuHeaderExcel(sheet1));
  for (const r of rows.slice(0, 25)) {
    const o = (r ?? []).map((c) => sach(String(c ?? ""))).filter(Boolean);
    // Mỗi ô dài là một dòng riêng (đầu chứng từ hay gộp ô); ô ngắn nối lại.
    for (const c of o) if (c.length >= 2) dong.push(c);
  }
  const dongDuyNhat = [...new Set(dong)];
  // Logo: ảnh trong bản vẽ của trang tính đầu, không có thì ảnh đầu tiên trong xl/media.
  let logo = null;
  const ve = (await zip.file("xl/worksheets/_rels/sheet1.xml.rels")?.async("string"))?.match(/Target="([^"]*drawing\d+\.xml)"/)?.[1];
  if (ve) {
    const tenVe = ve.split("/").pop()!;
    const anh = await anhTuRels(zip, `xl/drawings/_rels/${tenVe}.rels`, "xl/drawings");
    if (anh) logo = await layAnh(zip, anh.path, canhBao);
  }
  if (!logo) {
    const anh = Object.keys(zip.files)
      .filter((f) => /^xl\/media\/.+\.(png|jpe?g|gif|bmp|webp)$/i.test(f))
      .sort()[0];
    if (anh) logo = await layAnh(zip, anh, canhBao);
  }
  return { ok: true, truong: phanTichDauChungTu(dongDuyNhat), logo, dongChu: dongDuyNhat.slice(0, 30), canhBao };
}

async function docDocCu(buffer: Buffer): Promise<KetQuaTrichBieuMau> {
  const { default: WordExtractor } = await import("word-extractor");
  const doc = await new WordExtractor().extract(buffer);
  const dong = [...doc.getHeaders({ includeFooters: false }).split(/\r?\n/), ...doc.getBody().split(/\r?\n/).slice(0, 30)]
    .flatMap((l) => l.split("\t"))
    .map(sach)
    .filter(Boolean);
  const dongDuyNhat = [...new Set(dong)];
  return {
    ok: true,
    truong: phanTichDauChungTu(dongDuyNhat),
    logo: null,
    dongChu: dongDuyNhat.slice(0, 30),
    canhBao: ["File Word đời cũ (.doc): chỉ đọc được chữ, không lấy được logo — lưu lại thành .docx trong Word rồi tải lên nếu cần logo."],
  };
}

async function docXlsCu(buffer: Buffer): Promise<KetQuaTrichBieuMau> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer", sheetRows: 25 });
  const ten = wb.SheetNames[0];
  const rows = ten ? (XLSX.utils.sheet_to_json(wb.Sheets[ten], { header: 1, raw: false, blankrows: false }) as unknown[][]) : [];
  const dong = [...new Set(rows.flatMap((r) => (r ?? []).map((c) => sach(String(c ?? "")))).filter((c) => c.length >= 2))];
  return {
    ok: true,
    truong: phanTichDauChungTu(dong),
    logo: null,
    dongChu: dong.slice(0, 30),
    canhBao: ["File Excel đời cũ (.xls): chỉ đọc được chữ, không lấy được logo — lưu lại thành .xlsx trong Excel rồi tải lên nếu cần logo."],
  };
}

/** Đọc đầu chứng từ từ file Word / Excel gốc. */
export async function trichBieuMauTuTep(buffer: Buffer, fileName: string): Promise<KetQuaTrichBieuMau> {
  const duoi = (fileName.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  try {
    if (duoi === ".docx") return await docDocx(buffer);
    if (duoi === ".xlsx") return await docXlsx(buffer);
    if (duoi === ".doc") return await docDocCu(buffer);
    if (duoi === ".xls") return await docXlsCu(buffer);
    return { ok: false, loi: "Chỉ nhận file Word (.docx, .doc) hoặc Excel (.xlsx, .xls)." };
  } catch (e) {
    return { ok: false, loi: `Không đọc được file: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) };
  }
}

export function mimeTepBieuMau(fileName: string): string {
  const duoi = (fileName.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  return (
    {
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc": "application/msword",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls": "application/vnd.ms-excel",
    }[duoi] ?? "application/octet-stream"
  );
}
