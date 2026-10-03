import "server-only";

import type { Prisma } from "@prisma/client";
import { cotGhiButToan, ghiChuButToan, gopDongBaoCaoTon, keHoachBaoCaoTon } from "@/lib/baoCaoTonSon";
import { PAINT_TYPE_VALUES } from "@/lib/paintTypes";
import { chiMucNhanDangSon, chonTheoNhanDang, gopDongNhap, type DongNhanSon } from "@/lib/phieuSon";
import { nhanDangTenSon } from "@/lib/tenSon";
import { heThongQuy, mocQuy, soIn, type KyQuy } from "@/lib/tonSon";
import { LoiTonSon } from "@/lib/tonSonServer";

/*
 * NHẬP PHIẾU GIAO SƠN / BÁO CÁO TỒN MLS-11-14 VÀO TỒN SƠN CỦA TÀU — phần ghi
 * database, chạy trong giao dịch của nơi gọi (server action, hoặc script kiểm thử
 * rồi cuộn ngược).
 *
 * Phiếu giao — mỗi loại sơn (dòng đã gộp): cộng tồn bằng upsert + increment (không
 * đọc rồi ghi lại — cùng cách "Nhập sơn" tay và nhận hàng PO) và ghi một phiếu nhập
 * PaintTransaction IN. Báo cáo tồn — capNhatTheoBaoCaoTonTx. Dòng chưa có loại
 * sơn: tạo loại mới mã SON-#### — trùng tên + hãng + màu + mã màu với loại đang có
 * (không phân biệt hoa thường), hoặc trùng khóa nhận dạng (lib/phieuSon.ts
 * khoaNhanDangSon — "JOTUN JOTAFIX …" ↔ "JOTAFIX …" · Jotun), thì dùng lại.
 */

// Vùng khóa tư vấn cấp mã SON-#### (khác vùng 811001 tồn kho, 811002 PO, 811003 yêu cầu).
const KHOA_MA_SON = 811010;

export type KetQuaNhapPhieuSon = {
  soLoai: number;
  soDong: number;
  taoMoi: number;
  tongSoLuong: number;
  sanPham: { productId: number; code: string; ten: string; soLuong: number; taoMoi: boolean }[];
};

/**
 * Loại sơn cho một dòng phiếu: loại người dùng đã chọn, không thì loại có sẵn trùng
 * tên chuẩn + hãng + màu + mã màu (hoặc trùng khóa nhận dạng, chỉ khi chắc một
 * loại), không có nữa thì TẠO MỚI mã SON-####. Dùng chung
 * cho phiếu giao và báo cáo tồn MLS-11-14 (một bộ cấp mã cho mỗi giao dịch).
 */
