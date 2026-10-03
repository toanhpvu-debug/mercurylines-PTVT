/*
 * SỬA / GỠ SƠN ĐÃ NHẬP và BẢN IN BÁO CÁO LƯỢNG SƠN TỒN THEO MẪU MLS-11-14 —
 * phần thuần (không database): dùng chung cho trang in (client), trang server,
 * server action và script kiểm thử.
 *
 * Bản in là tờ "BÁO CÁO LƯỢNG SƠN TỒN / PAINT INVENTORY" MLS-11-14 của công ty
 * (bản Word "MLS-11-14 BC LUONG SON TON"): báo cáo HÀNG QUÝ, chân trang ghi
 * "Người làm báo cáo: CE, CO · Thời điểm làm báo cáo: Hàng quý". Mỗi loại sơn
 * một dòng: Tồn đầu kỳ · Nhận · Tiêu thụ trong kỳ · Tồn cuối kỳ, tính từ lịch
 * sử nhập / xuất của tàu (tinhTonQuy).
 *
 * Người lập hay phải chỉnh tay trước khi ký (bỏ dòng không báo, sửa tên, sửa
 * số, thêm dòng ngoài sổ). Chỉnh đó KHÔNG đổi số liệu hệ thống: nó là một "bản
 * sửa" cất ở trình duyệt theo tàu + quý, chỉ ghi những ô người dùng đổi — áp lên
 * số liệu mới nhất mỗi lần mở, nên sơn nhập / xuất sau đó vẫn hiện đúng ở những
 * ô không sửa tay.
 */

export type CotDongSon = "moTa" | "donVi" | "tonDau" | "nhan" | "tieuThu" | "tonCuoi";
export type CotDauSon = "tenTau" | "quy" | "nam";

export const COT_DONG_SON: readonly CotDongSon[] = ["moTa", "donVi", "tonDau", "nhan", "tieuThu", "tonCuoi"];
export const COT_DAU_SON: readonly CotDauSon[] = ["tenTau", "quy", "nam"];
/** Bốn cột số của tờ in (Tồn đầu kỳ + Nhận − Tiêu thụ = Tồn cuối kỳ). */
export const COT_SO_SON: readonly CotDongSon[] = ["tonDau", "nhan", "tieuThu", "tonCuoi"];

/** Một dòng trên tờ in — mọi ô là chuỗi để người dùng gõ tự do. */
export type DongBaoCaoSon = Record<CotDongSon, string> & { id: string };

export type DauBaoCaoSon = Record<CotDauSon, string>;

/** Những chỗ người dùng đã sửa tay trên bản in (cất trong localStorage theo tàu + quý). */
export type BanSuaBaoCaoSon = {
  v: 2;
  dau: Partial<DauBaoCaoSon>;
  /** id dòng gốc → các ô đã sửa. */
  sua: Record<string, Partial<Record<CotDongSon, string>>>;
  /** id dòng gốc đã bỏ khỏi bản in. */
  bo: string[];
  /** Dòng thêm tay (id "them-…"). */
  them: DongBaoCaoSon[];
  /** Thứ tự dòng nếu người dùng đã đổi; null = theo số liệu. */
  thuTu: string[] | null;
};

export const banSuaRong = (): BanSuaBaoCaoSon => ({ v: 2, dau: {}, sua: {}, bo: [], them: [], thuTu: null });

/** Dòng thêm tay trống. */
export const dongTrongBaoCao = (id: string): DongBaoCaoSon => ({ id, moTa: "", donVi: "", tonDau: "", nhan: "", tieuThu: "", tonCuoi: "" });

const chuoi = (x: unknown, max = 300) => (typeof x === "string" ? x.slice(0, max) : "");

