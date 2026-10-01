import "server-only";

import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { VAI_TRO_DUYET_PO, coQuyenDuyetPo, tongDonMua, type NguoiDuyetPo } from "@/lib/donMuaQuyTrinh";
import { vesselScopeDayDu, type NguoiThaoTac, type VesselScope } from "@/lib/roles";

/*
 * KIỂM SOÁT DUYỆT PO — phần cần database: có lãnh đạo phòng KT-VT nào được chỉ
 * định chưa, ghi lịch sử trình / duyệt, phạm vi xem đơn mua của người duyệt.
 * Luật duyệt (thuần) ở lib/donMuaQuyTrinh.ts.
 */

/** Đã có ít nhất một lãnh đạo phòng KT-VT (đang hoạt động) được chỉ định chưa. Một truy vấn mỗi request. */
export const coLanhDaoDuyetPo = cache(async (): Promise<boolean> => {
  const n = await prisma.user.count({ where: { duyetDonMua: true, isActive: true, role: { in: [...VAI_TRO_DUYET_PO] } } });
  return n > 0;
});

type Db = Prisma.TransactionClient | typeof prisma;

/** Ghi một dòng lịch sử duyệt (trình / rút lại / duyệt / trả lại) kèm tổng tiền lúc đó. */
export async function ghiLichSuDuyet(
  db: Db,
  x: {
    po: { id: number; poNo: string; currency: string; discountPercent: number; transportFee: number; deliveryFee: number; items: { quantity: number; unitPrice: number }[] };
    hanhDong: "TRINH" | "RUT_LAI" | "DUYET" | "TRA_LAI";
    nguoi: { id: number; name: string };
    kyThay?: { id: number; name: string } | null;
    ghiChu?: string | null;
  }
) {
  await db.lichSuDuyetPo.create({
    data: {
      poId: x.po.id,
      poNo: x.po.poNo,
      hanhDong: x.hanhDong,
      nguoiId: x.nguoi.id,
      nguoi: x.nguoi.name,
      kyThayId: x.kyThay?.id ?? null,
      kyThay: x.kyThay?.name ?? null,
      ghiChu: x.ghiChu || null,
      tong: tongDonMua(x.po.items, x.po.discountPercent, x.po.transportFee, x.po.deliveryFee).tong,
      tienTe: x.po.currency,
    },
  });
}

/**
 * Id người đã trình PO (lần trình gần nhất ghi ở bản cài này), nếu tên khớp cột
 * submittedBy của đơn. Đơn trình ở bản cài khác thì không có — duocDuyet so theo tên.
 */
export async function nguoiTrinhId(po: { id: number; submittedBy: string | null }): Promise<number | null> {
  if (!po.submittedBy) return null;
  const lan = await prisma.lichSuDuyetPo.findFirst({ where: { poId: po.id, hanhDong: "TRINH" }, orderBy: { id: "desc" }, select: { nguoiId: true, nguoi: true } });
  return lan && lan.nguoi === po.submittedBy ? lan.nguoiId : null;
}

/**
 * Phạm vi tàu khi XEM / DUYỆT đơn mua: người có quyền duyệt PO (lãnh đạo phòng,
 * người được ủy quyền) duyệt cho mọi tàu, dù tài khoản quản lý kỹ thuật của họ
 * chỉ được phân công vài tàu. Người khác: phạm vi thường.
 */
export function phamViDonMua(user: NguoiThaoTac & NguoiDuyetPo, coLanhDao: boolean): VesselScope {
  if (coQuyenDuyetPo(user, coLanhDao)) return { all: true, vesselId: null, vesselIds: null, unassigned: false };
  return vesselScopeDayDu(user);
}
