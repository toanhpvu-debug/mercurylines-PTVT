/*
 * KỲ BÁO CÁO (quý / tháng, giờ Việt Nam) và PHẦN TÍNH TỒN THEO KỲ dùng chung cho
 * sơn (lib/tonSon.ts, lib/baoCaoTonSon.ts — báo cáo MLS-11-14) và vật tư & phụ tùng
 * (lib/tonKhoQuy.ts — biểu mẫu MLS-11-06). Thuần, không database.
 *
 *   - heThongQuy: số liệu THÔ của một mặt hàng quanh một kỳ, neo vào tồn hiện tại
 *     (tồn cuối kỳ = tồn bây giờ − phát sinh sau kỳ).
 *   - bonCotQuy: bốn cột của tờ báo cáo (Tồn đầu kỳ · Nhận · Tiêu thụ · Tồn cuối
 *     kỳ) — dòng điều chỉnh thường gộp vào Nhận / Tồn đầu kỳ để bốn cột vẫn cân;
 *     dòng do báo cáo / file kiểm kê ghi (cotBaoCao) nằm thẳng ở cột của nó.
 *   - keHoachBaoCaoTon: những dòng phải ghi để số của app trong kỳ khớp bốn cột
 *     của một báo cáo tàu gửi (đưa tồn về đúng số cuối kỳ, phát sinh sau giữ nguyên).
 */

// ─── Giờ Việt Nam ────────────────────────────────────────────────────────────

/** Việt Nam UTC+7 quanh năm (không đổi giờ mùa hè) — máy chủ Dokploy chạy giờ UTC. */
export const LECH_VN_MS = 7 * 3600_000;

export type ThangNam = { nam: number; thang: number };

/** 0 giờ ngày 1 của tháng (giờ Việt Nam). `thang` 1–12; tràn (13, 0) tự lùi / tiến năm. */
export const dauThangVN = (nam: number, thang: number) => new Date(Date.UTC(nam, thang - 1, 1) - LECH_VN_MS);

/** Ngày / tháng / năm theo giờ Việt Nam của một thời điểm. */
export function ngayCuaVN(d: Date): { nam: number; thang: number; ngay: number } {
  const vn = new Date(d.getTime() + LECH_VN_MS);
  return { nam: vn.getUTCFullYear(), thang: vn.getUTCMonth() + 1, ngay: vn.getUTCDate() };
}

/** 0 giờ (giờ Việt Nam) của ngày chứa `d`. */
export function dauNgayVN(d: Date): Date {
  const n = ngayCuaVN(d);
  return new Date(Date.UTC(n.nam, n.thang - 1, n.ngay) - LECH_VN_MS);
}

/** "yyyy-mm-dd" theo giờ Việt Nam — giá trị ô ngày của form. */
export function chuoiNgayVN(d: Date): string {
  const n = ngayCuaVN(d);
  return `${n.nam}-${String(n.thang).padStart(2, "0")}-${String(n.ngay).padStart(2, "0")}`;
}

/** Ô ngày "yyyy-mm-dd" → 12 giờ trưa ngày đó (giờ Việt Nam); sai → null. */
export function ngayTuChuoiVN(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const [nam, thang, ngay] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(nam, thang - 1, ngay, 12) - LECH_VN_MS);
  const n = ngayCuaVN(d);
  return n.nam === nam && n.thang === thang && n.ngay === ngay ? d : null;
}

/** Kỳ từ tháng `tu` tới hết tháng `den` (giờ Việt Nam): mốc đầu tính, mốc cuối không tính. */
export function kyThang(tu: ThangNam, den: ThangNam): { batDau: Date; ketThuc: Date } {
  return { batDau: dauThangVN(tu.nam, tu.thang), ketThuc: dauThangVN(den.nam, den.thang + 1) };
}

// ─── Quý ─────────────────────────────────────────────────────────────────────

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

// ─── Số liệu một kỳ ──────────────────────────────────────────────────────────

/** Một dòng nhập / xuất / điều chỉnh, đủ để xếp vào kỳ. */
export type GiaoDichKy = {
  type: string;
  quantity: number;
  /** Dòng ĐIỀU CHỈNH (sửa số tồn, kiểm kê) — không phải nhận hay dùng thật. */
  dieuChinh: boolean;
  occurredAt: Date;
  /** Dòng do báo cáo / file kiểm kê ghi: cột báo cáo mà dòng làm khớp (null = dòng thường). */
  cotBaoCao?: string | null;
};

/** Phần điều chỉnh đã sửa vào cột nào để bốn cột vẫn cân. */
export type DieuChinhVao = "nhan" | "tonDau" | "ca-hai" | null;

export const lam3 = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Math.abs(r) < 1e-9 ? 0 : r;
};