export function boTimLoaiSon(tx: Prisma.TransactionClient) {
  let soKe: number | null = null;
  const loaiHopLe = new Set<string>(PAINT_TYPE_VALUES);
  // Danh mục để tìm loại trùng theo khóa nhận dạng — đọc một lần (sau khi giữ khóa),
  // loại vừa tạo thêm vào để dòng sau cùng loại (ghi kiểu khác) dùng lại.
  type LoaiCo = { id: number; code: string; name: string; uom: string; maker: string | null; colorName: string | null; colorCode: string | null; packSize: number };
  let danhMuc: LoaiCo[] | null = null;
  let chiMuc: Map<string, { s: LoaiCo; hang: string | null }[]> | null = null;
  // Khóa cấp mã giữ TRƯỚC khi tìm loại trùng tên: hai lần nhập cùng lúc không cùng
  // "không thấy" rồi cùng tạo một loại mới hai lần.
  const giuKhoa = async () => {
    if (soKe !== null) return;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_MA_SON}::int, 0)`;
    const ma = await tx.paintProduct.findMany({ where: { code: { startsWith: "SON-" } }, select: { code: true } });
    soKe = Math.max(0, ...ma.map((m) => Number(m.code.slice(4))).filter((n) => Number.isFinite(n))) + 1;
  };
  const maMoi = async () => {
    await giuKhoa();
    return `SON-${String(soKe!++).padStart(4, "0")}`;
  };
  return async (
    d: DongNhanSon,
    nhanTep: { ma: string; ten: string } = { ma: "phiếu giao", ten: "phiếu" }
  ): Promise<{ sp: { id: number; code: string; name: string; uom: string }; taoMoi: boolean }> => {
    const chon = { id: true, code: true, name: true, uom: true } as const;
    if (d.paintProductId !== null) {
      const sp = await tx.paintProduct.findUnique({ where: { id: d.paintProductId }, select: chon });
      if (!sp) throw new Error(`Loại sơn #${d.paintProductId} không còn trong danh mục (dòng "${d.ten}")`);
      return { sp, taoMoi: false };
    }
    // Loại sơn mới đặt theo TÊN CHUẨN nhận dạng từ mô tả trên phiếu (lib/tenSon.ts):
    // "SON JOTAFIX PU TC RAL 5002 A 17.91L" → JOTAFIX PU TC COMP A · Jotun · Sơn phủ ·
    // RAL 5002 · 17,91 L — ô người soát đã điền (hãng, màu…) thắng phần nhận dạng.
    const nd = nhanDangTenSon(d.ten);
    const ten = (nd.ten || d.ten).trim().slice(0, 200);
    const hang = d.hang?.trim() || nd.hang;
    const mau = d.mau?.trim() || nd.mau;
    const maMau = d.maMau?.trim() || nd.maMau;
    const loai = [d.loaiSon, nd.loaiSon].find((x): x is string => Boolean(x && loaiHopLe.has(x))) ?? "OTHER";
    await giuKhoa();
    const coSan = await tx.paintProduct.findFirst({
      where: {
        name: { equals: ten, mode: "insensitive" },
        maker: hang ? { equals: hang, mode: "insensitive" } : null,
        colorName: mau ? { equals: mau, mode: "insensitive" } : null,
        // Cùng tên, khác mã màu (RAL 3000 / RAL 5002) là hai loại sơn khác nhau.
        colorCode: maMau ? { equals: maMau, mode: "insensitive" } : null,
      },
      select: chon,
    });
    if (coSan) return { sp: coSan, taoMoi: false };
    // Cùng loại ghi kiểu khác: "JOTUN JOTAFIX EPOXY PRIMER GREY COMP A 15L" ↔ "JOTAFIX
    // EPOXY PRIMER COMP A" · Jotun · GREY (lib/phieuSon.ts khoaNhanDangSon).
    danhMuc ??= await tx.paintProduct.findMany({ select: { ...chon, maker: true, colorName: true, colorCode: true, packSize: true } });
    chiMuc ??= chiMucNhanDangSon(danhMuc);
    const theoNhanDang = chonTheoNhanDang({ ten: d.ten, hang, mau, maMau, dungTich: d.dungTich ?? nd.dungTich }, chiMuc);
    if (theoNhanDang) return { sp: { id: theoNhanDang.id, code: theoNhanDang.code, name: theoNhanDang.name, uom: theoNhanDang.uom }, taoMoi: false };
    const ghiChu = [d.ma ? `Mã trên ${nhanTep.ma}: ${d.ma}` : null, ten !== d.ten.trim() ? `Tên trên ${nhanTep.ten}: ${d.ten.trim()}` : null].filter(Boolean);
    const sp = await tx.paintProduct.create({
      data: {
        code: await maMoi(),
        name: ten,
        maker: hang,
        colorName: mau,
        colorCode: maMau,
        paintType: loai,
        uom: (d.dvt || "L").slice(0, 20),
        packSize: d.dungTich ?? nd.dungTich ?? 0,
        notes: ghiChu.length ? ghiChu.join(" · ").slice(0, 500) : null,
      },
      select: { ...chon, maker: true, colorName: true, colorCode: true, packSize: true },
    });
    danhMuc.push(sp);
    chiMuc = null;
    return { sp: { id: sp.id, code: sp.code, name: sp.name, uom: sp.uom }, taoMoi: true };
  };
}