/** Đọc bản sửa từ localStorage — dữ liệu hỏng hay của phiên bản khác thì bỏ (dùng số liệu gốc). */
export function docBanSua(raw: unknown): BanSuaBaoCaoSon | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 2) return null;
  const ban = banSuaRong();
  if (r.dau && typeof r.dau === "object") {
    for (const k of COT_DAU_SON) {
      const v = (r.dau as Record<string, unknown>)[k];
      if (typeof v === "string") ban.dau[k] = chuoi(v);
    }
  }
  if (r.sua && typeof r.sua === "object") {
    for (const [id, o] of Object.entries(r.sua as Record<string, unknown>)) {
      if (!o || typeof o !== "object") continue;
      const sua: Partial<Record<CotDongSon, string>> = {};
      for (const k of COT_DONG_SON) {
        const v = (o as Record<string, unknown>)[k];
        if (typeof v === "string") sua[k] = chuoi(v);
      }
      if (Object.keys(sua).length) ban.sua[id.slice(0, 40)] = sua;
    }
  }
  if (Array.isArray(r.bo)) ban.bo = r.bo.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 40));
  if (Array.isArray(r.them)) {
    for (const d of r.them) {
      if (!d || typeof d !== "object") continue;
      const o = d as Record<string, unknown>;
      if (typeof o.id !== "string" || !o.id.startsWith("them-")) continue;
      const dong = dongTrongBaoCao(o.id.slice(0, 40));
      for (const k of COT_DONG_SON) dong[k] = chuoi(o[k]);
      ban.them.push(dong);
    }
  }
  if (Array.isArray(r.thuTu)) ban.thuTu = r.thuTu.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 40));
  return ban;
}

/** Dòng + đầu phiếu sẽ in: số liệu gốc mới nhất, áp những chỗ đã sửa tay. */
export function apDungBanSua(
  goc: { dau: DauBaoCaoSon; dong: DongBaoCaoSon[] },
  ban: BanSuaBaoCaoSon
): { dau: DauBaoCaoSon; dong: DongBaoCaoSon[] } {
  const bo = new Set(ban.bo);
  const dong = [
    ...goc.dong.filter((d) => !bo.has(d.id)).map((d) => ({ ...d, ...(ban.sua[d.id] ?? {}) })),
    ...ban.them,
  ];
  let xep = dong;
  if (ban.thuTu) {
    const viTri = new Map(ban.thuTu.map((id, i) => [id, i]));
    // Dòng có trong thứ tự đã xếp đứng trước theo đúng thứ tự đó; dòng mới phát
    // sinh sau lần xếp (vừa nhập thêm sơn) nối vào cuối theo thứ tự số liệu.
    xep = [
      ...dong.filter((d) => viTri.has(d.id)).sort((a, b) => viTri.get(a.id)! - viTri.get(b.id)!),
      ...dong.filter((d) => !viTri.has(d.id)),
    ];
  }
  return { dau: { ...goc.dau, ...ban.dau }, dong: xep };
}

/** Số chỗ bản in khác số liệu gốc (để nói rõ trên màn hình bản này đã sửa tay). */
export function demChoKhac(goc: { dau: DauBaoCaoSon; dong: DongBaoCaoSon[] }, ban: BanSuaBaoCaoSon): number {
  const coGoc = new Set(goc.dong.map((d) => d.id));
  let n = 0;
  for (const k of COT_DAU_SON) if (ban.dau[k] !== undefined && ban.dau[k] !== goc.dau[k]) n++;
  for (const [id, sua] of Object.entries(ban.sua)) {
    if (!coGoc.has(id) || ban.bo.includes(id)) continue;
    const d = goc.dong.find((x) => x.id === id)!;
    for (const k of COT_DONG_SON) if (sua[k] !== undefined && sua[k] !== d[k]) n++;
  }
  n += ban.bo.filter((id) => coGoc.has(id)).length;
  n += ban.them.length;
  if (ban.thuTu) {
    const tuNhien = apDungBanSua(goc, { ...ban, thuTu: null }).dong.map((d) => d.id);
    const daXep = apDungBanSua(goc, ban).dong.map((d) => d.id);
    if (tuNhien.join("|") !== daXep.join("|")) n++;
  }
  return n;
}

/** Bỏ những phần của bản sửa trỏ tới dòng không còn trong số liệu (loại sơn đã gỡ khỏi tàu). */
export function gonBanSua(goc: { dong: DongBaoCaoSon[] }, ban: BanSuaBaoCaoSon): BanSuaBaoCaoSon {
  const coGoc = new Set(goc.dong.map((d) => d.id));
  const sua: BanSuaBaoCaoSon["sua"] = {};
  for (const [id, s] of Object.entries(ban.sua)) if (coGoc.has(id)) sua[id] = s;
  const conId = new Set([...coGoc, ...ban.them.map((d) => d.id)]);
  return {
    ...ban,
    sua,
    bo: ban.bo.filter((id) => coGoc.has(id)),
    thuTu: ban.thuTu ? ban.thuTu.filter((id) => conId.has(id)) : null,
  };
}