/** Số liệu THÔ của một mặt hàng quanh một kỳ (chưa gộp điều chỉnh vào cột nào). */
export type HeThongQuy = {
  /** Tồn bây giờ. */
  hienTai: number;
  /** Tồn lúc đầu kỳ (thật, kể cả điều chỉnh trước kỳ). */
  dauKy: number;
  /** Dòng NHẬP không điều chỉnh trong kỳ (trừ dòng báo cáo ghi vào cột — xem nhanBc…). */
  nhan: number;
  /** Dòng XUẤT không điều chỉnh trong kỳ. */
  tieuThu: number;
  /** Tổng dòng ĐIỀU CHỈNH thường trong kỳ (Sửa số tồn, Gỡ khỏi danh sách, kiểm kê cũ), có dấu. */
  dieuChinh: number;
  /** Dòng báo cáo ghi vào cột Nhận (nhập +, bớt nhận −). */
  nhanBc: number;
  /** Dòng báo cáo ghi vào cột Tiêu thụ (xuất dùng +, bớt tiêu thụ −). */
  tieuThuBc: number;
  /** Dòng báo cáo chỉnh Tồn cuối kỳ (báo cáo không cân, chỉ có số đếm), có dấu. */
  cuoiBc: number;
  /** Tồn lúc hết kỳ. */
  cuoiKy: number;
};

/**
 * Số liệu thô của MỘT mặt hàng trong kỳ, neo vào tồn hiện tại: tồn cuối kỳ = tồn
 * bây giờ − (nhập − xuất) ghi từ cuối kỳ tới nay; tồn đầu kỳ = tồn cuối kỳ − mọi
 * phát sinh trong kỳ. Giao dịch trước đầu kỳ không cần (bỏ qua).
 */
