/**
 * NHẬP DỤNG CỤ CHẰNG BUỘC TỪ FILE MLS-11-13 — phần thuần (không database / file):
 * đọc bảng 10 cột của biểu mẫu từ các hàng ô (Word / Excel / lớp chữ PDF, hoặc
 * kết quả bộ đọc AI), đọc dòng "Ship's Name / Port / Date", ghép dòng với danh
 * mục dụng cụ đã có của tàu. Kiểm ở scripts/kiem-tra-chang-buoc-nhap.ts.
 *
 * Bảng của mẫu: Stt | Dụng cụ chằng buộc | Ký hiệu (Part No. / Mark) |
 *   (1) SL tối thiểu | (2) Trang bị chuẩn | (3) Còn sử dụng được | (4) Bị hỏng |
 *   (5)=(3+4) Toàn bộ | (6)=(1-3) SL thiếu tối thiểu | (7) Yêu cầu.
 * Năm tiêu đề cột trải trên 4–5 hàng (ô gộp), hàng cuối đánh số 1..7 — hàng đánh
 * số đó là mốc chắc nhất để biết cột nào là cột nào.
 */
import { docSo } from "@/lib/docSo";

export type DongChangBuocNhap = {
  ten: string;
  kyHieu: string | null;
  /** (1) SL tối thiểu khi chở đầy. */
  toiThieu: number | null;
  /** (2) Trang bị chuẩn. */
  chuan: number | null;
  /** (3) Còn sử dụng được. */
  conDung: number | null;
  /** (4) Bị hỏng. */
  hong: number | null;
  /** (7) Yêu cầu cấp. */
  yeuCau: number | null;
  canhBao: string | null;
  trang: number | null;
  /** Người soát bỏ dòng này (không áp dụng). */
  boQua: boolean;
};

export type DauChangBuoc = { tenTau: string | null; cang: string | null; ngay: string | null };

export const DUOI_CHANG_BUOC = [".docx", ".doc", ".xlsx", ".xls", ".pdf"] as const;
export const TOI_DA_DONG_CHANG_BUOC = 300;
/** Ai nhập dụng cụ chằng buộc từ file: quản trị (danh mục dụng cụ do quản trị quản lý). */
export const NHAP_CHANG_BUOC: readonly string[] = ["ADMIN"];

