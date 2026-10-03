import "server-only";

import { prisma } from "@/lib/prisma";
import type { GiaoDichVatTu } from "@/lib/tonKhoQuy";

/*
 * Nạp dữ liệu cho báo cáo tồn kho theo quý và thống kê xuất nhập tồn của MỘT tàu
 * (lib/tonKhoQuy.ts tính): tồn hiện tại theo mặt hàng (cộng các kho được chọn),
 * mọi dòng kho từ một mốc tới nay, và thông tin mặt hàng — mặt hàng của danh mục
 * tàu cộng mặt hàng đã gỡ khỏi danh mục mà vẫn còn tồn / có dòng trong kỳ (bản kiểm
 * kê phải phản ánh đủ hàng thật trên tàu, như file Excel MLS-11-06).
 */

/** Bộ phận theo hậu tố mã kho (như báo cáo MLS-11-01): ENG = Máy, DECK = Boong, STORE = Kho tiêu hao. */
export const HAU_TO_KHO: Record<string, string | null> = { ALL: null, ENG: "-ENG", DECK: "-DECK", STORE: "-STORE" };
export const LOAI_HANG = ["ALL", "STORE", "SPARE"] as const;

export type VatTuKy = {
  id: number;
  code: string;
  nameVn: string;
  nameEn: string | null;
  impa: string | null;
  partNumber: string | null;
  uom: string;
  materialType: string;
  equipment: string | null;
  minStock: number;
  nhom: string;
};

export type DuLieuTonKy = {
  kho: { id: number; code: string }[];
  tonHienTai: Map<number, number>;
  /** Kho đang giữ nhiều nhất của từng mặt hàng — để mở thẻ kho. */
  khoChinh: Map<number, number>;
  giaoDich: GiaoDichVatTu[];
  vatTu: Map<number, VatTuKy>;
};

export async function taiDuLieuTonKy(x: { vesselId: number; boPhan: string; loai: string; tuNgay: Date }): Promise<DuLieuTonKy> {
  const hauTo = HAU_TO_KHO[x.boPhan] ?? null;
  const khoTau = await prisma.warehouse.findMany({ where: { vesselId: x.vesselId }, select: { id: true, code: true }, orderBy: { code: "asc" } });
  const kho = khoTau.filter((w) => !hauTo || w.code.endsWith(hauTo));
  const khoIds = kho.map((w) => w.id);
  const loai = x.loai === "STORE" || x.loai === "SPARE" ? x.loai : null;
  const [ton, gd, lienKet] = await Promise.all([
    prisma.inventory.findMany({ where: { warehouseId: { in: khoIds } }, select: { materialId: true, warehouseId: true, quantity: true } }),
    prisma.inventoryTransaction.findMany({
      where: { warehouseId: { in: khoIds }, occurredAt: { gte: x.tuNgay } },
      select: { materialId: true, type: true, quantity: true, note: true, occurredAt: true, cotBaoCao: true },
    }),
    prisma.vesselMaterial.findMany({ where: { vesselId: x.vesselId, material: { isActive: true } }, select: { materialId: true } }),
  ]);
  const ids = new Set<number>([...lienKet.map((l) => l.materialId), ...ton.filter((r) => r.quantity !== 0).map((r) => r.materialId), ...gd.map((g) => g.materialId)]);
  const mh = await prisma.material.findMany({
    where: { id: { in: [...ids] }, ...(loai ? { materialType: loai } : {}) },
    select: {
      id: true,
      code: true,
      nameVn: true,
      nameEn: true,
      impa: true,
      partNumber: true,
      uom: true,
      materialType: true,
      equipment: true,
      minStock: true,
      category: { select: { name: true } },
    },
  });
  const vatTu = new Map<number, VatTuKy>(
    mh.map((m) => [
      m.id,
      {
        id: m.id,
        code: m.code,
        nameVn: m.nameVn,
        nameEn: m.nameEn,
        impa: m.impa,
        partNumber: m.partNumber,
        uom: m.uom,
        materialType: m.materialType,
        equipment: m.equipment,
        minStock: m.minStock,
        nhom: m.category?.name ?? m.equipment ?? (m.materialType === "SPARE" ? "Spare" : "Store"),
      },
    ])
  );
  const tonHienTai = new Map<number, number>();
  const khoChinh = new Map<number, number>();
  const nhieuNhat = new Map<number, number>();
  for (const r of ton) {
    if (!vatTu.has(r.materialId)) continue;
    tonHienTai.set(r.materialId, (tonHienTai.get(r.materialId) ?? 0) + r.quantity);
    if (!khoChinh.has(r.materialId) || r.quantity > (nhieuNhat.get(r.materialId) ?? -Infinity)) {
      khoChinh.set(r.materialId, r.warehouseId);
      nhieuNhat.set(r.materialId, r.quantity);
    }
  }
  // Mặt hàng của danh mục tàu chưa từng có dòng tồn: vẫn có mặt (tồn 0) như file MLS-11-06.
  for (const id of vatTu.keys()) if (!tonHienTai.has(id)) tonHienTai.set(id, 0);
  return { kho, tonHienTai, khoChinh, giaoDich: gd.filter((g) => vatTu.has(g.materialId)), vatTu };
}

/** Số hiệu in trên chứng từ: phụ tùng → Part No. của hãng, vật tư → IMPA (không in mã nội bộ). */
export const soHieuHang = (m: Pick<VatTuKy, "materialType" | "partNumber" | "impa">) => {
  const pn = (m.partNumber ?? "").trim();
  const impa = (m.impa ?? "").trim();
  return m.materialType === "SPARE" ? pn || impa : impa || pn;
};