export function heThongQuy(hienTai: number, giaoDich: readonly GiaoDichKy[], ky: { batDau: Date; ketThuc: Date }): HeThongQuy {
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

export type BonCotQuy = { tonDau: number; nhan: number; tieuThu: number; tonCuoi: number; dieuChinh: number; dieuChinhVao: DieuChinhVao };

/**
 * Điều chỉnh gộp vào cột nào:
 *   - "nhan" (sơn): kỳ có nhận thì sửa vào Nhận (điều chỉnh sơn thường là sửa số nhập
 *     nhầm từ phiếu giao), không thì vào Tồn đầu kỳ;
 *   - "tonDau" (vật tư & phụ tùng): luôn vào Còn tồn đợt trước — điều chỉnh vật tư là
 *     nạp tồn ban đầu từ file / kiểm kê đếm lại: hàng đã có trên tàu từ trước, app chỉ
 *     chưa biết; gộp vào Nhận thì một lần nạp tồn 400 thành "nhận 400 trong kỳ".
 */
export type GopDieuChinh = "nhan" | "tonDau";

/**
 * Bốn cột của tờ báo cáo từ số liệu thô: dòng điều chỉnh thường KHÔNG tính là
 * nhận hay dùng mà được coi là sửa số để bốn cột vẫn cân (cột nào: GopDieuChinh).
 * Dòng báo cáo ghi vào cột Nhận / Tiêu thụ cộng thẳng vào cột đó — cập nhật theo
 * báo cáo rồi in lại ra đúng báo cáo. `kemCuoiBc` = false: bỏ phần chỉnh tồn cuối
 * của báo cáo không cân (để so cột với báo cáo — keHoachBaoCaoTon; cột Tồn cuối kỳ
 * khi đó không còn cân).
 */
export function bonCotQuy(ht: HeThongQuy, kemCuoiBc = true, gop: GopDieuChinh = "nhan"): BonCotQuy {
  const dc = lam3(ht.dieuChinh + (kemCuoiBc ? ht.cuoiBc : 0));
  let nhan = ht.nhan;
  let tonDau = ht.dauKy;
  let vao: DieuChinhVao = null;
  if (gop === "tonDau") {
    if (dc !== 0) {
      tonDau = lam3(ht.dauKy + dc);
      vao = "tonDau";
    }
  } else if (dc < 0) {
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

// ─── Kế hoạch đưa số của app về đúng báo cáo ────────────────────────────────

/** Ba cột số của báo cáo ngoài Tồn cuối kỳ; null = ô trống. */
export type SoBaoCao = { tonDau: number | null; nhan: number | null; tieuThu: number | null };

export type ButToanBaoCao = {
  /** NHAN = dòng nhập, TIEU_THU = dòng xuất dùng, DIEU_CHINH = dòng điều chỉnh (có dấu). */
  loai: "NHAN" | "TIEU_THU" | "DIEU_CHINH";
  /** NHAN / TIEU_THU: số dương; DIEU_CHINH: có dấu (+ tăng tồn, − giảm tồn). */
  so: number;
  /** DAU_KY = ghi ngay trước đầu kỳ (tồn mang sang); CUOI_KY = ghi lúc cuối kỳ. */
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

/**
 * Những dòng phải ghi để số của app trong kỳ khớp báo cáo của một mặt hàng. `ht`
 * = số liệu thô của app quanh kỳ (heThongQuy) — mặt hàng mới tạo thì mọi số bằng
 * 0. Ba cột đầu so với bốn cột như tờ in (bỏ phần chỉnh tồn cuối của lần cập nhật
 * báo cáo không cân trước đó — nó không thuộc cột nào), Tồn cuối kỳ so với tồn
 * thật lúc hết kỳ: cập nhật lại đúng báo cáo đó lần nữa thì không ghi gì.
 *   - Tồn đầu kỳ khác → một dòng ĐIỀU CHỈNH ngay trước đầu kỳ (tồn mang sang);
 *   - Nhận nhiều hơn → dòng NHẬP cuối kỳ; ít hơn → điều chỉnh bớt;
 *   - Tiêu thụ nhiều hơn → dòng XUẤT DÙNG cuối kỳ; ít hơn → điều chỉnh;
 *   - còn lệch Tồn cuối kỳ (báo cáo không cân, ô để trống, file chỉ có số đếm) →
 *     một dòng cuối kỳ để tồn cuối kỳ bằng đúng báo cáo. `thieuLaTieuThu`: ô Tiêu
 *     thụ trống mà app dư hơn số báo cáo thì coi phần thiếu là sơn đã dùng (cách
 *     tàu tính báo cáo sơn); vật tư thì luôn là điều chỉnh kiểm kê.
 */
export function keHoachBaoCaoTon(
  bao: SoBaoCao & { tonCuoi: number },
  ht: HeThongQuy,
  tuyChon: { thieuLaTieuThu?: boolean; gopDieuChinh?: GopDieuChinh } = {}
): KeHoachBaoCaoTon {
  const thieuLaTieuThu = tuyChon.thieuLaTieuThu ?? true;
  const buToan: ButToanBaoCao[] = [];
  const app = bonCotQuy(ht, false, tuyChon.gopDieuChinh ?? "nhan");
  let cuoi = ht.cuoiKy;
  if (bao.tonDau !== null && Math.abs(bao.tonDau - app.tonDau) > SAI_SO) {
    const d = lam3(bao.tonDau - app.tonDau);
    buToan.push({ loai: "DIEU_CHINH", so: d, luc: "DAU_KY", cot: "tonDau", truoc: app.tonDau, sau: bao.tonDau });
    cuoi += d;
  }
  if (bao.nhan !== null) {
    const d = lam3(bao.nhan - app.nhan);
    if (d > SAI_SO) buToan.push({ loai: "NHAN", so: d, luc: "CUOI_KY", cot: "nhan", truoc: app.nhan, sau: bao.nhan });
    else if (d < -SAI_SO) buToan.push({ loai: "DIEU_CHINH", so: d, luc: "CUOI_KY", cot: "nhan", truoc: app.nhan, sau: bao.nhan });
    if (Math.abs(d) > SAI_SO) cuoi += d;
  }
  if (bao.tieuThu !== null) {
    const d = lam3(bao.tieuThu - app.tieuThu);
    if (d > SAI_SO) buToan.push({ loai: "TIEU_THU", so: d, luc: "CUOI_KY", cot: "tieuThu", truoc: app.tieuThu, sau: bao.tieuThu });
    else if (d < -SAI_SO) buToan.push({ loai: "DIEU_CHINH", so: -d, luc: "CUOI_KY", cot: "tieuThu", truoc: app.tieuThu, sau: bao.tieuThu });
    if (Math.abs(d) > SAI_SO) cuoi -= d;
  }
  const f = lam3(bao.tonCuoi - lam3(cuoi));
  if (Math.abs(f) > SAI_SO) {
    if (thieuLaTieuThu && bao.tieuThu === null && f < 0) buToan.push({ loai: "TIEU_THU", so: -f, luc: "CUOI_KY", cot: "tonCuoi", truoc: lam3(cuoi), sau: bao.tonCuoi });
    else buToan.push({ loai: "DIEU_CHINH", so: f, luc: "CUOI_KY", cot: "tonCuoi", truoc: lam3(cuoi), sau: bao.tonCuoi });
  }
  const tongDoi = lam3(buToan.reduce((s, b) => s + (b.loai === "TIEU_THU" ? -b.so : b.so), 0));
  return { buToan, tongDoi, hienTaiMoi: lam3(ht.hienTai + tongDoi), khop: buToan.length === 0 };
}

/**
 * Cột lưu kèm dòng ghi (cột `cotBaoCao` của PaintTransaction / InventoryTransaction)
 * — cột tờ in xếp dòng đó vào: dòng nhập về Nhận, dòng xuất dùng về Tiêu thụ (kể cả
 * tiêu thụ tính theo tồn cuối), dòng điều chỉnh về đúng cột nó sửa.
 */
export const cotGhiButToan = (b: ButToanBaoCao): ButToanBaoCao["cot"] => (b.loai === "NHAN" ? "nhan" : b.loai === "TIEU_THU" ? "tieuThu" : b.cot);

/** Loại dòng kho của một bút toán: nhập / xuất, có phải điều chỉnh không. */
export const kieuGhiButToan = (b: ButToanBaoCao): { type: "IN" | "OUT"; dieuChinh: boolean; quantity: number } => ({
  type: b.loai === "NHAN" ? "IN" : b.loai === "TIEU_THU" ? "OUT" : b.so > 0 ? "IN" : "OUT",
  dieuChinh: b.loai === "DIEU_CHINH",
  quantity: Math.abs(b.so),
});
