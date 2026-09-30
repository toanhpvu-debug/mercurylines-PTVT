import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { khoangThang, type DongThietYeu } from "@/lib/thietYeu";

/**
 * Dựng bảng báo cáo phụ tùng thiết yếu (MLS-11-04) của một tàu cho một tháng —
 * dùng chung cho trang, bản in và tệp Word nên ba nơi luôn ra cùng một số.
 *
 * Số của từng mục, theo thứ tự ưu tiên:
 *   1. ĐÃ LƯU: tàu đã lưu số kiểm tra tháng này → dùng nguyên.
 *   2. KHO: mục gắn với mặt hàng trong danh mục kho → tính từ phiếu nhập / xuất
 *      của tàu trong tháng (ban đầu = cuối tháng − nhận + dùng), như MLS-11-01.
 *   3. ƯỚC: chưa lưu, không gắn kho → ban đầu = số hiện có của tháng gần nhất
 *      đã lưu trước đó (hoặc số lúc nhập file), nhận / tiêu thụ để trống.
 */
export async function layBangThietYeu(
  vesselId: number,
  thang: string,
  /** Kiểm thử truyền giao dịch để cuộn ngược (scripts/kiem-tra-thiet-yeu-db.ts). */
  db: Prisma.TransactionClient = prisma
): Promise<DongThietYeu[]> {
  const muc = await db.phuTungThietYeu.findMany({
    where: { vesselId },
    orderBy: [{ thuTu: "asc" }, { id: "asc" }],
    include: { material: { select: { code: true } } },
  });
  if (!muc.length) return [];
  const ids = muc.map((m) => m.id);
  const [daLuu, truocDo] = await Promise.all([
    db.phuTungThietYeuThang.findMany({ where: { itemId: { in: ids }, thang } }),
    db.phuTungThietYeuThang.findMany({
      where: { itemId: { in: ids }, thang: { lt: thang } },
      orderBy: { thang: "desc" },
      select: { itemId: true, hienCo: true, viTri: true },
    }),
  ]);
  const luuTheoMuc = new Map(daLuu.map((r) => [r.itemId, r]));
  const truocTheoMuc = new Map<number, { hienCo: number | null; viTri: string | null }>();
  for (const r of truocDo) if (!truocTheoMuc.has(r.itemId)) truocTheoMuc.set(r.itemId, r);

  // Số từ kho cho các mục có gắn mặt hàng mà chưa lưu tháng này.
  const canKho = [...new Set(muc.filter((m) => m.materialId && !luuTheoMuc.has(m.id)).map((m) => m.materialId as number))];
  const soKho = new Map<number, { tonDau: number; nhan: number; tieuThu: number; hienCo: number }>();
  if (canKho.length) {
    const { dau, cuoi } = khoangThang(thang);
    const kho = await db.warehouse.findMany({ where: { vesselId }, select: { id: true } });
    const khoIds = kho.map((k) => k.id);
    const [ton, gd] = await Promise.all([
      db.inventory.findMany({ where: { warehouseId: { in: khoIds }, materialId: { in: canKho } }, select: { materialId: true, quantity: true } }),
      db.inventoryTransaction.findMany({
        where: { warehouseId: { in: khoIds }, materialId: { in: canKho }, occurredAt: { gte: dau } },
        select: { materialId: true, type: true, quantity: true, occurredAt: true },
      }),
    ]);
    const hienTai = new Map<number, number>();
    for (const r of ton) hienTai.set(r.materialId, (hienTai.get(r.materialId) ?? 0) + r.quantity);
    const sauThang = new Map<number, number>();
    const nhan = new Map<number, number>();
    const dung = new Map<number, number>();
    for (const g of gd) {
      const co = g.type === "IN" ? g.quantity : -g.quantity;
      if (g.occurredAt >= cuoi) sauThang.set(g.materialId, (sauThang.get(g.materialId) ?? 0) + co);
      else if (g.type === "IN") nhan.set(g.materialId, (nhan.get(g.materialId) ?? 0) + g.quantity);
      else dung.set(g.materialId, (dung.get(g.materialId) ?? 0) + g.quantity);
    }
    const tron = (n: number) => Math.round(n * 100) / 100;
    for (const id of canKho) {
      const cuoiThang = (hienTai.get(id) ?? 0) - (sauThang.get(id) ?? 0);
      const n = nhan.get(id) ?? 0;
      const d = dung.get(id) ?? 0;
      soKho.set(id, { tonDau: tron(cuoiThang - n + d), nhan: tron(n), tieuThu: tron(d), hienCo: tron(cuoiThang) });
    }
  }

  return muc.map((m): DongThietYeu => {
    const chung = {
      id: m.id,
      nhom: m.nhom,
      stt: m.stt ?? "",
      moTa: m.moTa,
      partNo: m.partNo,
      toiThieu: m.toiThieu,
      toiThieuSo: m.toiThieuSo,
      maVatTu: m.material?.code ?? null,
    };
    const luu = luuTheoMuc.get(m.id);
    if (luu) {
      return { ...chung, tonDau: luu.tonDau, nhan: luu.nhan, tieuThu: luu.tieuThu, hienCo: luu.hienCo, viTri: luu.viTri ?? m.viTri, nguon: "DA_LUU" };
    }
    const k = m.materialId ? soKho.get(m.materialId) : undefined;
    if (k) return { ...chung, ...k, viTri: m.viTri, nguon: "KHO" };
    const truoc = truocTheoMuc.get(m.id);
    const tonDau = truoc?.hienCo ?? m.hienCo ?? null;
    return { ...chung, tonDau, nhan: null, tieuThu: null, hienCo: tonDau, viTri: truoc?.viTri ?? m.viTri, nguon: "UOC" };
  });
}
