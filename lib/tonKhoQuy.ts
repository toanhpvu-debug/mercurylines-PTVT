/*
 * TỒN KHO VẬT TƯ & PHỤ TÙNG THEO KỲ (quý / tháng, giờ Việt Nam) — phần thuần,
 * dùng chung cho trang báo cáo theo quý (/inventory/bao-cao-quy), thống kê xuất
 * nhập tồn (/inventory/thong-ke), xuất Excel MLS-11-06, kiểm kê theo file và
 * script kiểm thử (scripts/kiem-tra-ton-kho-quy.ts).
 *
 * Biểu mẫu công ty MLS-11-06 "Store & Spare Part Inventory / Kiểm kê vật tư" có
 * đúng bốn cột của báo cáo sơn MLS-11-14: Còn tồn đợt trước (Last R.O.B) · Nhận
 * trong kỳ (Receive) · Tiêu thụ trong kỳ (Cons.) · Tồn trên tàu (R.O.B), kỳ ghi ở
 * ô "From month / Từ tháng … đến …". Vì vậy phần tính dùng chung lib/kyQuy.ts:
 *   - Nhận = dòng NHẬP thật (phiếu giao, nhận hàng PO, nhập tay);
 *   - Tiêu thụ = dòng XUẤT dùng;
 *   - dòng kiểm kê cũ (ghi chú "Kiểm kê …", nạp tồn từ file) là ĐIỀU CHỈNH — không
 *     tính nhận / dùng (như MLS-11-01 lib/baoCao1101.ts), gộp vào Còn tồn đợt trước để
 *     bốn cột vẫn cân: hàng đã có trên tàu từ trước, app chỉ chưa biết (lib/kyQuy.ts
 *     GopDieuChinh — sơn thì gộp vào Nhận);
 *   - dòng do file kiểm kê MLS-11-06 ghi mang cột của biểu mẫu (cotBaoCao) nên
 *     nằm thẳng ở cột đó: cập nhật theo file rồi in lại kỳ đó ra đúng file.
 */
import { laKiemKe } from "@/lib/baoCao1101";
import { QUY_LA_MA, bonCotQuy, dauThangVN, heThongQuy, lam3, mocQuy, quyCua, type BonCotQuy, type GiaoDichKy, type HeThongQuy, type KyQuy, type ThangNam } from "@/lib/kyQuy";

/** Một dòng kho (InventoryTransaction) đủ để xếp vào kỳ. */
export type GiaoDichVatTu = {
  materialId: number;
  type: string;
  quantity: number;
  note: string | null;
  occurredAt: Date;
  cotBaoCao?: string | null;
};

/**
 * Dòng kho → dòng xếp kỳ. Điều chỉnh = dòng Còn tồn đợt trước của file kiểm kê
 * (ghi ngay trước đầu kỳ của file — với kỳ trước đó nó là một lần sửa số) và dòng
 * kiểm kê kiểu cũ nhận ra theo ghi chú.
 */
export function giaoDichKyVatTu(g: Pick<GiaoDichVatTu, "type" | "quantity" | "note" | "occurredAt" | "cotBaoCao">): GiaoDichKy {
  const cot = g.cotBaoCao ?? null;
  return {
    type: g.type,
    quantity: g.quantity,
    occurredAt: g.occurredAt,
    cotBaoCao: cot,
    dieuChinh: cot === "tonDau" || (cot === null && laKiemKe(g.note)),
  };
}

export type SoLieuKyVatTu = { materialId: number; ht: HeThongQuy; cot: BonCotQuy };

/**
 * Bốn cột MLS-11-06 của từng mặt hàng trong một kỳ, cộng mọi kho được chọn, NEO
 * vào tồn hiện tại (tồn cuối kỳ = tồn bây giờ − phát sinh sau kỳ). `giaoDich` là
 * mọi dòng của các kho đó từ đầu kỳ tới nay. Mặt hàng cả bốn cột bằng 0 thì bỏ.
 */
export function soLieuKyVatTu(
  tonHienTai: ReadonlyMap<number, number>,
  giaoDich: readonly GiaoDichVatTu[],
  ky: { batDau: Date; ketThuc: Date }
): SoLieuKyVatTu[] {
  const theoMat = new Map<number, GiaoDichKy[]>();
  for (const id of tonHienTai.keys()) theoMat.set(id, []);
  const dau = ky.batDau.getTime();
  for (const g of giaoDich) {
    if (g.occurredAt.getTime() < dau) continue;
    const x = giaoDichKyVatTu(g);
    const ds = theoMat.get(g.materialId);
    if (ds) ds.push(x);
    else theoMat.set(g.materialId, [x]);
  }
  const ra: SoLieuKyVatTu[] = [];
  for (const [materialId, gd] of theoMat) {
    const ht = heThongQuy(tonHienTai.get(materialId) ?? 0, gd, ky);
    const cot = bonCotQuy(ht, true, "tonDau");
    if (cot.tonDau === 0 && cot.nhan === 0 && cot.tieuThu === 0 && cot.tonCuoi === 0) continue;
    ra.push({ materialId, ht, cot });
  }
  return ra;
}

