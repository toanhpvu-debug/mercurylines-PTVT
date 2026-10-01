import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { warehouseKindForSheet, type WarehouseKind } from "@/lib/materialImport";
import { KHOA_TON_KHO_ADVISORY, khoaAdvisoryDongTon } from "@/lib/theKho";
import type { DongKiemKe } from "@/lib/kiemKe";

/*
 * KIỂM KÊ THEO FILE — phần chạm database: ghép từng dòng của file với mặt hàng
 * ĐÃ CÓ, tính tồn hiện tại → tồn đếm được → chênh lệch (lapKeHoachKiemKe), và
 * đặt lại tồn theo kế hoạch (apDungKeHoachKiemKe). Kế hoạch luôn được lập lại
 * ở máy chủ ngay lúc áp dụng — không tin con số trình duyệt gửi lên.
 */

type Db = Prisma.TransactionClient;

export type KhopTheo = "IMPA" | "PN" | "TEN";
export type TrangThaiDongKK =
  /** Ghép được, số đếm khác tồn hiện tại → sẽ đặt lại tồn. */
  | "THAY_DOI"
  /** Ghép được, số đếm bằng tồn hiện tại. */
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
  | "KHONG_KHO";

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
  tonHienTai: number | null;
  /** Số tồn sẽ đặt (dòng đầu của nhóm trùng mang tổng cộng dồn). */
  tonMoi: number | null;
  chenhLech: number | null;
  /** Dòng GOP: cộng vào dòng số mấy (chỉ số 0). */
  gopVao: number | null;
};

export type TongKeHoach = Record<TrangThaiDongKK, number> & {
  tang: number;
  giam: number;
  /** Mặt hàng trong danh mục tàu KHÔNG có trong file (giữ nguyên tồn). */
  khongCoTrongFile: number;
};

export type KeHoachKiemKe = { dong: DongKeHoach[]; tong: TongKeHoach };

const norm = (s: string | null | undefined) => (s ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
const normMa = (s: string | null | undefined) => norm(s).replace(/[^a-z0-9]+/g, "");
const laMaGiuCho = (s: string) => !s || /^(n\/?a|none|nil|-+|0+|x+)$/i.test(s);
const tron = (n: number) => Math.round(n * 1000) / 1000;

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
 * Lập kế hoạch: ghép dòng ↔ mặt hàng, chọn kho ghi tồn, tính chênh lệch.
 *
 * Kho của một dòng ("AUTO"): mặt hàng đang nằm ở ĐÚNG MỘT kho của tàu → kho đó
 * (đếm lại món hàng ở chỗ nó đang nằm, không đẻ thêm bản tồn thứ hai); nằm ở
 * nhiều kho → kho theo sheet nếu là một trong số đó, không thì kho đang giữ
 * nhiều nhất; chưa có tồn → kho theo sheet / loại (Phụ tùng → kho máy, Boong →
 * kho boong, còn lại → kho tiêu hao). Chọn hẳn một kho thì mọi dòng ghi vào kho đó.
 */
export async function lapKeHoachKiemKe(vesselId: number, dong: DongKiemKe[], khoChon: string, db: Db = prisma): Promise<KeHoachKiemKe> {
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
    if (dangCo.length === 1) return dangCo[0].warehouseId;
    if (dangCo.length > 1) {
      if (theoLoai && dangCo.some((r) => r.warehouseId === theoLoai)) return theoLoai;
      return [...dangCo].sort((a, b) => b.quantity - a.quantity)[0].warehouseId;
    }
    return theoLoai ?? null;
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
      tonMoi: d.ton,
      chenhLech: null,
      gopVao: null,
      ...x,
    });
    if (!khop) return co({ trangThai: d.boQua ? "BO_QUA" : d.ton === null ? "KHONG_SO" : "MOI" });
    const m = khop.m;
    const warehouseId = khoCho(d, m.id);
    const tonHienTai = warehouseId ? tron((tonTheoMat.get(m.id) ?? []).find((r) => r.warehouseId === warehouseId)?.quantity ?? 0) : null;
    return co({
      trangThai: d.boQua ? "BO_QUA" : d.ton === null ? "KHONG_SO" : warehouseId === null ? "KHONG_KHO" : "KHONG_DOI",
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
    if (k.trangThai !== "KHONG_DOI" || k.materialId === null || k.warehouseId === null) continue;
    const khoa = `${k.materialId}|${k.warehouseId}`;
    const dau = dauNhom.get(khoa);
    if (!dau) {
      dauNhom.set(khoa, k);
      continue;
    }
    dau.tonMoi = tron((dau.tonMoi ?? 0) + (k.tonMoi ?? 0));
    k.trangThai = "GOP";
    k.gopVao = dau.i;
  }
  for (const k of ke) {
    if (k.trangThai !== "KHONG_DOI") continue;
    const cl = tron((k.tonMoi ?? 0) - (k.tonHienTai ?? 0));
    k.chenhLech = cl;
    if (cl !== 0) k.trangThai = "THAY_DOI";
  }

  const tong: TongKeHoach = { THAY_DOI: 0, KHONG_DOI: 0, MOI: 0, KHONG_SO: 0, BO_QUA: 0, GOP: 0, KHONG_KHO: 0, tang: 0, giam: 0, khongCoTrongFile: 0 };
  for (const k of ke) {
    tong[k.trangThai]++;
    if (k.trangThai === "THAY_DOI") {
      if ((k.chenhLech ?? 0) > 0) tong.tang++;
      else tong.giam++;
    }
  }
  const trongFile = new Set(ke.map((k) => k.materialId).filter((x): x is number => x !== null));
  tong.khongCoTrongFile = [...trongTau].filter((id) => !trongFile.has(id)).length;
  return { dong: ke, tong };
}

