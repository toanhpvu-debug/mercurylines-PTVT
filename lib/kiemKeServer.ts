import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { warehouseKindForSheet, type WarehouseKind } from "@/lib/materialImport";
import { KHOA_TON_KHO_ADVISORY, khoaAdvisoryDongTon } from "@/lib/theKho";
import { keHoachNhomKiemKe, type DongKiemKe, type SoFileKiemKe } from "@/lib/kiemKe";
import { cotGhiButToan, heThongQuy, kieuGhiButToan, lam3, type ButToanBaoCao, type HeThongQuy } from "@/lib/kyQuy";
import { giaoDichKyVatTu } from "@/lib/tonKhoQuy";

export type { SoFileKiemKe };

/*
 * KIỂM KÊ THEO FILE — phần chạm database: ghép từng dòng của file với mặt hàng
 * ĐÃ CÓ, rồi đưa tồn của app về đúng file THEO NGÀY CỦA FILE (lapKeHoachKiemKe /
 * apDungKeHoachKiemKe), gỡ được cả lần kiểm kê (goKiemKeTx).
 *
 * Theo ngày, không theo "bây giờ": tồn HẾT NGÀY KIỂM KÊ phải bằng số đếm; nhập /
 * xuất ghi SAU ngày đó giữ nguyên, nên tồn hiện tại = số đếm + phát sinh sau đó
 * (trước đây tồn hiện tại bị đặt thẳng bằng số đếm — file kiểm kê cuối tháng tải
 * lên giữa tháng sau xóa mất mọi lần nhập / xuất của nửa tháng đó). File có kỳ (ô
 * "Từ tháng … đến …") và ba cột Còn tồn đợt trước / Nhận / Tiêu thụ trong kỳ thì số
 * của app trong kỳ được đưa về đúng ba cột đó (cùng luật với báo cáo tồn sơn
 * MLS-11-14 — lib/kyQuy.ts keHoachBaoCaoTon): in lại kỳ đó ra đúng file. Phần lệch
 * số đếm luôn là ĐIỀU CHỈNH kiểm kê (không thành tiêu thụ). Kế hoạch luôn được lập
 * lại ở máy chủ ngay trong giao dịch lúc áp dụng — không tin số trình duyệt gửi lên.
 */

type Db = Prisma.TransactionClient;

export type KhopTheo = "IMPA" | "PN" | "TEN";
export type TrangThaiDongKK =
  /** Ghép được, app khác file → sẽ ghi dòng điều chỉnh / nhận / tiêu thụ. */
  | "THAY_DOI"
  /** Ghép được, app đã khớp file. */
  | "KHONG_DOI"
  /** Chưa có trong danh mục (không ghép được). */
  | "MOI"
  /** Ô số tồn để trống — chưa đếm, không đụng tới. */
  | "KHONG_SO"
  /** Người đối chiếu bỏ dòng. */
  | "BO_QUA"
  /** Cùng mặt hàng + kho với một dòng phía trên — số đã cộng dồn vào dòng đó. */
  | "GOP"
  /** Ghép được nhưng không xác định được kho ghi tồn (tàu thiếu kho tương ứng). */
  | "KHONG_KHO"
  /**
   * Kho tự động mà mặt hàng đang có tồn ở NHIỀU kho của tàu: số đếm của file (Tồn trên
   * tàu — cả tàu) không biết chia vào kho nào; so với một kho là đặt sai. Không áp
   * dụng — chọn hẳn kho được kiểm, hoặc dồn hàng về một kho trước.
   */
  | "NHIEU_KHO"
  /** Áp dụng thì tồn hiện tại âm: sau ngày kiểm kê đã xuất nhiều hơn số đếm — sửa số hoặc bỏ dòng. */
  | "AM";

