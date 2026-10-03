/**
 * BÁO CÁO LƯỢNG SƠN TỒN MLS-11-14 TẢI LÊN → ĐƯA TỒN SƠN CỦA TÀU VỀ ĐÚNG SỐ CUỐI QUÝ
 * — phần thuần (không database), dùng chung cho đọc tệp, trang soát (client),
 * server action và script kiểm thử (scripts/kiem-tra-bao-cao-ton-son.ts).
 *
 * Tàu báo cáo sơn hàng quý trên tờ MLS-11-14: Tên tàu · Quý · Năm, mỗi loại sơn
 * Tồn đầu kỳ · Nhận · Tiêu thụ trong kỳ · Tồn cuối kỳ. Ngày của báo cáo là NGÀY
 * CUỐI QUÝ (ô "Issued date" trong khung là ngày ban hành mẫu, không phải).
 * Tải báo cáo lên thì app đưa số liệu của nó trong quý đó về đúng báo cáo, bằng
 * các dòng nhập / xuất / điều chỉnh ghi đúng thời điểm (keHoachBaoCaoTon):
 *   - Tồn đầu kỳ khác → một dòng ĐIỀU CHỈNH ngay trước đầu quý (tồn mang sang);
 *   - Nhận nhiều hơn số app đã ghi → dòng NHẬP cuối quý; ít hơn → điều chỉnh bớt;
 *   - Tiêu thụ nhiều hơn số app đã ghi → dòng XUẤT DÙNG cuối quý; ít hơn → điều chỉnh;
 *   - còn lệch Tồn cuối kỳ (tàu cộng trừ sai, ô để trống…) → một dòng cuối quý để
 *     tồn cuối quý bằng đúng báo cáo (ô Tiêu thụ trống thì coi phần thiếu là tiêu thụ).
 * Số app "đang ghi" để so là bốn cột như tờ in quý (lib/tonSon.ts bonCotQuy — điều
 * chỉnh thường đã gộp vào Nhận / Tồn đầu kỳ), nên tải lại chính tờ in của app thì
 * khớp hết. Mỗi dòng ghi mang cột báo cáo của nó (PaintTransaction.cotBaoCao): tờ
 * in xếp dòng Nhận / Tiêu thụ thẳng vào cột đó, nên in lại quý ra đúng bốn cột của
 * tàu. Sơn nhập / xuất ghi SAU cuối quý giữ nguyên, nên tồn hiện tại = Tồn cuối kỳ
 * của báo cáo + phát sinh sau đó.
 */
import { docSoLoc } from "@/lib/docSo";
import { QUY_LA_MA, bonCotQuy, soIn, type HeThongQuy, type KyQuy } from "@/lib/tonSon";
import type { DongNhanSon, SoBaoCaoTon } from "@/lib/phieuSon";

// ─── Chữ ─────────────────────────────────────────────────────────────────────

/** Bỏ dấu tiếng Việt + chữ thường + gọn khoảng trắng — để so nhãn cột ("Tồn đầu kỳ" ~ "ton dau ky"). */
const chuan = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const gon = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Tệp có phải báo cáo lượng sơn tồn MLS-11-14 không (theo chữ đọc được: mã mẫu, tiêu đề, hoặc đủ bộ cột). */
export function laBaoCaoTon(chu: string): boolean {
  const s = chuan(chu);
  if (/mls\s*[-–]?\s*11\s*[-–]?\s*14/.test(s)) return true;
  if (/luong\s+son\s+ton|paint\s+inventory/.test(s)) return true;
  return /ton\s*dau\s*ky|in\s*stock/.test(s) && /ton\s*cuoi\s*ky|remain/.test(s) && /tieu\s*thu|consum/.test(s);
}

/** Một ô số của báo cáo: "17,91" · "1.000" · "-" (= 0) · trống / chữ → null. */
export function soBaoCao(raw: string | null | undefined): number | null {
  const s = gon(raw);
  if (!s) return null;
  if (/^[-–—]+$/.test(s)) return 0;
  if (!/\d/.test(s)) return null;
  const n = docSoLoc(s);
  return n !== null && Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null;
}

