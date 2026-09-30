/**
 * Điền báo cáo dụng cụ chằng buộc container vào TỆP WORD MẪU MLS-11-13 của
 * công ty, giữ nguyên mọi thứ khác (header có logo, footer, đường kẻ, cỡ chữ).
 *
 * Tệp .docx là gói zip chứa XML; toàn bộ nội dung trang nằm ở word/document.xml.
 * Mẫu gốc (chuyển từ .doc bằng Word) có: một đoạn "Ship's Name (Tên tàu): . . .
 * Port (Cảng): . . . Date (Ngày): . . / . . / . . ." với dấu chấm chờ điền; một
 * bảng 10 cột gồm các hàng tiêu đề rồi 10 hàng số liệu đánh số 1..10; hai dòng
 * chữ ký. Tệp từ tàu hay khác đôi chút (Word tự đánh số cột Stt, có bảng phụ phía
 * trên, dấu nháy ’) — tachBang dò theo cấu trúc chứ không đòi ô Stt là chữ số
 * gõ tay. Cách điền:
 *   - Dòng Ship's Name: dựng lại đoạn với đúng định dạng chữ của mẫu (rPr của
 *     run thường và run nghiêng), thay dấu chấm bằng giá trị, giữ hai dấu tab.
 *   - Bảng: lấy hàng số liệu đầu làm khuôn, sinh đúng số hàng cần (ít nhất bằng
 *     số hàng mẫu để tờ giấy không ngắn đi), mỗi ô giữ tcPr / pPr / rPr của mẫu,
 *     chỉ thay chữ.
 * Phần thuần chuỗi (dienDocumentXml) kiểm ở scripts/kiem-tra-bieu-mau-chang-buoc.ts.
 */
import JSZip from "jszip";

export type DongChangBuoc = {
  stt: number;
  ten: string;
  kyHieu: string;
  toiThieu: number;
  chuan: number;
  conDung: number;
  hong: number;
  tong: number;
  thieu: number;
  yeuCau: number;
};

export type DuLieuChangBuoc = {
  tenTau: string;
  cang: string;
  /** dd/mm/yyyy */
  ngay: string;
  dong: DongChangBuoc[];
};

// Thẻ mở có thể mang thuộc tính (tệp lưu từ trình soạn khác Word); \b giữ cho
// <w:tblPr>, <w:tcPr>, <w:trPr> không bị bắt nhầm.
const RE_TBL_G = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g;
const RE_TR = /<w:tr\b[\s\S]*?<\/w:tr>/g;
const RE_TC = /<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g;
const RE_P = /<w:p\b[\s\S]*?<\/w:p>/g;
/** Chữ nhận ra dòng "Ship's Name (Tên tàu)…" — cả dấu nháy thẳng lẫn ’. */
const RE_DONG_TAU = /Ship\s*['’`]?\s*s\s*Name|Tên tàu/i;
/** Chữ của hàng tiêu đề cột trong bảng (khi hàng tiêu đề không gộp dọc ô Stt). */
const RE_CHU_TIEU_DE = /quantity|out-?fitting|trang bị|dụng được|bị hỏng|toàn bộ|yêu cầu|minimum|standard|tối thiểu|stock|order/i;

const oCua = (tr: string) => tr.match(RE_TC) ?? [];
/** Ô nối tiếp một ô gộp dọc (không phải ô bắt đầu gộp). */
const laTiepGop = (tc: string) => /<w:vMerge(?:\s*\/>|\s+w:val="continue"\s*\/>)/.test(tc);
const oDauLaSo = (tr: string) => /^\s*\d+\s*[.)]?\s*$/.test(chuCua(oCua(tr)[0] ?? ""));
/** Ô Stt đánh số TỰ ĐỘNG (danh sách của Word): ô không có chữ nhưng có w:numPr. */
const oDauTuDanhSo = (tr: string) => /<w:numPr>/.test(oCua(tr)[0] ?? "");

/**
 * Tìm bảng số liệu và tách hàng: tiêu đề / số liệu (10 ô) / phần sau.
 * Không đòi ô Stt là chữ số gõ tay — mẫu từ tàu hay để Word tự đánh số, hoặc là
 * một báo cáo đã điền; hàng tiêu đề nhận theo ô gộp dọc của cột Stt hoặc theo chữ.
 */
