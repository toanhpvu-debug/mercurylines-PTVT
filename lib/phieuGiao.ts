/**
 * Quy tắc thuần (không đụng server) của PHIẾU GIAO HÀNG chờ duyệt: ai được tải
 * lên, dòng nhập từ giao diện trông thế nào, kiểm tra dòng trước khi lưu/duyệt,
 * và đọc ngày từ đủ kiểu chuỗi. Dùng chung cho server action, trang và
 * component client — file "use server" không được export hằng số nên đặt ở đây.
 */
import { LAP_YEU_CAU, VAN_HANH_TAU } from "@/lib/roles";

/** Ai tải phiếu lên được: người vận hành kho + người lập yêu cầu (sĩ quan tàu). */
export const NGUOI_TAI_PHIEU_GIAO: readonly string[] = [
  ...new Set([...VAN_HANH_TAU, ...LAP_YEU_CAU]),
];

export const TRANG_THAI_PHIEU_GIAO = ["CHO_DUYET", "DA_DUYET", "TU_CHOI"] as const;
export type TrangThaiPhieuGiao = (typeof TRANG_THAI_PHIEU_GIAO)[number];

/** Một dòng như giao diện duyệt gửi lên (mọi ô là chuỗi, người dùng gõ). */
export type DongNhap = {
  id?: number;
  chon: boolean;
  ten: string;
  partNo: string;
  impa: string;
  soLuong: string | number;
  donVi: string;
  loai: "STORE" | "SPARE";
  thietBi: string;
  materialId: number | null;
  chuGoc?: string | null;
  /** Tên tiếng Anh tách từ phiếu song ngữ (bộ đọc AI) — vào nameEn của mặt hàng khi duyệt. */
  tenEn?: string | null;
  /** Trang trên bản scan mà dòng này nằm (bộ đọc AI) — để nhảy tới khi đối chiếu. */
  trang?: number | null;
  /** Lý do dòng này đáng ngờ (AI hoặc bộ soát) — người duyệt soi kỹ; sửa ô là xóa cảnh báo. */
  canhBao?: string | null;
};

export type ThongTinPhieuNhap = {
  nhaCungCap: string;
  soPhieu: string;
  /** yyyy-mm-dd (ô <input type=date>) hoặc dd/mm/yyyy từ bộ đọc; rỗng = không rõ. */
  ngayGiao: string;
  ghiChu: string;
};

export type DongSach = {
  chon: boolean;
  ten: string;
  partNo: string | null;
  impa: string | null;
  soLuong: number;
  donVi: string;
  loai: "STORE" | "SPARE";
  thietBi: string | null;
  materialId: number | null;
  chuGoc: string | null;
  tenEn: string | null;
  trang: number | null;
  canhBao: string | null;
};

const cat = (s: unknown, toiDa = 200) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, toiDa);
const hoacNull = (s: string) => (s ? s : null);

/**
 * Làm sạch + kiểm tra các dòng. Chỉ dòng ĐƯỢC TICK mới bắt buộc đủ tên và số
 * lượng > 0 — dòng bỏ tick là dòng rác người duyệt giữ lại để đối chiếu, không
 * bắt họ phải sửa cho hợp lệ rồi mới lưu được.
 */
export function kiemTraDongNhap(
  dong: DongNhap[]
): { ok: true; dong: DongSach[] } | { ok: false; n: number; loi: "thieuTen" | "soLuongSai" } {
  const ra: DongSach[] = [];
  for (let i = 0; i < dong.length; i++) {
    const d = dong[i];
    const ten = cat(d.ten);
    const soLuong = Number(String(d.soLuong ?? "").replace(",", "."));
    const chon = Boolean(d.chon);
    if (chon && ten.length < 2) return { ok: false, n: i + 1, loi: "thieuTen" };
    if (chon && !(soLuong > 0 && Number.isFinite(soLuong))) return { ok: false, n: i + 1, loi: "soLuongSai" };
    ra.push({
      chon,
      ten,
      partNo: hoacNull(cat(d.partNo, 80)),
      impa: hoacNull(cat(d.impa, 20)),
      soLuong: Number.isFinite(soLuong) && soLuong >= 0 ? soLuong : 0,
      donVi: cat(d.donVi, 20).toUpperCase() || "PCS",
      loai: d.loai === "STORE" ? "STORE" : "SPARE",
      thietBi: hoacNull(cat(d.thietBi, 120)),
      materialId: Number.isInteger(d.materialId) && (d.materialId as number) > 0 ? (d.materialId as number) : null,
      chuGoc: d.chuGoc ? cat(d.chuGoc, 500) : null,
      tenEn: hoacNull(cat(d.tenEn, 200)),
      trang: Number.isInteger(d.trang) && (d.trang as number) > 0 ? (d.trang as number) : null,
      canhBao: hoacNull(cat(d.canhBao, 300)),
    });
  }
  return { ok: true, dong: ra };
}

/** Đọc ngày từ "yyyy-mm-dd", "dd/mm/yyyy", "dd-mm-yy", "dd.mm.yyyy". Không rõ → null. */
export function ngayTuChuoi(s: string | null | undefined): Date | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  let y: number, m: number, d: number;
  let mt = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mt) {
    [y, m, d] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  } else {
    mt = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!mt) return null;
    [d, m, y] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
    if (y < 100) y += 2000;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const ng = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return Number.isNaN(ng.getTime()) ? null : ng;
}

/** Ngược lại: Date → "yyyy-mm-dd" cho ô <input type=date>. */
export function chuoiNgay(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}
