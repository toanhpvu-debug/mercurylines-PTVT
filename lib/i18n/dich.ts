import type { BangChu, TuDienNamespace } from "./dict/_kieu";
import { BO_PHAN, CHUC_DANH, NHOM_THIET_BI, type BoPhan } from "@/lib/maVatTu";
import { MA_LOCALE, type NgonNgu } from "./ngonNgu";
import { TU_DIEN, type KhoaDich } from "./tuDien";

export type ThamSo = Record<string, string | number>;

/** Hàm dịch có kiểm tra khóa ở tầng kiểu. */
export type HamDich = (khoa: KhoaDich, thamSo?: ThamSo) => string;
/** Hàm dịch cho khóa tính động — không kiểm tra kiểu, thiếu khóa trả về chính khóa. */
export type HamDichTuDo = (khoa: string, thamSo?: ThamSo) => string;

function thayThamSo(mau: string, thamSo?: ThamSo): string {
  if (!thamSo) return mau;
  return mau.replace(/\{(\w+)\}/g, (nguyen, ten: string) =>
    ten in thamSo ? String(thamSo[ten]) : nguyen
  );
}

/**
 * Tra một khóa. Thiếu ở bảng đang chọn thì lùi về tiếng Việt (bảng gốc, luôn
 * đủ); thiếu cả hai thì trả về chính khóa — nhìn thấy "materials.xyz" trên màn
 * hình còn hơn một ô trống không ai biết vì sao.
 */
export function tra(locale: NgonNgu, khoa: string, thamSo?: ThamSo): string {
  const cham = khoa.indexOf(".");
  const ns = cham < 0 ? "" : khoa.slice(0, cham);
  const k = cham < 0 ? khoa : khoa.slice(cham + 1);
  const bang = (TU_DIEN as Record<string, TuDienNamespace<BangChu>>)[ns];
  const mau = bang?.[locale]?.[k] ?? bang?.vi?.[k];
  if (mau === undefined) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] thiếu khóa "${khoa}"`);
    }
    return khoa;
  }
  return thayThamSo(mau, thamSo);
}

export function dichTheo(locale: NgonNgu): HamDich {
  return (khoa, thamSo) => tra(locale, khoa, thamSo);
}

export function dichTuDo(locale: NgonNgu): HamDichTuDo {
  return (khoa, thamSo) => tra(locale, khoa, thamSo);
}

/** Bộ công cụ ngôn ngữ trao cho trang / component: cùng một hình dạng ở server và client. */
export type BoNgonNgu = {
  locale: NgonNgu;
  t: HamDich;
  tTuDo: HamDichTuDo;
  /** Ngày dd/mm/yyyy (vi) hoặc dd/mm/yyyy (en-GB). */
  ngay: (d: Date | string | number, tuyChon?: Intl.DateTimeFormatOptions) => string;
  /** Ngày + giờ đến phút. */
  ngayGio: (d: Date | string | number) => string;
  so: (n: number, tuyChon?: Intl.NumberFormatOptions) => string;
  /** Tên chức danh giữ vật tư (Thủy thủ trưởng / Bosun) theo ngôn ngữ. */
  tenChucDanh: (ma: string | null | undefined) => string;
  tenBoPhan: (bp: BoPhan | string | null | undefined) => string;
  tenNhomThietBi: (ma: string | null | undefined) => string;
};

/**
 * Bộ định dạng Intl dựng sẵn, dùng lại giữa các lần gọi và các request.
 *
 * `Date.prototype.toLocaleString(locale, options)` dựng lại một
 * Intl.DateTimeFormat (phân giải locale, đọc dữ liệu ICU) ở MỖI lần gọi: đo
 * được 118 µs/lần so với 2,3 µs khi dựng sẵn — trang /audit 200 dòng tốn ~24 ms
 * CPU chỉ để in ngày. Intl.*Format không giữ trạng thái nên dùng chung an toàn;
 * đầu ra đã đối chiếu 600 mốc × 2 ngôn ngữ, giống hệt cách cũ. Khóa cache PHẢI
 * gồm locale — thiếu là tiếng Anh hiện ngày theo kiểu Việt.
 */
const boDinhDang = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();
function dinhDangNgay(ma: string, tuyChon?: Intl.DateTimeFormatOptions) {
  const khoa = `d|${ma}|${JSON.stringify(tuyChon ?? null)}`;
  let f = boDinhDang.get(khoa) as Intl.DateTimeFormat | undefined;
  if (!f) {
    f = new Intl.DateTimeFormat(ma, tuyChon);
    boDinhDang.set(khoa, f);
  }
  return f;
}
function dinhDangSo(ma: string, tuyChon?: Intl.NumberFormatOptions) {
  const khoa = `n|${ma}|${JSON.stringify(tuyChon ?? null)}`;
  let f = boDinhDang.get(khoa) as Intl.NumberFormat | undefined;
  if (!f) {
    f = new Intl.NumberFormat(ma, tuyChon);
    boDinhDang.set(khoa, f);
  }
  return f;
}
const TUY_CHON_NGAY_GIO: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

export function taoBoNgonNgu(locale: NgonNgu): BoNgonNgu {
  const ma = MA_LOCALE[locale];
  const ngay: BoNgonNgu["ngay"] = (d, tuyChon) =>
    dinhDangNgay(ma, tuyChon).format(new Date(d));
  return {
    locale,
    t: dichTheo(locale),
    tTuDo: dichTuDo(locale),
    ngay,
    ngayGio: (d) => dinhDangNgay(ma, TUY_CHON_NGAY_GIO).format(new Date(d)),
    so: (n, tuyChon) => dinhDangSo(ma, tuyChon).format(n),
    tenChucDanh: (x) => {
      const cd = x ? CHUC_DANH[x] : undefined;
      if (!cd) return x ?? "";
      return locale === "en" ? cd.tenEn : cd.ten;
    },
    tenBoPhan: (bp) => {
      const b = bp ? BO_PHAN[bp as BoPhan] : undefined;
      if (!b) return bp ?? "";
      return locale === "en" ? b.tenEn : b.ten;
    },
    tenNhomThietBi: (x) => {
      const n = x ? NHOM_THIET_BI[x] : undefined;
      if (!n) return x ?? "";
      return locale === "en" ? n.tenEn : n.ten;
    },
  };
}