function tachBang(xml: string): { tbl: string; hangTieuDe: string[]; hangSoLieuMau: string[]; hangSau: string[] } {
  const bangs = xml.match(RE_TBL_G) ?? [];
  const co10O = (b: string) => (b.match(RE_TR) ?? []).some((tr) => oCua(tr).length === 10);
  const tbl =
    bangs.find((b) => co10O(b) && /stt|no\.|minimum|fitting|chằng|lashing/i.test(chuCua(b))) ?? bangs.find(co10O) ?? bangs[0];
  if (!tbl) throw new Error("Mẫu không có bảng.");
  const rows = tbl.match(RE_TR) ?? [];
  const laHangTieuDe = (tr: string, i: number) =>
    i === 0 || laTiepGop(oCua(tr)[0] ?? "") || (!oDauLaSo(tr) && !oDauTuDanhSo(tr) && RE_CHU_TIEU_DE.test(chuCua(tr)));
  let dau = 0;
  while (dau < rows.length && laHangTieuDe(rows[dau], dau)) dau++;
  const hangSoLieuMau = rows.slice(dau).filter((tr) => oCua(tr).length === 10);
  if (!hangSoLieuMau.length) {
    throw new Error(
      `Không tìm thấy hàng số liệu 10 ô dưới phần tiêu đề của bảng (bảng có ${rows.length} hàng, số ô từng hàng: ${rows
        .map((r) => oCua(r).length)
        .join(",")}).`
    );
  }
  return { tbl, hangTieuDe: rows.slice(0, dau), hangSoLieuMau, hangSau: rows.slice(dau).filter((tr) => oCua(tr).length !== 10) };
}

export function xmlEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Chữ nhìn thấy của một mảnh XML (nối mọi <w:t>). */
export function chuCua(xml: string): string {
  return [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
}

function pPrCua(p: string): string {
  return p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
}

function rPrDauTien(p: string): string {
  const run = p.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/)?.[0] ?? "";
  return run.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
}

/** Thay toàn bộ chữ trong ô bằng một đoạn duy nhất, giữ tcPr / pPr / rPr của mẫu. */
export function datChuO(tc: string, text: string): string {
  const tcPr = tc.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/)?.[0] ?? "";
  const pDau = tc.match(RE_P)?.[0] ?? "<w:p></w:p>";
  // Bỏ đánh số tự động của đoạn: ô đã được ghi chữ số rõ ràng, giữ w:numPr thì
  // Word hiện thêm số của danh sách ("1." + "1").
  const pPr = pPrCua(pDau).replace(/<w:numPr>[\s\S]*?<\/w:numPr>/, "");
  // Ô trống của mẫu không có run nào — lấy định dạng chữ của dấu đoạn (rPr
  // trong pPr) để chữ điền vào đúng phông / cỡ như cột đó trên mẫu.
  const rPr = rPrDauTien(pDau) || (pPr.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "");
  const noiDung = text === "" ? " " : text;
  return `<w:tc>${tcPr}<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${xmlEsc(noiDung)}</w:t></w:r></w:p></w:tc>`;
}

const soChu = (n: number) => (Number.isFinite(n) ? String(Number.isInteger(n) ? n : Math.round(n * 100) / 100) : "");

