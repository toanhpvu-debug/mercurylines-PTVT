import "server-only";

import type { Prisma } from "@prisma/client";
import { KHOA_TON_KHO_ADVISORY, khoaAdvisoryDongTon } from "@/lib/theKho";

/*
 * LÕI GHI NHẬP / XUẤT KHO — dùng chung cho phiếu nhập / xuất từng dòng (createInventoryTransaction)
 * và nhập / xuất hàng loạt (app/nhap-xuat-hang-loat-actions.ts): một luật ghi tồn, một chỗ sửa.
 */

/**
 * Xếp hàng mọi phiếu động tới các dòng tồn sắp ghi (khóa tư vấn, tự nhả khi giao dịch kết thúc).
 * Khóa tất cả trong MỘT câu, theo thứ tự tăng dần: hai phiếu hàng loạt chọn trùng mặt hàng không
 * thể khóa chéo nhau (mỗi bên giữ một nửa rồi chờ nửa kia).
 *
 * Cần khóa cho cả nhánh NHẬP: hai phiếu nhập cùng lúc cho một cặp (vật tư, kho) chưa từng có dòng
 * tồn thì cả hai cùng thấy "chưa có" và cùng INSERT — một bên vỡ vì ràng buộc duy nhất.
 */
export async function khoaDongTonTx(tx: Prisma.TransactionClient, cap: readonly { materialId: number; warehouseId: number }[]) {
  const khoa = [...new Set(cap.map((c) => khoaAdvisoryDongTon(c.materialId, c.warehouseId)))].sort((a, b) => a - b);
  if (!khoa.length) return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_TON_KHO_ADVISORY}::int, k) FROM unnest(${khoa}::int[]) AS k`;
}

export type DongGhiNhapXuat = {
  type: "IN" | "OUT";
  materialId: number;
  warehouseId: number;
  vesselId: number;
  quantity: number;
  note: string | null;
  occurredAt: Date;
  performedBy: string;
};

/**
 * Ghi MỘT dòng nhập / xuất (nơi gọi đã khóa dòng tồn bằng khoaDongTonTx). Trả false nếu xuất mà
 * không đủ tồn — nơi gọi cuộn ngược giao dịch.
 *
 * Xuất trừ tồn bằng MỘT lệnh UPDATE có điều kiện, không đọc-rồi-ghi: điều kiện tồn ≥ số xuất nằm
 * ngay trong WHERE nên database là trọng tài — hai người cùng xuất một mặt hàng thì người sau chỉ
 * trừ được nếu phần còn lại thật sự đủ (kiểu cũ đọc số, so trong Node rồi ghi đè làm tồn tụt âm hoặc
 * mất hẳn một lần xuất). count = 0 gồm cả "chưa có dòng tồn" lẫn "tồn không đủ" — với người dùng
 * là cùng một việc.
 */
export async function ghiNhapXuatTx(tx: Prisma.TransactionClient, d: DongGhiNhapXuat): Promise<boolean> {
  if (d.type === "OUT") {
    const daTru = await tx.inventory.updateMany({
      where: { materialId: d.materialId, warehouseId: d.warehouseId, quantity: { gte: d.quantity } },
      data: { quantity: { decrement: d.quantity } },
    });
    if (daTru.count === 0) return false;
  } else {
    await tx.inventory.upsert({
      where: { materialId_warehouseId: { materialId: d.materialId, warehouseId: d.warehouseId } },
      update: { quantity: { increment: d.quantity }, vesselId: d.vesselId },
      create: { materialId: d.materialId, warehouseId: d.warehouseId, vesselId: d.vesselId, quantity: d.quantity },
    });
  }
  await tx.inventoryTransaction.create({
    data: {
      type: d.type,
      materialId: d.materialId,
      warehouseId: d.warehouseId,
      vesselId: d.vesselId,
      quantity: d.quantity,
      note: d.note,
      occurredAt: d.occurredAt,
      performedBy: d.performedBy,
    },
  });
  return true;
}

/**
 * Thời điểm thực hiện gõ vào: trống = bây giờ; cho ghi lùi (nhập bù), không cho ghi trước tương lai
 * (lệch đồng hồ 5 phút vẫn nhận). Chuỗi nên mang múi giờ (ISO từ trình duyệt): máy chủ Dokploy chạy
 * giờ UTC, chuỗi "2026-10-18T08:00" không múi giờ sẽ bị hiểu lệch 7 tiếng.
 */
export function docThoiDiemThucHien(raw: string, bayGio = Date.now()): { ngay: Date } | { loi: "khongHopLe" | "tuongLai" } {
  const s = raw.trim();
  if (!s) return { ngay: new Date(bayGio) };
  const d = new Date(s);
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return { loi: "khongHopLe" };
  if (d.getTime() > bayGio + 5 * 60 * 1000) return { loi: "tuongLai" };
  return { ngay: d };
}