/** Sửa một ô của dòng: dòng thêm tay sửa thẳng; dòng gốc ghi vào `sua` (gõ lại đúng số gốc là xóa chỗ sửa). */
export function suaOBanIn(
  goc: { dong: DongBaoCaoSon[] },
  ban: BanSuaBaoCaoSon,
  id: string,
  cot: CotDongSon,
  giaTri: string
): BanSuaBaoCaoSon {
  if (id.startsWith("them-")) {
    return { ...ban, them: ban.them.map((d) => (d.id === id ? { ...d, [cot]: giaTri } : d)) };
  }
  const d = goc.dong.find((x) => x.id === id);
  if (!d) return ban;
  const cu = { ...(ban.sua[id] ?? {}) };
  if (giaTri === d[cot]) delete cu[cot];
  else cu[cot] = giaTri;
  const sua = { ...ban.sua };
  if (Object.keys(cu).length) sua[id] = cu;
  else delete sua[id];
  return { ...ban, sua };
}

/** Sửa một ô của đầu phiếu (gõ lại đúng giá trị gốc là xóa chỗ sửa). */
export function suaDauBanIn(goc: { dau: DauBaoCaoSon }, ban: BanSuaBaoCaoSon, cot: CotDauSon, giaTri: string): BanSuaBaoCaoSon {
  const dau = { ...ban.dau };
  if (giaTri === goc.dau[cot]) delete dau[cot];
  else dau[cot] = giaTri;
  return { ...ban, dau };
}

/** Bỏ một dòng khỏi bản in. */
export function boDongBanIn(ban: BanSuaBaoCaoSon, id: string): BanSuaBaoCaoSon {
  const thuTu = ban.thuTu ? ban.thuTu.filter((x) => x !== id) : null;
  if (id.startsWith("them-")) return { ...ban, them: ban.them.filter((d) => d.id !== id), thuTu };
  const sua = { ...ban.sua };
  delete sua[id];
  return { ...ban, sua, bo: ban.bo.includes(id) ? ban.bo : [...ban.bo, id], thuTu };
}

/** Đổi chỗ một dòng lên (-1) hoặc xuống (+1) trong bản in. */
export function doiChoDongBanIn(goc: { dau: DauBaoCaoSon; dong: DongBaoCaoSon[] }, ban: BanSuaBaoCaoSon, id: string, huong: -1 | 1): BanSuaBaoCaoSon {
  const ids = apDungBanSua(goc, ban).dong.map((d) => d.id);
  const i = ids.indexOf(id);
  const j = i + huong;
  if (i < 0 || j < 0 || j >= ids.length) return ban;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return { ...ban, thuTu: ids };
}

/** Số lượng như trên tờ in tay: không phần nghìn thừa, dấu phẩy thập phân kiểu Việt Nam. */
export function soIn(n: number): string {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Math.round(n * 1000) / 1000);
}

/**
 * Mô tả một loại sơn trên tờ in theo cách tàu vẫn ghi trên giấy:
 * HÃNG · TÊN · MÃ MÀU · MÀU ("JOTUN HARTOP PAL 9003A WHITE"). Phần nào đã nằm
 * sẵn trong tên thì không lặp lại.
 */
