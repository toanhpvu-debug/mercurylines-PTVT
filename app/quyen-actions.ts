"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireActiveRole } from "@/lib/auth";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { ROLE_LABEL } from "@/lib/roles";

// Server action cho phần phân quyền nâng cao: phân công đội tàu cho tài khoản
// bờ, và ủy quyền có thời hạn. Tách khỏi app/actions.ts vì đây là nghiệp vụ
// quản trị, không phải nghiệp vụ vật tư.

const NO_PERMISSION = "Bạn không có quyền thực hiện thao tác này.";

type ActionState = { message: string; success?: boolean };

/**
 * Đặt lại danh sách tàu mà một tài khoản BỜ phụ trách.
 *
 * Thay cả cụm thay vì thêm/bớt từng dòng: giao diện là một danh sách ô đánh
 * dấu, người dùng nghĩ theo kiểu "ông này phụ trách mấy tàu này", nên lưu cũng
 * nên theo đúng cách nghĩ đó.
 */
export async function capNhatPhanCongDoiTau(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) return { message: NO_PERMISSION };

  const userId = Number(formData.get("userId"));
  if (!Number.isInteger(userId) || userId <= 0) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { message: "Không tìm thấy người dùng." };
  if (user.role !== "TECH_MANAGER") {
    // ADMIN luôn thấy toàn đội; người trên tàu bị giới hạn bằng cột vesselId.
    // Phân công đội tàu chỉ có nghĩa với quản lý kỹ thuật.
    return {
      message: `Phân công đội tàu chỉ áp dụng cho ${ROLE_LABEL.TECH_MANAGER}.`,
    };
  }

  const vesselIds = formData
    .getAll("vesselIds")
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);
  const coThat = vesselIds.length
    ? await prisma.vessel.findMany({
        where: { id: { in: vesselIds } },
        select: { id: true },
      })
    : [];
  const hopLe = coThat.map((v) => v.id);

  await prisma.$transaction([
    prisma.fleetAssignment.deleteMany({ where: { userId } }),
    ...(hopLe.length
      ? [
          prisma.fleetAssignment.createMany({
            data: hopLe.map((vesselId) => ({ userId, vesselId })),
          }),
        ]
      : []),
  ]);

  await ghiNhatKyNguoiDung(admin, {
    action: "phan-cong-doi-tau",
    path: "/users",
    // Phân công người phụ trách là việc của công ty, không thuộc tàu nào.
    vesselId: null,
    detail: hopLe.length
      ? `${user.email}: phụ trách ${hopLe.length} tàu (id ${hopLe.join(", ")})`
      : `${user.email}: bỏ phân công — trở lại thấy toàn đội`,
  });

  revalidatePath("/users");
  return {
    message: hopLe.length
      ? `Đã phân công ${hopLe.length} tàu cho ${user.name}.`
      : `Đã bỏ phân công tàu của ${user.name} — tài khoản này trở lại thấy toàn đội.`,
    success: true,
  };
}

/**
 * Lập một ủy quyền có thời hạn.
 *
 * Ai lập được: quản trị lập cho bất kỳ ai; ngoài ra mỗi người tự giao quyền
 * của CHÍNH MÌNH cho người khác. Không cho lập hộ người thứ ba — quyền đi từ
 * người có nó, chứ không phải từ người đứng gần đó.
 */