// ─── Kỳ ghi trên biểu mẫu ────────────────────────────────────────────────────

const boDau = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

const LA_MA: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4 };
const thangHop = (t: number) => Number.isInteger(t) && t >= 1 && t <= 12;
const namHop = (n: number) => Number.isInteger(n) && n >= 2000 && n <= 2100;
const soThang = (x: ThangNam) => x.nam * 12 + (x.thang - 1);

/**
 * Kỳ từ chữ trong ô "From month / Từ tháng … đến …" của MLS-11-06 (hoặc tên kỳ app
 * tự ghi): "Tháng 8/2026", "7/2026 đến 9/2026", "Từ tháng 7 đến tháng 9/2026",
 * "07/2026 - 09/2026", "Quý III/2026", "Q3 2026", "From 7 to 9/2026". Thiếu năm
 * thì lấy năm của `ngayGoiY` (ô Date / Ngày). Chữ mẫu chưa điền ("…… đến ……201x")
 * hoặc vô lý (đến trước từ, dài quá 2 năm) → null.
 */
export function kyTuChuMls1106(chu: string | null | undefined, ngayGoiY?: Date | null): { tu: ThangNam; den: ThangNam } | null {
  const s = boDau(String(chu ?? "")).replace(/\s+/g, " ").trim();
  if (!s || !/\d/.test(s)) return null;
  const namGoiY = ngayGoiY ? quyCua(ngayGoiY).nam : null;
  const hop = (tu: ThangNam, den: ThangNam) => {
    if (!thangHop(tu.thang) || !thangHop(den.thang) || !namHop(tu.nam) || !namHop(den.nam)) return null;
    const dai = soThang(den) - soThang(tu);
    return dai >= 0 && dai < 24 ? { tu, den } : null;
  };
  // Quý: "quy iii/2026", "q3 2026", "quarter 4 - 2026".
  const q = /\b(?:quy|quarter|q)\s*\.?\s*(iv|iii|ii|i|[1-4])\b(?:\D{0,6}(\d{4}))?/.exec(s);
  if (q) {
    const so = LA_MA[q[1]] ?? Number(q[1]);
    const nam = q[2] ? Number(q[2]) : namGoiY;
    if (so && nam) return hop({ nam, thang: so * 3 - 2 }, { nam, thang: so * 3 });
  }
  // Hai tháng có năm riêng: "7/2026 den 9/2026", "11/2026 - 01/2027".
  const hai = /(\d{1,2})\s*[/.-]\s*(\d{4})\D+?(\d{1,2})\s*[/.-]\s*(\d{4})/.exec(s);
  if (hai) return hop({ nam: Number(hai[2]), thang: Number(hai[1]) }, { nam: Number(hai[4]), thang: Number(hai[3]) });
  // Hai tháng chung năm: "tu thang 7 den thang 9/2026", "from 7 to 9/2026", "7 - 9/2026".
  const chung = /(\d{1,2})\s*(?:den|to|-|–|—|~)\s*(?:thang\s*)?(\d{1,2})\s*[/.-]\s*(\d{4})/.exec(s);
  if (chung) {
    const nam = Number(chung[3]);
    return hop({ nam, thang: Number(chung[1]) }, { nam, thang: Number(chung[2]) });
  }
  // Hai tháng, năm ở chỗ khác hoặc không có: "thang 7 den thang 9" + ô ngày.
  const khongNam = /(?:thang|month|from|tu)\s*(\d{1,2})\s*(?:den|to|-|–)\s*(?:thang\s*)?(\d{1,2})\b(?!\s*[/.-]\s*\d)/.exec(s);
  if (khongNam && namGoiY) return hop({ nam: namGoiY, thang: Number(khongNam[1]) }, { nam: namGoiY, thang: Number(khongNam[2]) });
  // Một tháng: "thang 8/2026", "08/2026".
  const mot = /(\d{1,2})\s*[/.-]\s*(\d{4})/.exec(s);
  if (mot) {
    const x = { nam: Number(mot[2]), thang: Number(mot[1]) };
    return hop(x, x);
  }
  return null;
}

