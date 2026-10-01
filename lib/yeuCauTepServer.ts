import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  docDauYeuCau,
  docDongYeuCauFile,
  dongFormTuFile,
  ghepDongYeuCau,
  loaiCuaFile,
  type DongYeuCauFile,
} from "@/lib/yeuCauNhap";

/**
 * Dựng phần điền sẵn của form lập yêu cầu từ một file MLS-11-05A/B đã đọc:
 * ghép từng dòng với danh mục, ưu tiên mặt hàng đã gán cho tàu. `phamVi` phải là
 * ĐÚNG điều kiện mà trang dùng để nạp ô chọn mặt hàng của form — nhờ vậy mặt hàng
 * ghép được luôn có trong ô chọn.
 */
export async function dienFormTuTep(
  tep: { id: number; fileName: string; vesselId: number | null; dau: unknown; dong: unknown },
  phamVi: Prisma.MaterialWhereInput,
  chu: { robFile: (n: number) => string; soGoc: (so: string) => string }
) {
  const dau = docDauYeuCau(tep.dau);
  const dong: DongYeuCauFile[] = docDongYeuCauFile(tep.dong);
  const kind = loaiCuaFile(dau, dong);
  const vatTu = await prisma.material.findMany({
    where: {
      isActive: true,
      materialType: kind,
      ...phamVi,
    },
    select: {
      id: true,
      code: true,
      nameVn: true,
      nameEn: true,
      impa: true,
      partNumber: true,
      uom: true,
      materialType: true,
      vesselMaterials: { where: { vesselId: tep.vesselId ?? -1 }, select: { id: true } },
    },
  });
  const ghep = ghepDongYeuCau(
    dong,
    kind,
    vatTu.map(({ vesselMaterials, ...m }) => ({ ...m, cuaTau: vesselMaterials.length > 0 }))
  );
  const items = dongFormTuFile(dong, ghep, (d) => [d.rob !== null ? chu.robFile(d.rob) : null, d.canhBao].filter(Boolean).join(" · ") || undefined);
  return {
    tepId: tep.id,
    ten: tep.fileName,
    kind,
    vesselId: tep.vesselId,
    department: dau.boPhan,
    requiredDate: dau.ngay ?? "",
    purpose: dau.soYeuCau ? chu.soGoc(dau.soYeuCau) : "",
    equipment: [dau.thietBi, dau.kieu ? `(${dau.kieu})` : null].filter(Boolean).join(" "),
    maker: dau.hang ?? "",
    serialNo: dau.soSeri ?? "",
    items,
    khop: ghep.filter(Boolean).length,
    moi: ghep.filter((g) => !g).length,
    thieuSo: dong.filter((d) => !(d.soLuong !== null && d.soLuong > 0)).length,
    canhBao: dong.filter((d) => d.canhBao).length,
    phan: [...new Set(dong.map((d) => d.phan).filter((p): p is string => Boolean(p)))],
    tauFile: tep.vesselId ? null : dau.tau,
  };
}
