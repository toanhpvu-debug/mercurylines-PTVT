import "server-only";

import type { Prisma } from "@prisma/client";
import { coSoBaoCao, ghepChangBuoc, type DongChangBuocNhap } from "@/lib/changBuocNhap";

export type KetQuaApChangBuoc = { them: number; capNhat: number; giong: number; trung: number; boQua: number; reportId: number | null; soDongBaoCao: number };

/**
 * Áp các dòng đã soát vào danh mục dụng cụ chằng buộc của tàu, trong MỘT giao
 * dịch:
 *  - dòng chưa có → thêm dụng cụ (thứ tự sau dụng cụ cuối cùng, theo thứ tự file);
 *  - dòng đã có → bổ sung / sửa ký hiệu, và (nếu capNhatSo) số tối thiểu / chuẩn;
 *  - taoBaoCao → lưu số còn dùng / hỏng của các dòng có số thành một báo cáo
 *    MLS-11-13 (ngày, cảng theo file) — dòng báo cáo chụp lại tên / số chuẩn lúc đó.
 * Kiểm ở scripts/kiem-tra-chang-buoc-nhap.ts (database thật, cuộn ngược).
 */
export async function apDungChangBuocTx(
  tx: Prisma.TransactionClient,
  x: { vesselId: number; dong: DongChangBuocNhap[]; capNhatSo: boolean; taoBaoCao: boolean; ngay: Date; cang: string | null; nguoi: string }
): Promise<KetQuaApChangBuoc> {
  const gears = await tx.lashingGear.findMany({ where: { vesselId: x.vesselId }, orderBy: { sortOrder: "asc" } });
  const ghep = ghepChangBuoc(x.dong, gears, x.capNhatSo);
  let thuTu = gears.reduce((m, g) => Math.max(m, g.sortOrder), 0);
  const gearTheoDong = new Map<number, { id: number; name: string; partNo: string | null; minQty: number; standardQty: number }>();
  const dem = { them: 0, capNhat: 0, giong: 0, trung: 0, boQua: 0 };
  for (let i = 0; i < x.dong.length; i++) {
    const d = x.dong[i];
    const g = ghep[i];
    if (g.trangThai === "BO_QUA") {
      dem.boQua++;
      continue;
    }
    if (g.trangThai === "TRUNG") {
      dem.trung++;
      continue;
    }
    if (g.trangThai === "MOI") {
      const moi = await tx.lashingGear.create({
        data: { vesselId: x.vesselId, name: d.ten, partNo: d.kyHieu, minQty: d.toiThieu ?? 0, standardQty: d.chuan ?? 0, sortOrder: ++thuTu },
      });
      gearTheoDong.set(i, moi);
      dem.them++;
      continue;
    }
    const cu = gears.find((z) => z.id === g.gearId)!;
    if (g.trangThai === "CAP_NHAT") {
      const sau = await tx.lashingGear.update({
        where: { id: cu.id },
        data: {
          ...(d.kyHieu ? { partNo: d.kyHieu } : {}),
          ...(x.capNhatSo && d.toiThieu !== null ? { minQty: d.toiThieu } : {}),
          ...(x.capNhatSo && d.chuan !== null ? { standardQty: d.chuan } : {}),
        },
      });
      gearTheoDong.set(i, sau);
      dem.capNhat++;
    } else {
      gearTheoDong.set(i, cu);
      dem.giong++;
    }
  }
  let reportId: number | null = null;
  const dongBaoCao = x.dong.map((d, i) => ({ d, g: gearTheoDong.get(i) })).filter((v) => v.g && coSoBaoCao(v.d));
  if (x.taoBaoCao && dongBaoCao.length) {
    const r = await tx.lashingReport.create({
      data: {
        vesselId: x.vesselId,
        reportDate: x.ngay,
        position: x.cang,
        createdBy: x.nguoi,
        lines: {
          create: dongBaoCao.map(({ d, g }) => ({
            gearId: g!.id,
            gearName: g!.name,
            partNo: g!.partNo,
            minQty: g!.minQty,
            standardQty: g!.standardQty,
            inOrder: d.conDung ?? 0,
            outOfOrder: d.hong ?? 0,
          })),
        },
      },
      select: { id: true },
    });
    reportId = r.id;
  }
  return { ...dem, reportId, soDongBaoCao: reportId ? dongBaoCao.length : 0 };
}
