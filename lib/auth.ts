import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
// Phần quyết định quyền là hàm THUẦN nên nằm ở lib/roles.ts — file này là
// "server-only" và kéo theo next/navigation, không chạy được ngoài Next (kể cả
// trong script kiểm thử). Tái xuất ở đây để mọi nơi đang import từ @/lib/auth
// giữ nguyên.
export type { NguoiThaoTac, UyQuyen, VesselScope } from "@/lib/roles";
export {
  canManageVesselCatalog,
  capDuyetChiTiet,
  capDuyetChoPhep,
  chonDuocTau,
  coQuanLyNhienLieu,
  coQuanLySon,
  coXinCapNhienLieu,
  danhTinhHieuLuc,
  nhomNhienLieuChoPhep,
  nhomXinCapChoPhep,
  trinhThangLenCongTy,
  trongPhamVi,
  vesselScope,
  vesselScopeDayDu,
} from "@/lib/roles";

import {
  trongPhamVi,
  vesselScopeDayDu,
  type VesselScope,
} from "@/lib/roles";

export async function requireActiveRole(roles: string[]) {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  if (!user || !user.isActive) return null;
  // Luôn kèm phần quyền động: nơi gọi lấy `actor` này rồi đưa thẳng vào
  // capDuyetChoPhep / coQuanLy* — thiếu nó thì ủy quyền và phân công đội tàu
  // có trong database mà không có tác dụng gì.
  const them = await quyenDong(user.id);
  if (roles.includes(user.role)) return { ...user, ...them };
  // Quyền mượn từ ủy quyền cũng mở được cửa này — nếu không thì người được máy
  // trưởng ủy quyền vẫn bị chặn ngay từ cổng, trước cả khi xét tới việc gì.
  // ADMIN bị loại khỏi vai trò mượn: dù có dòng ủy quyền cũ trong database,
  // nó cũng không mở được 28 server action chỉ-ADMIN.
  if (
    them.uyQuyen.some(
      (u) => u.delegatorRole !== "ADMIN" && roles.includes(u.delegatorRole)
    )
  ) {
    return { ...user, ...them };
  }
  return null;
}

/**
 * Đọc phần quyền ĐỘNG của một tài khoản: tàu được phân công (tài khoản bờ) và
 * các ủy quyền còn hiệu lực tại thời điểm này.
 *
 * Đọc mỗi lần chứ không nhét vào JWT: thu hồi ủy quyền hay đổi phân công tàu
 * phải có hiệu lực NGAY, không chờ phiên đăng nhập hết hạn.
 */
async function quyenDong(userId: number) {
  const bayGio = new Date();
  const [phanCong, uyQuyen] = await Promise.all([
    prisma.fleetAssignment.findMany({
      where: { userId },
      select: { vesselId: true },
    }),
    prisma.delegation.findMany({
      where: {
        delegateId: userId,
        revokedAt: null,
        startAt: { lte: bayGio },
        endAt: { gte: bayGio },
      },
      include: {
        delegator: {
          select: {
            id: true,
            name: true,
            role: true,
            vesselId: true,
            isActive: true,
            fleetAssignments: { select: { vesselId: true } },
          },
        },
      },
    }),
  ]);
  return {
    fleetVesselIds: phanCong.map((x) => x.vesselId),
    // Người ủy quyền bị khóa tài khoản thì quyền mượn từ họ cũng hết hiệu lực:
    // khóa một người mà quyền của họ vẫn chạy qua tay người khác là khóa hụt.
    uyQuyen: uyQuyen
      .filter((u) => u.delegator.isActive)
      .map((u) => ({
        delegatorId: u.delegator.id,
        delegatorName: u.delegator.name,
        delegatorRole: u.delegator.role,
        delegatorVesselId: u.delegator.vesselId,
        delegatorFleetVesselIds: u.delegator.fleetAssignments.map(
          (x) => x.vesselId
        ),
        endAt: u.endAt,
      })),
  };
}

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  // Hai nhánh không phụ thuộc nhau: quyenDong chỉ cần session.userId — chính là
  // id vừa dùng để tra user — nên chạy song song (đo: 2,0 ms → 1,2 ms mỗi lần
  // dựng trang). Tài khoản vừa bị xóa thì nhánh quyền trả rỗng và vẫn return null.
  const [user, them] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      include: { vessel: true },
    }),
    quyenDong(session.userId),
  ]);
  if (!user) return null;
  return { ...user, ...them };
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
  if (scope.all) return {};
  if (scope.vesselIds) return { vesselId: { in: scope.vesselIds } };
  return { vesselId: scope.vesselId ?? -1 };
}

// Điều kiện where theo phạm vi cho chính bảng Vessel.
export function vesselIdWhere(scope: VesselScope) {
  if (scope.all) return {};
  if (scope.vesselIds) return { id: { in: scope.vesselIds } };
  return { id: scope.vesselId ?? -1 };
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
  user: { role: string; vesselId: number | null; fleetVesselIds?: number[] | null },
  request: { vesselId: number; status: string }
) {
  const scope = vesselScopeDayDu(user);
  if (!trongPhamVi(scope, request.vesselId)) {
    return false;
  }
  if (user.role === "ADMIN") {
    return true;
  }
  return REQUEST_DELETABLE_BY_NON_ADMIN.includes(request.status);
}
