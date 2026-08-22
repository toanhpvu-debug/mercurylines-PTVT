import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
// Phần quyết định quyền là hàm THUẦN nên nằm ở lib/roles.ts — file này là
// "server-only" và kéo theo next/navigation, không chạy được ngoài Next (kể cả
// trong script kiểm thử). Tái xuất ở đây để mọi nơi đang import từ @/lib/auth
// giữ nguyên.
export type { VesselScope } from "@/lib/roles";
export {
  canManageVesselCatalog,
  capDuyetChoPhep,
  coQuanLyNhienLieu,
  coQuanLySon,
  coXinCapNhienLieu,
  nhomNhienLieuChoPhep,
  nhomXinCapChoPhep,
  trinhThangLenCongTy,
  vesselScope,
} from "@/lib/roles";

import { vesselScope, type VesselScope } from "@/lib/roles";

export async function requireActiveRole(roles: string[]) {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  if (!user || !user.isActive || !roles.includes(user.role)) {
    return null;
  }
  return user;
}

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    include: { vessel: true },
  });
});

// Dùng trong mọi trang sau đăng nhập: trả về user MỚI NHẤT từ database
// (vai trò / tàu phụ trách / trạng thái khóa có hiệu lực ngay, không chờ JWT hết hạn).
export async function requireScopedUser() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    redirect("/locked");
  }
  return user;
}

// Điều kiện where theo phạm vi cho các bảng có cột vesselId (-1 không khớp gì).
export function vesselWhere(scope: VesselScope) {
  return scope.all ? {} : { vesselId: scope.vesselId ?? -1 };
}

// Điều kiện where theo phạm vi cho chính bảng Vessel.
export function vesselIdWhere(scope: VesselScope) {
  return scope.all ? {} : { id: scope.vesselId ?? -1 };
}

// Yêu cầu đã cam kết (duyệt trở đi) chỉ ADMIN mới được xóa — bảo toàn hồ sơ mua sắm.
export const REQUEST_DELETABLE_BY_NON_ADMIN = [
  "DRAFT",
  "PENDING_MASTER",
  "REJECTED",
  "CANCELLED",
];

// Ai được xóa một yêu cầu: ADMIN xóa mọi trạng thái; MASTER/CREW chỉ xóa
// yêu cầu của tàu mình khi chưa duyệt/mua sắm.
export function canDeleteRequest(
  user: { role: string; vesselId: number | null },
  request: { vesselId: number; status: string }
) {
  const scope = vesselScope(user);
  if (!scope.all && request.vesselId !== scope.vesselId) {
    return false;
  }
  if (user.role === "ADMIN") {
    return true;
  }
  return REQUEST_DELETABLE_BY_NON_ADMIN.includes(request.status);
}
