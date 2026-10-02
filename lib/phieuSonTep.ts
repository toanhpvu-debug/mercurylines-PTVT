import "server-only";

import { dongTuBangSon, dongTuChuPhieuGiao, dongTuYeuCauFile, ngayNhanTuChu, type DongNhanSon } from "@/lib/phieuSon";

/*
 * Đọc phiếu giao / nhận SƠN KHÔNG dùng AI — thử mọi cách đọc hợp với loại file,
 * giữ cách ra NHIỀU dòng có số lượng nhất (hòa thì: mẫu công ty có tiêu đề >
 * bảng sơn > còn lại):
 *   - MLS-11-05 (Excel / Word / lớp chữ PDF) — lib/yeuCauTep.ts, số nhận lấy cột
 *     S.lượng duyệt nếu có;
 *   - bảng sơn có tiêu đề cột (Excel; lớp chữ PDF) — lib/paintImport.ts, đọc
 *     kèm hãng / màu / ĐVT / dung tích;
 *   - phiếu giao của nhà cung cấp (lớp chữ PDF, OCR Windows cho bản scan) —
 *     lib/phieuGiaoParse.ts.
 * PDF scan không đọc được theo cách nào thì cần bộ đọc AI (canAi).
 */

export type KetQuaDocPhieuSon =
  | { ok: true; dong: DongNhanSon[]; nguon: string; ghiChu: string; soPhieu: string | null; nhaCungCap: string | null; ngay: string | null }
  | { ok: false; loi: string; canAi: boolean };

/** uuTien: dùng khi hai cách đọc ra cùng số dòng — mẫu công ty có tiêu đề 2 > bảng sơn 1 > còn lại 0. */
type UngVien = { nguon: string; ten: string; dong: DongNhanSon[]; uuTien: number; soPhieu?: string | null; nhaCungCap?: string | null; ngay?: string | null };

const diem = (u: UngVien) => u.dong.filter((d) => d.soLuong !== null && d.soLuong > 0).length;

export async function docPhieuSonKhongAi(buffer: Buffer, fileName: string, fullPath?: string): Promise<KetQuaDocPhieuSon> {
  const duoi = (fileName.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  if (![".xlsx", ".xls", ".docx", ".doc", ".pdf"].includes(duoi)) return { ok: false, loi: "Chỉ nhận file Word, Excel hoặc PDF.", canAi: false };
  const ungVien: UngVien[] = [];
  try {
    // 1. Mẫu MLS-11-05 (mọi loại file).
    const { docYeuCauKhongAi } = await import("@/lib/yeuCauTep");
    const yc = await docYeuCauKhongAi(buffer, fileName);
    // Có tiêu đề biểu mẫu (REQUISITION / YÊU CẦU / MLS-11-05) mới chắc là mẫu công ty;
    // bảng thường đọc theo khuôn này thì nhường bảng sơn (giữ được hãng / màu).
    if (yc.ok)
      ungVien.push({ nguon: "MLS-11-05", ten: "mẫu MLS-11-05", dong: dongTuYeuCauFile(yc.dong), uuTien: yc.dau.loai ? 2 : 0, soPhieu: yc.dau.soYeuCau, ngay: yc.dau.ngay });

    // 2. Bảng sơn trong Excel.
    if (duoi === ".xlsx" || duoi === ".xls") {
      const { parsePaintExcel } = await import("@/lib/paintImport");
      const p = parsePaintExcel(buffer);
      if (!p.error && p.items.length) ungVien.push({ nguon: "BANG", ten: "bảng sơn trong Excel", dong: dongTuBangSon(p.items), uuTien: 1 });
    }

    // 3. PDF: lớp chữ → phiếu giao nhà cung cấp + bảng sơn; không có lớp chữ → OCR (Windows).
    if (duoi === ".pdf") {
      const { docChuTuPdf } = await import("@/lib/pdfChu");
      const lop = await docChuTuPdf(buffer, 40);
      let chu: string | null = lop.ok ? lop.text : null;
      let nguonChu = "PHIEU_GIAO";
      if (!chu && fullPath && process.platform === "win32") {
        const { docPdfBangOcr } = await import("@/lib/pdfOcr");
        const ocr = await docPdfBangOcr(fullPath, 10);
        if (ocr.ok && ocr.text.trim().length >= 10) {
          chu = ocr.text;
          nguonChu = "OCR";
        }
      }
      if (chu) {
        const { docPhieuGiaoTuChu } = await import("@/lib/phieuGiaoParse");
        const pg = docPhieuGiaoTuChu(chu);
        if (pg.dong.length)
          ungVien.push({
            nguon: nguonChu,
            ten: nguonChu === "OCR" ? "chữ OCR của bản scan" : "lớp chữ PDF (phiếu giao)",
            dong: dongTuChuPhieuGiao(pg.dong),
            uuTien: 0,
            soPhieu: pg.soPhieu,
            nhaCungCap: pg.nhaCungCap,
            ngay: pg.ngayGiao,
          });
        const { parsePaintText } = await import("@/lib/paintImport");
        const bang = parsePaintText(chu.replace(/^--- trang \d+ ---$/gm, ""));
        if (!bang.error && bang.items.length) ungVien.push({ nguon: "BANG", ten: "bảng sơn trong PDF", dong: dongTuBangSon(bang.items), uuTien: 1 });
      }
    }
  } catch (e) {
    return { ok: false, loi: `Không đọc được file: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300), canAi: duoi === ".pdf" };
  }

  // Cách đọc ra nhiều dòng có số lượng nhất; hòa thì theo uuTien.
  let tot: UngVien | null = null;
  for (const u of ungVien) if (diem(u) > 0 && (!tot || diem(u) > diem(tot) || (diem(u) === diem(tot) && u.uuTien > tot.uuTien))) tot = u;
  if (!tot) {
    return {
      ok: false,
      loi: duoi === ".pdf" ? "Không đọc được dòng sơn nào từ PDF (bản scan / không có bảng)." : "Không tìm thấy bảng sơn có cột số lượng trong file.",
      canAi: duoi === ".pdf",
    };
  }
  const coSo = diem(tot);
  return {
    ok: true,
    dong: tot.dong,
    nguon: tot.nguon,
    ghiChu: `Đọc ${tot.dong.length} dòng (${coSo} có số lượng) từ ${tot.ten}.`,
    soPhieu: tot.soPhieu ?? null,
    nhaCungCap: tot.nhaCungCap ?? null,
    ngay: ngayNhanTuChu(tot.ngay ?? null),
  };
}
