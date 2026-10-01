import "server-only";

import JSZip from "jszip";
import {
  dauYeuCau,
  dongTuChuPdfYeuCau,
  dongTuLuoiYeuCau,
  gopDauYeuCau,
  type DauYeuCauFile,
  type DongYeuCauFile,
} from "@/lib/yeuCauNhap";

/*
 * Đọc phiếu yêu cầu MLS-11-05A/B KHÔNG dùng AI: Word .docx (bảng trong tài liệu,
 * đầu phiếu có thể nằm ở bảng phụ, đoạn văn hay phần header trang), Word .doc
 * (chữ tách theo tab), Excel (.xlsx / .xls — chọn sheet cho nhiều dòng nhất),
 * PDF có lớp chữ. PDF scan (không có lớp chữ) phải qua bộ đọc AI.
 */

export type KetQuaDocYeuCau = { ok: true; dong: DongYeuCauFile[]; dau: DauYeuCauFile; ghiChu: string } | { ok: false; loi: string };

const sach = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const giaiMa = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
/** Chữ của một mảnh XML Word; tab giữ thành "\t" để tách "Vsl./Tàu: … Date/Ngày: …". */
const chuXml = (xml: string) =>
  giaiMa(
    [...xml.replace(/<w:tab\/>/g, "<w:t>\t</w:t>").replace(/<w:br\/>/g, "<w:t> </w:t>").matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
      .map((m) => m[1])
      .join("")
  );

/** Chọn bảng cho nhiều dòng nhất; đầu phiếu lấy từ bảng đó, ô còn trống bù bằng phần chữ còn lại của file. */
function totNhat(ungVien: { rows: string[][]; nguon: string }[], hangDau: string[][]): KetQuaDocYeuCau {
  let tot: { dong: DongYeuCauFile[]; dau: DauYeuCauFile; boQua: number; nguon: string } | null = null;
  let loi = "Không tìm thấy bảng yêu cầu vật tư / phụ tùng (MLS-11-05A/B) trong file.";
  for (const u of ungVien) {
    const kq = dongTuLuoiYeuCau(u.rows);
    if ("loi" in kq) {
      loi = kq.loi;
      continue;
    }
    if (!tot || kq.dong.length > tot.dong.length) tot = { ...kq, nguon: u.nguon };
  }
  if (!tot) return { ok: false, loi };
  const dau = gopDauYeuCau(tot.dau, dauYeuCau(hangDau));
  return {
    ok: true,
    dong: tot.dong,
    dau,
    ghiChu: `Đọc ${tot.dong.length} dòng từ ${tot.nguon}${tot.boQua ? `, bỏ qua ${tot.boQua} dòng không có mô tả` : ""}.`,
  };
}

async function docDocx(buffer: Buffer): Promise<KetQuaDocYeuCau> {
  const zip = await JSZip.loadAsync(buffer);
  const doc = await zip.file("word/document.xml")?.async("string");
  if (!doc) return { ok: false, loi: "Không phải tệp Word .docx." };
  const bang = doc.match(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g) ?? [];
  const hangBang = (b: string) => (b.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []).map((tr) => (tr.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g) ?? []).map((tc) => sach(chuXml(tc))));
  const ungVien = bang.map((b, i) => ({ rows: hangBang(b), nguon: `bảng ${i + 1} của file Word` }));
  // Đầu phiếu: header trang (khung tiêu đề biểu mẫu), các bảng phụ và đoạn văn — mỗi đoạn tách ô theo tab.
  const header = await Promise.all(
    Object.keys(zip.files)
      .filter((n) => /^word\/header\d*\.xml$/.test(n))
      .map((n) => zip.file(n)!.async("string"))
  );
  const doan = [...header, doc].flatMap((x) => (x.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).map(chuXml)).filter((x) => x.trim());
  const hangDau = [...doan.map((d) => d.split("\t").map(sach)), ...ungVien.flatMap((u) => u.rows.slice(0, 12))];
  return totNhat(ungVien, hangDau);
}

async function docDocCu(buffer: Buffer): Promise<KetQuaDocYeuCau> {
  const { default: WordExtractor } = await import("word-extractor");
  const doc = await new WordExtractor().extract(buffer);
  const than = doc.getBody();
  const rows = than.split(/\r?\n/).map((l) => l.split("\t").map(sach));
  const hangDau = `${doc.getHeaders({ includeFooters: false })}\n${than}`
    .split(/\r?\n/)
    .slice(0, 60)
    .map((l) => l.split("\t").map(sach));
  return totNhat([{ rows, nguon: "file Word (.doc)" }], hangDau);
}

async function docExcel(buffer: Buffer): Promise<KetQuaDocYeuCau> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer", sheetRows: 800 });
  const ungVien = wb.SheetNames.map((ten) => ({
    rows: (XLSX.utils.sheet_to_json(wb.Sheets[ten], { header: 1, raw: false, blankrows: false, defval: "" }) as unknown[][]).map((r) =>
      r.map((c) => sach(String(c ?? "")))
    ),
    nguon: `sheet "${ten}"`,
  }));
  return totNhat(ungVien, []);
}

async function docPdfChu(buffer: Buffer): Promise<KetQuaDocYeuCau> {
  const { docChuTuPdf } = await import("@/lib/pdfChu");
  const lop = await docChuTuPdf(buffer, 40);
  if (!lop.ok) return { ok: false, loi: "PDF không có lớp chữ (bản scan) — cần bộ đọc AI để đọc." };
  const { dau, dong } = dongTuChuPdfYeuCau(lop.text);
  if (!dong.length) return { ok: false, loi: "Không tìm thấy dòng hàng nào trong lớp chữ của PDF." };
  return { ok: true, dong, dau, ghiChu: `Đọc ${dong.length} dòng từ lớp chữ PDF (neo cột số từ phải sang — đối chiếu với bản gốc).` };
}

export async function docYeuCauKhongAi(buffer: Buffer, fileName: string): Promise<KetQuaDocYeuCau> {
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