export function moTaSonIn(p: {
  name: string;
  maker: string | null;
  colorCode: string | null;
  colorName: string | null;
  packSize?: number | null;
  uom?: string | null;
}): string {
  const ten = p.name.replace(/\s+/g, " ").trim();
  // Tên chuẩn của bộ nhận dạng (lib/tenSon.ts) là "… COMP A (ĐÓNG RẮN)": màu đứng
  // TRƯỚC thành phần như cách tàu ghi ("JOTAFIX PU TC RAL 3000 COMP A 18L").
  const m = /^(.*?)((?:\s+COMP\.?\s*[AB])?)((?:\s+\([^)]*\))?)$/i.exec(ten);
  const goc = m?.[1] || ten;
  const thanhPhan = (m?.[2] ?? "").trim();
  const vaiTro = (m?.[3] ?? "").trim();
  const thuong = ten.toLocaleLowerCase("vi");
  const coSan = (x: string) => thuong.includes(x.toLocaleLowerCase("vi"));
  const phan: string[] = [];
  const hang = (p.maker ?? "").trim();
  if (hang && !coSan(hang)) phan.push(hang);
  phan.push(goc);
  for (const x of [p.colorCode, p.colorName]) {
    const v = (x ?? "").trim();
    if (v && !coSan(v) && !phan.some((y) => y.toLocaleLowerCase("vi") === v.toLocaleLowerCase("vi"))) phan.push(v);
  }
  if (thanhPhan) phan.push(thanhPhan);
  if (vaiTro) phan.push(vaiTro);
  // Đơn vị là thùng / lon (PAIL, CAN…): ghi dung tích một thùng — "1 PAIL" không nói được bao nhiêu sơn.
  const dv = (p.uom ?? "").trim();
  if (p.packSize && p.packSize > 0 && dv && !/^(l|lt|ltr|lit|lít|litre|liter)s?$/i.test(dv) && !/\d\s*L\b/i.test(goc)) phan.push(`${soIn(p.packSize)}L`);
  const moTa = phan.join(" ").replace(/\s+/g, " ").trim();
  // Tên viết HOA (như tàu vẫn ghi: "JOTUN HARTOP …") thì cả dòng viết hoa cho đều.
  return /\p{Lu}/u.test(ten) && ten === ten.toLocaleUpperCase("vi") ? moTa.toLocaleUpperCase("vi") : moTa;
}

// ─── Kỳ báo cáo: quý theo giờ Việt Nam ──────────────────────────────────────

/** Việt Nam UTC+7 quanh năm (không đổi giờ mùa hè) — máy chủ Dokploy chạy giờ UTC. */
const LECH_VN_MS = 7 * 3600_000;

export type KyQuy = { nam: number; quy: 1 | 2 | 3 | 4 };
export const QUY_LA_MA = ["I", "II", "III", "IV"] as const;

/** Quý chứa thời điểm `d` theo giờ Việt Nam. */
export function quyCua(d: Date): KyQuy {
  const vn = new Date(d.getTime() + LECH_VN_MS);
  return { nam: vn.getUTCFullYear(), quy: (Math.floor(vn.getUTCMonth() / 3) + 1) as KyQuy["quy"] };
}

/** Mốc đầu (tính) và cuối (không tính) của quý: 0 giờ ngày đầu quý, giờ Việt Nam. */
export function mocQuy(k: KyQuy): { batDau: Date; ketThuc: Date } {
  return {
    batDau: new Date(Date.UTC(k.nam, (k.quy - 1) * 3, 1) - LECH_VN_MS),
    ketThuc: new Date(Date.UTC(k.nam, k.quy * 3, 1) - LECH_VN_MS),
  };
}

/** Quý / năm từ địa chỉ trang (?quy=4&nam=2026) — sai hoặc chưa tới thì lấy quý hiện tại. */
export function docKyQuy(nam: unknown, quy: unknown, bayGio: Date): KyQuy {
  const hienTai = quyCua(bayGio);
  const n = Number(Array.isArray(nam) ? nam[0] : nam);
  const q = Number(Array.isArray(quy) ? quy[0] : quy);
  if (!Number.isInteger(n) || !Number.isInteger(q) || q < 1 || q > 4 || n < 2000) return hienTai;
  if (n > hienTai.nam || (n === hienTai.nam && q > hienTai.quy)) return hienTai;
  return { nam: n, quy: q as KyQuy["quy"] };
}

// ─── Số liệu một quý ─────────────────────────────────────────────────────────

export type GiaoDichSonKy = {
  productId: number;
  type: string;
  quantity: number;
  dieuChinh: boolean;
  occurredAt: Date;
  /** Dòng do báo cáo tồn MLS-11-14 ghi: cột báo cáo mà dòng làm khớp (null = dòng thường). */
  cotBaoCao?: string | null;
};

