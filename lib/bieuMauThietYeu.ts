/**
 * Điền báo cáo phụ tùng thiết yếu vào TỆP WORD MẪU MLS-11-04 của công ty, giữ
 * nguyên header có logo, khung mã biểu mẫu, footer, cỡ chữ, đường kẻ chấm.
 *
 * Mẫu có: đoạn "Tên tàu (Vessel) …… Ngày (Date): ……/……/2026……"; một bảng 9 cột
 * gồm hàng tiêu đề cột, hàng tiêu đề nhóm (một ô trải hết chiều ngang, "A.
 * Phụ tùng cho Máy chính…"), các hàng mục (ô đầu là số thứ tự), vài hàng trống
 * ở cuối; khối ký Máy trưởng / Thuyền trưởng. Cách điền:
 *   - Đoạn tên tàu / ngày: dựng lại với đúng định dạng chữ của mẫu.
 *   - Bảng: giữ hàng tiêu đề cột; với từng nhóm, nhân bản hàng nhóm của mẫu rồi
 *     các hàng mục của mẫu (mỗi ô giữ tcPr / pPr / rPr, chỉ thay chữ); cuối bảng
 *     giữ một hàng trống của mẫu để đường kẻ khép bảng như bản gốc.
 * Phần thuần chuỗi (dienXmlThietYeu) kiểm ở scripts/kiem-tra-thiet-yeu.ts.
 */
import JSZip from "jszip";
import { chuCua, datChuO, xmlEsc } from "@/lib/bieuMauChangBuoc";
import { COT_IN, gomNhom, type DongIn } from "@/lib/thietYeu";

/** Dòng bản in (chữ) — từ số liệu hệ thống (dongInTu) hoặc bản người dùng sửa trước khi in. */
export type DuLieuThietYeu = { tenTau: string; ngay: string; dong: DongIn[] };

const RE_TBL = /<w:tbl>[\s\S]*?<\/w:tbl>/;
const RE_TR = /<w:tr\b[\s\S]*?<\/w:tr>/g;
const RE_TC = /<w:tc>[\s\S]*?<\/w:tc>/g;
const RE_P = /<w:p\b[\s\S]*?<\/w:p>/g;

const oCua = (tr: string) => tr.match(RE_TC) ?? [];
const laHangMuc = (tr: string) => {
  const o = oCua(tr);
  return o.length === 9 && /^\s*\d+\s*$/.test(chuCua(o[0]));
};
const laHangNhomMotO = (tr: string) => oCua(tr).length === 1 && chuCua(tr).trim().length > 0;
const laHangTrong = (tr: string) => oCua(tr).length === 9 && !chuCua(tr).trim();

export function dienXmlThietYeu(xml: string, du: DuLieuThietYeu): string {
  const tblMatch = xml.match(RE_TBL);
  if (!tblMatch) throw new Error("Mẫu không có bảng.");
  const tbl = tblMatch[0];
  const rows = tbl.match(RE_TR) ?? [];
  const viTriNhomDau = rows.findIndex(laHangNhomMotO);
  const khuonMuc = rows.find(laHangMuc);
  if (viTriNhomDau < 0) throw new Error("Mẫu không có hàng tiêu đề nhóm (A. Phụ tùng cho Máy chính…).");
  if (!khuonMuc) throw new Error("Mẫu không có hàng mục (ô đầu là số thứ tự) với 9 ô.");
  const khuonNhom = rows[viTriNhomDau];
  const hangTieuDe = rows.slice(0, viTriNhomDau);
  const hangTrongCuoi = [...rows].reverse().find(laHangTrong);

  const hangNhom = (ten: string) => {
    const tc = oCua(khuonNhom)[0] ?? "";
    const trPr = khuonNhom.match(/<w:trPr>[\s\S]*?<\/w:trPr>/)?.[0] ?? "";
    return `<w:tr>${trPr}${datChuO(tc, ten)}</w:tr>`;
  };
  const trPrMuc = khuonMuc.match(/<w:trPr>[\s\S]*?<\/w:trPr>/)?.[0] ?? "";
  const oMuc = oCua(khuonMuc);
  const hangMuc = (gia: string[]) => `<w:tr>${trPrMuc}${oMuc.map((tc, j) => datChuO(tc, gia[j] ?? "")).join("")}</w:tr>`;

  const than: string[] = [];
  for (const nh of gomNhom(du.dong)) {
    than.push(hangNhom(nh.nhom));
    for (const d of nh.dong) than.push(hangMuc(COT_IN.map((k) => d[k])));
  }
  if (hangTrongCuoi) {
    const trPr = hangTrongCuoi.match(/<w:trPr>[\s\S]*?<\/w:trPr>/)?.[0] ?? "";
    than.push(`<w:tr>${trPr}${oCua(hangTrongCuoi).map((tc) => datChuO(tc, "")).join("")}</w:tr>`);
  }
  const tblPr = tbl.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? "";
  const tblGrid = tbl.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? "";
  let ra = xml.replace(tbl, () => `<w:tbl>${tblPr}${tblGrid}${hangTieuDe.join("")}${than.join("")}</w:tbl>`);

  // Đoạn "Tên tàu (Vessel) … Ngày (Date): …".
  const ngoaiBang = ra.replace(RE_TBL, "");
  const pTau = (ngoaiBang.match(RE_P) ?? []).find((p) => /Vessel/.test(chuCua(p)) && /Date/.test(chuCua(p)));
  if (pTau) {
    const pPr = pTau.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
    const runs = pTau.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g) ?? [];
    const rPrCuaRun = (r: string | undefined) => r?.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
    const rThuong = rPrCuaRun(runs.find((r) => /^\s*\(\s*$/.test(chuCua(r))) ?? runs[0]);
    const rNghieng = rPrCuaRun(runs.find((r) => chuCua(r).trim() === "Vessel")) || rThuong;
    const T = (s: string) => `<w:t xml:space="preserve">${xmlEsc(s)}</w:t>`;
    const R = (rPr: string, s: string) => `<w:r>${rPr}${T(s)}</w:r>`;
    const pMoi =
      `<w:p>${pPr}` +
      R(rThuong, "Tên tàu (") +
      R(rNghieng, "Vessel") +
      R(rThuong, `) ${du.tenTau}`) +
      R(rThuong, "                              ") +
      R(rThuong, "Ngày (") +
      R(rNghieng, "Date") +
      R(rThuong, `): ${du.ngay}`) +
      `</w:p>`;
    ra = ra.replace(pTau, () => pMoi);
  }
  return ra;
}

export async function dienBieuMauThietYeu(template: Buffer, du: DuLieuThietYeu): Promise<Buffer> {
  const zip = await JSZip.loadAsync(template);
  const tep = zip.file("word/document.xml");
  if (!tep) throw new Error("Tệp không phải .docx (thiếu word/document.xml).");
  zip.file("word/document.xml", dienXmlThietYeu(await tep.async("string"), du));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** Kiểm tệp tải lên có dùng được làm mẫu MLS-11-04 không (lúc quản trị tải lên). */
export async function kiemTraBieuMauThietYeu(buffer: Buffer): Promise<{ ok: true } | { ok: false; loi: string }> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const tep = zip.file("word/document.xml");
    if (!tep) return { ok: false, loi: "Không phải tệp Word .docx (thiếu word/document.xml)." };
    dienXmlThietYeu(await tep.async("string"), { tenTau: "THU", ngay: "01/01/2026", dong: [] });
    return { ok: true };
  } catch (e) {
    return { ok: false, loi: e instanceof Error ? e.message : String(e) };
  }
}
