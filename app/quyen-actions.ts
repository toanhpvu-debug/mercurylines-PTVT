"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireActiveRole } from "@/lib/auth";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import { ROLE_LABEL } from "@/lib/roles";

// Server action cho phần phân quyền nâng cao: phân công đội tàu cho tài khoản
// bờ, và ủy quyền có thời hạn. Tách khỏi app/actions.ts vì đây là nghiệp vụ
// quản trị, không phải nghiệp vụ vật tư.
//
// Câu trả về cho người dùng đi qua t(); riêng phần `detail` của nhật ký người
// dùng giữ nguyên tiếng Việt — hồ sơ không đổi theo ngôn ngữ người đang xem.

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
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) return { message: t("chung.khongCoQuyen") };

  const userId = Number(formData.get("userId"));
  if (!Number.isInteger(userId) || userId <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { message: t("actionsModule.quyen_khongTimThayNguoiDung") };
  if (user.role !== "TECH_MANAGER") {
    // ADMIN luôn thấy toàn đội; người trên tàu bị giới hạn bằng cột vesselId.
    // Phân công đội tàu chỉ có nghĩa với quản lý kỹ thuật.
    return {
      message: t("actionsModule.quyen_chiApDungCho", {
        vaiTro: t("labels.role_TECH_MANAGER"),
      }),
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
      ? t("actionsModule.quyen_daPhanCong", {
          n: hopLe.length,
          ten: user.name,
        })
      : t("actionsModule.quyen_daBoPhanCong", { ten: user.name }),
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
  // Đặt tên khác cho hàm định dạng ngày vì file này đã có hàm ngay() riêng.
  const { t, ngay: dinhDangNgay } = await layT();
  const me = await getCurrentUser();
  if (!me || !me.isActive) return { message: t("chung.khongCoQuyen") };

  const delegatorId = Number(formData.get("delegatorId")) || me.id;
  const delegateId = Number(formData.get("delegateId"));
  const laAdmin = me.role === "ADMIN";
  if (!laAdmin && delegatorId !== me.id) {
    return { message: t("actionsModule.quyen_chiUyQuyenCuaMinh") };
  }
  if (!Number.isInteger(delegateId) || delegateId <= 0) {
    return { message: t("actionsModule.quyen_chonNguoiNhan") };
  }
  if (delegateId === delegatorId) {
    return { message: t("actionsModule.quyen_khongUyQuyenChoMinh") };
  }

  const [delegator, delegate] = await Promise.all([
    prisma.user.findUnique({ where: { id: delegatorId } }),
    prisma.user.findUnique({ where: { id: delegateId } }),
  ]);
  if (!delegator || !delegate) {
    return { message: t("actionsModule.quyen_khongTimThayNguoiDung") };
  }
  // Quyền quản trị hệ thống KHÔNG phải thẩm quyền nghiệp vụ: nó là quyền trên
  // chính cái hệ thống này, không gắn với một chức danh trên tàu nào để mà đi
  // vắng và giao lại. Cho mượn được thì một dòng ủy quyền biến người nhận thành
  // quản trị viên và mở toàn bộ đội tàu cho họ, hết hạn lúc nào không ai theo.
  //
  // Hàng rào này ĐỘC LẬP với việc form chọn sẵn ai: LapUyQuyen nay bắt chọn tay
  // ô "Người giao quyền", nhưng delegatorId vẫn tới từ FormData nên không được
  // tin. Đừng gỡ nhánh này vì thấy form đã an toàn.
  if (delegator.role === "ADMIN") {
    return { message: t("actionsModule.quyen_khongUyQuyenAdmin") };
  }
  if (!delegate.isActive) {
    return {
      message: t("actionsModule.quyen_taiKhoanBiKhoa", {
        email: delegate.email,
      }),
    };
  }

  const startAt = ngay(formData.get("startAt"));
  const endAt = ngay(formData.get("endAt"), true);
  if (!startAt || !endAt) {
    return { message: t("actionsModule.quyen_nhapDuNgay") };
  }
  if (endAt <= startAt) {
    return { message: t("actionsModule.quyen_ngayHetHanSauBatDau") };
  }
  // Ủy quyền VÔ THỜI HẠN là thứ nguy hiểm nhất ở đây: người ta lập một lần rồi
  // quên, và quyền cứ nằm đó. Chặn cứng ở một năm.
  const MOT_NAM = 366 * 24 * 60 * 60 * 1000;
  if (endAt.getTime() - startAt.getTime() > MOT_NAM) {
    return { message: t("actionsModule.quyen_toiDaMotNam") };
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
    message: t("actionsModule.quyen_daUyQuyen", {
      ten: delegate.name,
      ngay: dinhDangNgay(endAt),
    }),
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
  const { t } = await layT();
  const me = await getCurrentUser();
  if (!me || !me.isActive) return { message: t("chung.khongCoQuyen") };

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: t("chung.duLieuKhongHopLe") };
  }
  const uq = await prisma.delegation.findUnique({
    where: { id },
    include: { delegate: true, delegator: true },
  });
  if (!uq) return { message: t("actionsModule.quyen_khongTimThayUyQuyen") };
  if (me.role !== "ADMIN" && uq.delegatorId !== me.id) {
    return { message: t("actionsModule.quyen_chiNguoiUyQuyenThuHoi") };
  }
  if (uq.revokedAt) return { message: t("actionsModule.quyen_daThuHoiRoi") };

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
  return {
    message: t("actionsModule.quyen_daThuHoi", { ten: uq.delegate.name }),
    success: true,
  };
}

/** Đọc ngày từ ô <input type="date">; cuối ngày cho mốc hết hạn. */
function ngay(v: FormDataEntryValue | null, cuoiNgay = false): Date | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(cuoiNgay ? `${s}T23:59:59` : `${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
