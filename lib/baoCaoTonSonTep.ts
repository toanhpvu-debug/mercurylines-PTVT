import "server-only";

import JSZip from "jszip";
import { docChuPdfBaoCaoTon, docLuoiBaoCaoTon, dongNhanTuBaoCao, laBaoCaoTon, luoiTuChuWord, type DauBaoCaoTon, type DongBaoCaoTonTho } from "@/lib/baoCaoTonSon";
import type { DongNhanSon } from "@/lib/phieuSon";

/*
 * Đọc BÁO CÁO LƯỢNG SƠN TỒN MLS-11-14 tải lên KHÔNG dùng AI: Word .docx (bảng trong
 * tài liệu, tiêu đề biểu mẫu nằm ở header trang), Word .doc (chữ tách theo tab của
 * word-extractor), Excel (.xlsx / .xls — chọn sheet đọc ra nhiều dòng nhất), lớp
 * chữ PDF (tờ in của app / Word xuất PDF; bản scan có OCR Windows thì thử thêm).
 * Bản scan không đọc được thì cần bộ đọc AI (chế độ "baoCaoTon").
 *
 * Cùng chỗ đọc này cho ra toàn bộ CHỮ của tệp để nhận diện: báo cáo tồn MLS-11-14
 * (laBaoCaoTon) và phiếu yêu cầu MLS-11-05 (laPhieuYeuCau — không dùng nhập tồn sơn).
 */

export type TepDaDoc = { luoi: string[][]; hangDau: string[][]; chu: string; laPdf: boolean; coChu: boolean };

const sach = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const giaiMa = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
/** Chữ một đoạn XML Word (tab giữ thành "\t"). */
const chuDoan = (xml: string) =>
  giaiMa(
    [...xml.replace(/<w:tab\/>/g, "<w:t>\t</w:t>").replace(/<w:br\/>/g, "<w:t> </w:t>").matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
      .map((m) => m[1])
      .join("")
  );
/** Chữ một ô bảng: các đoạn nối bằng dấu cách ("Tồn đầu kỳ" + "In stock" → "Tồn đầu kỳ In stock"). */
const chuO = (tc: string) => sach((tc.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).map(chuDoan).join(" "));

async function docDocx(buffer: Buffer): Promise<TepDaDoc> {
  const zip = await JSZip.loadAsync(buffer);
  const doc = await zip.file("word/document.xml")?.async("string");
  if (!doc) throw new Error("Không phải tệp Word .docx.");
  const luoi: string[][] = [];
  for (const bang of doc.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/g) ?? []) {
    for (const tr of bang.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []) {
      const hang: string[] = [];
      for (const tc of tr.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) ?? []) {
        hang.push(chuO(tc));
        // Ô gộp ngang chiếm nhiều cột lưới: chèn ô trống cho thẳng cột với hàng tiêu đề.
        const span = Number(/<w:gridSpan w:val="(\d+)"/.exec(tc)?.[1] ?? 1);
        for (let k = 1; k < span && k < 20; k++) hang.push("");
      }
      luoi.push(hang);
    }
  }
  const phan = await Promise.all(
    Object.keys(zip.files)
      .filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n))
      .map((n) => zip.file(n)!.async("string"))
  );
  const doan = [...phan, doc].flatMap((x) => (x.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).map(chuDoan)).filter((x) => x.trim());
  return { luoi, hangDau: doan.map((d) => d.split("\t").map(sach)), chu: doan.join("\n"), laPdf: false, coChu: true };
}

async function docDocCu(buffer: Buffer): Promise<TepDaDoc> {
  const { default: WordExtractor } = await import("word-extractor");
  const doc = await new WordExtractor().extract(buffer);
  const than = doc.getBody();
  const dau = doc.getHeaders({ includeFooters: true });
  const hangDau = `${dau}\n${than}`
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => l.split("\t").map(sach));
  return { luoi: luoiTuChuWord(than), hangDau, chu: `${dau}\n${than}`, laPdf: false, coChu: true };
}

async function docExcel(buffer: Buffer): Promise<TepDaDoc & { theoSheet: string[][][] }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer", sheetRows: 800 });
  const theoSheet = wb.SheetNames.map((ten) =>
    (XLSX.utils.sheet_to_json(wb.Sheets[ten], { header: 1, raw: false, blankrows: false, defval: "" }) as unknown[][]).map((r) => r.map((c) => sach(String(c ?? ""))))
  );
  const luoi = theoSheet.flat();
  return { luoi, hangDau: [], chu: luoi.map((r) => r.join("\t")).join("\n"), laPdf: false, coChu: true, theoSheet };
}