/** Ô Quý: "III" · "3" · "Q3" · "Quý IV/2026" → 1–4; không đọc được → null. */
export function quyTuChu(raw: string | null | undefined): KyQuy["quy"] | null {
  const s = chuan(raw ?? "").toUpperCase();
  const la = /(?:^|[^A-Z])(IV|III|II|I)(?![A-Z])/.exec(s);
  if (la) return ({ I: 1, II: 2, III: 3, IV: 4 } as const)[la[1] as "I" | "II" | "III" | "IV"];
  const so = /(?:^|\D)([1-4])(?!\d)/.exec(s);
  return so ? (Number(so[1]) as KyQuy["quy"]) : null;
}

/** Ô Năm: số 4 chữ số 2000–2099. */
export function namTuChu(raw: string | null | undefined): number | null {
  const m = /(?:^|\D)(20\d{2})(?!\d)/.exec(raw ?? "");
  return m ? Number(m[1]) : null;
}

/** "III/2026". */
export const tenKy = (k: KyQuy) => `${QUY_LA_MA[k.quy - 1]}/${k.nam}`;

/** Ngày cuối quý theo lịch (yyyy-mm-dd) — ngày của báo cáo. */
export function ngayCuoiQuy(k: KyQuy): string {
  const thang = k.quy * 3;
  const ngay = new Date(Date.UTC(k.nam, thang, 0)).getUTCDate();
  return `${k.nam}-${String(thang).padStart(2, "0")}-${String(ngay).padStart(2, "0")}`;
}

/**
 * Ngày cuối quý lưu vào SonPhieuTep.ngayNhan — 12 giờ trưa giờ máy chủ, như mọi ô
 * ngày nhận khác; giờ Việt Nam hay UTC thì vẫn rơi đúng ngày đó của quý
 * (lib/tonSon.ts quyCua đọc lại ra đúng quý).
 */
export const ngayNhanCuaKy = (k: KyQuy) => new Date(`${ngayCuoiQuy(k)}T12:00:00`);

/** Số phiếu hiển thị của báo cáo tồn ("MLS-11-14 · quý III/2026"). */
export const soPhieuBaoCao = (k: KyQuy | null) => (k ? `MLS-11-14 · quý ${tenKy(k)}` : "MLS-11-14");

// ─── Đọc bảng của báo cáo ────────────────────────────────────────────────────

type CotBaoCao = "stt" | "ten" | "donVi" | "tonDau" | "nhan" | "tieuThu" | "tonCuoi";

/** Nhãn cột (đã bỏ dấu) — thứ tự kiểm quan trọng: "Tiêu thụ trong kỳ" trước "Nhận". */
const NHAN_COT: [CotBaoCao, RegExp][] = [
  ["tonDau", /ton\s*dau|in\s*stock|opening/],
  ["tonCuoi", /ton\s*cuoi|remain/],
  ["tieuThu", /tieu\s*thu|consum/],
  ["nhan", /^nhan\b|\bnhan\s+rec|rece?ive/],
  ["donVi", /don\s*vi|\bunit\b|^dvt\b/],
  ["ten", /ten\s*son|paint\s*name|ten\s*hang|description|mo\s*ta/],
  ["stt", /^(stt|no\.?|s\.?\s*no\.?)(\s|$)/],
];

function cotCua(o: string): CotBaoCao | null {
  const s = chuan(o);
  if (!s || s.length > 40) return null;
  for (const [k, re] of NHAN_COT) if (re.test(s)) return k;
  return null;
}

type BanDoCot = Partial<Record<CotBaoCao, number>>;

/** Hàng tiêu đề bảng: có Tồn cuối kỳ, Tên sơn và ít nhất hai trong Tồn đầu kỳ / Nhận / Tiêu thụ. */
function banDoCot(hang: string[]): BanDoCot | null {
  const m: BanDoCot = {};
  hang.forEach((o, i) => {
    const k = cotCua(o);
    if (k && m[k] === undefined) m[k] = i;
  });
  const soCot = (["tonDau", "nhan", "tieuThu"] as const).filter((k) => m[k] !== undefined).length;
  return m.tonCuoi !== undefined && m.ten !== undefined && soCot >= 2 ? m : null;
}

