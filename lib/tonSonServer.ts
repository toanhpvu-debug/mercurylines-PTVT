import "server-only";

import { Prisma } from "@prisma/client";
import type { HamDich } from "@/lib/i18n";
import { PAINT_TYPE_VALUES } from "@/lib/paintTypes";
import { soIn } from "@/lib/tonSon";

/*
 * SỬA / GỠ SƠN ĐÃ NHẬP — phần ghi database, chạy trong giao dịch của nơi gọi
 * (server action, hoặc script kiểm thử rồi cuộn ngược).
 *
 *   suaTonSonTx       sửa số đang có trên tàu (ghi một dòng ĐIỀU CHỈNH có lý do),
 *                     tồn tối thiểu, thông tin loại sơn (tên, hãng, màu, ĐVT…)
 *   goTonSonTx        gỡ một loại sơn khỏi tồn của tàu: GIỮ lịch sử (điều chỉnh
 *                     về 0) hoặc XÓA hẳn khi nhập nhầm (như chưa từng nhập)
 *   xoaGiaoDichSonTx  xóa một dòng nhập/xuất tay nhầm, hoàn lại tồn tương ứng
 *   goPhieuSonTx      gỡ cả một phiếu giao sơn / báo cáo tồn MLS-11-14 đã nhập:
 *                     hoàn lại đúng chiều từng dòng nó đã ghi, phiếu trở về chờ
 *                     xử lý để sửa rồi nhập lại
 *
 * Mọi thay đổi số tồn đều cộng/trừ NGUYÊN TỬ trong câu UPDATE có điều kiện (cùng
 * cách "Nhập/Xuất sơn" ở app/paint-actions.ts) — không đọc số ra rồi ghi đè, để
 * hai người cùng thao tác không làm mất phần của nhau và tồn không bao giờ âm.
 *
 * Dòng điều chỉnh mang dieuChinh = true: không phải nhận hay dùng sơn thật nên
 * trang tàu không cộng vào "tiêu thụ 12 tháng".
 */

export type MaLoiTonSon =
  | "khongCoDong"
  | "thieuLyDo"
  | "soKhongHopLe"
  | "daDoi"
  | "sanPhamDungChung"
  | "tenTrong"
  | "loaiKhongHopLe"
  | "daThiCong"
  | "khongCoGiaoDich"
  | "thuocThiCong"
  | "thuocPhieu"
  | "khongDuTon"
  | "phieuDaGo"
  | "phieuKhongXacDinh"
  | "daDungBot"
  | "baoCaoAm";

/** Lỗi nghiệp vụ nêu trong giao dịch — nơi gọi dịch theo ngôn ngữ giao diện. */
export class LoiTonSon extends Error {
  constructor(
    public ma: MaLoiTonSon,
    public thamSo: Record<string, string | number> = {}
  ) {
    super(`LoiTonSon:${ma}`);
  }
}

/** Câu báo lỗi theo ngôn ngữ giao diện. */
export function chuLoiTonSon(e: LoiTonSon, t: HamDich): string {
  const p = e.thamSo;
  switch (e.ma) {
    case "khongCoDong":
      return t("paint.tsLoiKhongCoDong");
    case "thieuLyDo":
      return t("paint.tsLoiThieuLyDo");
    case "soKhongHopLe":
      return t("paint.tsLoiSoKhongHopLe");
    case "daDoi":
      return t("paint.tsLoiDaDoi", p);
    case "sanPhamDungChung":
      return t("paint.tsLoiDungChung", p);
    case "tenTrong":
      return t("actionsModule.son_tenSonBatBuoc");
    case "loaiKhongHopLe":
      return t("actionsModule.son_loaiSonKhongHopLe");
    case "daThiCong":
      return t("paint.tsLoiDaThiCong", p);
    case "khongCoGiaoDich":
      return t("paint.gdLoiKhongCo");
    case "thuocThiCong":
      return t("paint.gdLoiThuocThiCong");
    case "thuocPhieu":
      return t("paint.gdLoiThuocPhieu");
    case "khongDuTon":
      return t("paint.gdLoiKhongDuTon", p);
    case "phieuDaGo":
      return t("paint.pgLoiDaGo");
    case "phieuKhongXacDinh":
      return t("paint.pgLoiKhongXacDinh");
    case "daDungBot":
      return t("paint.pgLoiDaDungBot", p);
    case "baoCaoAm":
      return t("paint.bcLoiAm", p);
  }
}

