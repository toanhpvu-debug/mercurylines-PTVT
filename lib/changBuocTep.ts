import "server-only";

import JSZip from "jszip";
import { dauChangBuoc, dongTuChuPdfChangBuoc, dongTuLuoiChangBuoc, type DauChangBuoc, type DongChangBuocNhap } from "@/lib/changBuocNhap";

/*
 * Đọc file MLS-11-13 KHÔNG dùng AI: Word .docx (bảng trong tài liệu), Word .doc
 * (chữ tách theo tab), Excel (.xlsx / .xls), PDF có lớp chữ. Mọi nhánh quy về
 * các hàng ô rồi qua cùng bộ dò bảng (lib/changBuocNhap.ts). PDF scan (không có
 * lớp chữ) phải qua bộ đọc AI.
 */

export type KetQuaDocChangBuoc = { ok: true; dong: DongChangBuocNhap[]; dau: DauChangBuoc; ghiChu: string } | { ok: false; loi: string };

const sach = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const giaiMa = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
/** Chữ của một mảnh XML Word; tab giữ thành "\t" để tách cột "Ship's Name … Port … Date". */
const chuXml = (xml: string) =>
  giaiMa(
    [...xml.replace(/<w:tab\/>/g, "<w:t>\t</w:t>").replace(/<w:br\/>/g, "<w:t> </w:t>").matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
      .map((m) => m[1])
      .join("")
  );

/** Chọn bảng cho nhiều dòng nhất; không bảng nào đọc được thì trả lỗi của bảng sau cùng. */
function totNhat(ungVien: { rows: string[][]; nguon: string }[], chuDau: string): KetQuaDocChangBuoc {
  let tot: { dong: DongChangBuocNhap[]; boQua: number; nguon: string } | null = null;
  let loi = "Không tìm thấy bảng dụng cụ chằng buộc MLS-11-13 trong file.";
  for (const u of ungVien) {
    const kq = dongTuLuoiChangBuoc(u.rows);
    if ("loi" in kq) {
      loi = kq.loi;
      continue;
    }
    if (!tot || kq.dong.length > tot.dong.length) tot = { ...kq, nguon: u.nguon };
  }
  if (!tot) return { ok: false, loi };
  return {
    ok: true,
    dong: tot.dong,
    dau: dauChangBuoc(chuDau),
    ghiChu: `Đọc ${tot.dong.length} dụng cụ từ ${tot.nguon}${tot.boQua ? `, bỏ qua ${tot.boQua} dòng không có tên dụng cụ` : ""}.`,
  };
}

async function docDocx(buffer: Buffer): Promise<KetQuaDocChangBuoc> {
  const zip = await JSZip.loadAsync(buffer);
  const doc = await zip.file("word/document.xml")?.async("string");
  if (!doc) return { ok: false, loi: "Không phải tệp Word .docx." };
  const bang = doc.match(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g) ?? [];
  const ungVien = bang.map((b, i) => ({
    rows: (b.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []).map((tr) => (tr.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g) ?? []).map((tc) => sach(chuXml(tc)))),
    nguon: `bảng ${i + 1} của file Word`,
  }));
  // Dòng "Ship's Name / Port / Date": mọi đoạn văn (cả trong bảng phụ phía trên), mỗi đoạn một dòng.
  const doan = (doc.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).map(chuXml).filter((x) => x.trim());
  return totNhat(ungVien, doan.join("\n"));
}

async function docDocCu(buffer: Buffer): Promise<KetQuaDocChangBuoc> {
  const { default: WordExtractor } = await import("word-extractor");
  const doc = await new WordExtractor().extract(buffer);
  const than = doc.getBody();
  const rows = than.split(/\r?\n/).map((l) => l.split("\t").map(sach));
  return totNhat([{ rows, nguon: "file Word (.doc)" }], `${doc.getHeaders({ includeFooters: false })}\n${than}`);
}

async function docExcel(buffer: Buffer): Promise<KetQuaDocChangBuoc> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer", sheetRows: 600 });
  const ungVien = wb.SheetNames.map((ten) => ({
    rows: (XLSX.utils.sheet_to_json(wb.Sheets[ten], { header: 1, raw: false, blankrows: false, defval: "" }) as unknown[][]).map((r) =>
      r.map((c) => sach(String(c ?? "")))
    ),
    nguon: `sheet "${ten}"`,
  }));
  const chuDau = ungVien
    .flatMap((u) => u.rows.slice(0, 12))
    .map((r) => r.filter(Boolean).join("\t"))
    .join("\n");
  return totNhat(ungVien, chuDau);
}

async function docPdfChu(buffer: Buffer): Promise<KetQuaDocChangBuoc> {
  const { docChuTuPdf } = await import("@/lib/pdfChu");
  const lop = await docChuTuPdf(buffer, 40);
  if (!lop.ok) return { ok: false, loi: "PDF không có lớp chữ (bản scan) — cần bộ đọc AI để đọc." };
  const dongChu = lop.text.split(/\r?\n/).filter((l) => !/^--- trang \d+ ---$/.test(l.trim()));
  const rows = dongChu.map((l) => l.split(/\t|\s{2,}/).map(sach));
  const bang = totNhat([{ rows, nguon: "lớp chữ của PDF" }], lop.text);
  if (bang.ok) return bang;
  const dong = dongTuChuPdfChangBuoc(dongChu.join("\n"));
  if (!dong.length) return bang;
  return { ok: true, dong, dau: dauChangBuoc(lop.text), ghiChu: `Đọc ${dong.length} dụng cụ từ lớp chữ PDF (đoán cột theo thứ tự số — cần đối chiếu).` };
}

export async function docChangBuocKhongAi(buffer: Buffer, fileName: string): Promise<KetQuaDocChangBuoc> {
  const duoi = (fileName.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  try {
    if (duoi === ".docx") return await docDocx(buffer);
    if (duoi === ".doc") return await docDocCu(buffer);
    if (duoi === ".xlsx" || duoi === ".xls") return await docExcel(buffer);
    if (duoi === ".pdf") return await docPdfChu(buffer);
    return { ok: false, loi: "Chỉ nhận file Word, Excel hoặc PDF." };
  } catch (e) {
    return { ok: false, loi: `Không đọc được file: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) };
  }
}
