import { VI_TRI_CO_THE } from "@/lib/thietYeu";

/*
 * KHO / VỊ TRÍ TRÊN TÀU — quy ước mã kho (dùng chung máy chủ + trình duyệt).
 *
 * Mỗi tàu có ba kho chuẩn <mã tàu>-DECK / -ENG / -STORE. Phần sau mã tàu là KHỐI của kho, và
 * báo cáo theo bộ phận (MLS-11-01, MLS-11-06, báo cáo quý, thống kê) cùng bước nhập file / kiểm
 * kê "tự động" đều đọc khối từ đây. Kho thêm để chỉ rõ chỗ cất hàng mang thêm một MÃ VỊ TRÍ sau
 * khối: ML-001-ENG-ECR, ML-001-DECK-PAINT — vẫn đúng khối của nó trong mọi báo cáo.
 *
 * Khối là đoạn -ENG / -DECK / -STORE ĐẦU TIÊN trong mã: mã vị trí được phép chứa lại các chữ đó
 * ("ML-001-ENG-ER-STORE" là kho phụ tùng buồng máy, thuộc khối Máy), vì khối luôn đứng ngay sau
 * mã tàu.
 */

export const LOAI_KHO = ["ENG", "DECK", "STORE"] as const;
export type LoaiKho = (typeof LOAI_KHO)[number];

const RE_KHOI = /-(ENG|DECK|STORE)(?=-|$)/i;

/** Khối của kho theo mã: "ML-001-ENG", "ML-001-ENG-ECR" → ENG; mã không theo quy ước → null. */
export function loaiKhoTuMa(code: string): LoaiKho | null {
  const m = RE_KHOI.exec(code);
  return m ? (m[1].toUpperCase() as LoaiKho) : null;
}

/** Mã vị trí sau khối: "ML-001-ENG-ECR" → "ECR"; kho chính "ML-001-ENG" (hay mã khác quy ước) → "". */
export function hauToKho(code: string): string {
  const m = RE_KHOI.exec(code);
  return m ? code.slice(m.index + m[0].length).replace(/^-/, "") : "";
}

/** Kho có thuộc bộ phận đang lọc không (báo cáo theo bộ phận); "ALL" / trống → mọi kho. */
export function khoThuocBoPhan(code: string, boPhan: string | null | undefined): boolean {
  return !boPhan || boPhan === "ALL" || loaiKhoTuMa(code) === boPhan;
}

/**
 * Kho CHÍNH của mỗi khối — nơi nhập file / kiểm kê "tự động" ghi mặt hàng chưa có chỗ: kho mang
 * đúng mã <tàu>-<KHỐI> (ba kho chuẩn); khối không còn kho đó thì kho đầu tiên của khối theo mã.
 */
export function khoChinhTheoLoai(kho: readonly { id: number; code: string }[]): Partial<Record<LoaiKho, number>> {
  const xep = [...kho].sort((a, b) => Number(hauToKho(a.code) !== "") - Number(hauToKho(b.code) !== "") || a.code.localeCompare(b.code));
  const ra: Partial<Record<LoaiKho, number>> = {};
  for (const k of xep) {
    const loai = loaiKhoTuMa(k.code);
    if (loai) ra[loai] ??= k.id;
  }
  return ra;
}

/**
 * Kho là kho CUỐI CÙNG của khối nó trên tàu → trả khối đó (không xóa / không đổi khối được: nhập
 * file và kiểm kê chọn kho "tự động" cần mỗi khối còn ít nhất một kho để ghi hàng); còn kho khác
 * cùng khối, hoặc mã không theo quy ước → null.
 */
export function laKhoCuoiCuaKhoi(kho: { id: number; code: string }, tatCa: readonly { id: number; code: string }[]): LoaiKho | null {
  const loai = loaiKhoTuMa(kho.code);
  if (!loai) return null;
  return tatCa.some((k) => k.id !== kho.id && loaiKhoTuMa(k.code) === loai) ? null : loai;
}

/** Chữ thường, bỏ dấu — để lọc danh sách theo chữ gõ. */
export const khongDau = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();

export const DO_DAI_HAU_TO = 16;

/** Mã vị trí gõ tay → dạng ghi vào mã kho: bỏ dấu, chữ hoa, chỉ A–Z 0–9 nối bằng "-". "E/R store" → "ER-STORE". */
export function chuanHoaHauTo(s: string): string {
  return khongDau(s)
    .replace(/[/'’.]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, DO_DAI_HAU_TO)
    .replace(/-+$/, "");
}

/** Mã kho: <mã tàu>-<KHỐI>[-<MÃ VỊ TRÍ>]. */
export function maKho(vesselCode: string, loai: LoaiKho, hauTo: string): string {
  const h = chuanHoaHauTo(hauTo);
  return `${vesselCode}-${loai}${h ? `-${h}` : ""}`;
}

/**
 * Tên kho nhúng tên tàu ("Kho máy - M. ODYSSEY") — quy ước của dữ liệu sẵn có: danh sách kho
 * gộp nhiều tàu vẫn phân biệt được, và đổi tên tàu thì updateVessel đổi theo đúng đuôi này.
 */
export function tenKhoDayDu(ten: string, tenTau: string): string {
  const goc = tenKhoNgan(ten.trim(), tenTau);
  return `${goc} - ${tenTau}`;
}

/** Bỏ đuôi " - <tên tàu>" để sửa phần tên riêng của kho. */
export function tenKhoNgan(ten: string, tenTau: string): string {
  const duoi = ` - ${tenTau}`;
  return ten.endsWith(duoi) ? ten.slice(0, -duoi.length).trim() : ten.trim();
}

export const DO_DAI_TEN_KHO = 60;

/** Một dòng tồn trong hộp "Chuyển hàng" (máy chủ trả về, trình duyệt lọc / chọn). */
export type HangTrongKho = {
  id: number;
  materialId: number;
  ma: string;
  ten: string;
  dvt: string;
  ton: number;
  giu: number;
  /** Cùng mặt hàng đang có ở kho khác của tàu: chuyển sang đó thì cộng vào dòng có sẵn. */
  khoKhac: { khoId: number; so: number }[];
};

/** Khối thường gặp của các chỗ cất trên tàu (gợi ý, người thêm kho vẫn đổi được). */
const KHOI_CUA_VI_TRI: Record<string, LoaiKho> = {
  CRANE: "DECK",
  DECK_STORE: "DECK",
  BOSUN: "DECK",
  FORE: "DECK",
  PAINT: "DECK",
  BRIDGE: "DECK",
  LIFEBOAT: "DECK",
};

/** Mã vị trí ngắn, đọc được trên nhãn kho (mặc định: khóa của chỗ đó, "_" → "-"). */
const MA_CUA_VI_TRI: Record<string, string> = {
  ER_WORKSHOP: "WORKSHOP",
  DECK_STORE: "STORE",
};

/**
 * Chỗ cất trên tàu để chọn nhanh khi thêm kho — cùng danh sách "Vị trí / Location" của phụ tùng
 * thiết yếu (lib/thietYeu.ts), kèm khối và mã vị trí gợi ý. Tên đầy đủ: từ điển thietYeu.viTri_<khoa>.
 */
export const VI_TRI_GOI_Y = VI_TRI_CO_THE.map((v) => ({
  khoa: v.khoa,
  ma: v.ma,
  loai: KHOI_CUA_VI_TRI[v.khoa] ?? ("ENG" as LoaiKho),
  hauTo: MA_CUA_VI_TRI[v.khoa] ?? v.khoa.replace(/_/g, "-"),
}));