const EPS = 1e-9;
const lam = (n: number) => Math.round(n * 1000) / 1000;

/** Loại sơn còn dính tới bất cứ đâu (tồn, nhập/xuất, sơ đồ sơn, thi công, yêu cầu) không. */
async function conThamChieu(tx: Prisma.TransactionClient, productId: number): Promise<boolean> {
  if ((await tx.paintStock.count({ where: { productId } })) > 0) return true;
  if ((await tx.paintTransaction.count({ where: { productId } })) > 0) return true;
  if ((await tx.paintSchemeLayer.count({ where: { productId } })) > 0) return true;
  if ((await tx.paintJobLine.count({ where: { productId } })) > 0) return true;
  return (await tx.materialRequestItem.count({ where: { paintProductId: productId } })) > 0;
}

/** Loại sơn này có dùng ở tàu khác không — có thì đổi tên/hãng/màu là đổi cho cả tàu đó. */
export async function sonDungOTauKhac(tx: Prisma.TransactionClient, productId: number, vesselId: number): Promise<boolean> {
  const khac = { not: vesselId };
  if ((await tx.paintStock.count({ where: { productId, vesselId: khac } })) > 0) return true;
  if ((await tx.paintTransaction.count({ where: { productId, vesselId: khac } })) > 0) return true;
  if ((await tx.paintSchemeLayer.count({ where: { productId, area: { vesselId: khac } } })) > 0) return true;
  return (await tx.materialRequestItem.count({ where: { paintProductId: productId, request: { vesselId: khac } } })) > 0;
}

/**
 * Sau khi trừ: dọn số lẻ dấu phẩy động về 0, và bỏ hẳn dòng tồn rỗng không còn
 * gì gắn vào (tồn 0, không còn dòng nhập/xuất nào trên tàu, không đặt tối thiểu
 * — trừ khi `boQuaToiThieu`: dòng tồn do chính lần nhập đang gỡ sinh ra).
 */
async function donDongTon(tx: Prisma.TransactionClient, vesselId: number, productId: number, boQuaToiThieu = false) {
  const s = await tx.paintStock.findUnique({ where: { vesselId_productId: { vesselId, productId } } });
  if (!s) return;
  if (s.quantity !== 0 && Math.abs(s.quantity) < 1e-6) {
    await tx.paintStock.update({ where: { id: s.id }, data: { quantity: 0 } });
  }
  if (
    Math.abs(s.quantity) < 1e-6 &&
    (boQuaToiThieu || s.minQty === 0) &&
    (await tx.paintTransaction.count({ where: { vesselId, productId } })) === 0
  ) {
    await tx.paintStock.delete({ where: { id: s.id } });
  }
}

/** Trừ tồn có điều kiện "còn đủ"; không đủ thì nêu lỗi với số thật đang có. */
async function truTon(
  tx: Prisma.TransactionClient,
  vesselId: number,
  productId: number,
  soLuong: number,
  loi: (con: number) => LoiTonSon
) {
  const tru = await tx.paintStock.updateMany({
    where: { vesselId, productId, quantity: { gte: soLuong - 1e-6 } },
    data: { quantity: { decrement: soLuong } },
  });
  if (tru.count === 0) {
    const con = await tx.paintStock.findUnique({ where: { vesselId_productId: { vesselId, productId } }, select: { quantity: true } });
    throw loi(con?.quantity ?? 0);
  }
  // Trừ số thực có thể để lại -0,0000000001 — đưa về 0 ngay.
  await tx.paintStock.updateMany({ where: { vesselId, productId, quantity: { lt: 0 } }, data: { quantity: 0 } });
}

// ─── 1. Sửa một dòng tồn ─────────────────────────────────────────────────────