export type DongKeHoach = {
  i: number;
  trangThai: TrangThaiDongKK;
  materialId: number | null;
  maVatTu: string | null;
  tenVatTu: string | null;
  khopTheo: KhopTheo | null;
  /** Mặt hàng có trong hệ thống nhưng chưa gán cho tàu này — áp dụng sẽ gán. */
  ngoaiDanhMucTau: boolean;
  warehouseId: number | null;
  maKho: string | null;
  /** Tồn hiện tại của mặt hàng ở kho đó. */
  tonHienTai: number | null;
  /** Tồn của app lúc hết ngày kiểm kê (ht.cuoiKy). */
  tonNgay: number | null;
  /** Số đếm sẽ đặt (dòng đầu của nhóm trùng mang tổng cộng dồn). */
  tonMoi: number | null;
  /** Số đếm − tồn của app lúc hết ngày kiểm kê. */
  chenhLech: number | null;
  /** Dòng GOP: cộng vào dòng số mấy (chỉ số 0). */
  gopVao: number | null;
  /** Số liệu app quanh kỳ của mặt hàng + kho (mọi dòng đã ghép) — trang đối chiếu tính lại kế hoạch khi sửa số. */
  ht: HeThongQuy | null;
  /** Bốn số của file đem đối chiếu (dòng đầu nhóm, đã cộng dồn). */
  soFile: SoFileKiemKe | null;
  /** Các dòng sẽ ghi (dòng đầu nhóm). */
  buToan: ButToanBaoCao[];
  /** Tồn hiện tại sau khi áp dụng (dòng đầu nhóm). */
  tonSau: number | null;
  /** Kho tự động mà mặt hàng có tồn ở nhiều kho: từng kho đang giữ bao nhiêu. */
  nhieuKho: { maKho: string; so: number }[] | null;
};

export type TongKeHoach = Record<TrangThaiDongKK, number> & {
  tang: number;
  giam: number;
  /** Mặt hàng trong danh mục tàu KHÔNG có trong file (giữ nguyên tồn). */
  khongCoTrongFile: number;
};

export type KyKiemKe = { batDau: Date; ketThuc: Date; coKy: boolean };

export type KeHoachKiemKe = { dong: DongKeHoach[]; tong: TongKeHoach; ky: KyKiemKe };