export type SoLieuQuySon = {
  productId: number;
  tonDau: number;
  nhan: number;
  tieuThu: number;
  tonCuoi: number;
  /** Tổng các dòng ĐIỀU CHỈNH (Sửa số tồn / Gỡ khỏi danh sách) trong quý, có dấu. */
  dieuChinh: number;
  /** Phần điều chỉnh đã sửa vào cột nào để bốn cột vẫn cân. */
  dieuChinhVao: "nhan" | "tonDau" | "ca-hai" | null;
};

const lam3 = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Math.abs(r) < 1e-9 ? 0 : r;
};

/** Số liệu THÔ của một loại sơn quanh một quý (chưa gộp điều chỉnh vào cột nào). */
export type HeThongQuy = {
  /** Tồn bây giờ. */
  hienTai: number;
  /** Tồn lúc đầu quý (thật, kể cả điều chỉnh trước quý). */
  dauKy: number;
  /** Dòng NHẬP không điều chỉnh trong quý (trừ dòng báo cáo tồn ghi vào cột — xem nhanBc…). */
  nhan: number;
  /** Dòng XUẤT không điều chỉnh trong quý. */
  tieuThu: number;
  /** Tổng dòng ĐIỀU CHỈNH thường trong quý (Sửa số tồn, Gỡ khỏi danh sách), có dấu. */
  dieuChinh: number;
  /** Dòng báo cáo tồn MLS-11-14 ghi vào cột Nhận (nhập +, bớt nhận −). */
  nhanBc: number;
  /** Dòng báo cáo tồn ghi vào cột Tiêu thụ (xuất dùng +, bớt tiêu thụ −). */
  tieuThuBc: number;
  /** Dòng báo cáo tồn chỉnh Tồn cuối kỳ khi bốn số của báo cáo không cân, có dấu. */
  cuoiBc: number;
  /** Tồn lúc hết quý. */
  cuoiKy: number;
};

/**
 * Số liệu thô của MỘT loại sơn trong quý, neo vào tồn hiện tại: tồn cuối quý = tồn
 * bây giờ − (nhập − xuất) ghi từ cuối quý tới nay; tồn đầu quý = tồn cuối quý − mọi
 * phát sinh trong quý. Giao dịch trước đầu quý không cần (bỏ qua).
 */
export function heThongQuy(hienTai: number, giaoDich: readonly GiaoDichSonKy[], ky: { batDau: Date; ketThuc: Date }): HeThongQuy {
  const dau = ky.batDau.getTime();
  const cuoi = ky.ketThuc.getTime();
  let sau = 0;
  let vao = 0;
  let ra = 0;
  let dc = 0;
  let nhanBc = 0;
  let tieuThuBc = 0;
  let cuoiBc = 0;
  for (const g of giaoDich) {
    const t = g.occurredAt.getTime();
    if (t < dau) continue;
    const so = g.type === "IN" ? g.quantity : -g.quantity;
    if (t >= cuoi) sau += so;
    else if (g.cotBaoCao === "nhan") nhanBc += so;
    else if (g.cotBaoCao === "tieuThu") tieuThuBc -= so;
    else if (g.cotBaoCao === "tonCuoi") cuoiBc += so;
    else if (g.dieuChinh) dc += so;
    else if (g.type === "IN") vao += g.quantity;
    else ra += g.quantity;
  }
  const cuoiKy = lam3(hienTai - sau);
  return {
    hienTai: lam3(hienTai),
    dauKy: lam3(cuoiKy - (vao - ra + dc + nhanBc - tieuThuBc + cuoiBc)),
    nhan: lam3(vao),
    tieuThu: lam3(ra),
    dieuChinh: lam3(dc),
    nhanBc: lam3(nhanBc),
    tieuThuBc: lam3(tieuThuBc),
    cuoiBc: lam3(cuoiBc),
    cuoiKy,
  };
}

export type BonCotQuy = { tonDau: number; nhan: number; tieuThu: number; tonCuoi: number; dieuChinh: number; dieuChinhVao: SoLieuQuySon["dieuChinhVao"] };