export async function nhapPhieuSonTx(
  tx: Prisma.TransactionClient,
  input: {
    vesselId: number;
    dong: DongNhanSon[];
    ghiChu: string;
    ngayNhan: Date;
    nguoi: string;
    /** Phiếu giao sinh ra các dòng nhập — gắn vào để gỡ được cả phiếu khi nhập nhầm. */
    phieuSonId?: number | null;
  }
): Promise<KetQuaNhapPhieuSon> {
  const gop = gopDongNhap(input.dong);
  const ketQua: KetQuaNhapPhieuSon = { soLoai: 0, soDong: 0, taoMoi: 0, tongSoLuong: 0, sanPham: [] };
  if (!gop.length) return ketQua;
  const timLoai = boTimLoaiSon(tx);
  for (const g of gop) {
    const { sp, taoMoi } = await timLoai(g.dau);
    if (taoMoi) ketQua.taoMoi++;
    await tx.paintStock.upsert({
      where: { vesselId_productId: { vesselId: input.vesselId, productId: sp.id } },
      update: { quantity: { increment: g.soLuong } },
      create: { vesselId: input.vesselId, productId: sp.id, quantity: g.soLuong },
    });
    await tx.paintTransaction.create({
      data: {
        vesselId: input.vesselId,
        productId: sp.id,
        type: "IN",
        quantity: g.soLuong,
        note: input.ghiChu.slice(0, 300),
        occurredAt: input.ngayNhan,
        performedBy: input.nguoi,
        phieuSonId: input.phieuSonId ?? null,
      },
    });
    ketQua.soLoai++;
    ketQua.soDong += g.soDong;
    ketQua.tongSoLuong += g.soLuong;
    ketQua.sanPham.push({ productId: sp.id, code: sp.code, ten: sp.name, soLuong: g.soLuong, taoMoi });
  }
  ketQua.tongSoLuong = Math.round(ketQua.tongSoLuong * 1000) / 1000;
  return ketQua;
}

// ─── Báo cáo lượng sơn tồn MLS-11-14 → đưa tồn về đúng số cuối quý ───────────

export type KetQuaBaoCaoTon = {
  soLoai: number;
  /** Loại đã khớp báo cáo sẵn (không ghi gì). */
  soKhop: number;
  /** Loại phải ghi thêm dòng nhập / xuất / điều chỉnh. */
  soDoi: number;
  taoMoi: number;
  soButToan: number;
  /** Đọc lại khi gỡ (lib/tonSonServer.ts docSanPhamPhieu): loại nào, có do báo cáo tạo mới không. */
  sanPham: { productId: number; code: string; ten: string; soLuong: number; taoMoi: boolean; truoc: number; sau: number }[];
};

/**
 * Ghi báo cáo tồn của MỘT quý vào tồn sơn của tàu (lib/baoCaoTonSon.ts: vì sao và
 * ghi những dòng nào). Mỗi loại sơn: khóa dòng tồn, tính lại số liệu thật của app
 * quanh quý NGAY TRONG giao dịch, lập kế hoạch, ghi các dòng (gắn phieuSonId để gỡ
 * được cả báo cáo), cộng / trừ tồn nguyên tử. Tồn hiện tại sẽ âm (sau cuối quý đã
 * xuất nhiều hơn số báo cáo còn) thì dừng cả báo cáo.
 */