const norm = (s: string | null | undefined) => (s ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
const normMa = (s: string | null | undefined) => norm(s).replace(/[^a-z0-9]+/g, "");
const laMaGiuCho = (s: string) => !s || /^(n\/?a|none|nil|-+|0+|x+)$/i.test(s);
const congNull = (a: number | null, b: number | null) => (a === null && b === null ? null : lam3((a ?? 0) + (b ?? 0)));

type MatHang = {
  id: number;
  code: string;
  nameVn: string;
  nameEn: string | null;
  impa: string | null;
  partNumber: string | null;
  equipment: string | null;
};

/** Bộ tra mặt hàng theo IMPA / Part No / tên (+ thiết bị), ưu tiên danh mục tàu rồi mới tới toàn hệ thống. */
function boTra(ds: MatHang[]) {
  const theoImpa = new Map<string, MatHang>();
  const theoPn = new Map<string, MatHang>();
  const theoTen = new Map<string, MatHang>();
  const theoTenRieng = new Map<string, MatHang[]>();
  const khoaTen = (ten: string, tb: string | null) => `${norm(ten)}|${norm(tb)}`;
  for (const m of ds) {
    const impa = normMa(m.impa);
    if (impa.length >= 4 && !theoImpa.has(impa)) theoImpa.set(impa, m);
    const pn = normMa(m.partNumber);
    if (pn.length >= 3 && !laMaGiuCho(m.partNumber ?? "") && !theoPn.has(pn)) theoPn.set(pn, m);
    for (const ten of [m.nameVn, m.nameEn]) {
      if (!ten) continue;
      const k = khoaTen(ten, m.equipment);
      if (!theoTen.has(k)) theoTen.set(k, m);
      const kr = norm(ten);
      theoTenRieng.set(kr, [...(theoTenRieng.get(kr) ?? []), m]);
    }
  }
  return (d: DongKiemKe): { m: MatHang; theo: KhopTheo } | null => {
    const impa = normMa(d.impa);
    if (impa.length >= 4 && theoImpa.has(impa)) return { m: theoImpa.get(impa)!, theo: "IMPA" };
    const pn = normMa(d.partNo);
    if (pn.length >= 3 && !laMaGiuCho(d.partNo ?? "") && theoPn.has(pn)) return { m: theoPn.get(pn)!, theo: "PN" };
    for (const ten of [d.ten, d.tenEn]) {
      if (!ten) continue;
      const m = theoTen.get(khoaTen(ten, d.thietBi));
      if (m) return { m, theo: "TEN" };
    }
    // Tên khớp mà thiết bị ghi khác / thiếu: chỉ nhận khi tên đó là DUY NHẤT.
    for (const ten of [d.ten, d.tenEn]) {
      if (!ten) continue;
      const ds2 = [...new Set(theoTenRieng.get(norm(ten)) ?? [])];
      if (ds2.length === 1) return { m: ds2[0], theo: "TEN" };
    }
    return null;
  };
}

/**
 * Lập kế hoạch: ghép dòng ↔ mặt hàng, chọn kho ghi tồn, tính số của app quanh kỳ
 * và các dòng sẽ ghi.
 *
 * Kho của một dòng ("AUTO"): mặt hàng đang nằm ở ĐÚNG MỘT kho của tàu → kho đó
 * (đếm lại món hàng ở chỗ nó đang nằm, không đẻ thêm bản tồn thứ hai); nằm ở
 * nhiều kho → kho theo sheet nếu là một trong số đó, không thì kho đang giữ
 * nhiều nhất; chưa có tồn → kho theo sheet / loại (Phụ tùng → kho máy, Boong →
 * kho boong, còn lại → kho tiêu hao). Chọn hẳn một kho thì mọi dòng ghi vào kho đó.
 */
export async function lapKeHoachKiemKe(vesselId: number, dong: DongKiemKe[], khoChon: string, ky: KyKiemKe, db: Db = prisma): Promise<KeHoachKiemKe> {
  const [lienKet, tatCa, kho] = await Promise.all([
    db.vesselMaterial.findMany({
      where: { vesselId },
      select: { material: { select: { id: true, code: true, nameVn: true, nameEn: true, impa: true, partNumber: true, equipment: true } } },
    }),
    db.material.findMany({ select: { id: true, code: true, nameVn: true, nameEn: true, impa: true, partNumber: true, equipment: true } }),
    db.warehouse.findMany({ where: { vesselId }, select: { id: true, code: true } }),
  ]);
  const trongTau = new Set(lienKet.map((l) => l.material.id));
  const traTau = boTra(lienKet.map((l) => l.material));
  const traHeThong = boTra(tatCa);
  const khoIds = kho.map((k) => k.id);
  const maKho = new Map(kho.map((k) => [k.id, k.code]));
  const khoTheoLoai: Partial<Record<WarehouseKind, number>> = {};
  for (const k of kho) {
    if (/-ENG$/i.test(k.code)) khoTheoLoai.ENG ??= k.id;
    else if (/-DECK$/i.test(k.code)) khoTheoLoai.DECK ??= k.id;
    else if (/-STORE$/i.test(k.code)) khoTheoLoai.STORE ??= k.id;
  }
  const khoCoDinh = khoChon !== "AUTO" && khoIds.includes(Number(khoChon)) ? Number(khoChon) : null;

  const ton = await db.inventory.findMany({ where: { warehouseId: { in: khoIds } }, select: { materialId: true, warehouseId: true, quantity: true } });
  const tonTheoMat = new Map<number, { warehouseId: number; quantity: number }[]>();
  for (const r of ton) tonTheoMat.set(r.materialId, [...(tonTheoMat.get(r.materialId) ?? []), { warehouseId: r.warehouseId, quantity: r.quantity }]);

  const khoCho = (d: DongKiemKe, materialId: number): number | null => {
    if (khoCoDinh) return khoCoDinh;
    const loai: WarehouseKind = d.sheet ? warehouseKindForSheet(d.sheet) : d.loai === "SPARE" ? "ENG" : "STORE";
    const theoLoai = khoTheoLoai[loai] ?? (kho.length === 1 ? kho[0].id : undefined);
    const dangCo = (tonTheoMat.get(materialId) ?? []).filter((r) => khoIds.includes(r.warehouseId));
    // Dòng tồn bằng 0 ở kho khác không làm lệch tổng: chỉ kho đang có hàng mới tính.
    const coHang = dangCo.filter((r) => r.quantity !== 0);
    if (coHang.length === 1) return coHang[0].warehouseId;
    if (dangCo.length === 1) return dangCo[0].warehouseId;
    if (dangCo.length > 1) {
      if (theoLoai && dangCo.some((r) => r.warehouseId === theoLoai)) return theoLoai;
      return [...dangCo].sort((a, b) => b.quantity - a.quantity)[0].warehouseId;
    }
    return theoLoai ?? null;
  };
  /** Kho tự động: mặt hàng đang có hàng ở hơn một kho của tàu → danh sách kho (để báo). */
  const nhieuKhoCua = (materialId: number) => {
    if (khoCoDinh) return null;
    const coHang = (tonTheoMat.get(materialId) ?? []).filter((r) => khoIds.includes(r.warehouseId) && r.quantity !== 0);
    return coHang.length > 1 ? coHang.map((r) => ({ maKho: maKho.get(r.warehouseId) ?? String(r.warehouseId), so: lam3(r.quantity) })) : null;
  };

  const ke: DongKeHoach[] = dong.map((d, i) => {
    const khop = traTau(d) ?? traHeThong(d);
    const co = (x: Partial<DongKeHoach>): DongKeHoach => ({
      i,
      trangThai: "MOI",
      materialId: null,
      maVatTu: null,
      tenVatTu: null,
      khopTheo: null,
      ngoaiDanhMucTau: false,
      warehouseId: null,
      maKho: null,
      tonHienTai: null,
      tonNgay: null,
      tonMoi: d.ton,
      chenhLech: null,
      gopVao: null,
      ht: null,
      soFile: null,
      buToan: [],
      tonSau: null,
      nhieuKho: null,
      ...x,
    });
    if (!khop) return co({ trangThai: d.boQua ? "BO_QUA" : d.ton === null ? "KHONG_SO" : "MOI" });
    const m = khop.m;
    const warehouseId = khoCho(d, m.id);
    const tonHienTai = warehouseId ? lam3((tonTheoMat.get(m.id) ?? []).find((r) => r.warehouseId === warehouseId)?.quantity ?? 0) : null;
    const nhieuKho = nhieuKhoCua(m.id);
    return co({
      trangThai: d.boQua ? "BO_QUA" : d.ton === null ? "KHONG_SO" : warehouseId === null ? "KHONG_KHO" : nhieuKho ? "NHIEU_KHO" : "KHONG_DOI",
      nhieuKho,
      materialId: m.id,
      maVatTu: m.code,
      tenVatTu: m.nameVn,
      khopTheo: khop.theo,
      ngoaiDanhMucTau: !trongTau.has(m.id),
      warehouseId,
      maKho: warehouseId ? (maKho.get(warehouseId) ?? null) : null,
      tonHienTai,
    });
  });

  // Cùng mặt hàng + kho xuất hiện nhiều dòng (để ở nhiều chỗ trên tàu): cộng dồn vào dòng đầu.
  const dauNhom = new Map<string, DongKeHoach>();
  for (const k of ke) {
    const d = dong[k.i];
    if (k.trangThai !== "KHONG_DOI" || k.materialId === null || k.warehouseId === null) continue;
    const khoa = `${k.materialId}|${k.warehouseId}`;
    const bc = d.bc ?? { tonDau: null, nhan: null, tieuThu: null };
    const dau = dauNhom.get(khoa);
    if (!dau) {
      dauNhom.set(khoa, k);
      k.soFile = { ...bc, tonCuoi: d.ton ?? 0 };
      continue;
    }
    dau.tonMoi = lam3((dau.tonMoi ?? 0) + (k.tonMoi ?? 0));
    dau.soFile = {
      tonDau: congNull(dau.soFile!.tonDau, bc.tonDau),
      nhan: congNull(dau.soFile!.nhan, bc.nhan),
      tieuThu: congNull(dau.soFile!.tieuThu, bc.tieuThu),
      tonCuoi: dau.tonMoi,
    };
    k.trangThai = "GOP";
    k.gopVao = dau.i;
  }

  // Số của app quanh kỳ cho MỌI dòng đã ghép được kho (kể cả dòng đang bỏ qua / để
  // trống — sửa số trên trang đối chiếu là tính lại được ngay): một câu hỏi cho mọi
  // dòng kho từ đầu kỳ tới nay.
  const coKho = ke.filter((k) => k.materialId !== null && k.warehouseId !== null);
  const gd = coKho.length
    ? await db.inventoryTransaction.findMany({
        where: {
          vesselId,
          materialId: { in: [...new Set(coKho.map((k) => k.materialId!))] },
          warehouseId: { in: [...new Set(coKho.map((k) => k.warehouseId!))] },
          occurredAt: { gte: ky.batDau },
        },
        select: { materialId: true, warehouseId: true, type: true, quantity: true, note: true, occurredAt: true, cotBaoCao: true },
      })
    : [];
  const gdTheoNhom = new Map<string, typeof gd>();
  for (const g of gd) {
    const khoa = `${g.materialId}|${g.warehouseId}`;
    const ds = gdTheoNhom.get(khoa);
    if (ds) ds.push(g);
    else gdTheoNhom.set(khoa, [g]);
  }
  const htTheoNhom = new Map<string, HeThongQuy>();
  for (const k of coKho) {
    const khoa = `${k.materialId}|${k.warehouseId}`;
    let ht = htTheoNhom.get(khoa);
    if (!ht) {
      ht = heThongQuy(k.tonHienTai ?? 0, (gdTheoNhom.get(khoa) ?? []).map(giaoDichKyVatTu), ky);
      htTheoNhom.set(khoa, ht);
    }
    k.ht = ht;
    k.tonNgay = ht.cuoiKy;
  }
  for (const k of ke) {
    if (k.trangThai !== "KHONG_DOI" || !k.ht) continue;
    const kh = keHoachNhomKiemKe(k.soFile!, k.ht, ky.coKy);
    k.chenhLech = lam3((k.tonMoi ?? 0) - k.ht.cuoiKy);
    k.buToan = kh.buToan;
    k.tonSau = kh.hienTaiMoi;
    k.trangThai = kh.hienTaiMoi < -1e-6 ? "AM" : kh.khop ? "KHONG_DOI" : "THAY_DOI";
  }

  const tong: TongKeHoach = { THAY_DOI: 0, KHONG_DOI: 0, MOI: 0, KHONG_SO: 0, BO_QUA: 0, GOP: 0, KHONG_KHO: 0, NHIEU_KHO: 0, AM: 0, tang: 0, giam: 0, khongCoTrongFile: 0 };
  for (const k of ke) {
    tong[k.trangThai]++;
    if (k.trangThai === "THAY_DOI") {
      const doi = lam3((k.tonSau ?? 0) - (k.tonHienTai ?? 0));
      if (doi > 0) tong.tang++;
      else if (doi < 0) tong.giam++;
    }
  }
  const trongFile = new Set(ke.map((k) => k.materialId).filter((x): x is number => x !== null));
  tong.khongCoTrongFile = [...trongTau].filter((id) => !trongFile.has(id)).length;
  return { dong: ke, tong, ky };
}

/** Lỗi nghiệp vụ khi áp dụng / gỡ — nơi gọi dịch ra câu cho người dùng. */
export class LoiKiemKe extends Error {
  constructor(
    public ma: "am" | "daDungBot" | "khongXacDinh",
    public thamSo: Record<string, string | number> = {}
  ) {
    super(ma);
  }
}

/** Ghi chú của một dòng do file kiểm kê ghi (tiếng Việt như mọi ghi chú kho). */
export function ghiChuKiemKe(b: ButToanBaoCao, x: { tenFile: string; id: number; ky: KyKiemKe }): string {
  const so = (n: number) => String(lam3(n));
  const nguon = `kiểm kê ${x.tenFile} (#${x.id})`;
  switch (b.cot) {
    case "tonDau":
      return `Còn tồn đợt trước theo ${nguon}: ${so(b.truoc)} → ${so(b.sau)}`;
    case "nhan":
      return b.loai === "NHAN" ? `Nhận trong kỳ theo ${nguon} (đã ghi ${so(b.truoc)}, file ${so(b.sau)})` : `Sửa số nhận trong kỳ theo ${nguon} (đã ghi ${so(b.truoc)}, file ${so(b.sau)})`;
    case "tieuThu":
      return b.loai === "TIEU_THU"
        ? `Tiêu thụ trong kỳ theo ${nguon} (đã ghi ${so(b.truoc)}, file ${so(b.sau)})`
        : `Sửa số tiêu thụ trong kỳ theo ${nguon} (đã ghi ${so(b.truoc)}, file ${so(b.sau)})`;
    case "tonCuoi":
      return `Điều chỉnh ${nguon}: tồn ngày kiểm kê ${so(b.truoc)} → ${so(b.sau)}`;
  }
}

/**
 * Áp dụng kế hoạch trong giao dịch của nơi gọi. Mỗi nhóm có thay đổi: khóa dòng tồn
 * (cùng khóa với phiếu nhập / xuất tay), đọc LẠI tồn và lịch sử ngay lúc ghi, lập
 * lại kế hoạch, ghi các dòng (gắn kiemKeId + cột biểu mẫu, đúng mốc đầu / cuối kỳ),
 * cộng / trừ tồn đúng phần đổi. Tồn hiện tại sẽ âm → dừng cả lần áp dụng.
 * Mặt hàng có trong hệ thống mà chưa gán cho tàu thì gán luôn.
 */
export async function apDungKeHoachKiemKe(
  tx: Db,
  x: { vesselId: number; keHoach: KeHoachKiemKe; kiemKeId: number | null; tenFile: string; nguoi: string; bayGio?: Date }
): Promise<{ soDong: number; tang: number; giam: number; soButToan: number }> {
  const ky = x.keHoach.ky;
  const bayGio = x.bayGio ?? new Date();
  const lucDau = new Date(ky.batDau.getTime() - 1);
  const lucCuoi = new Date(Math.min(ky.ketThuc.getTime() - 1, bayGio.getTime()));
  let soDong = 0;
  let tang = 0;
  let giam = 0;
  let soButToan = 0;
  for (const k of x.keHoach.dong) {
    if (k.materialId === null || k.warehouseId === null || k.soFile === null) continue;
    if (k.trangThai !== "THAY_DOI" && k.trangThai !== "KHONG_DOI" && k.trangThai !== "AM") continue;
    if (k.ngoaiDanhMucTau) {
      await tx.vesselMaterial.upsert({
        where: { vesselId_materialId: { vesselId: x.vesselId, materialId: k.materialId } },
        update: {},
        create: { vesselId: x.vesselId, materialId: k.materialId },
      });
    }
    if (k.trangThai === "KHONG_DOI") continue;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_TON_KHO_ADVISORY}::int, ${khoaAdvisoryDongTon(k.materialId, k.warehouseId)}::int)`;
    const ton = await tx.inventory.findUnique({
      where: { materialId_warehouseId: { materialId: k.materialId, warehouseId: k.warehouseId } },
      select: { quantity: true },
    });
    const gd = await tx.inventoryTransaction.findMany({
      where: { materialId: k.materialId, warehouseId: k.warehouseId, occurredAt: { gte: ky.batDau } },
      select: { type: true, quantity: true, note: true, occurredAt: true, cotBaoCao: true },
    });
    const ht = heThongQuy(ton?.quantity ?? 0, gd.map(giaoDichKyVatTu), ky);
    const kh = keHoachNhomKiemKe(k.soFile, ht, ky.coKy);
    const loiAm = () => new LoiKiemKe("am", { ma: k.maVatTu ?? "", ten: k.tenVatTu ?? "", so: kh.hienTaiMoi, dong: k.i + 1 });
    if (kh.hienTaiMoi < -1e-6) throw loiAm();
    if (kh.khop) continue;
    for (const b of kh.buToan) {
      const kieu = kieuGhiButToan(b);
      await tx.inventoryTransaction.create({
        data: {
          type: kieu.type,
          materialId: k.materialId,
          warehouseId: k.warehouseId,
          vesselId: x.vesselId,
          quantity: kieu.quantity,
          note: ghiChuKiemKe(b, { tenFile: x.tenFile, id: x.kiemKeId ?? 0, ky }).slice(0, 200),
          occurredAt: b.luc === "DAU_KY" ? lucDau : lucCuoi,
          performedBy: x.nguoi,
          cotBaoCao: cotGhiButToan(b),
          kiemKeId: x.kiemKeId,
        },
      });
      soButToan++;
    }
    if (kh.tongDoi > 1e-9) {
      await tx.inventory.upsert({
        where: { materialId_warehouseId: { materialId: k.materialId, warehouseId: k.warehouseId } },
        update: { quantity: { increment: kh.tongDoi }, vesselId: x.vesselId },
        create: { materialId: k.materialId, warehouseId: k.warehouseId, vesselId: x.vesselId, quantity: kh.tongDoi },
      });
      tang++;
    } else if (kh.tongDoi < -1e-9) {
      const tru = await tx.inventory.updateMany({
        where: { materialId: k.materialId, warehouseId: k.warehouseId, quantity: { gte: -kh.tongDoi - 1e-6 } },
        data: { quantity: { decrement: -kh.tongDoi } },
      });
      if (tru.count === 0) throw loiAm();
      // Sai số làm tròn (−0.0000001) không để lại tồn âm.
      await tx.inventory.updateMany({ where: { materialId: k.materialId, warehouseId: k.warehouseId, quantity: { lt: 0 } }, data: { quantity: 0 } });
      giam++;
    }
    soDong++;
  }
  return { soDong, tang, giam, soButToan };
}

/**
 * Gỡ một lần kiểm kê đã áp dụng (trong giao dịch của nơi gọi): hoàn lại đúng các
 * dòng nó đã ghi (gắn kiemKeId) theo từng mặt hàng + kho — phần nó cộng thì trừ lại
 * (không đủ tồn vì đã xuất bớt → dừng), phần nó trừ thì cộng lại — rồi xóa các dòng.
 * Mặt hàng đã thêm mới vào danh mục từ file vẫn giữ (tồn về 0).
 */
export async function goKiemKeTx(tx: Db, kiemKeId: number): Promise<{ soDong: number; soMatHang: number }> {
  const gd = await tx.inventoryTransaction.findMany({
    where: { kiemKeId },
    select: { id: true, materialId: true, warehouseId: true, type: true, quantity: true },
  });
  if (!gd.length) throw new LoiKiemKe("khongXacDinh");
  const theoNhom = new Map<string, { materialId: number; warehouseId: number; net: number }>();
  for (const g of gd) {
    const khoa = `${g.materialId}|${g.warehouseId}`;
    const c = theoNhom.get(khoa) ?? { materialId: g.materialId, warehouseId: g.warehouseId, net: 0 };
    c.net += g.type === "IN" ? g.quantity : -g.quantity;
    theoNhom.set(khoa, c);
  }
  for (const c of theoNhom.values()) {
    const net = lam3(c.net);
    if (net === 0) continue;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_TON_KHO_ADVISORY}::int, ${khoaAdvisoryDongTon(c.materialId, c.warehouseId)}::int)`;
    if (net > 0) {
      const tru = await tx.inventory.updateMany({
        where: { materialId: c.materialId, warehouseId: c.warehouseId, quantity: { gte: net - 1e-6 } },
        data: { quantity: { decrement: net } },
      });
      if (tru.count === 0) {
        const [m, ton] = await Promise.all([
          tx.material.findUnique({ where: { id: c.materialId }, select: { code: true, nameVn: true } }),
          tx.inventory.findUnique({ where: { materialId_warehouseId: { materialId: c.materialId, warehouseId: c.warehouseId } }, select: { quantity: true } }),
        ]);
        throw new LoiKiemKe("daDungBot", { ma: m?.code ?? "", ten: m?.nameVn ?? "", con: lam3(ton?.quantity ?? 0), can: net });
      }
      await tx.inventory.updateMany({ where: { materialId: c.materialId, warehouseId: c.warehouseId, quantity: { lt: 0 } }, data: { quantity: 0 } });
    } else {
      await tx.inventory.upsert({
        where: { materialId_warehouseId: { materialId: c.materialId, warehouseId: c.warehouseId } },
        update: { quantity: { increment: -net } },
        create: { materialId: c.materialId, warehouseId: c.warehouseId, vesselId: (await tx.warehouse.findUniqueOrThrow({ where: { id: c.warehouseId }, select: { vesselId: true } })).vesselId!, quantity: -net },
      });
    }
  }
  await tx.inventoryTransaction.deleteMany({ where: { id: { in: gd.map((g) => g.id) } } });
  return { soDong: gd.length, soMatHang: theoNhom.size };
}