/**
 * Bốn cột MLS-11-14 của một loại sơn từ số liệu thô (luật gộp ở tinhTonQuy):
 * dòng điều chỉnh thường sửa vào Nhận hoặc Tồn đầu kỳ; dòng báo cáo tồn ghi vào cột
 * Nhận / Tiêu thụ cộng thẳng vào cột đó — in lại ra đúng số báo cáo. `kemCuoiBc`
 * = false: bỏ phần chỉnh tồn cuối của báo cáo không cân (để so cột với báo cáo —
 * lib/baoCaoTonSon.ts keHoachBaoCaoTon; cột Tồn cuối kỳ khi đó không còn cân).
 */
export function bonCotQuy(ht: HeThongQuy, kemCuoiBc = true): BonCotQuy {
  const dc = lam3(ht.dieuChinh + (kemCuoiBc ? ht.cuoiBc : 0));
  let nhan = ht.nhan;
  let tonDau = ht.dauKy;
  let vao: SoLieuQuySon["dieuChinhVao"] = null;
  if (dc < 0) {
    const truNhan = Math.min(nhan, -dc);
    nhan = lam3(nhan - truNhan);
    tonDau = lam3(ht.dauKy + dc + truNhan);
    vao = truNhan <= 0 ? "tonDau" : truNhan < -dc ? "ca-hai" : "nhan";
  } else if (dc > 0) {
    if (nhan > 0) {
      nhan = lam3(nhan + dc);
      vao = "nhan";
    } else {
      tonDau = lam3(ht.dauKy + dc);
      vao = "tonDau";
    }
  }
  return { tonDau, nhan: lam3(nhan + ht.nhanBc), tieuThu: lam3(ht.tieuThu + ht.tieuThuBc), tonCuoi: ht.cuoiKy, dieuChinh: dc, dieuChinhVao: vao };
}

/**
 * Bốn cột MLS-11-14 của từng loại sơn trong một quý, NEO vào tồn hiện tại:
 *   Tồn cuối kỳ = tồn bây giờ − (nhập − xuất) ghi từ cuối quý tới nay;
 *   Tồn đầu kỳ  = Tồn cuối kỳ − (nhập − xuất) trong quý;
 *   Nhận        = các dòng NHẬP trong quý (phiếu giao, nhận hàng theo PO, nhập tay);
 *   Tiêu thụ    = các dòng XUẤT trong quý (thi công, xuất dùng).
 * Dòng ĐIỀU CHỈNH (Sửa số tồn / Gỡ khỏi danh sách) không phải sơn nhận, cũng
 * không phải sơn đã dùng — hộp thoại Sửa đã nói rõ "không tính là sơn đã dùng" —
 * nhưng nó làm tồn đổi, nên để tờ in cân (đầu + nhận − tiêu thụ = cuối) nó được
 * coi là SỬA SỐ:
 *   - quý có nhận loại sơn đó → sửa vào Nhận (thường là sửa số nhập nhầm từ phiếu
 *     giao); Nhận không xuống dưới 0, phần còn lại sửa vào Tồn đầu kỳ;
 *   - quý không có nhận → sửa vào Tồn đầu kỳ (sửa số mang sang từ trước).
 * Dòng do báo cáo tồn MLS-11-14 ghi (cotBaoCao) vào cột Nhận / Tiêu thụ thì nằm
 * thẳng ở cột đó (bonCotQuy) — cập nhật theo báo cáo rồi in lại ra đúng báo cáo.
 * Loại sơn có cả bốn cột bằng 0 (gỡ trước quý, chưa từng có) không trả về.
 */
export function tinhTonQuy(
  tonHienTai: ReadonlyMap<number, number>,
  giaoDich: readonly GiaoDichSonKy[],
  ky: { batDau: Date; ketThuc: Date }
): SoLieuQuySon[] {
  const theoLoai = new Map<number, GiaoDichSonKy[]>();
  for (const id of tonHienTai.keys()) theoLoai.set(id, []);
  const dauQuy = ky.batDau.getTime();
  for (const g of giaoDich) {
    if (g.occurredAt.getTime() < dauQuy) continue;
    const ds = theoLoai.get(g.productId);
    if (ds) ds.push(g);
    else theoLoai.set(g.productId, [g]);
  }
  const ra: SoLieuQuySon[] = [];
  for (const [productId, gd] of theoLoai) {
    const c = bonCotQuy(heThongQuy(tonHienTai.get(productId) ?? 0, gd, ky));
    if (c.tonDau === 0 && c.nhan === 0 && c.tieuThu === 0 && c.tonCuoi === 0) continue;
    ra.push({ productId, ...c });
  }
  return ra;
}

