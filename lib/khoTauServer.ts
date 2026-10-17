import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import { KHOA_TON_KHO_ADVISORY, khoaAdvisoryDongTon } from "@/lib/theKho";
import { maKho, type HangTrongKho, type LoaiKho } from "@/lib/khoTau";

type Db = PrismaClient | Prisma.TransactionClient;

/** Ba kho chuẩn của mỗi tàu — đúng mã và tên của dữ liệu sẵn có ("Kho máy - M. ODYSSEY"). */
export const KHO_CHUAN: readonly { loai: LoaiKho; ten: string }[] = [
  { loai: "DECK", ten: "Kho boong" },
  { loai: "ENG", ten: "Kho máy" },
  { loai: "STORE", ten: "Kho vật tư tiêu hao" },
];

/** Tạo ba kho chuẩn cho một tàu mới (trong giao dịch của nơi gọi). */
export async function taoKhoChuan(db: Db, tau: { id: number; code: string; name: string }) {
  await db.warehouse.createMany({
    data: KHO_CHUAN.map((k) => ({ code: maKho(tau.code, k.loai, ""), name: `${k.ten} - ${tau.name}`, warehouseType: "VESSEL", vesselId: tau.id })),
  });
}

/** Thứ còn giữ một kho lại — khác 0 ở bất kỳ ô nào thì không xóa. */
export type ConTrongKho = { dongTon: number; giaoDich: number; kiemKeCho: number };

/**
 * Một kho chỉ xóa được khi đã trống thật: không dòng tồn nào (kể cả dòng số 0 — nó vẫn nói mặt
 * hàng nằm ở đây), không dòng nhập / xuất nào (thẻ kho và báo cáo các kỳ trước cần kho này), không
 * lần kiểm kê đang chờ áp dụng nào đã chọn ghi vào kho này. "Chuyển hàng" mang cả dòng tồn lẫn lịch
 * sử của mặt hàng đi, nên kho chuyển hết hàng là trống thật.
 */
export async function conTrongKho(db: Db, khoId: number): Promise<ConTrongKho> {
  const [dongTon, giaoDich, kiemKeCho] = await Promise.all([
    db.inventory.count({ where: { warehouseId: khoId } }),
    db.inventoryTransaction.count({ where: { warehouseId: khoId } }),
    db.kiemKeTep.count({ where: { khoChon: String(khoId), trangThai: "CHO_DUYET" } }),
  ]);
  return { dongTon, giaoDich, kiemKeCho };
}

/** Các dòng tồn của một kho (hộp "Chuyển hàng"), kèm chỗ khác trên cùng tàu đang có mặt hàng đó. */
export async function hangTrongKho(db: Db, kho: { id: number; vesselId: number }): Promise<HangTrongKho[]> {
  const dong = await db.inventory.findMany({
    where: { warehouseId: kho.id },
    select: { id: true, materialId: true, quantity: true, reservedQuantity: true, material: { select: { code: true, nameVn: true, uom: true } } },
    orderBy: { material: { code: "asc" } },
  });
  const khac = dong.length
    ? await db.inventory.findMany({
        where: { vesselId: kho.vesselId, warehouseId: { not: kho.id }, materialId: { in: dong.map((d) => d.materialId) } },
        select: { materialId: true, warehouseId: true, quantity: true },
      })
    : [];
  const khacTheoMat = new Map<number, { khoId: number; so: number }[]>();
  for (const r of khac) khacTheoMat.set(r.materialId, [...(khacTheoMat.get(r.materialId) ?? []), { khoId: r.warehouseId, so: r.quantity }]);
  return dong.map((d) => ({
    id: d.id,
    materialId: d.materialId,
    ma: d.material.code,
    ten: d.material.nameVn,
    dvt: d.material.uom,
    ton: d.quantity,
    giu: d.reservedQuantity,
    khoKhac: khacTheoMat.get(d.materialId) ?? [],
  }));
}

export type KetQuaChuyenHang = { soMatHang: number; soGop: number; soGiaoDich: number; ma: string[] };