const sach = (s: unknown) => String(s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const chuanKhop = (s: string | null | undefined) => (s ?? "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const themCanhBao = (cu: string | null, moi: string) => (cu ? `${cu}; ${moi}` : moi);

/** Ô số: trống → null, "-" / "—" → 0, số kiểu VN / quốc tế. */
export function soO(v: unknown): number | null {
  const s = sach(v);
  if (!s) return null;
  if (/^[-–—]+$/.test(s)) return 0;
  const t = s.replace(/[^\d.,-]/g, "");
  if (!t || !/\d/.test(t)) return null;
  const n = docSo(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ─── Đầu biểu mẫu ────────────────────────────────────────────────────────────

const RE_TAU = /(?:ship\s*['’`]?\s*s\s*name|tên\s*tàu|vessel)\s*(?:\(\s*tên\s*tàu\s*\))?\s*[:：]?\s*([^\t\n]*?)\s*(?=port\b|\(?\s*cảng|date\b|\(?\s*ngày|\t|$)/i;
const RE_CANG = /(?:port|cảng)\s*(?:\(\s*cảng\s*\))?\s*[:：]?\s*([^\t\n]*?)\s*(?=date\b|\(?\s*ngày|\t|$)/i;
const RE_NGAY = /(?:date|ngày)\s*(?:\(\s*ngày\s*\))?\s*[:：]?\s*(\d{1,2}\s*[/.\-]\s*\d{1,2}\s*[/.\-]\s*\d{2,4})/i;

const boChamCho = (s: string | undefined) => {
  const v = sach((s ?? "").replace(/^[\s:：()]+/, "").replace(/[.\s…]+$/g, "").replace(/^[.\s…]+/, ""));
  return v && !/^[.\s…/]+$/.test(v) ? v.slice(0, 120) : null;
};

/** Đọc "Ship's Name (Tên tàu): X   Port (Cảng): Y   Date (Ngày): dd/mm/yyyy" từ chữ đầu biểu mẫu. */
export function dauChangBuoc(chu: string): DauChangBuoc {
  const dong = chu.split(/\r?\n/).find((l) => /ship\s*['’`]?\s*s\s*name|tên\s*tàu/i.test(l)) ?? chu;
  const ngayTho = dong.match(RE_NGAY)?.[1]?.replace(/\s+/g, "") ?? null;
  return {
    tenTau: boChamCho(dong.match(RE_TAU)?.[1]),
    cang: boChamCho(dong.match(RE_CANG)?.[1]),
    ngay: ngayTho ? chuanNgay(ngayTho) : null,
  };
}

/** "5/9/26" → "05/09/2026"; sai → null. */
export function chuanNgay(s: string): string | null {
  const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(s.trim());
  if (!m) return null;
  const nam = m[3].length === 2 ? `20${m[3]}` : m[3];
  const d = Number(m[1]);
  const t = Number(m[2]);
  if (d < 1 || d > 31 || t < 1 || t > 12) return null;
  return `${String(d).padStart(2, "0")}/${String(t).padStart(2, "0")}/${nam}`;
}

/** "dd/mm/yyyy" → Date (12:00 giờ máy); sai → null. */
export function ngayTuDdMm(s: string | null | undefined): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12);
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

// ─── Bảng ────────────────────────────────────────────────────────────────────

type CotChangBuoc = { stt: number; ten: number; kyHieu: number; toiThieu: number; chuan: number; conDung: number; hong: number; tong: number; thieu: number; yeuCau: number };

const RE_KY_TEN = /fitting|gear|dụng\s*cụ|chằng|description|tên\s*(dụng|hàng)/i;
const RE_KY_KY_HIEU = /part|mark|ký\s*hiệu|ky\s*hieu|code/i;
const RE_KY_STT = /stt|^no\.?$|^no\.?\s/i;
/** Dòng chữ ký cuối biểu mẫu — gặp là thôi đọc. */
const RE_CHU_KY = /người\s*kiểm\s*kê|inventory\s*name|chief\s*officer|đại\s*phó|captain|thuyền\s*trưởng|master'?s?\s*sign/i;
/** Ô tên chỉ là chữ tiêu đề lặp lại (bảng tiếp trang sau). */
const RE_LA_TIEU_DE = /^(type\s*of\s*fitting|dụng\s*cụ\s*chằng|part\s*no|ký\s*hiệu|minimum|standard|in\s*order|out\s*of|total|short\s*of|order|stt|no\.?)\b/i;

/** Hàng đánh số "1 | 2 | 3 | 4 | 5=(3+4) | 6=(1-3) | 7" → vị trí 7 cột số. */
function timHangDanhSo(rows: string[][]): { hang: number; cot: number[] } | null {
  const mau = [/^1$/, /^2$/, /^3$/, /^4$/, /^5\b|^5=|^\(?5\)?$/, /^6\b|^6=|^\(?6\)?$/, /^7$|^\(?7\)?$/];
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const o = rows[r].map((x) => sach(x).replace(/\s+/g, ""));
    const cot: number[] = [];
    let tu = 0;
    for (const re of mau) {
      const j = o.findIndex((x, k) => k >= tu && re.test(x));
      if (j < 0) break;
      cot.push(j);
      tu = j + 1;
    }
    if (cot.length >= 4) return { hang: r, cot };
  }
  return null;
}

/** Chữ tiêu đề gộp theo cột (nối các hàng tiêu đề) — tiêu đề MLS-11-13 trải trên nhiều hàng. */
function chuTheoCot(rows: string[][], tu: number, den: number): string[] {
  const rong = Math.max(0, ...rows.slice(tu, den + 1).map((r) => r.length));
  return Array.from({ length: rong }, (_, c) =>
    rows
      .slice(tu, den + 1)
      .map((r) => sach(r[c]))
      .filter(Boolean)
      .join(" ")
  );
}

function timCotChu(rows: string[][]): { hangDau: number; cot: CotChangBuoc } | null {
  // 1) Hàng đánh số của mẫu.
  const ds = timHangDanhSo(rows);
  if (ds) {
    const tren = Math.max(0, ds.hang - 6);
    const chu = chuTheoCot(rows, tren, ds.hang);
    const truocSo = ds.cot[0];
    const tim = (re: RegExp, khac: number[]) => chu.findIndex((s, i) => i < truocSo && !khac.includes(i) && re.test(s));
    let stt = tim(RE_KY_STT, []);
    let ten = tim(RE_KY_TEN, [stt]);
    let kyHieu = tim(RE_KY_KY_HIEU, [stt, ten]);
    // Không đọc được chữ tiêu đề: theo vị trí của mẫu (Stt, Tên, Ký hiệu đứng trước cột số).
    if (ten < 0) ten = truocSo >= 2 ? truocSo - 2 : truocSo - 1;
    if (kyHieu < 0 && truocSo - 1 > ten) kyHieu = truocSo - 1;
    if (stt < 0 && ten > 0) stt = ten - 1;
    const [toiThieu, chuan, conDung, hong, tong = -1, thieu = -1, yeuCau = -1] = ds.cot;
    return { hangDau: ds.hang + 1, cot: { stt, ten, kyHieu, toiThieu, chuan, conDung, hong, tong, thieu, yeuCau } };
  }
  // 2) Theo chữ tiêu đề (bảng tự lập, không có hàng đánh số).
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const hang = rows[r].map(sach);
    if (!hang.some((x) => RE_KY_TEN.test(x)) || !hang.some((x) => /minimum|tối\s*thiểu|standard|chuẩn|in\s*order|còn/i.test(x))) continue;
    const den = Math.min(rows.length - 1, r + 4);
    // Chỉ gộp các hàng tiêu đề: dừng ở hàng đầu tiên có tên dụng cụ + số.
    let cuoi = r;
    for (let k = r + 1; k <= den; k++) {
      const o = rows[k].map(sach);
      if (o.some((x) => soO(x) !== null && /\d/.test(x)) && o.filter((x) => x && soO(x) === null).length >= 1 && !o.some((x) => RE_KY_TEN.test(x) || /order|hỏng|chuẩn/i.test(x))) break;
      cuoi = k;
    }
    const chu = chuTheoCot(rows, r, cuoi);
    const dung: number[] = [];
    const tim = (re: RegExp) => {
      const i = chu.findIndex((s, j) => !dung.includes(j) && re.test(s));
      if (i >= 0) dung.push(i);
      return i;
    };
    // Thứ tự quan trọng: "Short of Minimum Qtty / SL thiếu tối thiểu" có chữ
    // "tối thiểu"; "Out of Order" và "In Order" có chữ "order".
    const thieu = tim(/short|sl\.?\s*thiếu|thiếu\s*tối/i);
    const hong = tim(/out\s*of\s*order|bị\s*hỏng|hỏng/i);
    const conDung = tim(/in\s*order|còn\s*sử|dụng\s*được/i);
    const tong = tim(/total|toàn\s*bộ/i);
    const yeuCau = tim(/yêu\s*cầu|^order\b|\border$/i);
    const toiThieu = tim(/minimum|\bmin\b\.?|tối\s*thiểu/i);
    const chuan = tim(/standard|chuẩn|out-?\s*fitting|trang\s*bị/i);
    const stt = tim(RE_KY_STT);
    const ten = tim(RE_KY_TEN);
    const kyHieu = tim(RE_KY_KY_HIEU);
    if (ten < 0 || [toiThieu, chuan, conDung, hong].every((x) => x < 0)) continue;
    return { hangDau: cuoi + 1, cot: { stt, ten, kyHieu, toiThieu, chuan, conDung, hong, tong, thieu, yeuCau } };
  }
  // 3) Đúng khuôn 10 cột của mẫu, không có tiêu đề nhận được (VD lớp chữ PDF).
  const muoiCot = rows.filter((r) => r.length >= 10 && /^\d+$/.test(sach(r[0])) && sach(r[1]).length >= 2);
  if (muoiCot.length) {
    return { hangDau: 0, cot: { stt: 0, ten: 1, kyHieu: 2, toiThieu: 3, chuan: 4, conDung: 5, hong: 6, tong: 7, thieu: 8, yeuCau: 9 } };
  }
  return null;
}

/** Cảnh báo đối chiếu các cột suy ra của mẫu: (5) = (3)+(4), (6) = (1)−(3) khi thiếu. */
function doiChieu(d: Pick<DongChangBuocNhap, "toiThieu" | "conDung" | "hong">, tong: number | null, thieu: number | null): string | null {
  let cb: string | null = null;
  if (tong !== null && d.conDung !== null && d.hong !== null && Math.abs(tong - (d.conDung + d.hong)) > 0.001) {
    cb = themCanhBao(cb, `Cột toàn bộ (${tong}) khác còn dùng + hỏng (${d.conDung + d.hong})`);
  }
  if (thieu !== null && thieu > 0 && d.toiThieu !== null && d.conDung !== null && Math.abs(thieu - Math.max(0, d.toiThieu - d.conDung)) > 0.001) {
    cb = themCanhBao(cb, `Cột SL thiếu (${thieu}) khác tối thiểu − còn dùng (${Math.max(0, d.toiThieu - d.conDung)})`);
  }
  return cb;
}

/**
 * Đọc dòng dụng cụ từ các hàng ô của biểu mẫu MLS-11-13. Dòng trống của mẫu
 * (chỉ có số thứ tự) bị bỏ; gặp dòng chữ ký thì dừng.
 */
export function dongTuLuoiChangBuoc(rowsVao: unknown[][]): { dong: DongChangBuocNhap[]; boQua: number } | { loi: string } {
  const rows = rowsVao.map((r) => (Array.isArray(r) ? r : []).map(sach));
  const tc = timCotChu(rows);
  if (!tc) return { loi: "Không tìm thấy bảng dụng cụ chằng buộc theo mẫu MLS-11-13 (cần cột Dụng cụ chằng buộc / Type of fitting gear và các cột số lượng)." };
  const { hangDau, cot } = tc;
  const lay = (o: string[], c: number) => (c >= 0 ? (o[c] ?? "") : "");
  const dong: DongChangBuocNhap[] = [];
  let boQua = 0;
  for (let r = hangDau; r < rows.length && dong.length < TOI_DA_DONG_CHANG_BUOC; r++) {
    const o = rows[r];
    if (!o.some((x) => x)) continue;
    if (RE_CHU_KY.test(o.join(" "))) break;
    const ten = lay(o, cot.ten);
    const so = {
      toiThieu: soO(lay(o, cot.toiThieu)),
      chuan: soO(lay(o, cot.chuan)),
      conDung: soO(lay(o, cot.conDung)),
      hong: soO(lay(o, cot.hong)),
      yeuCau: soO(lay(o, cot.yeuCau)),
    };
    if (!ten || ten.length < 2 || /^\d+([.,]\d+)?$/.test(ten) || RE_LA_TIEU_DE.test(ten)) {
      // Dòng trống của mẫu (chỉ có Stt) không tính là bỏ qua.
      if (ten || Object.values(so).some((x) => x !== null)) boQua++;
      continue;
    }
    const kyHieu = lay(o, cot.kyHieu).slice(0, 80) || null;
    dong.push({
      ten: ten.slice(0, 200),
      kyHieu,
      ...so,
      canhBao: doiChieu(so, soO(lay(o, cot.tong)), soO(lay(o, cot.thieu))),
      trang: null,
      boQua: false,
    });
  }
  if (!dong.length) return { loi: "Tìm thấy bảng MLS-11-13 nhưng chưa có dòng dụng cụ nào được điền (mẫu trống)." };
  return { dong, boQua };
}

/**
 * Lớp chữ PDF: mỗi dòng "Stt  Tên  [Ký hiệu]  số…" — cột trống biến mất nên chỉ
 * đoán được thứ tự số; mọi dòng gắn cảnh báo để người soát đối chiếu bản gốc.
 */
export function dongTuChuPdfChangBuoc(chu: string): DongChangBuocNhap[] {
  const ra: DongChangBuocNhap[] = [];
  for (const l of chu.split(/\r?\n/)) {
    const line = sach(l);
    if (RE_CHU_KY.test(line)) break;
    const m = /^(\d{1,3})[.)]?\s+(.+)$/.exec(line);
    if (!m) continue;
    const tok = m[2].split(" ");
    const so: (number | null)[] = [];
    while (tok.length > 1) {
      const cuoi = tok[tok.length - 1];
      if (!/^(\d+([.,]\d+)?|[-–—])$/.test(cuoi)) break;
      so.unshift(soO(tok.pop()));
    }
    const ten = tok.join(" ");
    if (ten.length < 2 || !so.length || RE_LA_TIEU_DE.test(ten)) continue;
    const [toiThieu = null, chuan = null, conDung = null, hong = null, , , yeuCau = null] = so;
    ra.push({
      ten: ten.slice(0, 200),
      kyHieu: null,
      toiThieu,
      chuan,
      conDung,
      hong,
      yeuCau,
      canhBao: "Đọc từ lớp chữ PDF: cột trống không giữ được vị trí — đối chiếu số với bản gốc, ký hiệu có thể lẫn trong tên",
      trang: null,
      boQua: false,
    });
    if (ra.length >= TOI_DA_DONG_CHANG_BUOC) break;
  }
  return ra;
}

/** Dòng từ bộ đọc AI (chế độ "changBuoc"): tên, ký hiệu (partNo), năm cột số trong `cb`. */
export function dongTuAiChangBuoc(
  dong: {
    ten: string;
    partNo: string | null;
    impa: string | null;
    trang: number | null;
    canhBao: string | null;
    cb?: { toiThieu: number | null; chuan: number | null; conDung: number | null; hong: number | null; tong: number | null; thieu: number | null; yeuCau: number | null };
  }[]
): DongChangBuocNhap[] {
  return dong.slice(0, TOI_DA_DONG_CHANG_BUOC).map((d) => {
    const cb = d.cb ?? { toiThieu: null, chuan: null, conDung: null, hong: null, tong: null, thieu: null, yeuCau: null };
    const so = { toiThieu: cb.toiThieu, chuan: cb.chuan, conDung: cb.conDung, hong: cb.hong, yeuCau: cb.yeuCau };
    const dc = doiChieu(so, cb.tong, cb.thieu);
    return {
      ten: d.ten.slice(0, 200),
      kyHieu: (d.partNo ?? d.impa)?.slice(0, 80) ?? null,
      ...so,
      canhBao: dc ? themCanhBao(d.canhBao, dc) : d.canhBao,
      trang: d.trang,
      boQua: false,
    };
  });
}

/** Đọc dòng từ cột JSON (bỏ phần tử hỏng). */
export function docDongChangBuoc(v: unknown): DongChangBuocNhap[] {
  if (!Array.isArray(v)) return [];
  const sn = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null);
  const ra: DongChangBuocNhap[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const d = x as Partial<DongChangBuocNhap>;
    if (typeof d.ten !== "string" || !d.ten.trim()) continue;
    ra.push({
      ten: d.ten,
      kyHieu: typeof d.kyHieu === "string" && d.kyHieu ? d.kyHieu : null,
      toiThieu: sn(d.toiThieu),
      chuan: sn(d.chuan),
      conDung: sn(d.conDung),
      hong: sn(d.hong),
      yeuCau: sn(d.yeuCau),
      canhBao: typeof d.canhBao === "string" && d.canhBao ? d.canhBao : null,
      trang: typeof d.trang === "number" ? d.trang : null,
      boQua: d.boQua === true,
    });
  }
  return ra;
}

/** Kiểm & chuẩn hóa dòng người dùng sửa trên trang soát (mọi ô là chữ). Số sai → báo đúng dòng. */
export function sachDongChangBuocNhap(v: unknown): { ok: true; dong: DongChangBuocNhap[] } | { ok: false; n: number } {
  if (!Array.isArray(v)) return { ok: true, dong: [] };
  const ra: DongChangBuocNhap[] = [];
  for (let i = 0; i < Math.min(v.length, TOI_DA_DONG_CHANG_BUOC); i++) {
    const d = (v[i] ?? {}) as Record<string, unknown>;
    const ten = sach(d.ten).slice(0, 200);
    if (!ten) continue;
    const so: Record<"toiThieu" | "chuan" | "conDung" | "hong" | "yeuCau", number | null> = { toiThieu: null, chuan: null, conDung: null, hong: null, yeuCau: null };
    for (const k of Object.keys(so) as (keyof typeof so)[]) {
      const s = sach(d[k]);
      if (!s) continue;
      const n = soO(s);
      if (n === null) return { ok: false, n: i + 1 };
      so[k] = n;
    }
    ra.push({
      ten,
      kyHieu: sach(d.kyHieu).slice(0, 80) || null,
      ...so,
      canhBao: sach(d.canhBao).slice(0, 400) || null,
      trang: typeof d.trang === "number" ? d.trang : null,
      boQua: d.boQua === true,
    });
  }
  return { ok: true, dong: ra };
}

// ─── Ghép với danh mục dụng cụ của tàu ───────────────────────────────────────

export type GearCo = { id: number; name: string; partNo: string | null; minQty: number; standardQty: number };

export type GhepChangBuoc = {
  /** MOI: thêm vào danh mục · CAP_NHAT: đổi ký hiệu / số · GIONG: đã có, không đổi · TRUNG: trùng dòng trên · BO_QUA. */
  trangThai: "MOI" | "CAP_NHAT" | "GIONG" | "TRUNG" | "BO_QUA";
  gearId: number | null;
  gearName: string | null;
  /** Đổi gì (để hiện cho người soát): "ký hiệu", "tối thiểu 10 → 12"... */
  thayDoi: string[];
};

/**
 * Ghép từng dòng với dụng cụ ĐÃ CÓ của tàu: theo tên (bỏ dấu câu, không phân
 * biệt hoa thường), rồi theo ký hiệu. Mỗi dụng cụ chỉ ghép một lần; hai dòng
 * cùng tên trong file → dòng sau là TRUNG (tên dụng cụ là duy nhất trong tàu).
 * capNhatSo = false thì chỉ thêm mới / bổ sung ký hiệu, không đổi số tối thiểu, chuẩn.
 */
export function ghepChangBuoc(dong: DongChangBuocNhap[], gears: GearCo[], capNhatSo: boolean): GhepChangBuoc[] {
  const daDung = new Set<number>();
  const tenMoi = new Set<string>();
  return dong.map((d) => {
    if (d.boQua) return { trangThai: "BO_QUA", gearId: null, gearName: null, thayDoi: [] };
    const ten = chuanKhop(d.ten);
    const ky = chuanKhop(d.kyHieu);
    const g =
      gears.find((x) => !daDung.has(x.id) && chuanKhop(x.name) === ten) ??
      (ky.length >= 2 ? gears.find((x) => !daDung.has(x.id) && chuanKhop(x.partNo) === ky) : undefined);
    if (!g) {
      if (tenMoi.has(ten) || gears.some((x) => chuanKhop(x.name) === ten)) return { trangThai: "TRUNG", gearId: null, gearName: null, thayDoi: [] };
      tenMoi.add(ten);
      return { trangThai: "MOI", gearId: null, gearName: null, thayDoi: [] };
    }
    daDung.add(g.id);
    const thayDoi: string[] = [];
    if (d.kyHieu && chuanKhop(d.kyHieu) !== chuanKhop(g.partNo)) thayDoi.push(`ký hiệu ${g.partNo ?? "—"} → ${d.kyHieu}`);
    if (capNhatSo && d.toiThieu !== null && d.toiThieu !== g.minQty) thayDoi.push(`tối thiểu ${g.minQty} → ${d.toiThieu}`);
    if (capNhatSo && d.chuan !== null && d.chuan !== g.standardQty) thayDoi.push(`chuẩn ${g.standardQty} → ${d.chuan}`);
    return { trangThai: thayDoi.length ? "CAP_NHAT" : "GIONG", gearId: g.id, gearName: g.name, thayDoi };
  });
}

/** Dòng nào có số còn dùng / hỏng — đủ để lưu thành một báo cáo MLS-11-13. */
export const coSoBaoCao = (d: DongChangBuocNhap) => !d.boQua && (d.conDung !== null || d.hong !== null);