export type ThongTinSonSua = {
  name: string;
  maker: string | null;
  paintType: string;
  colorName: string | null;
  colorCode: string | null;
  uom: string;
  packSize: number;
};

export type KetQuaSuaTon = {
  ten: string;
  uom: string;
  truoc: number;
  sau: number;
  doiSo: boolean;
  doiMin: boolean;
  doiSanPham: boolean;
};

export async function suaTonSonTx(
  tx: Prisma.TransactionClient,
  v: {
    vesselId: number;
    productId: number;
    /** Số người dùng nhìn thấy lúc mở form — số trên tàu đổi giữa chừng thì không ghi đè. */
    soLuongCu: number;
    soLuongMoi: number | null;
    minQty: number | null;
    lyDo: string;
    nguoi: string;
    /** null = không sửa thông tin loại sơn. */
    sanPham: ThongTinSonSua | null;
    /** Thuyền trưởng / quản trị: sửa được cả loại sơn đang dùng ở tàu khác. */
    toanDoi: boolean;
  }
): Promise<KetQuaSuaTon> {
  const dong = await tx.paintStock.findUnique({
    where: { vesselId_productId: { vesselId: v.vesselId, productId: v.productId } },
    include: { product: true },
  });
  if (!dong) throw new LoiTonSon("khongCoDong");
  const p = dong.product;
  const kq: KetQuaSuaTon = { ten: p.name, uom: p.uom, truoc: dong.quantity, sau: dong.quantity, doiSo: false, doiMin: false, doiSanPham: false };

  // Thông tin loại sơn — chỉ ghi khi thực sự khác.
  if (v.sanPham) {
    const sp = { ...v.sanPham, name: v.sanPham.name.trim(), uom: v.sanPham.uom.trim() || "L" };
    const khac =
      sp.name !== p.name ||
      sp.maker !== p.maker ||
      sp.paintType !== p.paintType ||
      sp.colorName !== p.colorName ||
      sp.colorCode !== p.colorCode ||
      sp.uom !== p.uom ||
      Math.abs(sp.packSize - p.packSize) > EPS;
    if (khac) {
      if (!sp.name) throw new LoiTonSon("tenTrong");
      if (!PAINT_TYPE_VALUES.includes(sp.paintType)) throw new LoiTonSon("loaiKhongHopLe");
      if (!Number.isFinite(sp.packSize) || sp.packSize < 0) throw new LoiTonSon("soKhongHopLe");
      if (!v.toanDoi && (await sonDungOTauKhac(tx, p.id, v.vesselId))) throw new LoiTonSon("sanPhamDungChung", { ten: p.name });
      await tx.paintProduct.update({
        where: { id: p.id },
        data: {
          name: sp.name.slice(0, 200),
          maker: sp.maker?.slice(0, 100) ?? null,
          paintType: sp.paintType,
          colorName: sp.colorName?.slice(0, 100) ?? null,
          colorCode: sp.colorCode?.slice(0, 60) ?? null,
          uom: sp.uom.slice(0, 20),
          packSize: sp.packSize,
        },
      });
      kq.doiSanPham = true;
      kq.ten = sp.name;
      kq.uom = sp.uom;
    }
  }

  // Số đang có trên tàu: ghi một dòng ĐIỀU CHỈNH đúng phần chênh lệch.
  if (v.soLuongMoi !== null && Math.abs(v.soLuongMoi - v.soLuongCu) > EPS) {
    if (!Number.isFinite(v.soLuongMoi) || v.soLuongMoi < 0) throw new LoiTonSon("soKhongHopLe");
    const lyDo = v.lyDo.trim();
    if (!lyDo) throw new LoiTonSon("thieuLyDo");
    const doi = await tx.paintStock.updateMany({
      where: { vesselId: v.vesselId, productId: v.productId, quantity: v.soLuongCu },
      data: { quantity: v.soLuongMoi },
    });
    if (doi.count === 0) {
      const con = await tx.paintStock.findUnique({ where: { id: dong.id }, select: { quantity: true } });
      throw new LoiTonSon("daDoi", { con: soIn(con?.quantity ?? 0), dv: kq.uom });
    }
    const chenh = lam(v.soLuongMoi - v.soLuongCu);
    await tx.paintTransaction.create({
      data: {
        vesselId: v.vesselId,
        productId: v.productId,
        type: chenh > 0 ? "IN" : "OUT",
        quantity: Math.abs(chenh),
        note: `Điều chỉnh tồn ${soIn(v.soLuongCu)} → ${soIn(v.soLuongMoi)} ${kq.uom}: ${lyDo}`.slice(0, 300),
        performedBy: v.nguoi,
        dieuChinh: true,
      },
    });
    kq.truoc = v.soLuongCu;
    kq.sau = v.soLuongMoi;
    kq.doiSo = true;
  }

  // Tồn tối thiểu.
  if (v.minQty !== null && Math.abs(v.minQty - dong.minQty) > EPS) {
    if (!Number.isFinite(v.minQty) || v.minQty < 0) throw new LoiTonSon("soKhongHopLe");
    await tx.paintStock.update({ where: { id: dong.id }, data: { minQty: v.minQty } });
    kq.doiMin = true;
  }
  return kq;
}