export type SanPhamBaoCao = {
  id: number;
  name: string;
  maker: string | null;
  colorCode: string | null;
  colorName: string | null;
  uom: string;
  packSize?: number | null;
};

/** Dòng gốc của tờ in MLS-11-14, xếp theo tên như bảng Tồn sơn. Không in mã nội bộ SON-####. */
export function dongBaoCaoQuy(soLieu: readonly SoLieuQuySon[], sanPham: readonly SanPhamBaoCao[]): DongBaoCaoSon[] {
  const theoId = new Map(sanPham.map((p) => [p.id, p]));
  return soLieu
    .flatMap((s) => {
      const p = theoId.get(s.productId);
      return p ? [{ s, p }] : [];
    })
    .sort((a, b) => a.p.name.localeCompare(b.p.name, "vi") || a.p.id - b.p.id)
    .map(({ s, p }) => ({
      id: `p${p.id}`,
      moTa: moTaSonIn(p),
      donVi: p.uom,
      tonDau: soIn(s.tonDau),
      nhan: soIn(s.nhan),
      tieuThu: soIn(s.tieuThu),
      tonCuoi: soIn(s.tonCuoi),
    }));
}

/**
 * Đọc một số trên tờ in: "1.234,5" kiểu Việt Nam như soIn in ra; gõ tay "12.5"
 * cũng nhận ("1.500" có đúng nhóm ba chữ số là một nghìn năm trăm). null nếu
 * không phải số.
 */
export function docSoBaoCao(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "");
  if (!s) return null;
  let chuan = s;
  if (s.includes(",")) {
    if (s.indexOf(",") !== s.lastIndexOf(",")) return null;
    chuan = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) chuan = s.replace(/\./g, "");
  if (!/^-?\d+(\.\d+)?$/.test(chuan)) return null;
  const n = Number(chuan);
  return Number.isFinite(n) ? n : null;
}

/** Dòng có Tồn đầu kỳ + Nhận − Tiêu thụ ≠ Tồn cuối kỳ (thường do sửa tay một ô) — nhắc trên màn hình, không chặn in. */
export function lechCanDoi(d: DongBaoCaoSon): boolean {
  const [dau, nhan, tieuThu, cuoi] = COT_SO_SON.map((k) => docSoBaoCao(d[k]));
  if (dau === null || nhan === null || tieuThu === null || cuoi === null) return false;
  return Math.abs(dau + nhan - tieuThu - cuoi) > 0.0005;
}

/**
 * Chia dòng bảng vào các trang của tờ in theo chiều cao ĐO được (cùng một đơn
 * vị): trang đầu còn bảng thông tin tàu nên chứa ít dòng hơn trang sau; khối ký
 * phải ở cùng trang với ít nhất dòng cuối — không để một trang chỉ có chữ ký.
 * Trả về chỉ số dòng của từng trang.
 */
export function chiaTrangBaoCao(caoDong: readonly number[], cho: { trangDau: number; trangSau: number; ky: number }): number[][] {
  const trang: number[][] = [[]];
  let con = cho.trangDau;
  caoDong.forEach((h, i) => {
    if (h > con + 0.5 && trang[trang.length - 1].length > 0) {
      trang.push([]);
      con = cho.trangSau;
    }
    trang[trang.length - 1].push(i);
    con -= h;
  });
  if (cho.ky > con + 0.5) {
    const cuoi = trang[trang.length - 1];
    trang.push(cuoi.length > 1 ? [cuoi.pop()!] : []);
  }
  return trang;
}

/**
 * Số tồn mới người dùng gõ khi sửa; null nếu không hợp lệ. Ô nhập là
 * type="number" nên trình duyệt luôn gửi dấu chấm thập phân ("1.5"); vẫn nhận
 * dấu phẩy cho chắc. KHÔNG đoán dấu chấm hàng nghìn — "1.500" từ ô số là 1,5.
 */
export function docSoTon(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 1000) / 1000 : null;
}