/**
 * Đặt lại tồn theo kế hoạch, trong giao dịch của nơi gọi. Với mỗi dòng
 * THAY_DOI: khóa dòng tồn (cùng khóa với phiếu nhập / xuất tay), đọc LẠI tồn
 * ngay lúc ghi (có thể đã đổi từ lúc xem), đặt tồn = số đếm và ghi một giao
 * dịch NHẬP / XUẤT đúng phần chênh — thẻ kho giữ được vết "kiểm kê điều chỉnh".
 * Mặt hàng có trong hệ thống mà chưa gán cho tàu thì gán luôn.
 */
export async function apDungKeHoachKiemKe(
  tx: Db,
  x: { vesselId: number; keHoach: KeHoachKiemKe; ghiChu: string; occurredAt: Date; nguoi: string }
): Promise<{ soDong: number; tang: number; giam: number }> {
  let soDong = 0;
  let tang = 0;
  let giam = 0;
  for (const k of x.keHoach.dong) {
    if (k.trangThai !== "THAY_DOI" && !(k.trangThai === "KHONG_DOI" && k.ngoaiDanhMucTau)) continue;
    if (k.materialId === null || k.warehouseId === null || k.tonMoi === null) continue;
    if (k.ngoaiDanhMucTau) {
      await tx.vesselMaterial.upsert({
        where: { vesselId_materialId: { vesselId: x.vesselId, materialId: k.materialId } },
        update: {},
        create: { vesselId: x.vesselId, materialId: k.materialId },
      });
    }
    if (k.trangThai !== "THAY_DOI") continue;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_TON_KHO_ADVISORY}::int, ${khoaAdvisoryDongTon(k.materialId, k.warehouseId)}::int)`;
    const hienTai = await tx.inventory.findUnique({
      where: { materialId_warehouseId: { materialId: k.materialId, warehouseId: k.warehouseId } },
      select: { quantity: true },
    });
    const chenh = tron(k.tonMoi - (hienTai?.quantity ?? 0));
    await tx.inventory.upsert({
      where: { materialId_warehouseId: { materialId: k.materialId, warehouseId: k.warehouseId } },
      update: { quantity: k.tonMoi, vesselId: x.vesselId },
      create: { materialId: k.materialId, warehouseId: k.warehouseId, vesselId: x.vesselId, quantity: k.tonMoi },
    });
    if (chenh === 0) continue;
    await tx.inventoryTransaction.create({
      data: {
        type: chenh > 0 ? "IN" : "OUT",
        materialId: k.materialId,
        warehouseId: k.warehouseId,
        vesselId: x.vesselId,
        quantity: Math.abs(chenh),
        note: x.ghiChu.slice(0, 200),
        occurredAt: x.occurredAt,
        performedBy: x.nguoi,
      },
    });
    soDong++;
    if (chenh > 0) tang++;
    else giam++;
  }
  return { soDong, tang, giam };
}