/**
 * ĐỔI VỊ TRÍ LƯU của các dòng tồn sang một kho khác CÙNG TÀU (trong giao dịch của nơi gọi).
 *
 * Đây là chỉ rõ chỗ cất mặt hàng, không phải nhập / xuất: dòng tồn (cả số đang giữ) và MỌI dòng
 * nhập / xuất của mặt hàng ở kho cũ đi theo sang kho mới, dòng đơn mua ghi "nhận vào kho cũ" cũng
 * vậy. Nhờ thế thẻ kho ở chỗ mới vẫn đủ dòng và cộng ra đúng số tồn, tổng tồn của tàu không đổi,
 * không sinh phiếu nào (báo cáo tiêu thụ không thấy một lần xuất giả), và gỡ phiếu giao / gỡ kiểm
 * kê về sau — vốn hoàn tác theo kho ghi trên từng dòng giao dịch — trừ đúng chỗ hàng đang nằm.
 * Mặt hàng đã có dòng ở kho đích thì cộng vào dòng đó (ràng buộc một dòng / mặt hàng / kho).
 *
 * Khóa cùng vùng với mọi chỗ ghi tồn (lib/theKho.ts) cho cả hai đầu, theo thứ tự tăng dần trong
 * MỘT câu lệnh, để không phiếu nhập / xuất nào chen vào giữa và hai lần chuyển ngược chiều không
 * khóa chéo nhau.
 */
export async function chuyenHangTx(tx: Prisma.TransactionClient, tuKhoId: number, denKhoId: number, inventoryIds: number[]): Promise<KetQuaChuyenHang> {
  const truoc = await tx.inventory.findMany({ where: { id: { in: inventoryIds }, warehouseId: tuKhoId }, select: { materialId: true } });
  if (!truoc.length) return { soMatHang: 0, soGop: 0, soGiaoDich: 0, ma: [] };
  const khoa = [...new Set(truoc.flatMap((d) => [khoaAdvisoryDongTon(d.materialId, tuKhoId), khoaAdvisoryDongTon(d.materialId, denKhoId)]))].sort((a, b) => a - b);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_TON_KHO_ADVISORY}::int, k) FROM unnest(${khoa}::int[]) AS k`;

  // Đọc lại SAU khi khóa: số tồn có thể vừa đổi, dòng có thể vừa đi nơi khác.
  const dong = await tx.inventory.findMany({
    where: { id: { in: inventoryIds }, warehouseId: tuKhoId },
    select: { id: true, materialId: true, quantity: true, reservedQuantity: true, material: { select: { code: true } } },
  });
  const matIds = dong.map((d) => d.materialId);
  const dich = await tx.inventory.findMany({ where: { warehouseId: denKhoId, materialId: { in: matIds } }, select: { id: true, materialId: true } });
  const dichTheoMat = new Map(dich.map((d) => [d.materialId, d.id]));

  const diChuyen: number[] = [];
  let soGop = 0;
  for (const d of dong) {
    const coSan = dichTheoMat.get(d.materialId);
    if (coSan === undefined) {
      diChuyen.push(d.id);
      continue;
    }
    await tx.inventory.update({ where: { id: coSan }, data: { quantity: { increment: d.quantity }, reservedQuantity: { increment: d.reservedQuantity } } });
    await tx.inventory.delete({ where: { id: d.id } });
    soGop++;
  }
  if (diChuyen.length) await tx.inventory.updateMany({ where: { id: { in: diChuyen } }, data: { warehouseId: denKhoId } });
  const gd = await tx.inventoryTransaction.updateMany({ where: { warehouseId: tuKhoId, materialId: { in: matIds } }, data: { warehouseId: denKhoId } });
  await tx.purchaseOrderItem.updateMany({ where: { warehouseId: tuKhoId, materialId: { in: matIds } }, data: { warehouseId: denKhoId } });
  return { soMatHang: dong.length, soGop, soGiaoDich: gd.count, ma: dong.map((d) => d.material.code) };
}