export async function taoUyQuyen(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me || !me.isActive) return { message: NO_PERMISSION };

  const delegatorId = Number(formData.get("delegatorId")) || me.id;
  const delegateId = Number(formData.get("delegateId"));
  const laAdmin = me.role === "ADMIN";
  if (!laAdmin && delegatorId !== me.id) {
    return { message: "Chỉ ủy quyền được phần quyền của chính mình." };
  }
  if (!Number.isInteger(delegateId) || delegateId <= 0) {
    return { message: "Chọn người nhận ủy quyền." };
  }
  if (delegateId === delegatorId) {
    return { message: "Không thể ủy quyền cho chính mình." };
  }

  const [delegator, delegate] = await Promise.all([
    prisma.user.findUnique({ where: { id: delegatorId } }),
    prisma.user.findUnique({ where: { id: delegateId } }),
  ]);
  if (!delegator || !delegate) return { message: "Không tìm thấy người dùng." };
  // Quyền quản trị hệ thống KHÔNG phải thẩm quyền nghiệp vụ: nó là quyền trên
  // chính cái hệ thống này, không gắn với một chức danh trên tàu nào để mà đi
  // vắng và giao lại. Cho mượn được thì một dòng ủy quyền biến người nhận thành
  // quản trị viên và mở toàn bộ đội tàu cho họ, hết hạn lúc nào không ai theo.
  //
  // Hàng rào này ĐỘC LẬP với việc form chọn sẵn ai: LapUyQuyen nay bắt chọn tay
  // ô "Người giao quyền", nhưng delegatorId vẫn tới từ FormData nên không được
  // tin. Đừng gỡ nhánh này vì thấy form đã an toàn.
  if (delegator.role === "ADMIN") {
    return {
      message:
        "Không ủy quyền được quyền quản trị hệ thống. Hãy chọn người giao quyền là thuyền trưởng / máy trưởng / quản lý kỹ thuật.",
    };
  }
  if (!delegate.isActive) {
    return { message: `Tài khoản ${delegate.email} đang bị khóa.` };
  }

  const startAt = ngay(formData.get("startAt"));
  const endAt = ngay(formData.get("endAt"), true);
  if (!startAt || !endAt) return { message: "Nhập đủ ngày bắt đầu và ngày hết hạn." };
  if (endAt <= startAt) {
    return { message: "Ngày hết hạn phải sau ngày bắt đầu." };
  }
  // Ủy quyền VÔ THỜI HẠN là thứ nguy hiểm nhất ở đây: người ta lập một lần rồi
  // quên, và quyền cứ nằm đó. Chặn cứng ở một năm.
  const MOT_NAM = 366 * 24 * 60 * 60 * 1000;
  if (endAt.getTime() - startAt.getTime() > MOT_NAM) {
    return { message: "Ủy quyền tối đa một năm. Hết hạn thì lập lại." };
  }

  const reason = String(formData.get("reason") || "").trim() || null;
  const uq = await prisma.delegation.create({
    data: {
      delegatorId,
      delegateId,
      startAt,
      endAt,
      reason,
      createdById: me.id,
    },
  });

  await ghiNhatKyNguoiDung(me, {
    action: "tao-uy-quyen",
    path: "/users",
    // Ủy quyền ký thay áp cho mọi tàu người ấy phụ trách, không riêng tàu nào.
    vesselId: null,
    detail:
      `#${uq.id} ${delegator.email} (${ROLE_LABEL[delegator.role] ?? delegator.role})` +
      ` → ${delegate.email}, ${startAt.toLocaleDateString("vi-VN")} → ${endAt.toLocaleDateString("vi-VN")}` +
      (reason ? `, lý do: ${reason}` : ""),
  });

  revalidatePath("/users");
  return {
    message: `Đã ủy quyền cho ${delegate.name} tới ${endAt.toLocaleDateString("vi-VN")}.`,
    success: true,
  };
}

/**
 * Thu hồi trước hạn.
 *
 * Ghi revokedAt chứ không xóa dòng: hồ sơ phải trả lời được câu "ngày 12/3 ai
 * có quyền ký thay máy trưởng", mà xóa đi thì không trả lời được nữa.
 */
export async function thuHoiUyQuyen(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me || !me.isActive) return { message: NO_PERMISSION };

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { message: "Dữ liệu không hợp lệ." };
  const uq = await prisma.delegation.findUnique({
    where: { id },
    include: { delegate: true, delegator: true },
  });
  if (!uq) return { message: "Không tìm thấy ủy quyền." };
  if (me.role !== "ADMIN" && uq.delegatorId !== me.id) {
    return { message: "Chỉ người đã ủy quyền hoặc quản trị mới thu hồi được." };
  }
  if (uq.revokedAt) return { message: "Ủy quyền này đã được thu hồi." };

  await prisma.delegation.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  await ghiNhatKyNguoiDung(me, {
    action: "thu-hoi-uy-quyen",
    path: "/users",
    vesselId: null,
    detail: `#${id} ${uq.delegator.email} → ${uq.delegate.email}`,
  });

  revalidatePath("/users");
  return { message: `Đã thu hồi ủy quyền cho ${uq.delegate.name}.`, success: true };
}

/** Đọc ngày từ ô <input type="date">; cuối ngày cho mốc hết hạn. */
function ngay(v: FormDataEntryValue | null, cuoiNgay = false): Date | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(cuoiNgay ? `${s}T23:59:59` : `${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
