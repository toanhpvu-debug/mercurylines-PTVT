import "server-only";

import type { Prisma } from "@prisma/client";
import { PAINT_TYPE_VALUES } from "@/lib/paintTypes";
import { gopDongNhap, type DongNhanSon } from "@/lib/phieuSon";
import { nhanDangTenSon } from "@/lib/tenSon";

/*
 * NHẬP PHIẾU GIAO SƠN VÀO TỒN SƠN CỦA TÀU — phần ghi database, chạy trong giao
 * dịch của nơi gọi (server action, hoặc script kiểm thử rồi cuộn ngược).
 *
 * Mỗi loại sơn (dòng đã gộp): cộng tồn bằng upsert + increment (không đọc rồi
 * ghi lại — cùng cách "Nhập sơn" tay và nhận hàng PO) và ghi một phiếu nhập
 * PaintTransaction IN. Dòng chưa có loại sơn: tạo loại mới mã SON-#### — trùng
 * tên + hãng + màu với loại đang có (không phân biệt hoa thường) thì dùng lại.
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
  const coMoi = gop.some((g) => g.dau.paintProductId === null);
  let soKe = 0;
  if (coMoi) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_MA_SON}::int, 0)`;
    const ma = await tx.paintProduct.findMany({ where: { code: { startsWith: "SON-" } }, select: { code: true } });
    soKe = Math.max(0, ...ma.map((m) => Number(m.code.slice(4))).filter((n) => Number.isFinite(n))) + 1;
  }
  const loaiHopLe = new Set<string>(PAINT_TYPE_VALUES);
  for (const g of gop) {
    const d = g.dau;
    let sp: { id: number; code: string; name: string } | null = null;
    let taoMoi = false;
    if (d.paintProductId !== null) {
      sp = await tx.paintProduct.findUnique({ where: { id: d.paintProductId }, select: { id: true, code: true, name: true } });
      if (!sp) throw new Error(`Loại sơn #${d.paintProductId} không còn trong danh mục (dòng "${d.ten}")`);
    } else {
      // Loại sơn mới đặt theo TÊN CHUẨN nhận dạng từ mô tả trên phiếu (lib/tenSon.ts):
      // "SON JOTAFIX PU TC RAL 5002 A 17.91L" → JOTAFIX PU TC COMP A · Jotun · Sơn phủ ·
      // RAL 5002 · 17,91 L — ô người soát đã điền (hãng, màu…) thắng phần nhận dạng.
      const nd = nhanDangTenSon(d.ten);
      const ten = (nd.ten || d.ten).trim().slice(0, 200);
      const hang = d.hang?.trim() || nd.hang;
      const mau = d.mau?.trim() || nd.mau;
      const maMau = d.maMau?.trim() || nd.maMau;
      const loai = [d.loaiSon, nd.loaiSon].find((x): x is string => Boolean(x && loaiHopLe.has(x))) ?? "OTHER";
      sp = await tx.paintProduct.findFirst({
        where: {
          name: { equals: ten, mode: "insensitive" },
          maker: hang ? { equals: hang, mode: "insensitive" } : null,
          colorName: mau ? { equals: mau, mode: "insensitive" } : null,
          // Cùng tên, khác mã màu (RAL 3000 / RAL 5002) là hai loại sơn khác nhau.
          colorCode: maMau ? { equals: maMau, mode: "insensitive" } : null,
        },
        select: { id: true, code: true, name: true },
      });
      if (!sp) {
        const ghiChu = [d.ma ? `Mã trên phiếu giao: ${d.ma}` : null, ten !== d.ten.trim() ? `Tên trên phiếu: ${d.ten.trim()}` : null].filter(Boolean);
        sp = await tx.paintProduct.create({
          data: {
            code: `SON-${String(soKe++).padStart(4, "0")}`,
            name: ten,
            maker: hang,
            colorName: mau,
            colorCode: maMau,
            paintType: loai,
            uom: (d.dvt || "L").slice(0, 20),
            packSize: d.dungTich ?? nd.dungTich ?? 0,
            notes: ghiChu.length ? ghiChu.join(" · ").slice(0, 500) : null,
          },
          select: { id: true, code: true, name: true },
        });
        taoMoi = true;
        ketQua.taoMoi++;
      }
    }
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
