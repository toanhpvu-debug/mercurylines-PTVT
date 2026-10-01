/**
 * KIỂM KÊ THEO FILE (MLS-11-06 Excel / PDF scan) — phần thuần, không đụng
 * database: dòng kiểm kê, chuyển từ kết quả đọc Excel / AI, nhận tàu theo tên
 * file, áp chỉnh sửa của người đối chiếu. Kiểm ở scripts/kiem-tra-kiem-ke.ts.
 *
 * Nguyên tắc: kiểm kê CẬP NHẬT SỐ TỒN của mặt hàng đã có, không nhập lại mặt
 * hàng. Dòng nào ghép được với mặt hàng sẵn có thì tồn được đặt đúng bằng số
 * đếm; dòng chưa có trong danh mục chỉ được thêm khi người duyệt chọn.
 */
import type { ImportedItem } from "@/lib/materialImport";
import type { DongAi } from "@/lib/docPhieuBangAi";
import { LAP_YEU_CAU, VAN_HANH_TAU } from "@/lib/roles";

export type LoaiHang = "STORE" | "SPARE";

/** Một dòng của file kiểm kê (lưu trong KiemKeTep.dong). */
export type DongKiemKe = {
  ten: string;
  tenEn: string | null;
  impa: string | null;
  partNo: string | null;
  donVi: string;
  /** Thiết bị (phụ tùng: Máy chính, Máy phát...). */
  thietBi: string | null;
  /** Nhóm hàng (cột Group / Nhóm). */
  nhom: string | null;
  loai: LoaiHang | null;
  /** Sheet Excel chứa dòng — để định tuyến kho (Phụ tùng → kho máy, Boong → kho boong). */
  sheet: string | null;
  /** Số tồn đếm được; null = ô trống (chưa đếm) — KHÔNG phải 0. */
  ton: number | null;
  trang: number | null;
  canhBao: string | null;
  /** Người đối chiếu bỏ dòng này (không áp dụng). */
  boQua: boolean;
  /** Dòng chưa có trong danh mục: thêm làm mặt hàng mới khi áp dụng. */
  themMoi: boolean;
};

export const TRANG_THAI_KIEM_KE = ["CHO_DUYET", "DA_AP_DUNG"] as const;
export type TrangThaiKiemKe = (typeof TRANG_THAI_KIEM_KE)[number];

/** Ai tải file kiểm kê lên: sĩ quan tàu (lập yêu cầu) + người vận hành kho. */
export const NGUOI_TAI_KIEM_KE: readonly string[] = [...new Set([...VAN_HANH_TAU, ...LAP_YEU_CAU])];

export const DUOI_KIEM_KE = [".xlsx", ".xls", ".pdf"] as const;
export const TOI_DA_DONG_KIEM_KE = 3000;

const sach = (s: string | null | undefined, max: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return t || null;
};

export function dongTuExcel(items: ImportedItem[]): DongKiemKe[] {
  return items.slice(0, TOI_DA_DONG_KIEM_KE).map((x) => ({
    ten: sach(x.name, 200) ?? "?",
    tenEn: sach(x.nameEn ?? null, 200),
    impa: sach(x.impa, 20),
    partNo: sach(x.partNumber, 80),
    donVi: sach(x.uom, 20) ?? "PCS",
    thietBi: sach(x.equipment, 120),
    nhom: sach(x.group, 120),
    loai: x.materialType,
    sheet: sach(x.sheet, 80),
    ton: x.rob,
    trang: null,
    canhBao: null,
    boQua: false,
    themMoi: false,
  }));
}

export function dongTuAi(dong: DongAi[]): DongKiemKe[] {
  return dong.slice(0, TOI_DA_DONG_KIEM_KE).map((d) => ({
    ten: d.ten.slice(0, 200),
    tenEn: sach(d.tenEn, 200),
    impa: d.impa,
    partNo: sach(d.partNo, 80),
    donVi: sach(d.donVi, 20) ?? "PCS",
    // Bảng kiểm kê ghi nhóm ở cột Group: phụ tùng → thiết bị, vật tư → nhóm hàng.
    thietBi: d.loai === "SPARE" ? sach(d.thietBi, 120) : null,
    nhom: d.loai === "STORE" ? sach(d.thietBi, 120) : null,
    loai: d.loai,
    sheet: null,
    ton: d.soLuongTrong ? null : d.soLuong,
    trang: d.trang,
    canhBao: sach(d.canhBao, 300),
    boQua: false,
    themMoi: false,
  }));
}

const chuKhop = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