async function docPdf(buffer: Buffer, fullPath?: string): Promise<TepDaDoc> {
  const { docChuTuPdf } = await import("@/lib/pdfChu");
  const lop = await docChuTuPdf(buffer, 40);
  let chu: string | null = lop.ok ? lop.text : null;
  if (!chu && fullPath && process.platform === "win32") {
    const { docPdfBangOcr } = await import("@/lib/pdfOcr");
    const ocr = await docPdfBangOcr(fullPath, 10);
    if (ocr.ok && ocr.text.trim().length >= 10) chu = ocr.text;
  }
  return { luoi: [], hangDau: [], chu: chu ?? "", laPdf: true, coChu: Boolean(chu) };
}

/** Đọc tệp thành lưới ô + toàn bộ chữ (không AI). Lỗi đọc thì ném ra cho nơi gọi. */
export async function docTepSon(buffer: Buffer, fileName: string, fullPath?: string): Promise<TepDaDoc & { theoSheet?: string[][][] }> {
  const duoi = (fileName.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  if (duoi === ".docx") return docDocx(buffer);
  if (duoi === ".doc") return docDocCu(buffer);
  if (duoi === ".xlsx" || duoi === ".xls") return docExcel(buffer);
  if (duoi === ".pdf") return docPdf(buffer, fullPath);
  throw new Error("Chỉ nhận file Word, Excel hoặc PDF.");
}

/** Phiếu yêu cầu MLS-11-05 (REQUISITION FOR STORES / SPARE PARTS) — không phải phiếu giao, không phải báo cáo tồn. */
export function laPhieuYeuCau(chu: string): boolean {
  const s = chu
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
  return /mls\s*[-–]?\s*11\s*[-–]?\s*05|requisition\s+for\s+(stores|spare)/.test(s);
}

export type KetQuaDocBaoCaoTon =
  | { ok: true; dong: DongNhanSon[]; dau: DauBaoCaoTon; ghiChu: string; laBaoCao: true }
  | { ok: false; loi: string; laBaoCao: boolean; canAi: boolean };

/**
 * Đọc báo cáo lượng sơn tồn MLS-11-14 (không AI). `laBaoCao` = chữ của tệp cho
 * thấy đây là báo cáo tồn (mã mẫu / tiêu đề / đủ bộ cột) — nơi gọi dùng để tự chuyển
 * sang đường "cập nhật tồn theo báo cáo" dù người dùng chọn loại phiếu giao.
 */
export async function docBaoCaoTonKhongAi(buffer: Buffer, fileName: string, fullPath?: string, tep?: TepDaDoc & { theoSheet?: string[][][] }): Promise<KetQuaDocBaoCaoTon> {
  let t: TepDaDoc & { theoSheet?: string[][][] };
  try {
    t = tep ?? (await docTepSon(buffer, fileName, fullPath));
  } catch (e) {
    return { ok: false, loi: `Không đọc được file: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300), laBaoCao: false, canAi: /\.pdf$/i.test(fileName) };
  }
  if (t.laPdf && !t.coChu) return { ok: false, loi: "PDF không có lớp chữ (bản scan) — cần bộ đọc AI để đọc.", laBaoCao: false, canAi: true };

  let kq: { dau: DauBaoCaoTon; dong: DongBaoCaoTonTho[]; coBang: boolean; nguon: string };
  if (t.laPdf) kq = { ...docChuPdfBaoCaoTon(t.chu), nguon: "lớp chữ PDF" };
  else if (t.theoSheet) {
    // Excel: sheet đọc ra nhiều dòng nhất.
    const cac = t.theoSheet.map((s, i) => ({ ...docLuoiBaoCaoTon(s), nguon: `sheet ${i + 1}` }));
    kq = cac.reduce((a, b) => (b.dong.length > a.dong.length || (!a.coBang && b.coBang) ? b : a), cac[0] ?? { dau: { tau: null, quy: null, nam: null }, dong: [], coBang: false, nguon: "Excel" });
  } else kq = { ...docLuoiBaoCaoTon(t.luoi, t.hangDau), nguon: /\.doc$/i.test(fileName) ? "file Word (.doc)" : "bảng trong file Word" };

  const laBaoCao = kq.coBang || laBaoCaoTon(t.chu);
  if (!kq.dong.length) {
    return {
      ok: false,
      loi: laBaoCao
        ? "Báo cáo tồn MLS-11-14 chưa có dòng sơn nào đọc được (bảng còn trống, hoặc là bản scan)."
        : "Không thấy bảng báo cáo tồn MLS-11-14 (cột Tồn đầu kỳ · Nhận · Tiêu thụ · Tồn cuối kỳ) trong file. Nếu đây là phiếu giao, chọn loại «Phiếu giao» rồi tải lại.",
      laBaoCao,
      canAi: t.laPdf,
    };
  }
  const coSo = kq.dong.filter((d) => d.tonCuoi !== null).length;
  return {
    ok: true,
    dong: dongNhanTuBaoCao(kq.dong),
    dau: kq.dau,
    ghiChu: `Đọc ${kq.dong.length} dòng (${coSo} có Tồn cuối kỳ) từ ${kq.nguon} — báo cáo tồn MLS-11-14.`,
    laBaoCao: true,
  };
}
