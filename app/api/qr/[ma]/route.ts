import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveRole, vesselScopeDayDu, vesselWhere } from "@/lib/auth";
import { ROLES, VAN_HANH_TAU, danhTinhHieuLuc } from "@/lib/roles";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import { docMaTuQr } from "@/lib/qr";

export const dynamic = "force-dynamic";

/**
 * GET /api/qr/<mã> — thông tin mặt hàng cho MÀN QUÉT LIÊN TỤC.
 *
 * Màn quét (/quet) không rời trang sau mỗi lần đọc mã: nó hỏi đường này lấy tồn
 * theo kho trong phạm vi tàu của người quét, hiện bảng ghi nhập/xuất/đếm ngay
 * trên khung camera, ghi xong quét tiếp. Trang /qr/<mã> (đích của camera điện
 * thoại) vẫn là trang đầy đủ; đường này chỉ trả JSON gọn cho bảng đó.
 *
 * Ai đăng nhập cũng hỏi được (xem tồn là quyền chung), còn ghi được hay không
 * thì trả về trong `canTransact` để bảng biết ẩn nút; luật thật vẫn nằm ở server
 * action createInventoryTransaction lúc ghi.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ ma: string }> }) {
  const { t } = await layT();
  const user = await requireActiveRole([...ROLES]);
  if (!user) {
    return NextResponse.json({ error: t("actionsModule.chuaDangNhap") }, { status: 401 });
  }
  const maTho = decodeURIComponent((await params).ma);
  const ma = docMaTuQr(maTho);
  if (!ma) {
    return NextResponse.json({ error: t("qr.maKhongHopLe", { noiDung: maTho.slice(0, 80) }) }, { status: 400 });
  }
  const scope = vesselScopeDayDu(user);
  const material = await prisma.material.findFirst({
    where: { code: { equals: ma, mode: "insensitive" } },
    select: {
      id: true,
      code: true,
      nameVn: true,
      uom: true,
      materialType: true,
      impa: true,
      partNumber: true,
      minStock: true,
    },
  });

  await ghiNhatKyNguoiDung(user, {
    action: "quet-qr",
    path: `/quet`,
    vesselId: null,
    detail: material
      ? `Quét mã ${material.code} — ${material.nameVn}`
      : `Quét mã "${ma}" — không có trong danh mục`,
  });

  if (!material) {
    return NextResponse.json({ error: t("qr.khongTimThayMa", { ma }) }, { status: 404 });
  }

  const [ton, khoCuaToi] = await Promise.all([
    prisma.inventory.findMany({
      where: { materialId: material.id, ...vesselWhere(scope) },
      select: {
        warehouseId: true,
        quantity: true,
        reservedQuantity: true,
        warehouse: { select: { code: true, name: true } },
        vessel: { select: { code: true } },
      },
      orderBy: [{ vesselId: "asc" }, { warehouseId: "asc" }],
    }),
    prisma.warehouse.findMany({
      where: vesselWhere(scope),
      select: { id: true, code: true, name: true, vesselId: true },
      orderBy: { code: "asc" },
    }),
  ]);
  const canTransact =
    !scope.unassigned && danhTinhHieuLuc(user).some((d) => VAN_HANH_TAU.includes(d.role));

  return NextResponse.json({
    material,
    ton: ton.map((d) => ({
      warehouseId: d.warehouseId,
      warehouseCode: d.warehouse.code,
      warehouseName: d.warehouse.name,
      vesselCode: d.vessel.code,
      quantity: d.quantity,
      reserved: d.reservedQuantity,
    })),
    khoCuaToi,
    canTransact,
  });
}