// ─── 1b. Nhận dạng lại tên các loại sơn đã nhập (hàng loạt) ─────────────────

export type SuaNhanDang = ThongTinSonSua & { productId: number };

/**
 * Ghi thông tin loại sơn người dùng đã duyệt từ bộ nhận dạng tên (lib/tenSon.ts):
 * chỉ loại đang có trong tồn của tàu này; loại dùng ở tàu khác thì chỉ thuyền
 * trưởng / quản trị (đổi định nghĩa dùng chung). Không đụng số tồn.
 */
export async function apDungNhanDangTx(
  tx: Prisma.TransactionClient,
  v: { vesselId: number; ds: SuaNhanDang[]; toanDoi: boolean }
): Promise<{ soLoai: number; ten: string[] }> {
  const ten: string[] = [];
  for (const sp of v.ds) {
    const dong = await tx.paintStock.findUnique({
      where: { vesselId_productId: { vesselId: v.vesselId, productId: sp.productId } },
      select: { product: { select: { id: true, name: true } } },
    });
    if (!dong) throw new LoiTonSon("khongCoDong");
    const name = sp.name.trim();
    if (!name) throw new LoiTonSon("tenTrong");
    if (!PAINT_TYPE_VALUES.includes(sp.paintType)) throw new LoiTonSon("loaiKhongHopLe");
    if (!Number.isFinite(sp.packSize) || sp.packSize < 0 || sp.packSize > 1000) throw new LoiTonSon("soKhongHopLe");
    if (!v.toanDoi && (await sonDungOTauKhac(tx, sp.productId, v.vesselId))) throw new LoiTonSon("sanPhamDungChung", { ten: dong.product.name });
    await tx.paintProduct.update({
      where: { id: sp.productId },
      data: {
        name: name.slice(0, 200),
        maker: sp.maker?.trim().slice(0, 100) || null,
        paintType: sp.paintType,
        colorName: sp.colorName?.trim().slice(0, 100) || null,
        colorCode: sp.colorCode?.trim().slice(0, 60) || null,
        uom: (sp.uom.trim() || "L").slice(0, 20),
        packSize: sp.packSize,
      },
    });
    ten.push(`${dong.product.name} → ${name}`);
  }
  return { soLoai: v.ds.length, ten };
}

// ─── 2. Gỡ một loại sơn khỏi tồn của tàu ─────────────────────────────────────

export type CachGoSon = "GIU" | "XOA";

export type KetQuaGoTon = { ten: string; uom: string; soLuong: number; cach: CachGoSon; soGiaoDich: number; xoaLoai: boolean };