/** Tên kỳ in ở ô "From month / Từ tháng" khi app xuất MLS-11-06. */
export function tenKyThang(tu: ThangNam, den: ThangNam): string {
  const t = (x: ThangNam) => `${String(x.thang).padStart(2, "0")}/${x.nam}`;
  if (tu.nam === den.nam && tu.thang === den.thang) return `Tháng ${t(tu)}`;
  const laQuy = tu.nam === den.nam && den.thang - tu.thang === 2 && tu.thang % 3 === 1;
  return `${t(tu)} đến ${t(den)}${laQuy ? ` (quý ${QUY_LA_MA[(tu.thang - 1) / 3]})` : ""}`;
}

/**
 * Kỳ của một lần kiểm kê theo file: ngày kiểm kê = ngày người dùng chọn, không thì
 * hết tháng cuối của kỳ ghi trên file, không thì ô Date / Ngày, không thì hôm nay
 * (không bao giờ quá hôm nay). Đầu kỳ chỉ đặt khi file CÓ số ở các cột Còn tồn đợt
 * trước / Nhận / Tiêu thụ: theo ô "Từ tháng" của file; file không ghi kỳ thì lấy
 * quý chứa ngày kiểm kê và nói rõ trong ghi chú để người đối chiếu sửa nếu khác.
 */
export function kyKiemKeTuFile(x: { kyChu: string | null; ngayFile: Date | null; ngayChon: Date | null; coCotKy: boolean; bayGio: Date }): {
  tuNgay: Date | null;
  ngayKiemKe: Date;
  ghiChu: string | null;
} {
  const ky = kyTuChuMls1106(x.kyChu, x.ngayFile ?? x.ngayChon);
  const tru = (d: Date) => (d > x.bayGio ? x.bayGio : d);
  // 12 giờ trưa ngày cuối của tháng cuối kỳ (giờ Việt Nam).
  const cuoiKy = ky ? new Date(dauThangVN(ky.den.nam, ky.den.thang + 1).getTime() - 12 * 3600_000) : null;
  const ngayKiemKe = tru(x.ngayChon ?? cuoiKy ?? x.ngayFile ?? x.bayGio);
  if (!x.coCotKy) return { tuNgay: null, ngayKiemKe, ghiChu: ky ? `Kỳ trên file: ${tenKyThang(ky.tu, ky.den)} — các cột Nhận / Tiêu thụ trống, chỉ đối chiếu số đếm` : null };
  if (ky) return { tuNgay: dauThangVN(ky.tu.nam, ky.tu.thang), ngayKiemKe, ghiChu: `Kỳ trên file: ${tenKyThang(ky.tu, ky.den)}` };
  const q = quyCua(ngayKiemKe);
  return {
    tuNgay: mocQuy(q).batDau,
    ngayKiemKe,
    ghiChu: `File chưa ghi kỳ (ô Từ tháng … đến …) — đang lấy quý ${QUY_LA_MA[q.quy - 1]}/${q.nam} chứa ngày kiểm kê; sửa ở «Kỳ đối chiếu» nếu khác`,
  };
}

/** Tháng đầu / cuối của một quý. */
export const thangCuaQuy = (k: KyQuy): { tu: ThangNam; den: ThangNam } => ({
  tu: { nam: k.nam, thang: k.quy * 3 - 2 },
  den: { nam: k.nam, thang: k.quy * 3 },
});

// ─── Thống kê nhiều quý ──────────────────────────────────────────────────────

/** Các quý để thống kê: `n` quý tính tới quý chứa `bayGio` (cũ → mới), hoặc bốn quý của một năm (tới quý hiện tại). */
export function cacQuyThongKe(bayGio: Date, nam: number | null, n = 4): KyQuy[] {
  const hienTai = quyCua(bayGio);
  if (nam !== null) {
    const ra: KyQuy[] = [];
    for (let q = 1; q <= 4; q++) {
      if (nam > hienTai.nam || (nam === hienTai.nam && q > hienTai.quy)) break;
      ra.push({ nam, quy: q as KyQuy["quy"] });
    }
    return ra;
  }
  const ra: KyQuy[] = [];
  let x = hienTai;
  for (let i = 0; i < n; i++) {
    ra.unshift(x);
    x = x.quy === 1 ? { nam: x.nam - 1, quy: 4 } : { nam: x.nam, quy: (x.quy - 1) as KyQuy["quy"] };
  }
  return ra;
}

export type SoQuy = { nhan: number; tieuThu: number; dieuChinh: number; tonCuoi: number; soLanNhan: number; soLanXuat: number };

export type ThongKeMatHang = {
  materialId: number;
  tonHienTai: number;
  /** Theo thứ tự `cacQuy`. */
  theoQuy: SoQuy[];
  tongNhan: number;
  tongTieuThu: number;
  /** Tiêu thụ trung bình một quý ĐÃ HẾT (quý đang chạy chưa đủ ngày nên không tính); null = chưa có quý nào hết. */
  tbTieuThuQuy: number | null;
  /** Tồn hiện tại đủ dùng khoảng bao nhiêu quý theo mức tiêu thụ trung bình; null = không tiêu thụ. */
  duDungQuy: number | null;
  /** Không nhận, không dùng suốt các quý thống kê mà vẫn còn tồn (hàng nằm kho). */
  khongBienDong: boolean;
};

