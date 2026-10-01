import "server-only";

import JSZip from "jszip";
import { dauTuHang, dongTuBang, type DauBaoGia, type DongBaoGia } from "@/lib/baoGia";

/*
 * Đọc file báo giá KHÔNG dùng AI: Excel (.xlsx / .xls), Word (.docx — các bảng
 * trong tài liệu; .doc — chữ tách theo tab), PDF có lớp chữ (cột tách bởi
 * nhiều khoảng trắng — kém chắc hơn, nên ưu tiên bộ đọc AI cho PDF).
 * Mọi nhánh quy về các hàng ô rồi qua cùng một bộ dò bảng (lib/baoGia.ts).
 */

export type KetQuaDocBaoGia = { ok: true; dong: DongBaoGia[]; dau: DauBaoGia; ghiChu: string } | { ok: false; loi: string };

const sach = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const giaiMa = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const chuXml = (xml: string) =>
  sach(giaiMa([...xml.replace(/<w:tab\/>|<w:br\/>/g, "<w:t> </w:t>").matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("")));

/** Chọn kết quả tốt nhất trong các bảng (nhiều dòng nhất). */
function totNhat(ungVien: { rows: string[][]; nguon: string }[], dauNgoai: string[][]): KetQuaDocBaoGia {
  let tot: { dong: DongBaoGia[]; boQua: number; dau: DauBaoGia; nguon: string } | null = null;
  let loi = "Không tìm thấy bảng báo giá trong file.";
  for (const u of ungVien) {
    const kq = dongTuBang(u.rows);
    if ("loi" in kq) {
      loi = kq.loi;
      continue;
    }
    if (!tot || kq.dong.length > tot.dong.length) tot = { ...kq, nguon: u.nguon };
  }
  if (!tot) return { ok: false, loi };
  // Đầu báo giá: chữ ngoài bảng (đoạn văn / ô phía trên) bổ sung chỗ bảng thiếu.
  const ngoai = dauTuHang(dauNgoai);
  const dau: DauBaoGia = {
    nhaCungCap: tot.dau.nhaCungCap ?? ngoai.nhaCungCap,
    soBaoGia: tot.dau.soBaoGia ?? ngoai.soBaoGia,
    ngayBaoGia: tot.dau.ngayBaoGia ?? ngoai.ngayBaoGia,
    tienTe: tot.dau.tienTe ?? ngoai.tienTe,
  };
  return {
    ok: true,
    dong: tot.dong,
    dau,
    ghiChu: `Đọc ${tot.dong.length} dòng hàng từ ${tot.nguon}${tot.boQua ? `, bỏ qua ${tot.boQua} dòng không phải dòng hàng (tiêu đề nhóm / ghi chú)` : ""}.`,
  };
}

async function docExcel(buffer: Buffer): Promise<KetQuaDocBaoGia> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer", sheetRows: 800 });
  const ungVien = wb.SheetNames.map((ten) => ({
    rows: (XLSX.utils.sheet_to_json(wb.Sheets[ten], { header: 1, raw: false, blankrows: false, defval: "" }) as unknown[][]).map((r) =>
      r.map((c) => sach(String(c ?? "")))
    ),
    nguon: `sheet "${ten}"`,
  }));
  return totNhat(ungVien, ungVien[0]?.rows.slice(0, 20) ?? []);
}

async function docDocx(buffer: Buffer): Promise<KetQuaDocBaoGia> {
  const zip = await JSZip.loadAsync(buffer);
  const doc = await zip.file("word/document.xml")?.async("string");
  if (!doc) return { ok: false, loi: "Không phải tệp Word .docx." };
  const bang = doc.match(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g) ?? [];
  const ungVien = bang.map((b, i) => ({
    rows: (b.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []).map((tr) => (tr.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g) ?? []).map(chuXml)),
    nguon: `bảng ${i + 1} của file Word`,
  }));
  // Đoạn văn ngoài bảng + header: số báo giá, ngày, loại tiền, tên nhà cung cấp.
  const ngoai = doc.replace(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g, "");
  const doan = (ngoai.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).map(chuXml).filter(Boolean);
  for (const h of Object.keys(zip.files).filter((f) => /^word\/header\d*\.xml$/.test(f))) {
    doan.unshift(...((await zip.file(h)!.async("string")).match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).map(chuXml).filter(Boolean));
  }
  return totNhat(ungVien, doan.slice(0, 60).map((d) => [d]));
}

async function docDocCu(buffer: Buffer): Promise<KetQuaDocBaoGia> {
  const { default: WordExtractor } = await import("word-extractor");
  const doc = await new WordExtractor().extract(buffer);
  const rows = doc
    .getBody()
    .split(/\r?\n/)
    .map((l) => l.split("\t").map(sach));
  return totNhat([{ rows, nguon: "file Word (.doc)" }], [...doc.getHeaders({ includeFooters: false }).split(/\r?\n/).map((l) => [sach(l)]), ...rows.slice(0, 30)]);
}

/** PDF có lớp chữ: tách cột theo cụm ≥ 2 khoảng trắng — dự phòng khi chưa có bộ đọc AI. */
async function docPdfChu(buffer: Buffer): Promise<KetQuaDocBaoGia> {
  const { docChuTuPdf } = await import("@/lib/pdfChu");
  const lop = await docChuTuPdf(buffer, 40);
  if (!lop.ok) return { ok: false, loi: "PDF không có lớp chữ (bản scan) — cần bộ đọc AI để đọc." };
  const rows = lop.text
    .split(/\r?\n/)
    .filter((l) => !/^--- trang \d+ ---$/.test(l.trim()))
    .map((l) => l.split(/\s{2,}|\t| \| /).map(sach));
  return totNhat([{ rows, nguon: "lớp chữ của PDF" }], rows.slice(0, 30));
}

export async function docBaoGiaKhongAi(buffer: Buffer, fileName: string): Promise<KetQuaDocBaoGia> {
  const duoi = (fileName.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  try {
    if (duoi === ".xlsx" || duoi === ".xls") return await docExcel(buffer);
    if (duoi === ".docx") return await docDocx(buffer);
    if (duoi === ".doc") return await docDocCu(buffer);
    if (duoi === ".pdf") return await docPdfChu(buffer);
    return { ok: false, loi: "Chỉ nhận báo giá Word, Excel hoặc PDF." };
  } catch (e) {
    return { ok: false, loi: `Không đọc được file: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) };
  }
}