/** Phần thuần: điền dữ liệu vào chuỗi document.xml. Ném lỗi nếu mẫu không đúng dạng. */
export function dienDocumentXml(xml: string, du: DuLieuChangBuoc): string {
  // 1) Bảng.
  const { tbl, hangTieuDe, hangSoLieuMau, hangSau } = tachBang(xml);
  // Hai khuôn: hàng số liệu ĐẦU cho các hàng giữa, hàng số liệu CUỐI cho hàng
  // cuối — trong mẫu chỉ hàng cuối có kẻ đáy (các hàng giữa để "nil" cho bảng
  // liền nét), cắt mọi hàng từ một khuôn là bảng mất đường kẻ đáy.
  const khuon = hangSoLieuMau[0];
  const khuonCuoi = hangSoLieuMau[hangSoLieuMau.length - 1];
  const oKhuon = khuon.match(RE_TC) ?? [];
  const oKhuonCuoi = khuonCuoi.match(RE_TC) ?? [];
  if (oKhuon.length !== 10 || oKhuonCuoi.length !== 10) throw new Error(`Hàng số liệu của mẫu có ${oKhuon.length} ô, cần 10.`);
  const trPrCua = (tr: string) => tr.match(/<w:trPr>[\s\S]*?<\/w:trPr>/)?.[0] ?? "";
  const soHang = Math.max(du.dong.length, hangSoLieuMau.length);
  const hangMoi: string[] = [];
  for (let i = 0; i < soHang; i++) {
    const d = du.dong[i];
    const gia = d
      ? [String(d.stt), d.ten, d.kyHieu, soChu(d.toiThieu), soChu(d.chuan), soChu(d.conDung), soChu(d.hong), soChu(d.tong), soChu(d.thieu), soChu(d.yeuCau)]
      : [String(i + 1), "", "", "", "", "", "", "", "", ""];
    const cuoi = i === soHang - 1;
    const oDung = cuoi ? oKhuonCuoi : oKhuon;
    hangMoi.push(`<w:tr>${trPrCua(cuoi ? khuonCuoi : khuon)}${oDung.map((tc, j) => datChuO(tc, gia[j])).join("")}</w:tr>`);
  }
  // Hàng sau số liệu (nếu mẫu có) giữ nguyên.
  const tblPr = tbl.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? "";
  const tblGrid = tbl.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? "";
  const tblMoi = `<w:tbl>${tblPr}${tblGrid}${hangTieuDe.join("")}${hangMoi.join("")}${hangSau.join("")}</w:tbl>`;
  let ra = xml.replace(tbl, () => tblMoi);

  // 2) Dòng Ship's Name / Port / Date — đoạn ngoài bảng số liệu (có thể nằm trong
  // một bảng khác phía trên) có chữ "Ship's Name" / "Tên tàu".
  const ngoaiBangSoLieu = ra.replace(tblMoi, "");
  const pShip = (ngoaiBangSoLieu.match(RE_P) ?? []).find((p) => RE_DONG_TAU.test(chuCua(p)));
  if (pShip) {
    const pPr = pPrCua(pShip);
    const runs = pShip.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g) ?? [];
    const rPrThuong = runs[0]?.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
    const rNghieng = runs.find((r) => /Tên tàu/.test(chuCua(r)));
    const rPrNghieng = rNghieng?.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? rPrThuong;
    const T = (s: string) => `<w:t xml:space="preserve">${xmlEsc(s)}</w:t>`;
    const R = (rPr: string, ...phan: string[]) => `<w:r>${rPr}${phan.join("")}</w:r>`;
    const pMoi =
      `<w:p>${pPr}` +
      R(rPrThuong, T("Ship's Name (")) +
      R(rPrNghieng, T("Tên tàu")) +
      R(rPrThuong, T(`): ${du.tenTau} `), "<w:tab/>", T("Port (")) +
      R(rPrNghieng, T("Cảng")) +
      R(rPrThuong, T(`): ${du.cang} `), "<w:tab/>", T("Date (")) +
      R(rPrNghieng, T("Ngày")) +
      R(rPrThuong, T(`): ${du.ngay}`)) +
      `</w:p>`;
    ra = ra.replace(pShip, () => pMoi);
  }
  return ra;
}

/** Điền vào tệp .docx mẫu, trả về tệp mới. */
export async function dienBieuMauChangBuoc(template: Buffer, du: DuLieuChangBuoc): Promise<Buffer> {
  const zip = await JSZip.loadAsync(template);
  const tep = zip.file("word/document.xml");
  if (!tep) throw new Error("Tệp không phải .docx (thiếu word/document.xml).");
  const xml = await tep.async("string");
  zip.file("word/document.xml", dienDocumentXml(xml, du));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** Kiểm tệp tải lên có đúng là mẫu MLS-11-13 dùng được không (chạy lúc quản trị tải lên). */
export async function kiemTraBieuMauChangBuoc(buffer: Buffer): Promise<{ ok: true } | { ok: false; loi: string }> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const tep = zip.file("word/document.xml");
    if (!tep) return { ok: false, loi: "Không phải tệp Word .docx (thiếu word/document.xml)." };
    const xml = await tep.async("string");
    // Điền thử với dữ liệu giả — mọi lỗi cấu trúc nổ ở đây, trước mặt người tải.
    dienDocumentXml(xml, { tenTau: "THU", cang: "THU", ngay: "01/01/2026", dong: [] });
    if (!RE_DONG_TAU.test(chuCua(xml))) return { ok: false, loi: "Mẫu không có dòng \"Ship's Name (Tên tàu)\"." };
    return { ok: true };
  } catch (e) {
    return { ok: false, loi: e instanceof Error ? e.message : String(e) };
  }
}