/**
 * Thống kê xuất nhập tồn của từng mặt hàng qua nhiều quý (neo vào tồn hiện tại,
 * cùng cách tính với báo cáo theo quý): nhận / tiêu thụ / điều chỉnh / tồn cuối mỗi
 * quý, số lần nhập / xuất, trung bình tiêu thụ một quý và tồn hiện tại đủ dùng mấy
 * quý. `giaoDich` phải gồm mọi dòng từ đầu quý cũ nhất tới nay.
 */
export function thongKeNhieuQuy(
  tonHienTai: ReadonlyMap<number, number>,
  giaoDich: readonly GiaoDichVatTu[],
  cacQuy: readonly KyQuy[],
  bayGio: Date
): ThongKeMatHang[] {
  if (!cacQuy.length) return [];
  const theoMat = new Map<number, GiaoDichVatTu[]>();
  for (const id of tonHienTai.keys()) theoMat.set(id, []);
  const dauTien = mocQuy(cacQuy[0]).batDau.getTime();
  for (const g of giaoDich) {
    if (g.occurredAt.getTime() < dauTien) continue;
    const ds = theoMat.get(g.materialId);
    if (ds) ds.push(g);
    else theoMat.set(g.materialId, [g]);
  }
  const moc = cacQuy.map(mocQuy);
  const ra: ThongKeMatHang[] = [];
  for (const [materialId, gd] of theoMat) {
    const ton = tonHienTai.get(materialId) ?? 0;
    const gdKy = gd.map((g) => ({ g, x: giaoDichKyVatTu(g) }));
    const theoQuy: SoQuy[] = moc.map((m) => {
      const cot = bonCotQuy(heThongQuy(ton, gdKy.map((v) => v.x), m), true, "tonDau");
      // Lần nhập / xuất THẬT trong quý (không đếm điều chỉnh, kể cả điều chỉnh do file kiểm kê ghi).
      const trong = gdKy.filter((v) => v.g.occurredAt >= m.batDau && v.g.occurredAt < m.ketThuc && !v.x.dieuChinh);
      const laNhan = (v: (typeof trong)[number]) => v.g.type === "IN" && (v.x.cotBaoCao ?? "nhan") === "nhan";
      const laXuat = (v: (typeof trong)[number]) => v.g.type === "OUT" && (v.x.cotBaoCao ?? "tieuThu") === "tieuThu";
      return {
        nhan: cot.nhan,
        tieuThu: cot.tieuThu,
        dieuChinh: cot.dieuChinh,
        tonCuoi: cot.tonCuoi,
        soLanNhan: trong.filter(laNhan).length,
        soLanXuat: trong.filter(laXuat).length,
      };
    });
    const tongNhan = lam3(theoQuy.reduce((s, q) => s + q.nhan, 0));
    const tongTieuThu = lam3(theoQuy.reduce((s, q) => s + q.tieuThu, 0));
    const daHet = theoQuy.filter((_, i) => moc[i].ketThuc.getTime() <= bayGio.getTime());
    const tbTieuThuQuy = daHet.length ? lam3(daHet.reduce((s, q) => s + q.tieuThu, 0) / daHet.length) : null;
    const coDong = theoQuy.some((q) => q.nhan !== 0 || q.tieuThu !== 0 || q.dieuChinh !== 0);
    if (!coDong && ton === 0) continue;
    ra.push({
      materialId,
      tonHienTai: lam3(ton),
      theoQuy,
      tongNhan,
      tongTieuThu,
      tbTieuThuQuy,
      duDungQuy: tbTieuThuQuy && tbTieuThuQuy > 0 ? Math.round((ton / tbTieuThuQuy) * 10) / 10 : null,
      khongBienDong: !theoQuy.some((q) => q.nhan !== 0 || q.tieuThu !== 0) && ton > 0,
    });
  }
  return ra;
}

/** Ba nhãn cảnh báo của một mặt hàng trong thống kê: dưới tồn tối thiểu · đủ dùng dưới 1 quý · nằm kho. */
export function canhBaoThongKe(x: Pick<ThongKeMatHang, "tonHienTai" | "duDungQuy" | "khongBienDong">, minStock: number) {
  return {
    thieu: minStock > 0 && x.tonHienTai < minStock,
    sapHet: x.duDungQuy !== null && x.duDungQuy < 1,
    khongDong: x.khongBienDong,
  };
}
