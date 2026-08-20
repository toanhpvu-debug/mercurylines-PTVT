import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

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

export type VesselScope = {
  all: boolean;
  vesselId: number | null;
  unassigned: boolean;
};

// Quy tắc phạm vi: ADMIN luôn toàn đội; CREW/MASTER có gán tàu -> chỉ tàu đó;
// MASTER không gán tàu -> toàn đội (vai trò văn phòng); CREW không gán tàu -> không thấy tàu nào.
export function vesselScope(user: {
  role: string;
  vesselId: number | null;
}): VesselScope {
  if (user.role === "ADMIN") {
    return { all: true, vesselId: null, unassigned: false };
  }
  if (user.vesselId) {
    return { all: false, vesselId: user.vesselId, unassigned: false };
  }
  if (user.role === "MASTER") {
    return { all: true, vesselId: null, unassigned: false };
  }
  return { all: false, vesselId: null, unassigned: true };
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

// Ai được chỉnh danh mục vật tư của một tàu (gán/gỡ vật tư):
// ADMIN mọi tàu; MASTER tàu mình (hoặc toàn đội nếu không gán tàu); CREW không.
export function canManageVesselCatalog(
  user: { role: string; vesselId: number | null },
  vesselId: number
) {
  if (user.role === "ADMIN") return true;
  if (user.role === "MASTER") {
    const scope = vesselScope(user);
    return scope.all || scope.vesselId === vesselId;
  }
  return false;
}

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
