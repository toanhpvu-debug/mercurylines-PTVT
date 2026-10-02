/**
 * YÊU CẦU NHANH TỪ FILE — phần thuần: đọc biểu mẫu MLS-11-05B (Requisition for
 * Stores / Yêu cầu vật tư) và MLS-11-05A (Requisition for Spare Parts / Yêu cầu
 * phụ tùng), hoặc bảng tương tự đã đổi phiên bản, từ các hàng ô (Excel / Word /
 * lớp chữ PDF), hoặc từ kết quả bộ đọc AI. Cột nhận theo CHỮ tiêu đề (Anh hoặc
 * Việt, có thể trải hai hàng) chứ không theo vị trí, nên mẫu thêm / bớt / đổi chỗ
 * cột vẫn đọc được. Kiểm ở scripts/kiem-tra-yeu-cau-nhap.ts.
 */
import { docSo } from "@/lib/docSo";
import type { DauPhieu, DongAi } from "@/lib/docPhieuBangAi";

export type LoaiYeuCau = "STORE" | "SPARE";
export type BoPhanYeuCau = "ENGINE" | "DECK" | "ELECTRICAL" | "GENERAL";

export type DauYeuCauFile = {
  tau: string | null;
  /** yyyy-mm-dd */
  ngay: string | null;
  boPhan: BoPhanYeuCau | null;
  soYeuCau: string | null;
  loai: LoaiYeuCau | null;
  /** MLS-11-05A: thiết bị / máy, hãng sản xuất, kiểu, số máy. */
  thietBi: string | null;
  hang: string | null;
  kieu: string | null;
  soSeri: string | null;
};

export type DongYeuCauFile = {
  moTa: string;
  /** Mã IMPA (vật tư) — 6 chữ số. */
  impa: string | null;
  /** Part No. / số bản vẽ (phụ tùng), hoặc mã khác không phải IMPA. */
  partNo: string | null;
  /** Hạng mục (cột ITEM của MLS-11-05A). */
  hangMuc: string | null;
  donVi: string | null;
  /** Còn tồn trên tàu (R.O.B) ghi trên file. */
  rob: number | null;
  /** S.lượng yêu cầu; null = ô trống trên file. */
  soLuong: number | null;
  ghiChu: string | null;
  /** Tiêu đề nhóm đứng trên dòng (VD "ELECTRIC") nếu file chia phần. */
  phan: string | null;
  canhBao: string | null;
};

export const DUOI_YEU_CAU = [".xlsx", ".xls", ".docx", ".doc", ".pdf"] as const;
export const TOI_DA_DONG_YEU_CAU = 300;

