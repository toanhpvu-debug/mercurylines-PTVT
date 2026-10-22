import { CHUC_DANH, type BoPhan } from "@/lib/maVatTu";
import { chucDanhChiuTrachNhiem } from "@/lib/chucDanhChiuTrachNhiem";

/**
 * KIỂM SOÁT TỒN KHO THEO CHỨC DANH (trang Tồn kho): mỗi dòng tồn thuộc về chức danh GIỮ
 * và kiểm kê mặt hàng (cột "Giữ bởi" ở Danh mục — lib/chucDanhChiuTrachNhiem.ts). Gom
 * các dòng tồn hiện tại của một tàu theo chức danh đó: bao nhiêu dòng, bao nhiêu dòng
 * dưới tối thiểu / hết hàng, lần nhập / xuất gần nhất — để văn phòng thấy ngay phần
 * của Máy hai, Thủy thủ trưởng... và xuất báo cáo MLS-11-06 của riêng người đó.
 *
 * Hàm thuần (không database) — chạy được trong scripts/kiem-tra-ton-chuc-danh.ts.
 */

/** Cột mặt hàng cần để biết ai giữ — cùng bộ cột báo cáo quý / xuất MLS-11-06 truyền vào. */
export type VatTuCoNguoiGiu = {
  code: string;
  nameVn: string;
  nameEn: string | null;
  impa: string | null;
  materialType: string;
  equipment: string | null;
  department: string | null;
  nhomQuanLy: string | null;
  responsibleRank: string | null;
  category: { code: string; name: string } | null;
};

/** Chức danh giữ mặt hàng (gán tay → cụm máy → bản chất → bộ phận); null khi không xếp được. */
export function chucDanhGiuCua(m: VatTuCoNguoiGiu): string | null {
  return (
    chucDanhChiuTrachNhiem({
      responsibleRank: m.responsibleRank,
      categoryCode: m.category?.code ?? null,
      categoryName: m.category?.name ?? null,
      department: m.department,
      equipment: m.equipment,
      code: m.code,
      impa: m.impa,
      nameVn: m.nameVn,
      nameEn: m.nameEn,
      nhomQuanLy: m.nhomQuanLy,
      materialType: m.materialType,
    })?.chucDanh ?? null
  );
}

/** Một dòng tồn đã biết chức danh giữ. `khaDung` = tồn − giữ (như cột Khả dụng). */
export type DongTonCoChucDanh = {
  chucDanh: string | null;
  khaDung: number;
  minStock: number;
  /** Lần nhập / xuất gần nhất của dòng tồn (null: chưa có lần nào). */
  capNhat: Date | null;
};

export type DongTonChucDanh = {
  chucDanh: string | null;
  soDong: number;
  /** Dưới tối thiểu — cùng điều kiện huy hiệu "Thiếu" của bảng tồn: khả dụng ≤ tối thiểu. */
  thieu: number;
  /** Hết hàng: khả dụng ≤ 0. */
  het: number;
  capNhat: Date | null;
};

export type NhomTonChucDanh = {
  /** Bộ phận chính của chức danh (CHUC_DANH); null = chức danh lạ / chưa xác định. */
  boPhan: BoPhan | null;
  soDong: number;
  thieu: number;
  het: number;
  dong: DongTonChucDanh[];
};

const THU_TU_BO_PHAN: readonly (BoPhan | null)[] = ["D", "E", "L", "C", null];

/**
 * Gom dòng tồn theo ĐÚNG chức danh giữ (không bao trùm cấp dưới — ô lọc mới bao trùm),
 * xếp theo bộ phận Boong → Máy → Điện → Phục vụ → khác, trong bộ phận theo thứ tự
 * CHUC_DANH (thuyền trưởng, đại phó… thủy thủ trưởng). Bộ phận không có dòng nào thì bỏ.
 */
export function tonTheoChucDanh(ds: readonly DongTonCoChucDanh[]): NhomTonChucDanh[] {
  const theo = new Map<string | null, DongTonChucDanh>();
  for (const x of ds) {
    const khoa = x.chucDanh?.trim() || null;
    let d = theo.get(khoa);
    if (!d) {
      d = { chucDanh: khoa, soDong: 0, thieu: 0, het: 0, capNhat: null };
      theo.set(khoa, d);
    }
    d.soDong++;
    if (x.khaDung <= x.minStock) d.thieu++;
    if (x.khaDung <= 0) d.het++;
    if (x.capNhat && (!d.capNhat || x.capNhat > d.capNhat)) d.capNhat = x.capNhat;
  }
  const thuTu = Object.keys(CHUC_DANH);
  const viTri = (c: string | null) => (c !== null && thuTu.includes(c) ? thuTu.indexOf(c) : thuTu.length);
  const nhom: NhomTonChucDanh[] = THU_TU_BO_PHAN.map((boPhan) => ({ boPhan, soDong: 0, thieu: 0, het: 0, dong: [] }));
  for (const d of theo.values()) {
    const bp = d.chucDanh && CHUC_DANH[d.chucDanh] ? CHUC_DANH[d.chucDanh].boPhan : null;
    const g = nhom.find((x) => x.boPhan === bp)!;
    g.dong.push(d);
    g.soDong += d.soDong;
    g.thieu += d.thieu;
    g.het += d.het;
  }
  for (const g of nhom) {
    g.dong.sort((a, b) => viTri(a.chucDanh) - viTri(b.chucDanh) || (a.chucDanh ?? "").localeCompare(b.chucDanh ?? ""));
  }
  return nhom.filter((g) => g.dong.length > 0);
}