const NHAN_DAU = {
  tau: /^(ten\s*tau|vessel|ship'?s?\s*name)/,
  quy: /^(quy|quarter)\b/,
  nam: /^(nam|year)\b/,
};
const laNhanDau = (o: string) => {
  const s = chuan(o);
  return Object.values(NHAN_DAU).some((re) => re.test(s));
};

/** Giá trị đứng sau một nhãn: phần sau dấu ":" cùng ô, không thì ô có chữ kế tiếp (gặp nhãn khác thì thôi). */
function giaTriSau(hang: string[], re: RegExp): string | null {
  for (let i = 0; i < hang.length; i++) {
    if (!re.test(chuan(hang[i]))) continue;
    const hai = hang[i].indexOf(":");
    if (hai >= 0) {
      const sau = gon(hang[i].slice(hai + 1));
      if (sau) return sau;
    }
    for (let j = i + 1; j < hang.length; j++) {
      const v = gon(hang[j]);
      if (!v) continue;
      if (laNhanDau(v) || cotCua(v)) break;
      return v;
    }
  }
  return null;
}

export type DauBaoCaoTon = { tau: string | null; quy: KyQuy["quy"] | null; nam: number | null };
export type DongBaoCaoTonTho = {
  stt: number | null;
  ten: string;
  donVi: string | null;
  tonDau: number | null;
  nhan: number | null;
  tieuThu: number | null;
  tonCuoi: number | null;
};

/** Tên tàu / quý / năm từ các hàng chữ (đầu báo cáo, phần header trang…). */
export function dauBaoCaoTuHang(hang: string[][]): DauBaoCaoTon {
  let tau: string | null = null;
  let quy: KyQuy["quy"] | null = null;
  let nam: number | null = null;
  for (const h of hang) {
    tau ??= giaTriSau(h, NHAN_DAU.tau)?.slice(0, 80) ?? null;
    quy ??= quyTuChu(giaTriSau(h, NHAN_DAU.quy));
    nam ??= namTuChu(giaTriSau(h, NHAN_DAU.nam));
  }
  return { tau, quy, nam };
}

/** Hàng chữ ký / chân trang — hết bảng. */
const HET_BANG = /thuyen\s*truong|captain|dai\s*pho|chief\s*officer|nguoi\s*lam\s*bao\s*cao/;

/**
 * Đọc bảng MLS-11-14 từ một lưới ô (bảng Word, sheet Excel, chữ Word .doc tách
 * theo tab). Tìm hàng tiêu đề theo nhãn cột (Việt hoặc Anh, kể cả tiêu đề tách hai
 * hàng), đọc từng dòng có tên tới hàng chữ ký; dòng mẫu còn trống bỏ qua.
 */
export function docLuoiBaoCaoTon(luoi: string[][], hangDauThem: string[][] = []): { dau: DauBaoCaoTon; dong: DongBaoCaoTonTho[]; coBang: boolean } {
  let h = -1;
  let cot: BanDoCot | null = null;
  let tu = -1;
  for (let i = 0; i < luoi.length && h < 0; i++) {
    const m = banDoCot(luoi[i]);
    if (m) [h, cot, tu] = [i, m, i + 1];
  }
  // Không hàng nào đủ nhãn: tiêu đề Việt / Anh tách hai hàng (Excel chép từ Word) — ghép
  // từng cặp hàng rồi thử. Chỉ thử SAU khi hết hàng đơn, kẻo hàng thông tin tàu ghép với
  // hàng tiêu đề thành "tiêu đề" sai.
  for (let i = 0; i + 1 < luoi.length && h < 0; i++) {
    const sau = luoi[i + 1];
    const m2 = banDoCot(luoi[i].map((o, j) => `${o} ${sau[j] ?? ""}`));
    if (m2) [h, cot, tu] = [i, m2, i + 2];
  }
  const dau = dauBaoCaoTuHang([...hangDauThem, ...(h >= 0 ? luoi.slice(0, h) : luoi)]);
  if (h < 0 || !cot) return { dau, dong: [], coBang: false };
  const c = cot;
  const dong: DongBaoCaoTonTho[] = [];
  for (let i = tu; i < luoi.length; i++) {
    const hang = luoi[i];
    if (HET_BANG.test(chuan(hang.join(" ")))) break;
    // Tiêu đề lặp lại (bảng sang trang) hoặc hàng tiêu đề tiếng Anh còn lại.
    if (hang.filter((o) => cotCua(o)).length >= 3) continue;
    const lay = (k: CotBaoCao) => (c[k] !== undefined ? gon(hang[c[k]!]) : "");
    const ten = lay("ten");
    if (!ten) continue;
    const stt = /^\d{1,4}\.?$/.test(lay("stt")) ? Number.parseInt(lay("stt"), 10) : null;
    dong.push({
      stt,
      ten: ten.slice(0, 300),
      donVi: lay("donVi").slice(0, 20) || null,
      tonDau: soBaoCao(lay("tonDau")),
      nhan: soBaoCao(lay("nhan")),
      tieuThu: soBaoCao(lay("tieuThu")),
      tonCuoi: soBaoCao(lay("tonCuoi")),
    });
  }
  return { dau, dong, coBang: true };
}

/**
 * Chữ của tệp Word .doc (word-extractor): ô kết thúc bằng tab, hàng kết thúc bằng
 * tab + xuống dòng; xuống dòng TRONG ô là đoạn mới của chính ô đó. Dựng lại lưới.
 */
export function luoiTuChuWord(chu: string): string[][] {
  const luoi: string[][] = [];
  let cho: string[] = [];
  for (const dong of chu.replace(/\r\n?/g, "\n").split("\n")) {
    cho.push(dong);
    if (!dong.endsWith("\t")) continue;
    const o = cho.join("\n").split("\t");
    o.pop();
    luoi.push(o.map((x) => gon(x)));
    cho = [];
  }
  return luoi;
}

const LA_SO_PDF = /^(?:[-–—]|\d[\d.,]*)$/;
const LA_DON_VI = /^\p{L}[\p{L}.\/]{0,11}$/u;
/** Dòng đầu trang / chân trang lặp lại mỗi trang của tờ in — không phải tên sơn. */
const KHUNG_TRANG =
  /^(mls\s*-?\s*11|issued\s*date|revision|revised\s*date|page\s*:|bao\s*cao\s*luong|paint\s*inventory|mercury\s*lines|company\s*limited|nguoi\s*lam|thoi\s*diem|thoi\s*gian\s*luu|luu\s*vp|ten\s*tau|vessel|quy\s*\/|nam\s*\/)/;

/**
 * Đọc báo cáo từ LỚP CHỮ PDF (lib/pdfChu.ts: mỗi dòng như mắt nhìn, ô cách " | ").
 * Dòng neo = dòng kết thúc bằng 4 ô số (… | Đơn vị | Đầu | Nhận | Tiêu thụ | Cuối).
 * Tên sơn dài xuống dòng trong ô, các ô khác canh giữa theo chiều dọc ⇒ tên nằm
 * chia đều trên và dưới dòng neo: mảnh chữ ngay trước dòng neo thuộc dòng đó, và
 * dòng đó lấy thêm đúng chừng ấy mảnh chữ phía sau.
 */
export function docChuPdfBaoCaoTon(chu: string): { dau: DauBaoCaoTon; dong: DongBaoCaoTonTho[]; coBang: boolean } {
  type Neo = { stt: number | null; ten: string; donVi: string | null; so: (number | null)[]; truoc: string[]; sau: string[] };
  const dauHang: string[][] = [];
  const neo: Neo[] = [];
  let trongBang = false;
  let truoc: string[] = [];
  let canSau = 0;
  let cuoi: Neo | null = null;
  for (const dongTho of chu.split("\n")) {
    const dong = dongTho.trim();
    if (!dong) continue;
    if (/^--- trang \d+ ---$/.test(dong)) {
      [truoc, canSau, cuoi] = [[], 0, null];
      continue;
    }
    let o = dong.split(" | ").map(gon).filter(Boolean);
    const s = chuan(dong);
    // Chữ OCR (bản scan) không có dấu ngăn cột: dòng kết thúc bằng 4 số thì tách lại theo từ.
    if (o.length === 1) {
      const tu = dong.split(/\s+/);
      if (tu.length >= 5 && tu.slice(-4).every((x) => LA_SO_PDF.test(x))) {
        const dauDong = tu.slice(0, -4);
        const stt = /^\d{1,4}\.?$/.test(dauDong[0] ?? "") ? [dauDong.shift()!] : [];
        const dv = dauDong.length >= 2 && LA_DON_VI.test(dauDong[dauDong.length - 1]) ? [dauDong.pop()!] : [];
        o = [...stt, dauDong.join(" "), ...dv, ...tu.slice(-4)].filter(Boolean);
      }
    }
    const laTieuDe = o.filter((x) => cotCua(x)).length >= 2 || (/ton\s*dau|in\s*stock/.test(s) && /ton\s*cuoi|remain/.test(s));
    if (!trongBang) {
      if (laTieuDe) trongBang = true;
      else dauHang.push(o);
      continue;
    }
    // Hàng tiêu đề (cả phần đuôi của ô tiêu đề nhiều dòng, như "Consume" của "Tiêu thụ
    // trong kỳ") — không phải mảnh tên sơn; xóa mảnh đang chờ để không lệch nhịp.
    if (laTieuDe || o.every((x) => cotCua(x) !== null)) {
      [truoc, canSau, cuoi] = [[], 0, null];
      continue;
    }
    if (/thuyen\s*truong|captain|dai\s*pho|chief\s*officer/.test(s)) break;
    if (KHUNG_TRANG.test(s)) continue;
    const coNeo = o.length >= 5 && o.slice(-4).every((x) => LA_SO_PDF.test(x));
    if (coNeo) {
      const con = o.slice(0, -4);
      const donVi = con.length >= 2 && LA_DON_VI.test(con[con.length - 1]) ? con.pop()! : null;
      const stt = con.length && /^\d{1,4}\.?$/.test(con[0]) ? Number.parseInt(con.shift()!, 10) : null;
      const n: Neo = { stt, ten: con.join(" "), donVi, so: o.slice(-4).map(soBaoCao), truoc, sau: [] };
      canSau = truoc.length;
      truoc = [];
      neo.push(n);
      cuoi = n;
    } else if (canSau > 0 && cuoi) {
      cuoi.sau.push(o.join(" "));
      canSau--;
    } else {
      truoc.push(o.join(" "));
    }
  }
  const dong = neo
    .map((n) => ({
      stt: n.stt,
      ten: gon([...n.truoc, n.ten, ...n.sau].join(" ")).slice(0, 300),
      donVi: n.donVi,
      tonDau: n.so[0],
      nhan: n.so[1],
      tieuThu: n.so[2],
      tonCuoi: n.so[3],
    }))
    .filter((d) => d.ten);
  return { dau: dauBaoCaoTuHang(dauHang), dong, coBang: trongBang };
}

/** Dòng báo cáo → kiểu dòng chung của trang soát (Tồn cuối kỳ ở soLuong, ba cột kia ở bc). */
export function dongNhanTuBaoCao(dong: DongBaoCaoTonTho[]): DongNhanSon[] {
  return dong.map((d) => ({
    ten: d.ten,
    hang: null,
    mau: null,
    maMau: null,
    ma: null,
    dvt: d.donVi,
    soLuong: d.tonCuoi,
    dungTich: null,
    loaiSon: null,
    paintProductId: null,
    boQua: false,
    canhBao: null,
    ghiChu: null,
    bc: { tonDau: d.tonDau, nhan: d.nhan, tieuThu: d.tieuThu },
  }));
}

// ─── Soát dòng trước khi cập nhật ────────────────────────────────────────────

export const CANH_BAO_THIEU_TON_CUOI = "Không đọc được Tồn cuối kỳ — đã bỏ tick; điền số nếu loại này cần cập nhật (dòng tự tick lại)";

/** Dòng chưa có Tồn cuối kỳ: bỏ tick sẵn kèm lời nhắc (0 là số thật — sơn đã hết — nên vẫn giữ). */
export function boTickThieuTonCuoi(dong: DongNhanSon[]): DongNhanSon[] {
  return dong.map((d) =>
    d.boQua || d.soLuong !== null
      ? d
      : { ...d, boQua: true, canhBao: (d.canhBao ? `${d.canhBao}; ${CANH_BAO_THIEU_TON_CUOI}` : CANH_BAO_THIEU_TON_CUOI).slice(0, 300) }
  );
}

/** Lỗi trước khi cập nhật: dòng đang tick thiếu Tồn cuối kỳ, hoặc tạo loại mới mà không có tên. Số dòng đánh từ 1. */
export function dongLoiBaoCaoTon(dong: DongNhanSon[]): { n: number; lyDo: "thieuSo" | "thieuTen" } | null {
  for (let i = 0; i < dong.length; i++) {
    const d = dong[i];
    if (d.boQua) continue;
    if (d.soLuong === null) return { n: i + 1, lyDo: "thieuSo" };
    if (d.paintProductId === null && !d.ten.trim()) return { n: i + 1, lyDo: "thieuTen" };
  }
  return null;
}

export type DongBaoCaoGop = { khoa: string; dau: DongNhanSon; tonCuoi: number; bc: SoBaoCaoTon; soDong: number };

/**
 * Gộp dòng cùng loại sơn (báo cáo ghi một loại ở nhiều dòng — nhiều lô): cộng Tồn
 * cuối kỳ và từng cột còn lại (cột mọi dòng đều trống thì vẫn trống). Dòng chưa có
 * loại sơn gộp theo tên + hãng + màu + mã màu.
 */
export function gopDongBaoCaoTon(dong: DongNhanSon[]): DongBaoCaoGop[] {
  const khop = (s: string | null) => (s ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  const cong = (a: number | null, b: number | null) => (a === null && b === null ? null : Math.round(((a ?? 0) + (b ?? 0)) * 1000) / 1000);
  const gop = new Map<string, DongBaoCaoGop>();
  for (const d of dong) {
    if (d.boQua || d.soLuong === null) continue;
    const khoa = d.paintProductId !== null ? `id:${d.paintProductId}` : `moi:${khop(d.ten)}|${khop(d.hang)}|${khop(d.mau)}|${khop(d.maMau)}`;
    const bc = d.bc ?? { tonDau: null, nhan: null, tieuThu: null };
    const cu = gop.get(khoa);
    if (cu) {
      cu.tonCuoi = Math.round((cu.tonCuoi + d.soLuong) * 1000) / 1000;
      cu.bc = { tonDau: cong(cu.bc.tonDau, bc.tonDau), nhan: cong(cu.bc.nhan, bc.nhan), tieuThu: cong(cu.bc.tieuThu, bc.tieuThu) };
      cu.soDong++;
    } else gop.set(khoa, { khoa, dau: d, tonCuoi: d.soLuong, bc: { ...bc }, soDong: 1 });
  }
  return [...gop.values()];
}

// ─── Kế hoạch đưa số của app về đúng báo cáo ────────────────────────────────

export type ButToanBaoCao = {
  /** NHAN = dòng nhập, TIEU_THU = dòng xuất dùng, DIEU_CHINH = dòng điều chỉnh (có dấu). */
  loai: "NHAN" | "TIEU_THU" | "DIEU_CHINH";
  /** NHAN / TIEU_THU: số dương; DIEU_CHINH: có dấu (+ tăng tồn, − giảm tồn). */
  so: number;
  /** DAU_KY = ghi ngay trước đầu quý (tồn mang sang); CUOI_KY = ghi lúc cuối quý. */
  luc: "DAU_KY" | "CUOI_KY";
  /** Cột của báo cáo mà dòng này làm khớp. */
  cot: "tonDau" | "nhan" | "tieuThu" | "tonCuoi";
  /** Số app đang có và số báo cáo ở cột đó. */
  truoc: number;
  sau: number;
};

export type KeHoachBaoCaoTon = {
  buToan: ButToanBaoCao[];
  /** Tổng thay đổi tồn (có dấu) — tồn hiện tại cộng đúng số này. */
  tongDoi: number;
  hienTaiMoi: number;
  /** App đã khớp báo cáo sẵn (không ghi gì). */
  khop: boolean;
};

const SAI_SO = 0.0005;
const lam = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Math.abs(r) < 1e-9 ? 0 : r;
};

/**
 * Những dòng phải ghi để số của app trong quý khớp báo cáo của một loại sơn (xem
 * đầu tệp). `ht` = số liệu thô của app quanh quý (lib/tonSon.ts heThongQuy) — loại
 * sơn mới tạo thì mọi số bằng 0. Ba cột đầu so với bốn cột như tờ in (bỏ phần
 * chỉnh tồn cuối của lần cập nhật báo cáo không cân trước đó — nó không thuộc cột
 * nào), Tồn cuối kỳ so với tồn thật lúc hết quý: cập nhật lại đúng báo cáo đó lần
 * nữa thì không ghi gì.
 */
export function keHoachBaoCaoTon(bao: SoBaoCaoTon & { tonCuoi: number }, ht: HeThongQuy): KeHoachBaoCaoTon {
  const buToan: ButToanBaoCao[] = [];
  const app = bonCotQuy(ht, false);
  let cuoi = ht.cuoiKy;
  if (bao.tonDau !== null && Math.abs(bao.tonDau - app.tonDau) > SAI_SO) {
    const d = lam(bao.tonDau - app.tonDau);
    buToan.push({ loai: "DIEU_CHINH", so: d, luc: "DAU_KY", cot: "tonDau", truoc: app.tonDau, sau: bao.tonDau });
    cuoi += d;
  }
  if (bao.nhan !== null) {
    const d = lam(bao.nhan - app.nhan);
    if (d > SAI_SO) buToan.push({ loai: "NHAN", so: d, luc: "CUOI_KY", cot: "nhan", truoc: app.nhan, sau: bao.nhan });
    else if (d < -SAI_SO) buToan.push({ loai: "DIEU_CHINH", so: d, luc: "CUOI_KY", cot: "nhan", truoc: app.nhan, sau: bao.nhan });
    if (Math.abs(d) > SAI_SO) cuoi += d;
  }
  if (bao.tieuThu !== null) {
    const d = lam(bao.tieuThu - app.tieuThu);
    if (d > SAI_SO) buToan.push({ loai: "TIEU_THU", so: d, luc: "CUOI_KY", cot: "tieuThu", truoc: app.tieuThu, sau: bao.tieuThu });
    else if (d < -SAI_SO) buToan.push({ loai: "DIEU_CHINH", so: -d, luc: "CUOI_KY", cot: "tieuThu", truoc: app.tieuThu, sau: bao.tieuThu });
    if (Math.abs(d) > SAI_SO) cuoi -= d;
  }
  const f = lam(bao.tonCuoi - lam(cuoi));
  if (Math.abs(f) > SAI_SO) {
    // Ô Tiêu thụ để trống: phần thiếu so với app là sơn đã dùng (cách tàu vẫn tính).
    if (bao.tieuThu === null && f < 0) buToan.push({ loai: "TIEU_THU", so: -f, luc: "CUOI_KY", cot: "tonCuoi", truoc: lam(cuoi), sau: bao.tonCuoi });
    else buToan.push({ loai: "DIEU_CHINH", so: f, luc: "CUOI_KY", cot: "tonCuoi", truoc: lam(cuoi), sau: bao.tonCuoi });
  }
  const tongDoi = lam(buToan.reduce((s, b) => s + (b.loai === "TIEU_THU" ? -b.so : b.so), 0));
  return { buToan, tongDoi, hienTaiMoi: lam(ht.hienTai + tongDoi), khop: buToan.length === 0 };
}

/**
 * Cột lưu kèm dòng ghi (PaintTransaction.cotBaoCao) — cột tờ in quý xếp dòng đó vào:
 * dòng nhập về Nhận, dòng xuất dùng về Tiêu thụ (kể cả tiêu thụ tính theo tồn cuối),
 * dòng điều chỉnh về đúng cột nó sửa.
 */
export const cotGhiButToan = (b: ButToanBaoCao): ButToanBaoCao["cot"] => (b.loai === "NHAN" ? "nhan" : b.loai === "TIEU_THU" ? "tieuThu" : b.cot);

/** Ghi chú của dòng nhập / xuất / điều chỉnh do báo cáo sinh ra (lưu vào lịch sử, tiếng Việt như mọi ghi chú). */
export function ghiChuButToan(b: ButToanBaoCao, ky: KyQuy): string {
  const q = `quý ${tenKy(ky)} theo báo cáo tồn MLS-11-14`;
  const so = (n: number) => soIn(n);
  switch (b.cot) {
    case "tonDau":
      return `Tồn đầu ${q}: ${so(b.truoc)} → ${so(b.sau)}`;
    case "nhan":
      return b.loai === "NHAN" ? `Nhận trong ${q} (đã ghi ${so(b.truoc)}, báo cáo ${so(b.sau)})` : `Sửa số nhận ${q} (đã ghi ${so(b.truoc)}, báo cáo ${so(b.sau)})`;
    case "tieuThu":
      return b.loai === "TIEU_THU" ? `Tiêu thụ ${q} (đã ghi ${so(b.truoc)}, báo cáo ${so(b.sau)})` : `Sửa số tiêu thụ ${q} (đã ghi ${so(b.truoc)}, báo cáo ${so(b.sau)})`;
    case "tonCuoi":
      return b.loai === "TIEU_THU" ? `Tiêu thụ ${q}, tính theo tồn cuối kỳ (app ${so(b.truoc)}, báo cáo ${so(b.sau)})` : `Tồn cuối ${q}: ${so(b.truoc)} → ${so(b.sau)}`;
  }
}
