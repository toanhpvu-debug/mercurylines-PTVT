import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Một lần nhập hoặc xuất — phần dùng để hiện "gần nhất" trong bảng tồn kho. */
export type GiaoDichGanNhat = {
  quantity: number;
  note: string | null;
  occurredAt: Date;
  performedBy: string | null;
};

/** Lần nhập và lần xuất gần nhất của một mặt hàng tại một kho. */
export type NhapXuatGanNhat = {
  IN?: GiaoDichGanNhat;
  OUT?: GiaoDichGanNhat;
};

/** Khóa tra cứu của một dòng tồn: cặp (vật tư, kho). */
export function khoaDongTon(materialId: number, warehouseId: number): string {
  return `${materialId}|${warehouseId}`;
}

/**
 * Vùng khóa tư vấn (advisory lock) của TỒN KHO trong PostgreSQL. Postgres chỉ có
 * một không gian khóa (int, int) chung cho cả tiến trình nên mỗi nghiệp vụ một
 * số vùng riêng. Mọi chỗ ghi tồn (phiếu nhập xuất tay, duyệt phiếu giao hàng,
 * nhận đơn mua) PHẢI xin cùng vùng này với cùng cách băm bên dưới — hai chỗ
 * dùng hai vùng khác nhau thì chúng không xếp hàng với nhau và hai phiếu cùng
 * lúc trên một dòng tồn mới lại cùng INSERT.
 */
export const KHOA_TON_KHO_ADVISORY = 811001;

/**
 * Gộp (vật tư, kho) thành một số int32 làm chìa khóa thứ hai. Đụng độ băm chỉ
 * khiến hai dòng tồn khác nhau chờ nhau một nhịp, không bao giờ sai số liệu.
 */
export function khoaAdvisoryDongTon(materialId: number, warehouseId: number): number {
  return (Math.imul(materialId, 100003) + warehouseId) | 0;
}

/** Đường dẫn thẻ kho của một mặt hàng tại một kho. */
export function duongDanTheKho(materialId: number, warehouseId: number): string {
  return `/inventory/stock-card?material=${materialId}&wh=${warehouseId}`;
}

/** Làm tròn 2 số lẻ để cộng dồn số thực không sinh đuôi 0,30000000004. */
export function lamTron(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Lần nhập và lần xuất GẦN NHẤT của mỗi cặp (vật tư, kho) trên các tàu đã cho.
 *
 * Một câu SQL thay vì N truy vấn: bảng tồn kho của cả đội có ~630 dòng, hỏi
 * từng dòng "giao dịch mới nhất của mày là gì" là 1.260 truy vấn cho một lần
 * mở trang. DISTINCT ON của PostgreSQL trả đúng dòng ĐẦU TIÊN của mỗi nhóm
 * theo thứ tự ORDER BY — ở đây là giao dịch mới nhất theo THỜI ĐIỂM THỰC HIỆN
 * (occurredAt), không phải lúc ghi sổ (createdAt): phiếu nhập bù ghi lùi ngày
 * phải xếp đúng chỗ của nó trên dòng thời gian, nếu không "xuất gần nhất" sẽ
 * chỉ vào phiếu vừa gõ chứ không phải lần xuất mới nhất thật.
 *
 * Tên bảng/cột viết đúng như Prisma tạo (không @@map): "InventoryTransaction",
 * cột camelCase có ngoặc kép.
 */
export async function layNhapXuatGanNhat(
  // null = không khoanh tàu (người toàn đội) — để gọi được ngay trong Promise.all
  // của trang, không phải đợi truy vấn danh sách tàu về rồi mới hỏi.
  vesselIds: number[] | null
): Promise<Map<string, NhapXuatGanNhat>> {
  const ket = new Map<string, NhapXuatGanNhat>();
  if (vesselIds !== null && vesselIds.length === 0) return ket;
  const dieuKien = vesselIds === null
    ? Prisma.empty
    : Prisma.sql`WHERE "vesselId" IN (${Prisma.join(vesselIds)})`;

  const dong = await prisma.$queryRaw<
    Array<{
      materialId: number;
      warehouseId: number;
      type: string;
      quantity: number;
      note: string | null;
      occurredAt: Date;
      performedBy: string | null;
    }>
  >`
    SELECT DISTINCT ON ("materialId", "warehouseId", "type")
      "materialId", "warehouseId", "type", "quantity", "note", "occurredAt", "performedBy"
    FROM "InventoryTransaction"
    ${dieuKien}
    ORDER BY "materialId", "warehouseId", "type", "occurredAt" DESC, "id" DESC
  `;

  for (const r of dong) {
    const k = khoaDongTon(r.materialId, r.warehouseId);
    const e = ket.get(k) ?? {};
    const gd: GiaoDichGanNhat = {
      quantity: r.quantity,
      note: r.note,
      occurredAt: r.occurredAt,
      performedBy: r.performedBy,
    };
    if (r.type === "IN") e.IN = gd;
    else if (r.type === "OUT") e.OUT = gd;
    ket.set(k, e);
  }
  return ket;
}