const sach = (s: unknown) => String(s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const boDau = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

export function soYeuCauO(v: unknown): number | null {
  const s = sach(v);
  if (!s) return null;
  if (/^[-–—]+$/.test(s)) return 0;
  const t = s.replace(/[^\d.,-]/g, "");
  if (!t || !/\d/.test(t)) return null;
  const n = docSo(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** "23 29 08" / "232908" / "IMPA 23.29.08" → "232908"; "NA" / mã khác → null. */
export function chuanImpa(v: unknown): string | null {
  const so = sach(v).replace(/\D/g, "");
  return /^\d{6}$/.test(so) ? so : null;
}

const THANG: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** "1-Apr-26", "01/04/2026", "1.4.26", "2026-04-01", số ngày Excel → "yyyy-mm-dd". */
export function chuanNgayYeuCau(v: unknown): string | null {
  const s = sach(v);
  if (!s) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  const nam2 = (y: string) => (y.length === 2 ? `20${y}` : y);
  const ra = (y: string, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${nam2(y)}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null);
  if (iso) return ra(iso[1], Number(iso[2]), Number(iso[3]));
  const chu = /^(\d{1,2})[-\s/.]([A-Za-z]{3})[a-z]*[-\s/.,]+(\d{2,4})$/.exec(s);
  if (chu && THANG[chu[2].toLowerCase()]) return ra(chu[3], THANG[chu[2].toLowerCase()], Number(chu[1]));
  const so = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(s);
  if (so) return ra(so[3], Number(so[2]), Number(so[1]));
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    return ra(String(d.getUTCFullYear()), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

/** Chữ bộ phận trên file ("ENGINE DEPARTERMENT", "Bộ phận Boong"...) → bộ phận của yêu cầu. */
export function boPhanTuChu(v: unknown): BoPhanYeuCau | null {
  const s = boDau(sach(v));
  if (!s) return null;
  if (/elec|dien/.test(s)) return "ELECTRICAL";
  if (/engine|may|machin/.test(s)) return "ENGINE";
  if (/deck|boong/.test(s)) return "DECK";
  if (/galley|catering|steward|bep|phuc vu|general|chung/.test(s)) return "GENERAL";
  return null;
}

// ─── Đầu biểu mẫu ────────────────────────────────────────────────────────────

const NHAN_DAU: { k: keyof DauYeuCauFile; re: RegExp }[] = [
  { k: "tau", re: /^(vsl|vessel|ship'?s? ?name|m\/?v|tau|ten tau)\b/ },
  // Không lấy "Ngày ban hành / hiệu lực" của khung biểu mẫu (góc phải trên cùng).
  { k: "ngay", re: /^(date|ngay)\b(?!\s*(ban hanh|hieu luc|sua doi|soat xet|of issue))/ },
  { k: "boPhan", re: /^(dept|department|bo phan)\b/ },
  { k: "soYeuCau", re: /^(req\.? ?no|requisition no|so y\/? ?cau|so yeu cau)\b/ },
  { k: "thietBi", re: /^(equipment|machinery|thiet bi)\b/ },
  { k: "hang", re: /^(maker|manufacturer|hang( sx| san xuat)?|nha san xuat)\b/ },
  { k: "kieu", re: /^(type|model|kieu)\b/ },
  { k: "soSeri", re: /^(serial|engine no|so seri|so may)\b/ },
];

/**
 * Đầu biểu mẫu: ô nhãn ("Vsl./Tàu:", "Date/Ngày:", "Dept./ Bộ phận:", "Req. No.",
 * "Equipment (Thiết bị):"...) với giá trị ở ô kế bên — hoặc ngay sau dấu hai
 * chấm trong cùng ô (biểu mẫu Word / lớp chữ PDF).
 */
export function dauYeuCau(rows: string[][]): DauYeuCauFile {
  const dau: DauYeuCauFile = { tau: null, ngay: null, boPhan: null, soYeuCau: null, loai: null, thietBi: null, hang: null, kieu: null, soSeri: null };
  const tatCa = boDau(rows.slice(0, 40).map((r) => r.join(" ")).join(" "));
  if (/spare part|phu tung|11-05a/.test(tatCa)) dau.loai = "SPARE";
  else if (/requisition for stores|yeu cau vat tu|11-05b|impa/.test(tatCa)) dau.loai = "STORE";
  for (const r of rows.slice(0, 25)) {
    for (let c = 0; c < r.length; c++) {
      const o = sach(r[c]);
      if (!o || o.length > 80) continue;
      const k = boDau(o).replace(/^[\s.]+/, "");
      for (const { k: khoa, re } of NHAN_DAU) {
        if (!re.test(k)) continue;
        // Giá trị trong cùng ô sau dấu ":" hoặc ở ô có chữ kế tiếp bên phải.
        const sauHaiCham = o.includes(":") ? sach(o.slice(o.indexOf(":") + 1)) : "";
        const keBen = r.slice(c + 1).map(sach).find((x) => x && !NHAN_DAU.some((n) => n.re.test(boDau(x))));
        const gt = sauHaiCham || keBen || "";
        if (!gt || gt.length > 120) continue;
        if (khoa === "ngay") dau.ngay ??= chuanNgayYeuCau(gt);
        else if (khoa === "boPhan") dau.boPhan ??= boPhanTuChu(gt);
        else if (khoa !== "loai" && dau[khoa] === null) (dau as Record<string, unknown>)[khoa] = gt.replace(/^[(:]+|[):]+$/g, "").trim() || null;
        break;
      }
    }
  }
  return dau;
}

// ─── Bảng ────────────────────────────────────────────────────────────────────

type CotYeuCau = { stt: number; moTa: number; hangMuc: number; impa: number; partNo: number; donVi: number; rob: number; soLuong: number; duyet: number; ghiChu: number };

/** Dòng chữ ký / phần duyệt cuối biểu mẫu — gặp là thôi đọc. */
const RE_CHAN = /(chief engineer|chief officer|captain|thuyen truong|may truong|dai pho|tech\.? ?& ?pur|phong ky thuat|vice director|pho giam doc|prepared by|nguoi lap|approved by|signature|chu ky)/;

/** Gộp chữ tiêu đề theo cột của các hàng [tu..den] (tiêu đề Anh / Việt hai hàng). */
function chuTheoCot(rows: string[][], tu: number, den: number): string[] {
  const rong = Math.max(0, ...rows.slice(tu, den + 1).map((r) => r.length));
  return Array.from({ length: rong }, (_, c) =>
    boDau(
      rows
        .slice(tu, den + 1)
        .map((r) => sach(r[c]))
        .filter(Boolean)
        .join(" ")
    )
  );
}

export function timCotYeuCau(rows: string[][]): { hangDau: number; cot: CotYeuCau } | null {
  for (let r = 0; r < Math.min(rows.length, 60); r++) {
    const hang = rows[r].map((x) => boDau(sach(x)));
    if (!hang.some((x) => /descript|mo ta|name of part|ten (phu tung|vat tu|hang)/.test(x))) continue;
    // Hàng tiêu đề thứ hai (bản tiếng Việt) nếu hàng ngay dưới không phải dữ liệu.
    const duoi = rows[r + 1] ?? [];
    const laDuLieu = (o: string[]) => /^\d+$/.test(sach(o[0])) && o.slice(1).some((x) => sach(x).length > 2);
    const den = duoi.length && !laDuLieu(duoi) ? r + 1 : r;
    const chu = chuTheoCot(rows, r, den);
    const dung: number[] = [];
    const tim = (re: RegExp) => {
      const i = chu.findIndex((s, j) => !dung.includes(j) && re.test(s));
      if (i >= 0) dung.push(i);
      return i;
    };
    // Thứ tự quan trọng: "IMPA Code" có chữ "code"; "Q'ty. App." và "Q'ty. Req."
    // cùng chữ "q'ty"; "S.lượng duyệt" và "S.lượng yêu cầu" cùng chữ "lượng".
    const duyet = tim(/q'?ty\.? ?app|\bapp\b|duyet|approved/);
    const soLuong = tim(/q'?ty\.? ?req|\breq\b|yeu cau|request|q'?ty|quantity|so luong/);
    const rob = tim(/r\.? ?o\.? ?b|con ton|ton tren tau|\bton\b|on board|in stock/);
    const impa = tim(/impa/);
    const partNo = tim(/part ?no|p\/ ?n|so phu tung|drawing|ban ve|code|ma (so|hang)/);
    const hangMuc = tim(/^item\b|hang muc/);
    const donVi = tim(/unit|don vi|dvt|uom/);
    const ghiChu = tim(/remark|ghi chu|note/);
    const moTa = tim(/descript|mo ta|name of part|ten (phu tung|vat tu|hang)/);
    const stt = tim(/s\.? ?no|^stt|\bstt\b|^no\.?/);
    if (moTa < 0 || soLuong < 0) continue;
    return { hangDau: den + 1, cot: { stt, moTa, hangMuc, impa, partNo, donVi, rob, soLuong, duyet, ghiChu } };
  }
  return null;
}

/**
 * Đọc dòng hàng: bỏ dòng trống, dừng ở phần chữ ký; dòng chỉ có chữ (không số
 * thứ tự, không số lượng) là TIÊU ĐỀ PHẦN ("ELECTRIC") — ghi vào các dòng sau.
 */
export function dongTuLuoiYeuCau(rowsVao: unknown[][]): { dau: DauYeuCauFile; dong: DongYeuCauFile[]; boQua: number } | { loi: string } {
  const rows = rowsVao.map((r) => (Array.isArray(r) ? r : []).map(sach));
  const tc = timCotYeuCau(rows);
  if (!tc) return { loi: "Không tìm thấy bảng yêu cầu (cần cột Description / Mô tả và Q'ty Req / S.lượng yêu cầu)." };
  const { hangDau, cot } = tc;
  const lay = (o: string[], c: number) => (c >= 0 ? (o[c] ?? "") : "");
  const dau = dauYeuCau(rows.slice(0, hangDau));
  if (!dau.loai) dau.loai = cot.impa >= 0 ? "STORE" : cot.partNo >= 0 ? "SPARE" : null;
  const dong: DongYeuCauFile[] = [];
  let boQua = 0;
  let phan: string | null = null;
  for (let r = hangDau; r < rows.length && dong.length < TOI_DA_DONG_YEU_CAU; r++) {
    const o = rows[r];
    if (!o.some((x) => x)) continue;
    if (RE_CHAN.test(boDau(o.join(" ")))) break;
    const moTa = lay(o, cot.moTa);
    const stt = lay(o, cot.stt);
    const soLuong = soYeuCauO(lay(o, cot.soLuong));
    if (!moTa || moTa.length < 2 || /^\d+([.,]\d+)?$/.test(moTa)) {
      if (moTa || soLuong !== null) boQua++;
      continue;
    }
    if (!/\d/.test(stt) && soLuong === null && !lay(o, cot.impa) && !lay(o, cot.partNo)) {
      phan = moTa.slice(0, 80); // tiêu đề phần
      continue;
    }
    const impaTho = lay(o, cot.impa);
    const impa = chuanImpa(impaTho);
    const maKhac = sach(lay(o, cot.partNo)) || (!impa && impaTho && !/^(na|n\/a|-+)$/i.test(impaTho) ? impaTho : "");
    dong.push({
      moTa: moTa.slice(0, 300),
      impa,
      partNo: maKhac ? maKhac.slice(0, 80) : null,
      hangMuc: sach(lay(o, cot.hangMuc)).slice(0, 80) || null,
      donVi: sach(lay(o, cot.donVi)).slice(0, 20) || null,
      rob: soYeuCauO(lay(o, cot.rob)),
      soLuong,
      ghiChu: sach(lay(o, cot.ghiChu)).slice(0, 200) || null,
      phan,
      canhBao: soLuong === null || soLuong <= 0 ? "Thiếu số lượng yêu cầu trên file" : null,
    });
  }
  if (!dong.length) return { loi: "Tìm thấy bảng yêu cầu nhưng chưa có dòng hàng nào." };
  return { dau, dong, boQua };
}

const RE_DON_VI = /^[a-z.'’]{1,8}$/i;
const laO_So = (s: string) => /^[\d\s.,]+$|^[-–—]$/.test(s) && soYeuCauO(s) !== null;

/**
 * Lớp chữ PDF (lib/pdfChu.ts nối hai mẩu cách xa nhau bằng " | "). Ô trống
 * KHÔNG để lại dấu tách, nên không đọc theo vị trí cột mà neo từ PHẢI sang:
 * các ô số cuối dòng (R.O.B, S.lượng yêu cầu, [S.lượng duyệt]) → đơn vị → mã
 * IMPA / Part No. → phần còn lại là mô tả (và hạng mục của MLS-11-05A).
 */
export function dongTuChuPdfYeuCau(chu: string): { dau: DauYeuCauFile; dong: DongYeuCauFile[] } {
  const dongChu = chu.split(/\r?\n/).filter((l) => !/^--- trang \d+ ---$/.test(l.trim()));
  const rows = dongChu.map((l) => l.split(/\s*\|\s*|\t/).map(sach));
  const iDau = rows.findIndex((r) => {
    const s = boDau(r.join(" "));
    return /descript|mo ta|name of part|ten phu tung/.test(s) && /q'?ty|so luong|quantity|\breq\b|s\.? ?l\.? yeu cau/.test(s);
  });
  const dau = dauYeuCau(rows.slice(0, iDau >= 0 ? iDau : 25));
  // Bản in của app (và vài phiên bản mẫu) có cột Ghi chú SAU các cột số.
  const coGhiChu = iDau >= 0 && /\brem\b|remark|ghi chu|\bnote\b/.test(boDau([...rows[iDau], ...(rows[iDau + 1] ?? [])].join(" ")));
  const loai = dau.loai;
  const dong: DongYeuCauFile[] = [];
  let phan: string | null = null;
  for (let r = iDau >= 0 ? iDau + 1 : 0; r < rows.length && dong.length < TOI_DA_DONG_YEU_CAU; r++) {
    const o = rows[r].filter(Boolean);
    if (!o.length) continue;
    const ca = boDau(o.join(" "));
    if (RE_CHAN.test(ca)) break;
    if (/^(stt|s\.? ?no|mo ta|description)\b/.test(ca)) continue; // tiêu đề lặp ở trang sau
    // "1 Welder gloves" dính chung một mẩu → tách số thứ tự.
    const dau0 = /^(\d{1,3})[.)]?\s+(.+)$/.exec(o[0]);
    if (dau0) o.splice(0, 1, dau0[1], dau0[2]);
    if (!/^\d{1,3}[.)]?$/.test(o[0])) {
      if (o.length === 1 && /[a-z]{3}/i.test(o[0]) && o[0].length <= 40) phan = o[0];
      continue;
    }
    const o2 = o.slice(1);
    const ghiChu = coGhiChu && o2.length > 2 && !laO_So(o2[o2.length - 1]) && laO_So(o2[o2.length - 2]) ? o2.pop()!.slice(0, 200) : null;
    const so: number[] = [];
    while (o2.length > 1 && so.length < 3 && laO_So(o2[o2.length - 1])) so.unshift(soYeuCauO(o2.pop())!);
    const donVi = o2.length > 1 && RE_DON_VI.test(o2[o2.length - 1]) ? o2.pop()! : null;
    let impa: string | null = null;
    let partNo: string | null = null;
    if (o2.length > 1) {
      const ma = o2[o2.length - 1];
      if (chuanImpa(ma) || /^(na|n\/a)$/i.test(ma)) {
        impa = chuanImpa(ma);
        o2.pop();
      } else if (loai === "SPARE" && /\d/.test(ma) && !/\s{2,}/.test(ma) && ma.length <= 40) {
        partNo = ma;
        o2.pop();
      }
    }
    const hangMuc = loai === "SPARE" && o2.length > 1 ? o2.pop()! : null;
    const moTa = o2.join(" ").slice(0, 300);
    if (moTa.length < 2 || !so.length) continue;
    const [rob, soLuong] = so.length === 1 ? [null, so[0]] : [so[0], so[1]];
    dong.push({
      moTa,
      impa,
      partNo,
      hangMuc,
      donVi,
      rob,
      soLuong,
      ghiChu,
      phan,
      canhBao: so.length === 1 ? "Đọc từ lớp chữ PDF: chỉ thấy một cột số — đã coi là số lượng yêu cầu, đối chiếu với bản gốc" : null,
    });
  }
  return { dau, dong };
}

/** Dòng bộ đọc AI (chế độ "yeuCau") → dòng yêu cầu. */
export function dongTuAiYeuCau(dong: DongAi[]): DongYeuCauFile[] {
  return dong.slice(0, TOI_DA_DONG_YEU_CAU).map((d) => ({
    moTa: d.ten.slice(0, 300),
    impa: chuanImpa(d.impa),
    // "NA" ở cột IMPA bị bộ chuẩn hóa chuyển sang partNo (tưởng mã NSX) — bỏ.
    partNo: d.partNo && !/^(na|n\/a|[-–—]+)$/i.test(d.partNo) ? d.partNo.slice(0, 80) : null,
    hangMuc: d.hangMuc ?? null,
    donVi: d.donVi || null,
    rob: d.ton ?? null,
    soLuong: d.soLuongTrong || !(d.soLuong > 0) ? null : d.soLuong,
    ghiChu: null,
    phan: d.thietBi ? d.thietBi.slice(0, 80) : null,
    canhBao: d.canhBao ? d.canhBao.slice(0, 300) : null,
  }));
}

/** Đầu phiếu bộ đọc AI → đầu phiếu yêu cầu. */
export function dauTuAiYeuCau(ai: DauPhieu): DauYeuCauFile {
  const yc = ai.yc;
  const loai = String(yc?.loaiYeuCau ?? "").toUpperCase();
  return {
    tau: ai.tau,
    ngay: chuanNgayYeuCau(ai.ngayGiao),
    boPhan: boPhanTuChu(yc?.boPhan),
    soYeuCau: ai.soPhieu && !/^mls/i.test(ai.soPhieu) ? ai.soPhieu : null,
    loai: loai === "SPARE" ? "SPARE" : loai === "STORE" ? "STORE" : null,
    thietBi: yc?.mayThietBi ?? null,
    hang: yc?.hangSx ?? null,
    kieu: yc?.kieuMay ?? null,
    soSeri: yc?.soMay ?? null,
  };
}

/** Bù ô đầu phiếu còn trống của `a` bằng `b`. */
export function gopDauYeuCau(a: DauYeuCauFile, b: DauYeuCauFile): DauYeuCauFile {
  const ra = { ...a };
  for (const k of Object.keys(ra) as (keyof DauYeuCauFile)[]) if (ra[k] === null) (ra as Record<string, unknown>)[k] = b[k];
  return ra;
}

/** Đọc dòng từ cột JSON (bỏ phần tử hỏng). */
export function docDongYeuCauFile(v: unknown): DongYeuCauFile[] {
  if (!Array.isArray(v)) return [];
  const sn = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null);
  const ch = (x: unknown, toiDa = 300) => (typeof x === "string" && x.trim() ? x.trim().slice(0, toiDa) : null);
  const ra: DongYeuCauFile[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const d = x as Record<string, unknown>;
    const moTa = ch(d.moTa);
    if (!moTa) continue;
    ra.push({
      moTa,
      impa: chuanImpa(d.impa),
      partNo: ch(d.partNo, 80),
      hangMuc: ch(d.hangMuc, 80),
      donVi: ch(d.donVi, 20),
      rob: sn(d.rob),
      soLuong: sn(d.soLuong),
      ghiChu: ch(d.ghiChu, 200),
      phan: ch(d.phan, 80),
      canhBao: ch(d.canhBao, 300),
    });
  }
  return ra;
}

export function docDauYeuCau(v: unknown): DauYeuCauFile {
  const d = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const ch = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim().slice(0, 120) : null);
  return {
    tau: ch(d.tau),
    ngay: chuanNgayYeuCau(d.ngay),
    boPhan: (["ENGINE", "DECK", "ELECTRICAL", "GENERAL"] as const).find((b) => b === d.boPhan) ?? null,
    soYeuCau: ch(d.soYeuCau),
    loai: d.loai === "SPARE" ? "SPARE" : d.loai === "STORE" ? "STORE" : null,
    thietBi: ch(d.thietBi),
    hang: ch(d.hang),
    kieu: ch(d.kieu),
    soSeri: ch(d.soSeri),
  };
}

/** Loại yêu cầu của file: theo tiêu đề biểu mẫu, không có thì theo cột mã (IMPA → vật tư, Part No. → phụ tùng). */
export function loaiCuaFile(dau: DauYeuCauFile, dong: DongYeuCauFile[]): LoaiYeuCau {
  if (dau.loai) return dau.loai;
  const impa = dong.filter((d) => d.impa).length;
  const pn = dong.filter((d) => d.partNo).length;
  return pn > impa ? "SPARE" : "STORE";
}

/** Một dòng của form lập yêu cầu (khớp kiểu RequestItem của components/RequestForm.tsx). */
export type DongFormYeuCau = {
  mode: "existing" | "new";
  materialId: string;
  itemName: string;
  itemCode: string;
  itemUom: string;
  quantity: string;
  note: string;
  rob: string;
  goiY?: string;
};

/**
 * Dòng file + kết quả ghép → dòng điền sẵn vào form. Dòng khớp danh mục là "có
 * sẵn" (ROB chụp từ tồn kho như mọi yêu cầu) nhưng vẫn giữ tên / mã / đơn vị
 * theo file, để người lập đổi sang "mới" mà không phải gõ lại. Tên phần ("ELECTRIC")
 * và hạng mục (cột ITEM của 05A) vào ghi chú — form không có cột riêng cho chúng.
 */
export function dongFormTuFile(
  dong: DongYeuCauFile[],
  ghep: (VatTuGhep | null)[],
  goiY: (d: DongYeuCauFile) => string | undefined
): DongFormYeuCau[] {
  return dong.map((d, i) => {
    const m = ghep[i];
    return {
      mode: m ? "existing" : "new",
      materialId: m ? String(m.id) : "",
      itemName: d.moTa,
      itemCode: d.impa ?? d.partNo ?? "",
      itemUom: d.donVi ?? "",
      quantity: d.soLuong !== null && d.soLuong > 0 ? String(d.soLuong) : "",
      note: [d.phan, d.hangMuc, d.ghiChu].filter(Boolean).join("; ").slice(0, 300),
      rob: !m && d.rob !== null ? String(d.rob) : "",
      goiY: goiY(d),
    };
  });
}

// ─── Ghép với danh mục ───────────────────────────────────────────────────────

export type VatTuGhep = { id: number; code: string; nameVn: string; nameEn: string | null; impa: string | null; partNumber: string | null; uom: string; materialType: string; cuaTau: boolean };

const khop = (s: string | null | undefined) => boDau(String(s ?? "")).replace(/[^a-z0-9]+/g, "");

/**
 * Ghép từng dòng file với mặt hàng CÓ SẴN trong danh mục cùng loại: mã IMPA
 * (vật tư) → Part No. (phụ tùng) → tên trùng khít (Việt hoặc Anh). Có nhiều ứng
 * viên thì ưu tiên mặt hàng đã gán cho tàu. Không ghép được → dòng MỚI (ngoài
 * danh mục) với tên, mã, đơn vị theo file.
 */
export function ghepDongYeuCau(dong: DongYeuCauFile[], loai: LoaiYeuCau, vatTu: VatTuGhep[]): (VatTuGhep | null)[] {
  // Chuẩn hóa mỗi mặt hàng MỘT lần trước vòng lặp: chuẩn hóa trong vòng (169
  // dòng × 597 mặt hàng × tới 8 lần normalize + regex) tốn 249 ms CPU chặn cả
  // server mỗi lần mở trang điền từ file; chuẩn hóa trước còn 7 ms, cùng kết quả.
  const cungLoai = vatTu
    .filter((m) => m.materialType === loai)
    .map((m) => ({ m, impa: chuanImpa(m.impa), pn: khop(m.partNumber), vn: khop(m.nameVn), en: m.nameEn ? khop(m.nameEn) : null }));
  const chon = (ds: typeof cungLoai) => (ds.find((x) => x.m.cuaTau) ?? ds[0])?.m ?? null;
  return dong.map((d) => {
    if (d.impa) {
      const theoImpa = cungLoai.filter((x) => x.impa === d.impa);
      if (theoImpa.length) return chon(theoImpa);
    }
    const pn = khop(d.partNo);
    if (pn.length >= 3) {
      const theoPn = cungLoai.filter((x) => x.pn === pn);
      if (theoPn.length) return chon(theoPn);
    }
    // Tên trùng khít: cả mô tả, rồi từng nửa của mô tả song ngữ "Wiping rags(giẻ lau)".
    const ngoac = /^(.+?)\s*\(([^()]+)\)?\s*\.?$/.exec(d.moTa.trim()); // ô gộp hay mất ")"
    const ten = [d.moTa, ...(ngoac ? [ngoac[1], ngoac[2]] : [])].map(khop).filter((s) => s.length >= 4);
    for (const s of ten) {
      const theoTen = cungLoai.filter((x) => x.vn === s || (x.en !== null && x.en === s));
      if (theoTen.length) return chon(theoTen);
    }
    return null;
  });
}