export async function goTonSonTx(
  tx: Prisma.TransactionClient,
  v: { vesselId: number; productId: number; cach: CachGoSon; lyDo: string; nguoi: string }
): Promise<KetQuaGoTon> {
  const dong = await tx.paintStock.findUnique({
    where: { vesselId_productId: { vesselId: v.vesselId, productId: v.productId } },
    include: { product: true },
  });
  if (!dong) throw new LoiTonSon("khongCoDong");
  const lyDo = v.lyDo.trim();
  if (!lyDo) throw new LoiTonSon("thieuLyDo");
  const p = dong.product;
  const kq: KetQuaGoTon = { ten: p.name, uom: p.uom, soLuong: dong.quantity, cach: v.cach, soGiaoDich: 0, xoaLoai: false };

  if (v.cach === "GIU") {
    // Xóa dòng tồn có điều kiện số chưa đổi: ai vừa nhập/xuất thêm thì dừng, không
    // gỡ mất phần của họ mà dòng điều chỉnh lại ghi theo số cũ.
    const xoa = await tx.paintStock.deleteMany({ where: { id: dong.id, quantity: dong.quantity } });
    if (xoa.count === 0) {
      const con = await tx.paintStock.findUnique({ where: { id: dong.id }, select: { quantity: true } });
      if (!con) throw new LoiTonSon("khongCoDong");
      throw new LoiTonSon("daDoi", { con: soIn(con.quantity), dv: p.uom });
    }
    if (dong.quantity > EPS) {
      await tx.paintTransaction.create({
        data: {
          vesselId: v.vesselId,
          productId: v.productId,
          type: "OUT",
          quantity: lam(dong.quantity),
          note: `Gỡ khỏi danh sách tồn (còn ${soIn(dong.quantity)} ${p.uom}): ${lyDo}`.slice(0, 300),
          performedBy: v.nguoi,
          dieuChinh: true,
        },
      });
      kq.soGiaoDich = 1;
    }
    return kq;
  }

  // XÓA HẲN — nhập nhầm: như chưa từng nhập. Đã thi công dùng sơn này thì không
  // được (nhật ký thi công là hồ sơ, xóa nó phải đi đường riêng của nó).
  const thiCong =
    (await tx.paintJobLine.count({ where: { productId: v.productId, job: { vesselId: v.vesselId } } })) +
    (await tx.paintTransaction.count({ where: { vesselId: v.vesselId, productId: v.productId, jobId: { not: null } } }));
  if (thiCong > 0) throw new LoiTonSon("daThiCong", { ten: p.name, n: thiCong });
  const dau = await tx.paintTransaction.findFirst({
    where: { vesselId: v.vesselId, productId: v.productId },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  const xoaGd = await tx.paintTransaction.deleteMany({ where: { vesselId: v.vesselId, productId: v.productId } });
  await tx.paintStock.deleteMany({ where: { vesselId: v.vesselId, productId: v.productId } });
  kq.soGiaoDich = xoaGd.count;
  // Loại sơn SINH RA từ chính lần nhập nhầm (tạo cùng lúc với lần nhập đầu tiên
  // của nó trên tàu này) mà nay không còn gì dùng → xóa luôn khỏi danh mục, để
  // lần nhập sau không ghép nhầm vào nó. Loại có sẵn trong danh mục từ trước thì giữ.
  if (dau && Math.abs(p.createdAt.getTime() - dau.createdAt.getTime()) <= 2 * 60_000 && !(await conThamChieu(tx, p.id))) {
    await tx.paintProduct.delete({ where: { id: p.id } });
    kq.xoaLoai = true;
  }
  return kq;
}

// ─── 3. Xóa một dòng nhập/xuất ───────────────────────────────────────────────

export type KetQuaXoaGiaoDich = { ten: string; uom: string; type: string; soLuong: number; dieuChinh: boolean; note: string | null };

export async function xoaGiaoDichSonTx(
  tx: Prisma.TransactionClient,
  v: { vesselId: number; giaoDichId: number; lyDo: string }
): Promise<KetQuaXoaGiaoDich> {
  const gd = await tx.paintTransaction.findUnique({
    where: { id: v.giaoDichId },
    include: { product: { select: { name: true, uom: true } } },
  });
  if (!gd || gd.vesselId !== v.vesselId) throw new LoiTonSon("khongCoGiaoDich");
  if (gd.jobId !== null) throw new LoiTonSon("thuocThiCong");
  if (gd.phieuSonId !== null) throw new LoiTonSon("thuocPhieu", { phieu: gd.phieuSonId });
  if (!v.lyDo.trim()) throw new LoiTonSon("thieuLyDo");
  if (gd.type === "IN") {
    await truTon(tx, v.vesselId, gd.productId, gd.quantity, (con) =>
      new LoiTonSon("khongDuTon", { ten: gd.product.name, con: soIn(con), can: soIn(gd.quantity), dv: gd.product.uom })
    );
  } else {
    // Hoàn lại phần đã xuất; dòng tồn đã bị gỡ thì dựng lại.
    await tx.paintStock.upsert({
      where: { vesselId_productId: { vesselId: v.vesselId, productId: gd.productId } },
      update: { quantity: { increment: gd.quantity } },
      create: { vesselId: v.vesselId, productId: gd.productId, quantity: gd.quantity },
    });
  }
  // deleteMany: người thứ hai bấm xóa cùng dòng thì 0 dòng — cuộn ngược phần tồn vừa hoàn.
  const xoa = await tx.paintTransaction.deleteMany({ where: { id: gd.id } });
  if (xoa.count === 0) throw new LoiTonSon("khongCoGiaoDich");
  await donDongTon(tx, v.vesselId, gd.productId);
  return { ten: gd.product.name, uom: gd.product.uom, type: gd.type, soLuong: gd.quantity, dieuChinh: gd.dieuChinh, note: gd.note };
}

// ─── 4. Gỡ cả một phiếu giao sơn đã nhập ─────────────────────────────────────

type SanPhamPhieu = { productId: number; soLuong: number; taoMoi: boolean };

/** Đọc ketQua của phiếu đã nhập (KetQuaNhapPhieuSon) — chỉ lấy phần cần để gỡ. */
export function docSanPhamPhieu(ketQua: unknown): SanPhamPhieu[] {
  const ds = (ketQua as { sanPham?: unknown } | null)?.sanPham;
  if (!Array.isArray(ds)) return [];
  return ds
    .map((x) => x as Record<string, unknown>)
    .filter((x) => Number.isInteger(x.productId) && typeof x.soLuong === "number")
    .map((x) => ({ productId: x.productId as number, soLuong: x.soLuong as number, taoMoi: x.taoMoi === true }));
}

/** Ghi chú lúc nhập phiếu đã ghi vào dòng nhập (app/son-phieu-actions.ts apDungPhieuSon). */
export const ghiChuNhapPhieu = (soPhieu: string, nhaCungCap: string | null) =>
  `Phiếu giao ${soPhieu}${nhaCungCap ? ` · ${nhaCungCap}` : ""}`.slice(0, 300);

export type KetQuaGoPhieu = { soPhieu: string; soLoai: number; soDong: number; tong: number; xoaLoai: number; vesselId: number };

export async function goPhieuSonTx(
  tx: Prisma.TransactionClient,
  v: { tepId: number; lyDo: string; nguoi: string; luc: string }
): Promise<KetQuaGoPhieu> {
  const lyDo = v.lyDo.trim();
  if (!lyDo) throw new LoiTonSon("thieuLyDo");
  // Khóa dòng phiếu: hai lần bấm cùng lúc thì lần sau chờ, rồi thấy phiếu đã gỡ.
  const khoa = await tx.$queryRaw<{ id: number }[]>`SELECT "id" FROM "SonPhieuTep" WHERE "id" = ${v.tepId} AND "trangThai" = 'DA_AP_DUNG' FOR UPDATE`;
  if (!khoa.length) throw new LoiTonSon("phieuDaGo");
  const tep = await tx.sonPhieuTep.findUniqueOrThrow({ where: { id: v.tepId } });
  const sanPham = docSanPhamPhieu(tep.ketQua);
  const soPhieu = tep.soPhieu ?? tep.fileName;

  let gd = await tx.paintTransaction.findMany({
    where: { phieuSonId: tep.id, vesselId: tep.vesselId },
    include: { product: { select: { name: true, uom: true } } },
    orderBy: { id: "asc" },
  });
  if (!gd.length && tep.apDungLuc && sanPham.length) {
    // Phiếu nhập trước khi có cột phieuSonId mà migration chưa gắn được: tìm theo
    // đúng ghi chú, loại sơn, số lượng, trong vài phút quanh lúc nhập.
    const ung = await tx.paintTransaction.findMany({
      where: {
        vesselId: tep.vesselId,
        type: "IN",
        jobId: null,
        phieuSonId: null,
        note: ghiChuNhapPhieu(soPhieu, tep.nhaCungCap),
        productId: { in: sanPham.map((s) => s.productId) },
        createdAt: { gte: new Date(tep.apDungLuc.getTime() - 10 * 60_000), lte: new Date(tep.apDungLuc.getTime() + 60_000) },
      },
      include: { product: { select: { name: true, uom: true } } },
      orderBy: { id: "asc" },
    });
    const chon: typeof ung = [];
    for (const s of sanPham) {
      const g = ung.find((x) => x.productId === s.productId && Math.abs(x.quantity - s.soLuong) < 1e-6 && !chon.includes(x));
      if (g) chon.push(g);
    }
    gd = chon;
  }
  if (!gd.length) throw new LoiTonSon("phieuKhongXacDinh");

  // Hoàn tác theo TỪNG LOẠI SƠN, đúng chiều từng dòng: phiếu giao chỉ có dòng nhập
  // (trừ lại); báo cáo tồn MLS-11-14 có cả dòng xuất / điều chỉnh giảm (cộng lại).
  const theoLoai = new Map<number, { net: number; ten: string; uom: string }>();
  for (const g of gd) {
    const c = theoLoai.get(g.productId) ?? { net: 0, ten: g.product.name, uom: g.product.uom };
    c.net += g.type === "IN" ? g.quantity : -g.quantity;
    theoLoai.set(g.productId, c);
  }
  for (const [productId, c] of theoLoai) {
    const net = lam(c.net);
    if (net > EPS) {
      await truTon(tx, tep.vesselId, productId, net, (con) => new LoiTonSon("daDungBot", { ten: c.ten, con: soIn(con), can: soIn(net), dv: c.uom }));
    } else if (net < -EPS) {
      await tx.paintStock.upsert({
        where: { vesselId_productId: { vesselId: tep.vesselId, productId } },
        update: { quantity: { increment: -net } },
        create: { vesselId: tep.vesselId, productId, quantity: -net },
      });
    }
  }
  await tx.paintTransaction.deleteMany({ where: { id: { in: gd.map((g) => g.id) } } });
  const loai = [...new Set(gd.map((g) => g.productId))];
  // Loại sơn do chính phiếu này sinh ra: dòng tồn của nó cũng do phiếu sinh ra —
  // gỡ phiếu là như chưa từng nhập, kể cả khi người dùng đã kịp đặt tồn tối thiểu.
  const doPhieuTao = new Set(sanPham.filter((s) => s.taoMoi).map((s) => s.productId));
  for (const id of loai) await donDongTon(tx, tep.vesselId, id, doPhieuTao.has(id));

  // Loại sơn do chính phiếu này tạo mới: không còn gì dùng thì xóa khỏi danh mục.
  let xoaLoai = 0;
  for (const s of sanPham) {
    if (!s.taoMoi) continue;
    const con = await tx.paintProduct.findUnique({ where: { id: s.productId }, select: { id: true } });
    if (con && !(await conThamChieu(tx, s.productId))) {
      await tx.paintProduct.delete({ where: { id: s.productId } });
      xoaLoai++;
    }
  }

  const ghiChu = [tep.ghiChuDoc, `Đã gỡ lần nhập (${v.luc}) bởi ${v.nguoi}: ${lyDo}`].filter(Boolean).join(" · ").slice(-1000);
  await tx.sonPhieuTep.update({
    where: { id: tep.id },
    data: { trangThai: "CHO_XU_LY", apDungBoi: null, apDungLuc: null, ketQua: Prisma.DbNull, ghiChuDoc: ghiChu },
  });
  return {
    soPhieu,
    soLoai: loai.length,
    soDong: gd.length,
    tong: lam(gd.reduce((s, g) => s + g.quantity, 0)),
    xoaLoai,
    vesselId: tep.vesselId,
  };
}