export async function capNhatTheoBaoCaoTonTx(
  tx: Prisma.TransactionClient,
  input: { vesselId: number; dong: DongNhanSon[]; ky: KyQuy; nguoi: string; phieuSonId?: number | null; bayGio?: Date }
): Promise<KetQuaBaoCaoTon> {
  const { batDau, ketThuc } = mocQuy(input.ky);
  const bayGio = input.bayGio ?? new Date();
  // Tồn mang sang: ngay trước 0 giờ ngày đầu quý; còn lại: cuối quý (quý đang chạy: bây giờ).
  const lucDau = new Date(batDau.getTime() - 1);
  const lucCuoi = new Date(Math.min(ketThuc.getTime() - 1, bayGio.getTime()));
  const kq: KetQuaBaoCaoTon = { soLoai: 0, soKhop: 0, soDoi: 0, taoMoi: 0, soButToan: 0, sanPham: [] };
  const timLoai = boTimLoaiSon(tx);
  for (const g of gopDongBaoCaoTon(input.dong)) {
    // Loại MỚI mà báo cáo không có số nào khác 0: không tạo một loại sơn rỗng.
    const rong = g.tonCuoi === 0 && !g.bc.tonDau && !g.bc.nhan && !g.bc.tieuThu;
    if (g.dau.paintProductId === null && rong) continue;
    const { sp, taoMoi } = await timLoai(g.dau, { ma: "báo cáo tồn", ten: "báo cáo tồn" });
    // Khóa dòng tồn: ai nhập / xuất loại này cùng lúc phải chờ, số tính dưới đây không lệch.
    await tx.$queryRaw`SELECT "id" FROM "PaintStock" WHERE "vesselId" = ${input.vesselId} AND "productId" = ${sp.id} FOR UPDATE`;
    const ton = await tx.paintStock.findUnique({ where: { vesselId_productId: { vesselId: input.vesselId, productId: sp.id } }, select: { quantity: true } });
    const gd = await tx.paintTransaction.findMany({
      where: { vesselId: input.vesselId, productId: sp.id, occurredAt: { gte: batDau } },
      select: { productId: true, type: true, quantity: true, dieuChinh: true, occurredAt: true, cotBaoCao: true },
    });
    const ht = heThongQuy(ton?.quantity ?? 0, gd, { batDau, ketThuc });
    const kh = keHoachBaoCaoTon({ ...g.bc, tonCuoi: g.tonCuoi }, ht);
    const loiAm = () => new LoiTonSon("baoCaoAm", { ten: sp.name, so: soIn(kh.hienTaiMoi), dv: sp.uom });
    if (kh.hienTaiMoi < -1e-6) throw loiAm();
    for (const b of kh.buToan) {
      await tx.paintTransaction.create({
        data: {
          vesselId: input.vesselId,
          productId: sp.id,
          type: b.loai === "NHAN" ? "IN" : b.loai === "TIEU_THU" ? "OUT" : b.so > 0 ? "IN" : "OUT",
          quantity: Math.abs(b.so),
          dieuChinh: b.loai === "DIEU_CHINH",
          note: ghiChuButToan(b, input.ky).slice(0, 300),
          occurredAt: b.luc === "DAU_KY" ? lucDau : lucCuoi,
          performedBy: input.nguoi,
          phieuSonId: input.phieuSonId ?? null,
          // Tờ in quý xếp dòng vào đúng cột báo cáo này (lib/tonSon.ts bonCotQuy).
          cotBaoCao: cotGhiButToan(b),
        },
      });
    }
    if (kh.tongDoi > 1e-9) {
      await tx.paintStock.upsert({
        where: { vesselId_productId: { vesselId: input.vesselId, productId: sp.id } },
        update: { quantity: { increment: kh.tongDoi } },
        create: { vesselId: input.vesselId, productId: sp.id, quantity: kh.tongDoi },
      });
    } else if (kh.tongDoi < -1e-9) {
      const tru = await tx.paintStock.updateMany({
        where: { vesselId: input.vesselId, productId: sp.id, quantity: { gte: -kh.tongDoi - 1e-6 } },
        data: { quantity: { decrement: -kh.tongDoi } },
      });
      if (tru.count === 0) throw loiAm();
      await tx.paintStock.updateMany({ where: { vesselId: input.vesselId, productId: sp.id, quantity: { lt: 0 } }, data: { quantity: 0 } });
    }
    kq.soLoai++;
    if (kh.khop) kq.soKhop++;
    else kq.soDoi++;
    if (taoMoi) kq.taoMoi++;
    kq.soButToan += kh.buToan.length;
    kq.sanPham.push({ productId: sp.id, code: sp.code, ten: sp.name, soLuong: kh.tongDoi, taoMoi, truoc: ht.cuoiKy, sau: g.tonCuoi });
  }
  return kq;
}