/**
 * Nhận tàu từ tên file: "MLS-11-06_ML-001_2026-08-15.xlsx" → tàu mã ML-001;
 * "Kiem ke ODYSSEY T9.pdf" → tàu tên M. ODYSSEY. Chỉ trả về khi khớp ĐÚNG MỘT
 * tàu (khớp nhiều / không khớp → null, người dùng tự chọn).
 */
export function tauTuTenTep<T extends { id: number; code: string; name: string }>(fileName: string, vessels: T[]): T | null {
  const ten = ` ${chuKhop(fileName.replace(/\.[a-z0-9]+$/i, ""))} `;
  const tenLien = ten.replace(/ /g, "");
  const theoMa = vessels.filter((v) => {
    const ma = chuKhop(v.code).replace(/ /g, "");
    return ma.length >= 3 && tenLien.includes(ma);
  });
  if (theoMa.length === 1) return theoMa[0];
  if (theoMa.length > 1) return null;
  // Theo tên: bỏ tiền tố "M." / "MV" / "M/V", lấy các từ ≥ 4 ký tự làm khóa.
  const theoTen = vessels.filter((v) => {
    const tu = chuKhop(v.name)
      .split(" ")
      .filter((w) => w.length >= 4 && !["SHIP", "VESSEL"].includes(w));
    return tu.length > 0 && tu.every((w) => ten.includes(` ${w} `));
  });
  return theoTen.length === 1 ? theoTen[0] : null;
}

/** Số trong ô người đối chiếu gõ: "12", "2,5" → số; trống → null; sai → NaN. */
export function soTonNhap(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v * 1000) / 1000 : NaN;
  const t = String(v).trim().replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return Math.round(Number(t) * 1000) / 1000;
}

/** Chỉnh sửa của người đối chiếu cho MỘT dòng (chỉ số tồn và hai lựa chọn — tên / mã giữ như đọc được). */
export type SuaDongKiemKe = { i: number; ton: string | number | null; boQua: boolean; themMoi: boolean };

/**
 * Áp chỉnh sửa lên các dòng đã lưu. Chỉ nhận số tồn và hai lựa chọn theo chỉ
 * số dòng — người dùng không đổi được tên / mã để "ghép" sang mặt hàng khác.
 */
export function apSuaDong(dong: DongKiemKe[], sua: unknown): { ok: true; dong: DongKiemKe[] } | { ok: false; n: number } {
  const ra = dong.map((d) => ({ ...d }));
  if (!Array.isArray(sua)) return { ok: true, dong: ra };
  for (const x of sua.slice(0, TOI_DA_DONG_KIEM_KE)) {
    if (!x || typeof x !== "object") continue;
    const s = x as Partial<SuaDongKiemKe>;
    const i = Number(s.i);
    if (!Number.isInteger(i) || i < 0 || i >= ra.length) continue;
    const ton = soTonNhap(s.ton);
    if (Number.isNaN(ton)) return { ok: false, n: i + 1 };
    ra[i].ton = ton;
    ra[i].boQua = s.boQua === true;
    ra[i].themMoi = s.themMoi === true;
  }
  return { ok: true, dong: ra };
}

/** Đọc mảng dòng từ cột JSON (dữ liệu cũ / hỏng thì bỏ qua phần tử sai). */
export function docDongJson(v: unknown): DongKiemKe[] {
  if (!Array.isArray(v)) return [];
  const ra: DongKiemKe[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const d = x as Partial<DongKiemKe>;
    if (typeof d.ten !== "string") continue;
    const ton = soTonNhap(d.ton ?? null);
    ra.push({
      ten: d.ten,
      tenEn: d.tenEn ?? null,
      impa: d.impa ?? null,
      partNo: d.partNo ?? null,
      donVi: d.donVi ?? "PCS",
      thietBi: d.thietBi ?? null,
      nhom: d.nhom ?? null,
      loai: d.loai === "STORE" || d.loai === "SPARE" ? d.loai : null,
      sheet: d.sheet ?? null,
      ton: Number.isNaN(ton) ? null : ton,
      trang: typeof d.trang === "number" ? d.trang : null,
      canhBao: d.canhBao ?? null,
      boQua: d.boQua === true,
      themMoi: d.themMoi === true,
    });
  }
  return ra;
}

/** Ngày kiểm kê từ ô ngày (yyyy-mm-dd) — sai / trống → hôm nay; không nhận ngày tương lai. */
export function ngayKiemKeTu(s: string | null | undefined, bayGio = new Date()): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return bayGio;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  if (Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1) return bayGio;
  return d > bayGio ? bayGio : d;
}
