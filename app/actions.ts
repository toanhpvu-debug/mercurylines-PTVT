"use server";

import path from "path";
import { createHash, randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  REQUEST_ALLOWED_FROM,
  REQUEST_STATUS_LABEL,
} from "@/lib/requestStatus";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/lib/session";
import {
  REQUEST_DELETABLE_BY_NON_ADMIN,
  canManageVesselCatalog,
  capDuyetChoPhep,
  requireActiveRole,
  vesselScope,
} from "@/lib/auth";
import {
  CHI_HUY_TAU,
  ROLES,
  DUYET_CONG_TY,
  LAP_YEU_CAU,
  ROLE_LABEL,
  VAN_HANH_TAU,
  viSaoKhongDuyetDuoc,
} from "@/lib/roles";
import {
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  ensureUploadDir,
  fileExtension,
  getUploadDir,
} from "@/lib/uploads";

class ActionError extends Error {}

const NO_PERMISSION = "Bạn không có quyền thực hiện thao tác này.";

// Hash bcrypt hợp lệ dùng để cân bằng thời gian phản hồi khi email không tồn tại,
// tránh dò tài khoản qua timing.
const DUMMY_HASH =
  "$2b$10$p2eUvUoaC5LHxELi.I7wTur0Jaof9nj86cELvEzX0lepltGRldBEi";

function formValues(formData: FormData, keys: string[]) {
  const values: Record<string, string> = {};
  for (const key of keys) {
    values[key] = String(formData.get(key) ?? "");
  }
  return values;
}

function safeNextPath(raw: string, fallback = "/dashboard") {
  if (
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.startsWith("/\\") &&
    raw !== "/login" &&
    raw !== "/locked"
  ) {
    return raw;
  }
  return fallback;
}

export async function login(
  _prevState: { message: string; email?: string },
  formData: FormData
): Promise<{ message: string; email?: string }> {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "");
  if (!email || !password) {
    return { message: "Vui lòng nhập email và mật khẩu.", email };
  }
  const user = await prisma.user.findUnique({ where: { email } });
  // Luôn chạy đúng một lần bcrypt.compare dù email có tồn tại hay không,
  // để thời gian phản hồi không tiết lộ email nào có tài khoản.
  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !user.isActive || !valid) {
    return { message: "Email hoặc mật khẩu không đúng.", email };
  }
  await createSession({
    userId: user.id,
    role: user.role,
    name: user.name,
  });
  redirect(safeNextPath(next));
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export async function createVessel(
  _prevState: { message: string; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const values = formValues(formData, [
    "code",
    "name",
    "imo",
    "flag",
    "vesselType",
  ]);
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const imo = String(formData.get("imo") || "").trim();
  const flag = String(formData.get("flag") || "").trim();
  const vesselType = String(formData.get("vesselType") || "").trim();
  if (!code || !name) {
    return { message: "Mã tàu và tên tàu là bắt buộc.", values };
  }
  try {
    await prisma.vessel.create({
      data: {
        code,
        name,
        imo: imo || null,
        flag: flag || null,
        vesselType: vesselType || null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: `Mã tàu "${code}" đã tồn tại.`, values };
    }
    throw error;
  }
  revalidatePath("/vessels");
  return { message: `Đã thêm tàu "${name}".`, success: true };
}

const VESSEL_STATUSES = ["ACTIVE", "MAINTENANCE", "INACTIVE"];

export async function updateVessel(
  _prevState: { message: string; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Không tìm thấy tàu." };
  }
  const values = formValues(formData, [
    "code",
    "name",
    "imo",
    "flag",
    "vesselType",
    "status",
  ]);
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const imo = String(formData.get("imo") || "").trim();
  const flag = String(formData.get("flag") || "").trim();
  const vesselType = String(formData.get("vesselType") || "").trim();
  const status = String(formData.get("status") || "ACTIVE");
  if (!code || !name) {
    return { message: "Mã tàu và tên tàu là bắt buộc.", values };
  }
  if (!VESSEL_STATUSES.includes(status)) {
    return { message: "Trạng thái tàu không hợp lệ.", values };
  }
  const before = await prisma.vessel.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!before) {
    return { message: "Không tìm thấy tàu." };
  }
  let renamedWarehouses = 0;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.vessel.update({
        where: { id },
        data: {
          code,
          name,
          imo: imo || null,
          flag: flag || null,
          vesselType: vesselType || null,
          status,
        },
      });
      // Tên kho nhúng sẵn tên tàu ("Kho máy - M. ODYSSEY") nên đổi tên tàu mà không
      // đổi kho là dữ liệu lệch ngay. Chỉ sửa kho còn theo đúng quy ước đuôi
      // " - <tên tàu cũ>"; kho đã được đặt tên riêng thì giữ nguyên.
      if (before.name !== name) {
        const suffix = ` - ${before.name}`;
        const warehouses = await tx.warehouse.findMany({
          where: { vesselId: id },
          select: { id: true, name: true },
        });
        for (const wh of warehouses) {
          if (!wh.name.endsWith(suffix)) continue;
          await tx.warehouse.update({
            where: { id: wh.id },
            data: { name: `${wh.name.slice(0, -suffix.length)} - ${name}` },
          });
          renamedWarehouses += 1;
        }
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { message: `Mã tàu "${code}" đã tồn tại.`, values };
      }
      if (error.code === "P2025") {
        return { message: "Không tìm thấy tàu." };
      }
    }
    throw error;
  }
  revalidatePath("/vessels");
  revalidatePath(`/vessels/${id}`);
  revalidatePath("/inventory");
  return {
    message: renamedWarehouses
      ? `Đã lưu thay đổi và đổi tên ${renamedWarehouses} kho theo tên tàu mới.`
      : "Đã lưu thay đổi.",
    success: true,
  };
}

export async function deleteVessel(
  _prevState: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Không tìm thấy tàu." };
  }
  const [requestCount, assignedUserCount] = await Promise.all([
    prisma.materialRequest.count({ where: { vesselId: id } }),
    prisma.user.count({ where: { vesselId: id } }),
  ]);
  if (requestCount > 0) {
    return {
      message: `Tàu đang có ${requestCount} yêu cầu vật tư nên không thể xóa. Hãy chuyển trạng thái sang "Ngừng khai thác" thay vì xóa.`,
    };
  }
  if (assignedUserCount > 0) {
    return {
      message: `Tàu đang có ${assignedUserCount} người dùng được gán phụ trách. Hãy gỡ gán hoặc chuyển tàu cho họ trong trang Người dùng trước khi xóa.`,
    };
  }
  try {
    await prisma.vessel.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { message: "Không tìm thấy tàu." };
      }
      if (error.code === "P2003") {
        return {
          message:
            "Tàu đang có dữ liệu liên quan (yêu cầu vật tư) nên không thể xóa.",
        };
      }
    }
    throw error;
  }
  revalidatePath("/vessels");
  redirect("/vessels");
}

export async function createMaterial(
  _prevState: { message: string; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const values = formValues(formData, [
    "code",
    "nameVn",
    "nameEn",
    "impa",
    "partNumber",
    "manufacturer",
    "materialType",
    "equipment",
    "uom",
    "categoryId",
    "minStock",
    "maxStock",
    "isCritical",
  ]);
  const code = String(formData.get("code") || "").trim();
  const nameVn = String(formData.get("nameVn") || "").trim();
  const nameEn = String(formData.get("nameEn") || "").trim();
  const impa = String(formData.get("impa") || "").trim();
  const partNumber = String(formData.get("partNumber") || "").trim();
  const manufacturer = String(formData.get("manufacturer") || "").trim();
  const materialType =
    String(formData.get("materialType") || "STORE") === "SPARE"
      ? "SPARE"
      : "STORE";
  const equipment = String(formData.get("equipment") || "").trim();
  const uom = String(formData.get("uom") || "PCS").trim();
  const categoryIdRaw = String(formData.get("categoryId") || "");
  const minStock = Number(formData.get("minStock") || 0);
  const maxStock = Number(formData.get("maxStock") || 0);
  const isCritical = formData.get("isCritical") === "on";
  if (!code || !nameVn) {
    return { message: "Mã vật tư và tên vật tư là bắt buộc.", values };
  }
  try {
    await prisma.material.create({
      data: {
        code,
        nameVn,
        nameEn: nameEn || null,
        impa: impa || null,
        partNumber: partNumber || null,
        manufacturer: manufacturer || null,
        materialType,
        equipment: materialType === "SPARE" ? equipment || null : null,
        uom,
        categoryId: categoryIdRaw ? Number(categoryIdRaw) : null,
        minStock,
        maxStock,
        isCritical,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: `Mã vật tư "${code}" đã tồn tại.`, values };
    }
    throw error;
  }
  revalidatePath("/materials");
  return { message: `Đã thêm vật tư "${nameVn}".`, success: true };
}

// Ngừng / mở lại sử dụng vật tư — giữ nguyên tồn kho và lịch sử.
export async function setMaterialActive(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  const active = String(formData.get("active") || "") === "true";
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  try {
    await prisma.material.update({
      where: { id },
      data: { isActive: active },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { message: "Không tìm thấy vật tư." };
    }
    throw error;
  }
  revalidatePath("/materials");
  return { message: "", success: true };
}

// Xóa vĩnh viễn — chỉ khi vật tư chưa có tồn kho và chưa dùng trong yêu cầu nào.
export async function deleteMaterial(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  const [requestItemCount, inventoryCount] = await Promise.all([
    prisma.materialRequestItem.count({ where: { materialId: id } }),
    prisma.inventory.count({ where: { materialId: id } }),
  ]);
  if (requestItemCount > 0) {
    return {
      message:
        "Vật tư đã dùng trong yêu cầu vật tư nên không thể xóa. Hãy chọn Ngừng sử dụng để giữ lịch sử.",
    };
  }
  if (inventoryCount > 0) {
    return {
      message:
        "Vật tư đang có bản ghi tồn kho trên tàu nên không thể xóa (tránh mất số liệu tồn). Hãy chọn Ngừng sử dụng.",
    };
  }
  try {
    await prisma.material.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { message: "Vật tư đã bị xóa." };
      }
      if (error.code === "P2003") {
        return {
          message:
            "Vật tư đang được tham chiếu ở nơi khác nên không thể xóa. Hãy chọn Ngừng sử dụng.",
        };
      }
    }
    throw error;
  }
  revalidatePath("/materials");
  return { message: "", success: true };
}

// Gán một vật tư vào danh mục của một tàu.
export async function assignMaterialToVessel(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const actor = await requireActiveRole([...VAN_HANH_TAU]);
  if (!actor) {
    return { message: NO_PERMISSION };
  }
  const vesselId = Number(formData.get("vesselId"));
  const materialId = Number(formData.get("materialId"));
  if (
    !Number.isInteger(vesselId) ||
    vesselId <= 0 ||
    !Number.isInteger(materialId) ||
    materialId <= 0
  ) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  if (!canManageVesselCatalog(actor, vesselId)) {
    return { message: NO_PERMISSION };
  }
  const material = await prisma.material.findUnique({
    where: { id: materialId },
  });
  if (!material) {
    return { message: "Vật tư không tồn tại." };
  }
  await prisma.vesselMaterial.upsert({
    where: { vesselId_materialId: { vesselId, materialId } },
    update: {},
    create: { vesselId, materialId },
  });
  revalidatePath("/materials");
  return { message: "", success: true };
}

// Gỡ một vật tư khỏi danh mục của một tàu (không xóa định nghĩa gốc, không xóa tồn kho).
export async function unassignMaterialFromVessel(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const actor = await requireActiveRole([...VAN_HANH_TAU]);
  if (!actor) {
    return { message: NO_PERMISSION };
  }
  const vesselId = Number(formData.get("vesselId"));
  const materialId = Number(formData.get("materialId"));
  if (
    !Number.isInteger(vesselId) ||
    vesselId <= 0 ||
    !Number.isInteger(materialId) ||
    materialId <= 0
  ) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  if (!canManageVesselCatalog(actor, vesselId)) {
    return { message: NO_PERMISSION };
  }
  await prisma.vesselMaterial.deleteMany({
    where: { vesselId, materialId },
  });
  revalidatePath("/materials");
  return { message: "", success: true };
}

export async function createInventoryTransaction(
  _prevState: { message: string; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const actor = await requireActiveRole([...VAN_HANH_TAU]);
  if (!actor) {
    return { message: NO_PERMISSION };
  }
  const scope = vesselScope(actor);
  const values = formValues(formData, [
    "materialId",
    "warehouseId",
    "type",
    "quantity",
    "note",
    "occurredAt",
  ]);
  const returnTo = safeNextPath(
    String(formData.get("returnTo") || ""),
    "/inventory"
  );
  const type = String(formData.get("type") || "");
  const materialId = Number(formData.get("materialId"));
  const warehouseId = Number(formData.get("warehouseId"));
  const quantity = Number(formData.get("quantity"));
  const note = String(formData.get("note") || "").trim();
  if (!["IN", "OUT"].includes(type)) {
    return { message: "Loại giao dịch không hợp lệ.", values };
  }
  if (!materialId || !warehouseId || !(quantity > 0)) {
    return { message: "Dữ liệu nhập/xuất không hợp lệ.", values };
  }
  // Thời điểm thực hiện: để trống = bây giờ; cho phép ghi lùi, không cho ghi trước tương lai.
  const occurredRaw = String(formData.get("occurredAt") || "").trim();
  let occurredAt = new Date();
  if (occurredRaw) {
    const d = new Date(occurredRaw);
    if (isNaN(d.getTime()) || d.getFullYear() < 2000) {
      return { message: "Thời điểm thực hiện không hợp lệ.", values };
    }
    if (d.getTime() > Date.now() + 5 * 60 * 1000) {
      return {
        message: "Thời điểm thực hiện không được ở tương lai.",
        values,
      };
    }
    occurredAt = d;
  }
  try {
    await prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({
        where: { id: warehouseId },
      });
      if (!warehouse || !warehouse.vesselId) {
        throw new ActionError("Kho không hợp lệ hoặc không thuộc tàu.");
      }
      if (!scope.all && warehouse.vesselId !== scope.vesselId) {
        throw new ActionError(
          "Bạn chỉ được nhập/xuất kho của tàu mình phụ trách."
        );
      }
      const vesselId = warehouse.vesselId;
      if (type === "OUT") {
        const inventory = await tx.inventory.findUnique({
          where: {
            materialId_warehouseId: {
              materialId,
              warehouseId,
            },
          },
        });
        if (!inventory || inventory.quantity < quantity) {
          throw new ActionError("Không đủ tồn kho để xuất.");
        }
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: {
              decrement: quantity,
            },
          },
        });
      } else {
        await tx.inventory.upsert({
          where: {
            materialId_warehouseId: {
              materialId,
              warehouseId,
            },
          },
          update: {
            quantity: {
              increment: quantity,
            },
            vesselId,
          },
          create: {
            materialId,
            warehouseId,
            vesselId,
            quantity,
          },
        });
      }
      await tx.inventoryTransaction.create({
        data: {
          type,
          materialId,
          warehouseId,
          vesselId,
          quantity,
          note: note || null,
          occurredAt,
          performedBy: actor.name,
        },
      });
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return { message: error.message, values };
    }
    throw error;
  }
  revalidatePath("/inventory");
  revalidatePath(returnTo);
  return { message: "Đã ghi nhận giao dịch nhập/xuất kho.", success: true };
}

const allowedFrom = REQUEST_ALLOWED_FROM;

// Ghi một mốc vào nhật ký phê duyệt. Gọi trong cùng transaction với thao tác
// đổi trạng thái để nhật ký không bao giờ lệch với trạng thái thực tế.
async function logRequestEvent(
  tx: Prisma.TransactionClient,
  args: {
    requestId: number;
    fromStatus: string | null;
    toStatus: string;
    actorName: string;
    actorRole: string;
    note?: string | null;
  }
) {
  await tx.materialRequestEvent.create({
    data: {
      requestId: args.requestId,
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
      actorName: args.actorName,
      actorRole: args.actorRole,
      note: args.note ?? null,
    },
  });
}

/**
 * Duyệt yêu cầu kèm số lượng duyệt (S.L Duyệt / APP) cho từng dòng.
 *
 * MỘT hàm lo cả hai cấp, tự xác định cấp theo trạng thái hiện tại của yêu cầu:
 *   PENDING_MASTER -> PENDING_OFFICE   thuyền trưởng / máy trưởng duyệt
 *   PENDING_OFFICE -> APPROVED         quản lý kỹ thuật công ty duyệt
 *
 * Tách thành hai hàm thì phần chốt trạng thái atomic, cắt số lượng và ghi nhật
 * ký phải viết hai lần — sớm muộn cũng lệch nhau.
 *
 * Cấp công ty được sửa lại số lượng tàu đã duyệt (giảm tiếp), vì công ty mới là
 * nơi quyết định cuối cùng mua bao nhiêu.
 */
export async function approveRequestQuantities(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const actor = await requireActiveRole([
    ...new Set([...CHI_HUY_TAU, ...DUYET_CONG_TY]),
  ]);
  if (!actor) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Yêu cầu không hợp lệ." };
  }
  const request = await prisma.materialRequest.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!request) {
    return { message: "Không tìm thấy yêu cầu." };
  }

  const cap = capDuyetChoPhep(actor, request);
  if (!cap) {
    // Báo đúng lý do: sai cấp, sai bộ phận, hay yêu cầu chưa được trình.
    if (request.status === "DRAFT") {
      return {
        message:
          "Yêu cầu còn ở trạng thái Nháp. Người lập cần bấm “Trình duyệt” trước khi phê duyệt.",
      };
    }
    if (request.status !== "PENDING_MASTER" && request.status !== "PENDING_OFFICE") {
      return { message: "Yêu cầu đã được xử lý, vui lòng tải lại trang." };
    }
    if (request.status === "PENDING_OFFICE") {
      return {
        message:
          "Tàu đã duyệt, bước này thuộc quản lý kỹ thuật công ty.",
      };
    }
    return { message: viSaoKhongDuyetDuoc(actor.role) };
  }

  const tuTrangThai = cap === "TAU" ? "PENDING_MASTER" : "PENDING_OFFICE";
  const denTrangThai = cap === "TAU" ? "PENDING_OFFICE" : "APPROVED";
  const now = new Date();
  const dau =
    cap === "TAU"
      ? {
          shipApprovedBy: actor.name,
          shipApprovedRole: actor.role,
          shipApprovedAt: now,
        }
      : { approvedBy: actor.name, approvedAt: now };

  try {
    await prisma.$transaction(async (tx) => {
      // Chốt trạng thái atomic trước — nếu người khác vừa duyệt/từ chối thì count=0 → rollback
      const guard = await tx.materialRequest.updateMany({
        where: { id, status: tuTrangThai },
        data: { status: denTrangThai, ...dau },
      });
      if (guard.count === 0) {
        throw new ActionError(
          "Yêu cầu đã được xử lý, vui lòng tải lại trang."
        );
      }
      let totalApproved = 0;
      for (const item of request.items) {
        const raw = formData.get(`approved_${item.id}`);
        let approved = Number(raw);
        if (!Number.isFinite(approved) || approved < 0) approved = 0;
        // Không cấp nào được duyệt vượt số lượng tàu đã xin; cấp công ty còn
        // không được vượt số lượng tàu đã duyệt ở bước trước.
        const tran =
          cap === "TAU"
            ? item.quantity
            : Math.min(item.quantity, item.approvedQuantity);
        if (approved > tran) approved = tran;
        totalApproved += approved;
        await tx.materialRequestItem.update({
          where: { id: item.id },
          data: { approvedQuantity: approved },
        });
      }
      const note = String(formData.get("note") || "").trim();
      const tenCap =
        cap === "TAU"
          ? `${ROLE_LABEL[actor.role] ?? actor.role} duyệt cấp tàu`
          : "Quản lý kỹ thuật duyệt cấp công ty";
      await logRequestEvent(tx, {
        requestId: id,
        fromStatus: request.status,
        toStatus: denTrangThai,
        actorName: actor.name,
        actorRole: actor.role,
        note:
          note ||
          `${tenCap}: ${request.items.length} dòng, tổng SL duyệt ${totalApproved}`,
      });
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return { message: error.message };
    }
    throw error;
  }
  revalidatePath("/requests");
  revalidatePath(`/requests/${id}`);
  redirect(`/requests/${id}`);
}

export async function updateRequestStatus(
  _prevState: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const status = String(formData.get("status") || "");
  // Quyền theo từng bước chuyển, đúng phân cấp:
  //   PENDING_MASTER (trình duyệt)  -> người lập, kể cả sĩ quan/thuyền viên
  //   REJECTED (từ chối)            -> tùy đang ở cấp nào, kiểm tra sau khi
  //                                    đọc trạng thái hiện tại của yêu cầu
  //   còn lại (hủy, chuyển mua sắm, giao hàng...) -> chỉ huy tàu + văn phòng
  const roles =
    status === "PENDING_MASTER"
      ? LAP_YEU_CAU
      : status === "REJECTED"
        ? [...new Set([...CHI_HUY_TAU, ...DUYET_CONG_TY])]
        : [...new Set([...CHI_HUY_TAU, ...DUYET_CONG_TY])];
  const actor = await requireActiveRole([...roles]);
  if (!actor) {
    return { message: NO_PERMISSION };
  }
  const scope = vesselScope(actor);
  const id = Number(formData.get("id"));
  const returnTo = safeNextPath(
    String(formData.get("returnTo") || ""),
    "/requests"
  );
  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !Object.hasOwn(allowedFrom, status)
  ) {
    return { message: "Trạng thái yêu cầu không hợp lệ." };
  }
  // Từ chối phải nêu lý do — người lập cần biết sửa gì để trình lại.
  const note = String(formData.get("note") || "").trim();
  if (status === "REJECTED" && !note) {
    return { message: "Vui lòng nhập lý do từ chối." };
  }
  const now = new Date();
  const stamp: Record<string, unknown> = {};
  if (status === "PENDING_MASTER") {
    stamp.submittedBy = actor.name;
    stamp.submittedAt = now;
    // Trình lại sau khi bị từ chối: xóa vết từ chối cũ, nếu không bảng đỏ
    // "Yêu cầu bị từ chối" vẫn đứng nguyên trên một yêu cầu đang chờ duyệt.
    stamp.rejectedBy = null;
    stamp.rejectedAt = null;
    stamp.rejectionReason = null;
  } else if (status === "REJECTED") {
    stamp.rejectedBy = actor.name;
    stamp.rejectedAt = now;
    stamp.rejectionReason = note;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.materialRequest.findUnique({
        where: { id },
        select: { status: true, vesselId: true, department: true },
      });
      if (!before) {
        throw new ActionError("Không tìm thấy yêu cầu.");
      }
      if (!scope.all && before.vesselId !== scope.vesselId) {
        throw new ActionError(NO_PERMISSION);
      }
      // Từ chối phải đúng cấp: người đang giữ bước duyệt mới được từ chối.
      // Không có kiểm tra này thì máy trưởng từ chối được yêu cầu đang nằm ở
      // bàn của công ty, và ngược lại.
      if (status === "REJECTED") {
        const capTuChoi = capDuyetChoPhep(actor, {
          vesselId: before.vesselId,
          status: before.status,
          department: before.department,
        });
        if (!capTuChoi) {
          throw new ActionError(
            before.status === "PENDING_OFFICE"
              ? "Yêu cầu đang chờ công ty duyệt — chỉ quản lý kỹ thuật mới từ chối được ở bước này."
              : viSaoKhongDuyetDuoc(actor.role)
          );
        }
      }
      const result = await tx.materialRequest.updateMany({
        where: {
          id,
          status: { in: allowedFrom[status] },
          ...(scope.all ? {} : { vesselId: scope.vesselId ?? -1 }),
        },
        data: { status, ...stamp },
      });
      if (result.count === 0) {
        throw new ActionError(
          `Không chuyển được từ "${
            REQUEST_STATUS_LABEL[before.status] ?? before.status
          }" sang "${
            REQUEST_STATUS_LABEL[status] ?? status
          }". Có thể người khác vừa xử lý — hãy tải lại trang.`
        );
      }
      await logRequestEvent(tx, {
        requestId: id,
        fromStatus: before.status,
        toStatus: status,
        actorName: actor.name,
        actorRole: actor.role,
        note: note || null,
      });
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return { message: error.message };
    }
    throw error;
  }
  revalidatePath("/requests");
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function deleteMaterialRequest(
  _prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const actor = await requireActiveRole([...LAP_YEU_CAU]);
  if (!actor) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  // returnTo mặc định về danh sách để không rơi vào trang chi tiết vừa bị xóa.
  const returnTo = safeNextPath(
    String(formData.get("returnTo") || ""),
    "/requests"
  );
  const request = await prisma.materialRequest.findUnique({ where: { id } });
  if (!request) {
    return { message: "Yêu cầu đã bị xóa hoặc không tồn tại." };
  }
  const scope = vesselScope(actor);
  if (!scope.all && request.vesselId !== scope.vesselId) {
    return { message: NO_PERMISSION };
  }
  if (
    actor.role !== "ADMIN" &&
    !REQUEST_DELETABLE_BY_NON_ADMIN.includes(request.status)
  ) {
    return {
      message:
        "Yêu cầu đã được duyệt/chuyển mua sắm nên chỉ quản trị viên mới xóa được.",
    };
  }
  try {
    await prisma.materialRequest.delete({ where: { id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { message: "Yêu cầu đã bị xóa." };
    }
    throw error;
  }
  revalidatePath("/requests");
  revalidatePath(returnTo);
  redirect(returnTo);
}

// ============ PURCHASING (MUA SẮM) ============

// Gán chuẩn biểu mẫu + Hull No cho một tàu.
export async function setVesselFormStandard(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  const formStandard = String(formData.get("formStandard") || "");
  const hullNo = String(formData.get("hullNo") || "").trim();
  if (!Number.isInteger(id) || id <= 0 || !formStandard) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  const std = await prisma.formStandard.findUnique({
    where: { code: formStandard },
  });
  if (!std || !std.isActive) {
    return { message: "Biểu mẫu không hợp lệ." };
  }
  try {
    await prisma.vessel.update({
      where: { id },
      data: { formStandard, hullNo: hullNo || null },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { message: "Không tìm thấy tàu." };
    }
    throw error;
  }
  revalidatePath("/purchasing/forms");
  return { message: "Đã lưu.", success: true };
}

// Thêm một biểu mẫu (công ty quản lý) mới.
export async function createFormStandard(
  _prevState: { message: string; success?: boolean; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const values = formValues(formData, [
    "code",
    "label",
    "companyName",
    "address",
    "repAddress",
    "tel",
    "email",
    "website",
  ]);
  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase();
  const label = String(formData.get("label") || "").trim();
  const companyName = String(formData.get("companyName") || "").trim();
  const address = String(formData.get("address") || "").trim();
  if (!code || !companyName || !address) {
    return {
      message: "Mã, tên công ty và địa chỉ là bắt buộc.",
      values,
    };
  }
  try {
    await prisma.formStandard.create({
      data: {
        code,
        label: label || code,
        companyName,
        address,
        repAddress: String(formData.get("repAddress") || "").trim() || null,
        tel: String(formData.get("tel") || "").trim() || null,
        email: String(formData.get("email") || "").trim() || null,
        website: String(formData.get("website") || "").trim() || null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: `Mã biểu mẫu "${code}" đã tồn tại.`, values };
    }
    throw error;
  }
  revalidatePath("/purchasing/forms");
  return { message: `Đã thêm biểu mẫu "${code}".`, success: true };
}

// Sửa thông tin một biểu mẫu; nếu đổi mã thì cập nhật luôn các tàu đang gán mã cũ.
export async function updateFormStandard(
  _prevState: { message: string; success?: boolean; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const values = formValues(formData, [
    "code",
    "label",
    "companyName",
    "address",
    "repAddress",
    "tel",
    "email",
    "website",
  ]);
  const id = Number(formData.get("id"));
  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase();
  const label = String(formData.get("label") || "").trim();
  const companyName = String(formData.get("companyName") || "").trim();
  const address = String(formData.get("address") || "").trim();
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Dữ liệu không hợp lệ.", values };
  }
  if (!code || !companyName || !address) {
    return { message: "Mã, tên công ty và địa chỉ là bắt buộc.", values };
  }
  const existing = await prisma.formStandard.findUnique({ where: { id } });
  if (!existing) {
    return { message: "Không tìm thấy biểu mẫu.", values };
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.formStandard.update({
        where: { id },
        data: {
          code,
          label: label || code,
          companyName,
          address,
          repAddress: String(formData.get("repAddress") || "").trim() || null,
          tel: String(formData.get("tel") || "").trim() || null,
          email: String(formData.get("email") || "").trim() || null,
          website: String(formData.get("website") || "").trim() || null,
        },
      });
      if (code !== existing.code) {
        // Chuyển các tàu đang gán mã cũ sang mã mới để không đứt tham chiếu.
        await tx.vessel.updateMany({
          where: { formStandard: existing.code },
          data: { formStandard: code },
        });
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: `Mã biểu mẫu "${code}" đã tồn tại.`, values };
    }
    throw error;
  }
  revalidatePath("/purchasing/forms");
  return { message: "Đã cập nhật biểu mẫu.", success: true };
}

export async function setFormStandardActive(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  const active = String(formData.get("active") || "") === "true";
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  const std = await prisma.formStandard.findUnique({ where: { id } });
  if (!std) {
    return { message: "Không tìm thấy biểu mẫu." };
  }
  // Không cho ngừng dùng biểu mẫu vẫn còn tàu đang gán.
  if (!active) {
    const inUse = await prisma.vessel.count({
      where: { formStandard: std.code },
    });
    if (inUse > 0) {
      return {
        message: `Còn ${inUse} tàu đang dùng biểu mẫu này. Hãy chuyển các tàu sang biểu mẫu khác trước.`,
      };
    }
  }
  await prisma.formStandard.update({
    where: { id },
    data: { isActive: active },
  });
  revalidatePath("/purchasing/forms");
  return { message: "", success: true };
}

export async function deleteFormStandard(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  const std = await prisma.formStandard.findUnique({ where: { id } });
  if (!std) {
    return { message: "Không tìm thấy biểu mẫu." };
  }
  const inUse = await prisma.vessel.count({
    where: { formStandard: std.code },
  });
  if (inUse > 0) {
    return {
      message: `Còn ${inUse} tàu đang dùng biểu mẫu "${std.code}" nên không thể xóa. Hãy chuyển các tàu sang biểu mẫu khác trước.`,
    };
  }
  await prisma.formStandard.delete({ where: { id } });
  revalidatePath("/purchasing/forms");
  return { message: "", success: true };
}

export async function createSupplier(
  _prevState: { message: string; success?: boolean; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const values = formValues(formData, [
    "code",
    "name",
    "contact",
    "email",
    "phone",
    "address",
  ]);
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!code || !name) {
    return { message: "Mã và tên nhà cung cấp là bắt buộc.", values };
  }
  try {
    await prisma.supplier.create({
      data: {
        code,
        name,
        contact: String(formData.get("contact") || "").trim() || null,
        email: String(formData.get("email") || "").trim() || null,
        phone: String(formData.get("phone") || "").trim() || null,
        address: String(formData.get("address") || "").trim() || null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: `Mã nhà cung cấp "${code}" đã tồn tại.`, values };
    }
    throw error;
  }
  revalidatePath("/purchasing/suppliers");
  return { message: `Đã thêm nhà cung cấp "${name}".`, success: true };
}

export async function setSupplierActive(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  const active = String(formData.get("active") || "") === "true";
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  await prisma.supplier.update({ where: { id }, data: { isActive: active } });
  revalidatePath("/purchasing/suppliers");
  return { message: "", success: true };
}

// Sửa thông tin nhà cung cấp.
export async function updateSupplier(
  _prevState: { message: string; success?: boolean; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const values = formValues(formData, [
    "code",
    "name",
    "contact",
    "email",
    "phone",
    "address",
  ]);
  const id = Number(formData.get("id"));
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Dữ liệu không hợp lệ.", values };
  }
  if (!code || !name) {
    return { message: "Mã và tên nhà cung cấp là bắt buộc.", values };
  }
  try {
    await prisma.supplier.update({
      where: { id },
      data: {
        code,
        name,
        contact: String(formData.get("contact") || "").trim() || null,
        email: String(formData.get("email") || "").trim() || null,
        phone: String(formData.get("phone") || "").trim() || null,
        address: String(formData.get("address") || "").trim() || null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { message: `Mã nhà cung cấp "${code}" đã tồn tại.`, values };
      }
      if (error.code === "P2025") {
        return { message: "Không tìm thấy nhà cung cấp.", values };
      }
    }
    throw error;
  }
  revalidatePath("/purchasing/suppliers");
  revalidatePath("/purchasing");
  return { message: "Đã cập nhật nhà cung cấp.", success: true };
}

// Xóa nhà cung cấp — chặn khi đã có đơn mua tham chiếu (dùng Ngừng dùng thay thế).
export async function deleteSupplier(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) {
    return { message: "Không tìm thấy nhà cung cấp." };
  }
  const poCount = await prisma.purchaseOrder.count({
    where: { supplierId: id },
  });
  if (poCount > 0) {
    return {
      message: `Nhà cung cấp đã có ${poCount} đơn mua nên không thể xóa (để giữ lịch sử). Hãy dùng "Ngừng dùng".`,
    };
  }
  await prisma.supplier.delete({ where: { id } });
  revalidatePath("/purchasing/suppliers");
  return { message: "", success: true };
}

// Nhập danh mục vật tư/phụ tùng cho một tàu từ file Excel (MLS-11-06) hoặc Word (MLS-11-04).
export async function importMaterials(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const actor = await requireActiveRole(["ADMIN", "MASTER"]);
  if (!actor) {
    return { message: NO_PERMISSION };
  }
  const vesselId = Number(formData.get("vesselId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) {
    return { message: "Vui lòng chọn tàu." };
  }
  if (!canManageVesselCatalog(actor, vesselId)) {
    return { message: "Bạn chỉ được nhập danh mục cho tàu mình phụ trách." };
  }
  const vessel = await prisma.vessel.findUnique({ where: { id: vesselId } });
  if (!vessel) {
    return { message: "Tàu không tồn tại." };
  }
  const kind = String(formData.get("kind") || "STORE");
  if (!["STORE", "SPARE"].includes(kind)) {
    return { message: "Loại vật tư không hợp lệ." };
  }
  // Kho ghi tồn (tùy chọn) — phải thuộc tàu đã chọn.
  const warehouseRaw = String(formData.get("warehouseId") || "");
  let warehouseId: number | null = null;
  // "AUTO" = định tuyến theo sheet: Phụ tùng→kho máy, Boong→kho boong, còn lại→kho tiêu hao.
  let warehouseByKind: Partial<
    Record<"ENG" | "DECK" | "STORE", number>
  > | null = null;
  if (warehouseRaw === "AUTO") {
    const vesselWarehouses = await prisma.warehouse.findMany({
      where: { vesselId },
      select: { id: true, code: true },
    });
    const map: Partial<Record<"ENG" | "DECK" | "STORE", number>> = {};
    for (const w of vesselWarehouses) {
      if (/-ENG$/i.test(w.code)) map.ENG = w.id;
      else if (/-DECK$/i.test(w.code)) map.DECK = w.id;
      else if (/-STORE$/i.test(w.code)) map.STORE = w.id;
    }
    if (!map.ENG && !map.DECK && !map.STORE) {
      return {
        message:
          "Tàu này chưa có kho nào có mã kết thúc bằng -ENG / -DECK / -STORE nên không tự định tuyến được. Hãy chọn một kho cụ thể.",
      };
    }
    warehouseByKind = map;
  } else if (warehouseRaw) {
    const wid = Number(warehouseRaw);
    if (!Number.isInteger(wid) || wid <= 0) {
      return { message: "Kho không hợp lệ." };
    }
    const warehouse = await prisma.warehouse.findUnique({ where: { id: wid } });
    if (!warehouse || warehouse.vesselId !== vesselId) {
      return { message: "Kho không thuộc tàu đã chọn." };
    }
    warehouseId = wid;
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { message: "Vui lòng chọn file danh mục (.xls/.xlsx/.doc/.docx)." };
  }
  const ext = fileExtension(file.name);
  if (![".xls", ".xlsx", ".doc", ".docx"].includes(ext)) {
    return { message: "File phải là Excel (.xls/.xlsx) hoặc Word (.doc/.docx)." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { message: "File vượt quá 10MB." };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const { parseMaterialExcel, parseMaterialDoc } = await import(
    "@/lib/materialImport"
  );
  const parsed = [".xls", ".xlsx"].includes(ext)
    ? parseMaterialExcel(buffer)
    : await parseMaterialDoc(buffer);
  if (parsed.error) {
    return { message: parsed.error };
  }

  const { applyMaterialImport } = await import("@/lib/materialImportApply");
  const { createdCount, linkedCount, robCount, conflict } =
    await applyMaterialImport({
      vesselId,
      warehouseId,
      warehouseByKind,
      fallbackKind: kind,
      items: parsed.items,
      fileName: file.name,
      actorName: actor.name,
    });
  if (conflict) {
    return {
      message:
        "Có phiên nhập liệu khác chạy đồng thời nên mã tự sinh bị trùng. Vui lòng bấm nhập lại.",
    };
  }

  revalidatePath("/materials");
  revalidatePath("/inventory");
  const parts = [
    `Đã nhập ${parsed.items.length} dòng cho tàu ${vessel.name}:`,
    `${createdCount} vật tư mới`,
    `${linkedCount} vật tư đã có (gán vào tàu)`,
  ];
  if (robCount > 0) parts.push(`${robCount} dòng ghi tồn kho`);
  if (parsed.skippedRows > 0)
    parts.push(`${parsed.skippedRows} dòng bị bỏ qua`);
  // Liệt kê từng sheet để người dùng đối chiếu — file kiểm kê thật tách nhiều sheet
  // theo bộ phận, im lặng bỏ sót một sheet là mất cả trăm dòng mà không ai biết.
  if (parsed.sheets?.length) {
    const read = parsed.sheets.filter((s) => !s.skipped);
    const ignored = parsed.sheets.filter((s) => s.skipped);
    if (read.length) {
      const labels: Record<string, string> = {
        STORE: "Vật tư",
        SPARE: "Phụ tùng",
      };
      parts.push(
        "Sheet đã đọc: " +
          read
            .map(
              (s) =>
                `${s.name} (${s.count} dòng${
                  s.materialType ? `, ${labels[s.materialType]}` : ""
                })`
            )
            .join("; ")
      );
    }
    if (ignored.length) {
      parts.push(
        `Sheet không có bảng danh mục nên bỏ qua: ${ignored
          .map((s) => s.name)
          .join("; ")}`
      );
    }
  }
  if (parsed.truncated) {
    parts.push(
      "⚠ File vượt quá giới hạn 3000 dòng — phần còn lại chưa được nhập, hãy tách file nhỏ hơn"
    );
  }
  return { message: parts.join(" · "), success: true };
}

// Tạo IFQ/PO trực tiếp từ Phòng Kỹ thuật - Vật tư (không cần yêu cầu từ tàu):
// dòng vật tư nhập tay và/hoặc đọc từ file Excel theo form công ty.
export async function createDirectPurchaseOrder(
  _prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const actor = await requireActiveRole(["ADMIN", "MASTER"]);
  if (!actor) {
    return { message: NO_PERMISSION };
  }
  const scope = vesselScope(actor);
  const vesselId = Number(formData.get("vesselId"));
  const supplierId = Number(formData.get("supplierId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) {
    return { message: "Vui lòng chọn tàu." };
  }
  if (!scope.all && vesselId !== scope.vesselId) {
    return { message: "Bạn chỉ được mua sắm cho tàu mình phụ trách." };
  }
  const vessel = await prisma.vessel.findUnique({ where: { id: vesselId } });
  if (!vessel) {
    return { message: "Tàu không tồn tại." };
  }
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    return { message: "Vui lòng chọn nhà cung cấp." };
  }
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
  });
  if (!supplier || !supplier.isActive) {
    return { message: "Nhà cung cấp không hợp lệ." };
  }
  const currency = String(formData.get("currency") || "USD").trim() || "USD";
  const notes = String(formData.get("notes") || "").trim() || null;
  const subject = String(formData.get("subject") || "").trim() || null;
  const supplierRef = String(formData.get("supplierRef") || "").trim() || null;
  const finiteOrZero = (v: FormDataEntryValue | null) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const discountPercent = Math.min(
    100,
    finiteOrZero(formData.get("discountPercent"))
  );
  const transportFee = finiteOrZero(formData.get("transportFee"));
  const deliveryFee = finiteOrZero(formData.get("deliveryFee"));
  const expectedRaw = String(formData.get("expectedDate") || "");
  let expectedDate: Date | null = null;
  if (expectedRaw) {
    const d = new Date(expectedRaw);
    if (!isNaN(d.getTime())) expectedDate = d;
  }

  type DirectLine = {
    description: string;
    partNo: string | null;
    uom: string;
    quantity: number;
    unitPrice: number;
  };
  const lines: DirectLine[] = [];
  let skippedRows = 0;

  // 1) Dòng từ file Excel theo form công ty (nếu có)
  const excel = formData.get("excel");
  if (excel instanceof File && excel.size > 0) {
    const ext = fileExtension(excel.name);
    if (![".xls", ".xlsx"].includes(ext)) {
      return { message: "File vật tư phải là Excel (.xls hoặc .xlsx)." };
    }
    if (excel.size > 10 * 1024 * 1024) {
      return { message: "File Excel vượt quá 10MB." };
    }
    const { parsePurchaseExcel } = await import("@/lib/excelPurchase");
    const parsed = parsePurchaseExcel(Buffer.from(await excel.arrayBuffer()));
    if (parsed.error) {
      return { message: parsed.error };
    }
    lines.push(...parsed.lines);
    skippedRows = parsed.skippedRows;
  }

  // 2) Dòng nhập tay: line_desc_i / line_pn_i / line_uom_i / line_qty_i / line_price_i
  const manualIdx = [...formData.keys()]
    .filter((k) => k.startsWith("line_desc_"))
    .map((k) => Number(k.slice("line_desc_".length)))
    .filter((n) => Number.isInteger(n) && n >= 0)
    .sort((a, b) => a - b);
  for (const i of manualIdx) {
    const description = String(formData.get(`line_desc_${i}`) || "").trim();
    const qtyRaw = String(formData.get(`line_qty_${i}`) || "").trim();
    if (!description && !qtyRaw) continue; // dòng trống — bỏ qua
    const qty = Number(qtyRaw);
    if (!description) {
      return { message: `Dòng nhập tay thứ ${i + 1} thiếu mô tả vật tư.` };
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return {
        message: `Dòng "${description.slice(0, 40)}" có số lượng không hợp lệ.`,
      };
    }
    lines.push({
      description,
      partNo: String(formData.get(`line_pn_${i}`) || "").trim() || null,
      uom: String(formData.get(`line_uom_${i}`) || "").trim() || "PCS",
      quantity: qty,
      unitPrice: finiteOrZero(formData.get(`line_price_${i}`)),
    });
  }

  if (!lines.length) {
    return {
      message:
        "Chưa có dòng vật tư nào — hãy upload file Excel theo form công ty hoặc nhập tay ít nhất một dòng.",
    };
  }
  if (lines.length > 200) {
    return { message: "Tối đa 200 dòng vật tư mỗi đơn." };
  }

  const poNo = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const created = await prisma.purchaseOrder.create({
    data: {
      poNo,
      supplierId,
      vesselId,
      status: "DRAFT",
      currency,
      orderDate: new Date(),
      expectedDate,
      notes,
      subject,
      supplierRef,
      discountPercent,
      transportFee,
      deliveryFee,
      createdBy: `${actor.name} (KT-VT)`,
      items: { create: lines },
    },
  });
  revalidatePath("/purchasing");
  redirect(
    `/purchasing/${created.id}${skippedRows > 0 ? `?skipped=${skippedRows}` : ""}`
  );
}

// Tạo đơn mua hàng từ các dòng yêu cầu đã duyệt đã chọn.
export async function createPurchaseOrder(
  _prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const actor = await requireActiveRole(["ADMIN", "MASTER"]);
  if (!actor) {
    return { message: NO_PERMISSION };
  }
  const scope = vesselScope(actor);
  const vesselId = Number(formData.get("vesselId"));
  const supplierId = Number(formData.get("supplierId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) {
    return { message: "Tàu không hợp lệ." };
  }
  if (!scope.all && vesselId !== scope.vesselId) {
    return { message: "Bạn chỉ được mua sắm cho tàu mình phụ trách." };
  }
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    return { message: "Vui lòng chọn nhà cung cấp." };
  }
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
  });
  if (!supplier || !supplier.isActive) {
    return { message: "Nhà cung cấp không hợp lệ." };
  }
  const currency = String(formData.get("currency") || "USD").trim() || "USD";
  const notes = String(formData.get("notes") || "").trim() || null;
  const subject = String(formData.get("subject") || "").trim() || null;
  const supplierRef = String(formData.get("supplierRef") || "").trim() || null;
  const finiteOrZero = (v: FormDataEntryValue | null) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const discountPercent = Math.min(100, finiteOrZero(formData.get("discountPercent")));
  const transportFee = finiteOrZero(formData.get("transportFee"));
  const deliveryFee = finiteOrZero(formData.get("deliveryFee"));
  const expectedRaw = String(formData.get("expectedDate") || "");
  let expectedDate: Date | null = null;
  if (expectedRaw) {
    const d = new Date(expectedRaw);
    if (!isNaN(d.getTime())) expectedDate = d;
  }
  // Các dòng yêu cầu được chọn: chk_<requestItemId> = "on", price_<id>, qty_<id>
  const selectedIds = [...formData.keys()]
    .filter((k) => k.startsWith("chk_"))
    .map((k) => Number(k.slice(4)))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!selectedIds.length) {
    return { message: "Vui lòng chọn ít nhất một dòng vật tư để mua." };
  }
  const requestItems = await prisma.materialRequestItem.findMany({
    where: {
      id: { in: selectedIds },
      request: { vesselId, status: "IN_PROCUREMENT" },
    },
    include: { material: true },
  });
  if (!requestItems.length) {
    return {
      message: "Không có dòng hợp lệ (yêu cầu phải đang ở trạng thái mua sắm).",
    };
  }
  const lines = requestItems.map((ri) => {
    const priceRaw = Number(formData.get(`price_${ri.id}`));
    const qtyRaw = Number(formData.get(`qty_${ri.id}`));
    const approved = ri.approvedQuantity > 0 ? ri.approvedQuantity : ri.quantity;
    const remaining = Math.max(0, approved - ri.suppliedQuantity);
    const quantity =
      Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : remaining || approved;
    return {
      requestItemId: ri.id,
      materialId: ri.materialId,
      description: ri.material ? ri.material.nameVn : (ri.itemName ?? "—"),
      partNo: ri.material
        ? (ri.material.partNumber ?? ri.material.impa ?? null)
        : (ri.itemCode ?? null),
      uom: ri.material ? ri.material.uom : (ri.itemUom ?? "PCS"),
      quantity,
      unitPrice: Number.isFinite(priceRaw) && priceRaw >= 0 ? priceRaw : 0,
    };
  });
  const poNo = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const created = await prisma.purchaseOrder.create({
    data: {
      poNo,
      supplierId,
      vesselId,
      status: "DRAFT",
      currency,
      orderDate: new Date(),
      expectedDate,
      notes,
      subject,
      supplierRef,
      discountPercent,
      transportFee,
      deliveryFee,
      createdBy: actor.name,
      items: { create: lines },
    },
  });
  revalidatePath("/purchasing");
  redirect(`/purchasing/${created.id}`);
}

const PO_ALLOWED_FROM: Record<string, string[]> = {
  SENT: ["DRAFT"],
  CONFIRMED: ["SENT"],
  CLOSED: ["RECEIVED", "PARTIALLY_RECEIVED"],
  CANCELLED: ["DRAFT", "SENT", "CONFIRMED"],
};

export async function updatePurchaseOrderStatus(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const actor = await requireActiveRole(["ADMIN", "MASTER"]);
  if (!actor) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") || "");
  if (!Number.isInteger(id) || id <= 0 || !PO_ALLOWED_FROM[status]) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) {
    return { message: "Không tìm thấy đơn mua." };
  }
  const scope = vesselScope(actor);
  if (!scope.all && po.vesselId !== scope.vesselId) {
    return { message: NO_PERMISSION };
  }
  const result = await prisma.purchaseOrder.updateMany({
    where: { id, status: { in: PO_ALLOWED_FROM[status] } },
    data: { status },
  });
  if (result.count === 0) {
    return { message: "Đơn đã đổi trạng thái, vui lòng tải lại trang." };
  }
  revalidatePath("/purchasing");
  revalidatePath(`/purchasing/${id}`);
  return { message: "", success: true };
}

// Nhận hàng: nhập kho + cập nhật tiến độ giao của yêu cầu, cuộn trạng thái PO.
export async function receivePurchaseOrder(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const actor = await requireActiveRole(["ADMIN", "MASTER"]);
  if (!actor) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  const warehouseId = Number(formData.get("warehouseId"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!po) {
    return { message: "Không tìm thấy đơn mua." };
  }
  const scope = vesselScope(actor);
  if (!scope.all && po.vesselId !== scope.vesselId) {
    return { message: NO_PERMISSION };
  }
  if (!["SENT", "CONFIRMED", "PARTIALLY_RECEIVED"].includes(po.status)) {
    return {
      message: "Chỉ nhận hàng khi đơn đã gửi/xác nhận. Vui lòng tải lại trang.",
    };
  }
  // Kho nhận phải thuộc tàu của đơn (chỉ bắt buộc khi có dòng gắn vật tư danh mục).
  const hasMaterialLine = po.items.some((it) => it.materialId !== null);
  let warehouse = null;
  if (Number.isInteger(warehouseId) && warehouseId > 0) {
    warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse || warehouse.vesselId !== po.vesselId) {
      return { message: "Kho nhận không thuộc tàu của đơn." };
    }
  } else if (hasMaterialLine) {
    return { message: "Vui lòng chọn kho nhận cho vật tư có trong danh mục." };
  }

  // SL người dùng muốn nhận cho từng dòng (chưa kẹp — kẹp lại trong transaction từ dữ liệu mới).
  const requestedByItem = new Map<number, number>();
  for (const it of po.items) {
    const raw = Number(formData.get(`recv_${it.id}`));
    if (Number.isFinite(raw) && raw > 0) requestedByItem.set(it.id, raw);
  }
  if (requestedByItem.size === 0) {
    return { message: "Chưa nhập số lượng nhận cho dòng nào." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Đọc lại PO + dòng MỚI TRONG transaction để tránh nhận trùng (double-submit).
      const fresh = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!fresh) throw new ActionError("Không tìm thấy đơn mua.");
      if (
        !["SENT", "CONFIRMED", "PARTIALLY_RECEIVED"].includes(fresh.status)
      ) {
        throw new ActionError(
          "Đơn đã đổi trạng thái, vui lòng tải lại trang."
        );
      }
      const affectedRequestIds = new Set<number>();
      let totalReceived = 0;
      for (const item of fresh.items) {
        const desired = requestedByItem.get(item.id) ?? 0;
        const remaining = Math.max(0, item.quantity - item.quantityReceived);
        const qty = Math.min(desired, remaining);
        if (qty <= 0) continue;
        totalReceived += qty;
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: {
            quantityReceived: { increment: qty },
            warehouseId:
              item.materialId && warehouse ? warehouse.id : item.warehouseId,
          },
        });
        // Nhập kho cho vật tư có trong danh mục
        if (item.materialId && warehouse) {
          await tx.inventory.upsert({
            where: {
              materialId_warehouseId: {
                materialId: item.materialId,
                warehouseId: warehouse.id,
              },
            },
            update: { quantity: { increment: qty }, vesselId: fresh.vesselId },
            create: {
              materialId: item.materialId,
              warehouseId: warehouse.id,
              vesselId: fresh.vesselId,
              quantity: qty,
            },
          });
          await tx.inventoryTransaction.create({
            data: {
              type: "IN",
              materialId: item.materialId,
              warehouseId: warehouse.id,
              vesselId: fresh.vesselId,
              quantity: qty,
              note: `Nhận hàng ${fresh.poNo}`,
              performedBy: actor.name,
            },
          });
        }
        // Cập nhật tiến độ giao của dòng yêu cầu
        if (item.requestItemId) {
          const ri = await tx.materialRequestItem.update({
            where: { id: item.requestItemId },
            data: { suppliedQuantity: { increment: qty } },
          });
          affectedRequestIds.add(ri.requestId);
        }
      }
      if (totalReceived === 0) {
        throw new ActionError("Các dòng đã nhận đủ, không còn gì để nhận.");
      }
      // Cuộn trạng thái PO
      const freshItems = await tx.purchaseOrderItem.findMany({
        where: { poId: id },
      });
      const allReceived = freshItems.every(
        (it) => it.quantityReceived >= it.quantity
      );
      const anyReceived = freshItems.some((it) => it.quantityReceived > 0);
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: allReceived
            ? "RECEIVED"
            : anyReceived
              ? "PARTIALLY_RECEIVED"
              : fresh.status,
        },
      });
      // Cuộn trạng thái giao của các yêu cầu liên quan
      for (const reqId of affectedRequestIds) {
        const req = await tx.materialRequest.findUnique({
          where: { id: reqId },
          include: { items: true },
        });
        if (!req) continue;
        if (["CLOSED", "CANCELLED", "REJECTED"].includes(req.status)) continue;
        const allDelivered = req.items.every((it) => {
          const target =
            it.approvedQuantity > 0 ? it.approvedQuantity : it.quantity;
          return it.suppliedQuantity >= target;
        });
        const anyDelivered = req.items.some((it) => it.suppliedQuantity > 0);
        await tx.materialRequest.update({
          where: { id: reqId },
          data: {
            status: allDelivered
              ? "FULLY_DELIVERED"
              : anyDelivered
                ? "PARTIALLY_DELIVERED"
                : req.status,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof ActionError) {
      return { message: error.message };
    }
    throw error;
  }
  revalidatePath("/purchasing");
  revalidatePath(`/purchasing/${id}`);
  revalidatePath("/requests");
  revalidatePath("/inventory");
  return { message: "Đã ghi nhận nhận hàng.", success: true };
}

export async function createLashingReport(
  _prevState: { message: string; values?: Record<string, string> },
  formData: FormData
): Promise<{ message: string; values?: Record<string, string> }> {
  const echoValues = () => {
    const values: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        values[key] = value;
      }
    }
    return values;
  };
  const actor = await requireActiveRole(["ADMIN", "MASTER"]);
  if (!actor) {
    return { message: NO_PERMISSION, values: echoValues() };
  }
  const scope = vesselScope(actor);
  const vesselId = Number(formData.get("vesselId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) {
    return { message: "Tàu không hợp lệ.", values: echoValues() };
  }
  if (!scope.all && vesselId !== scope.vesselId) {
    return {
      message: "Bạn chỉ được lập báo cáo cho tàu mình phụ trách.",
      values: echoValues(),
    };
  }
  const reportDateRaw = String(formData.get("reportDate") || "");
  const reportDate = new Date(reportDateRaw);
  if (isNaN(reportDate.getTime())) {
    return { message: "Ngày báo cáo không hợp lệ.", values: echoValues() };
  }
  const voyageNo = String(formData.get("voyageNo") || "").trim();
  const position = String(formData.get("position") || "").trim();
  const gears = await prisma.lashingGear.findMany({
    where: { vesselId },
    orderBy: { sortOrder: "asc" },
  });
  if (!gears.length) {
    return {
      message: "Tàu chưa có danh mục dụng cụ chằng buộc.",
      values: echoValues(),
    };
  }
  const lines = [];
  for (const gear of gears) {
    const rawIn = formData.get(`inOrder_${gear.id}`);
    const rawOut = formData.get(`outOfOrder_${gear.id}`);
    if (rawIn === null || rawOut === null) {
      return {
        message:
          "Danh mục dụng cụ vừa thay đổi. Vui lòng tải lại trang và nhập lại số liệu.",
        values: echoValues(),
      };
    }
    const inOrder = Number(rawIn);
    const outOfOrder = Number(rawOut);
    lines.push({
      gearId: gear.id,
      gearName: gear.name,
      partNo: gear.partNo,
      minQty: gear.minQty,
      standardQty: gear.standardQty,
      inOrder: Number.isFinite(inOrder) && inOrder >= 0 ? inOrder : 0,
      outOfOrder:
        Number.isFinite(outOfOrder) && outOfOrder >= 0 ? outOfOrder : 0,
    });
  }
  const report = await prisma.lashingReport.create({
    data: {
      vesselId,
      reportDate,
      voyageNo: voyageNo || null,
      position: position || null,
      createdBy: actor.name,
      lines: { create: lines },
    },
  });
  revalidatePath("/lashing");
  redirect(`/lashing/${report.id}`);
}

export async function updateLashingGear(
  _prevState: {
    message: string;
    success?: boolean;
    values?: Record<string, string>;
  },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const values = formValues(formData, [
    "name",
    "partNo",
    "minQty",
    "standardQty",
  ]);
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const partNo = String(formData.get("partNo") || "").trim();
  const minQty = Number(formData.get("minQty") || 0);
  const standardQty = Number(formData.get("standardQty") || 0);
  if (!Number.isInteger(id) || id <= 0 || !name) {
    return { message: "Dữ liệu không hợp lệ.", values };
  }
  if (!(minQty >= 0) || !(standardQty >= 0)) {
    return { message: "Số lượng không hợp lệ.", values };
  }
  try {
    await prisma.lashingGear.update({
      where: { id },
      data: { name, partNo: partNo || null, minQty, standardQty },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { message: "Không tìm thấy dụng cụ.", values };
      }
      if (error.code === "P2002") {
        return {
          message: `Tên dụng cụ "${name}" đã tồn tại trên tàu này.`,
          values,
        };
      }
    }
    throw error;
  }
  revalidatePath("/lashing");
  return { message: "Đã lưu.", success: true };
}

export async function createLashingGear(
  _prevState: {
    message: string;
    success?: boolean;
    values?: Record<string, string>;
  },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const values = formValues(formData, [
    "name",
    "partNo",
    "minQty",
    "standardQty",
  ]);
  const vesselId = Number(formData.get("vesselId"));
  const name = String(formData.get("name") || "").trim();
  const partNo = String(formData.get("partNo") || "").trim();
  const minQty = Number(formData.get("minQty") || 0);
  const standardQty = Number(formData.get("standardQty") || 0);
  if (!Number.isInteger(vesselId) || vesselId <= 0 || !name) {
    return { message: "Tên dụng cụ là bắt buộc.", values };
  }
  if (!(minQty >= 0) || !(standardQty >= 0)) {
    return { message: "Số lượng không hợp lệ.", values };
  }
  const maxOrder = await prisma.lashingGear.aggregate({
    where: { vesselId },
    _max: { sortOrder: true },
  });
  try {
    await prisma.lashingGear.create({
      data: {
        vesselId,
        name,
        partNo: partNo || null,
        minQty,
        standardQty,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        message: `Tên dụng cụ "${name}" đã tồn tại trên tàu này.`,
        values,
      };
    }
    throw error;
  }
  revalidatePath("/lashing");
  return { message: `Đã thêm dụng cụ "${name}".`, success: true };
}

export async function deleteLashingGear(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  const lineCount = await prisma.lashingReportLine.count({
    where: { gearId: id },
  });
  if (lineCount > 0) {
    return {
      message:
        "Dụng cụ đã xuất hiện trong báo cáo cũ nên không thể xóa (bảo toàn lịch sử).",
    };
  }
  try {
    await prisma.lashingGear.delete({ where: { id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { message: "Không tìm thấy dụng cụ." };
    }
    throw error;
  }
  revalidatePath("/lashing");
  return { message: "", success: true };
}

const REPORT_TYPES = ["MLS-11-01", "MLS-11-04", "MLS-11-13", "KHÁC"];

export async function uploadReportDocument(
  _prevState: {
    message: string;
    success?: boolean;
    values?: Record<string, string>;
  },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const actor = await requireActiveRole([...LAP_YEU_CAU]);
  if (!actor) {
    return { message: NO_PERMISSION };
  }
  const scope = vesselScope(actor);
  const values = formValues(formData, [
    "vesselId",
    "reportType",
    "period",
    "title",
    "note",
  ]);
  const vesselId = Number(formData.get("vesselId"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) {
    return { message: "Tàu không hợp lệ.", values };
  }
  if (!scope.all && vesselId !== scope.vesselId) {
    return {
      message: scope.unassigned
        ? "Bạn chưa được gán tàu nên chưa thể tải báo cáo lên."
        : "Bạn chỉ được tải báo cáo cho tàu mình phụ trách.",
      values,
    };
  }
  const vessel = await prisma.vessel.findUnique({ where: { id: vesselId } });
  if (!vessel) {
    return { message: "Tàu không tồn tại.", values };
  }
  const reportType = String(formData.get("reportType") || "");
  if (!REPORT_TYPES.includes(reportType)) {
    return { message: "Loại báo cáo không hợp lệ.", values };
  }
  const period = String(formData.get("period") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { message: "Vui lòng chọn file báo cáo.", values };
  }
  const ext = fileExtension(file.name);
  const allowed = ALLOWED_EXTENSIONS[ext];
  if (!allowed) {
    return {
      message: "Chỉ chấp nhận file PDF hoặc Excel (.pdf, .xls, .xlsx).",
      values,
    };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { message: "File vượt quá giới hạn 20MB.", values };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const storedName = `${randomUUID()}${ext}`;
  const dir = await ensureUploadDir();
  const fullPath = path.join(dir, storedName);
  await writeFile(fullPath, buffer);
  try {
    await prisma.reportDocument.create({
      data: {
        vesselId,
        title: title || file.name,
        reportType,
        period: period || null,
        fileName: file.name,
        storedName,
        mimeType: allowed.mime,
        size: file.size,
        sha256,
        note: note || null,
        uploadedById: actor.id,
      },
    });
  } catch (error) {
    // Ghi DB lỗi -> dọn file vừa ghi để không để lại file mồ côi trên đĩa
    await unlink(fullPath).catch(() => {});
    throw error;
  }
  revalidatePath("/documents");
  return {
    message: `Đã lưu "${file.name}" vào hồ sơ ${vessel.code}. Mã toàn vẹn SHA-256: ${sha256.slice(0, 16)}…`,
    success: true,
  };
}

export async function deleteReportDocument(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  const doc = await prisma.reportDocument.findUnique({ where: { id } });
  if (!doc) {
    return { message: "Không tìm thấy hồ sơ." };
  }
  await prisma.reportDocument.delete({ where: { id } });
  try {
    await unlink(path.join(getUploadDir(), doc.storedName));
  } catch {
    // file đã không còn trên đĩa — bỏ qua
  }
  revalidatePath("/documents");
  return { message: "", success: true };
}

// Danh sách vai trò hợp lệ lấy thẳng từ lib/roles.ts — trước đây là một mảng
// chép tay ở đây, thêm vai trò mới vào ô chọn mà quên sửa mảng này là server
// từ chối với thông báo "Vai trò không hợp lệ" mà giao diện không hề báo trước.
const USER_ROLES: readonly string[] = ROLES;

async function parseVesselAssignment(
  formData: FormData
): Promise<{ vesselId: number | null } | { error: string }> {
  const raw = String(formData.get("vesselId") || "");
  if (!raw) {
    return { vesselId: null };
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: "Tàu phụ trách không hợp lệ." };
  }
  const vessel = await prisma.vessel.findUnique({ where: { id: parsed } });
  if (!vessel) {
    return { error: "Tàu phụ trách không tồn tại." };
  }
  return { vesselId: parsed };
}

export async function createUser(
  _prevState: { message: string; values?: Record<string, string> },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const values = formValues(formData, ["name", "email", "role", "vesselId"]);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "");
  if (!name || !email || !password) {
    return { message: "Tên, email và mật khẩu là bắt buộc.", values };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { message: "Email không hợp lệ.", values };
  }
  if (password.length < 8) {
    return { message: "Mật khẩu phải có ít nhất 8 ký tự.", values };
  }
  if (!USER_ROLES.includes(role)) {
    return { message: "Vai trò không hợp lệ.", values };
  }
  const vesselResult = await parseVesselAssignment(formData);
  if ("error" in vesselResult) {
    return { message: vesselResult.error, values };
  }
  const hashed = await bcrypt.hash(password, 10);
  try {
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role,
        vesselId: vesselResult.vesselId,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: `Email "${email}" đã được sử dụng.`, values };
    }
    throw error;
  }
  revalidatePath("/users");
  return { message: `Đã tạo người dùng "${email}".`, success: true };
}

export async function updateUserRole(
  _prevState: { message: string },
  formData: FormData
): Promise<{
  message: string;
  success?: boolean;
  values?: Record<string, string>;
}> {
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) {
    return { message: NO_PERMISSION };
  }
  const values = formValues(formData, ["role", "vesselId"]);
  const id = Number(formData.get("id"));
  const role = String(formData.get("role") || "");
  if (!Number.isInteger(id) || id <= 0 || !USER_ROLES.includes(role)) {
    return { message: "Dữ liệu không hợp lệ.", values };
  }
  if (id === admin.id) {
    return { message: "Không thể tự thay đổi quyền của chính mình.", values };
  }
  const vesselResult = await parseVesselAssignment(formData);
  if ("error" in vesselResult) {
    return { message: vesselResult.error, values };
  }
  await prisma.user.update({
    where: { id },
    data: { role, vesselId: vesselResult.vesselId },
  });
  revalidatePath("/users");
  return { message: "", success: true };
}

export async function toggleUserActive(
  _prevState: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  if (!id) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  if (id === admin.id) {
    return { message: "Không thể tự khóa tài khoản của chính mình." };
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return { message: "Không tìm thấy người dùng." };
  }
  await prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
  });
  revalidatePath("/users");
  return { message: "", success: true };
}

// Xóa hẳn một đơn mua ĐÃ HỦY. Đơn hủy là rác trong danh sách nhưng vẫn phải
// thận trọng: chỉ xóa khi chắc chắn nó chưa ảnh hưởng tới tồn kho hay yêu cầu.
export async function deletePurchaseOrder(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  // Xóa chứng từ mua sắm là việc hệ trọng — chỉ quản trị viên.
  const actor = await requireActiveRole(["ADMIN"]);
  if (!actor) {
    return { message: "Chỉ quản trị viên mới xóa được đơn mua." };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!po) {
    return { message: "Đơn mua đã bị xóa hoặc không tồn tại." };
  }
  const scope = vesselScope(actor);
  if (!scope.all && po.vesselId !== scope.vesselId) {
    return { message: NO_PERMISSION };
  }
  if (po.status !== "CANCELLED") {
    return {
      message:
        "Chỉ xóa được đơn ĐÃ HỦY. Đơn đang xử lý thì hãy bấm Hủy trước, để giữ vết là nó từng tồn tại.",
    };
  }
  // Đã nhận hàng nghĩa là tồn kho đã bị tác động — xóa đơn sẽ mất căn cứ của
  // số tồn đó, nên chặn lại kể cả khi đơn đã hủy.
  const received = po.items.reduce((s, i) => s + i.quantityReceived, 0);
  if (received > 0) {
    return {
      message: `Không xóa được: đơn này đã nhận ${received} đơn vị hàng, xóa đi sẽ mất căn cứ của số tồn kho đã ghi.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    // Dòng đơn có gắn với dòng yêu cầu thì trả lại phần "đã đặt" cho yêu cầu,
    // để yêu cầu đó lại hiện trong hàng chờ mua sắm.
    for (const item of po.items) {
      if (item.requestItemId) {
        await tx.materialRequestItem.update({
          where: { id: item.requestItemId },
          data: { suppliedQuantity: { decrement: item.quantityReceived } },
        });
      }
    }
    // PurchaseOrderItem tự xóa theo (onDelete: Cascade).
    await tx.purchaseOrder.delete({ where: { id } });
  });

  revalidatePath("/purchasing");
  revalidatePath("/dashboard");
  return { message: `Đã xóa đơn ${po.poNo}.`, success: true };
}

// Sửa vật tư ngay tại dòng trong bảng danh mục — không phải mở form riêng.
export async function updateMaterial(
  _prevState: { message: string; success?: boolean },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { message: "Dữ liệu không hợp lệ." };
  }
  const before = await prisma.material.findUnique({ where: { id } });
  if (!before) {
    return { message: "Vật tư đã bị xóa hoặc không tồn tại." };
  }

  const str = (k: string) => String(formData.get(k) || "").trim();
  const code = str("code");
  const nameVn = str("nameVn");
  if (!code || !nameVn) {
    return { message: "Mã vật tư và tên vật tư là bắt buộc." };
  }
  const materialType = str("materialType") === "SPARE" ? "SPARE" : "STORE";
  const equipment = str("equipment");
  const categoryIdRaw = str("categoryId");
  const minStock = Number(formData.get("minStock") || 0);
  const maxStock = Number(formData.get("maxStock") || 0);
  if (!Number.isFinite(minStock) || minStock < 0) {
    return { message: "Tồn tối thiểu không hợp lệ." };
  }
  if (!Number.isFinite(maxStock) || maxStock < 0) {
    return { message: "Tồn tối đa không hợp lệ." };
  }

  try {
    await prisma.material.update({
      where: { id },
      data: {
        code,
        nameVn,
        nameEn: str("nameEn") || null,
        impa: str("impa") || null,
        partNumber: str("partNumber") || null,
        manufacturer: str("manufacturer") || null,
        materialType,
        // Thiết bị chỉ có nghĩa với phụ tùng — đổi sang Vật tư thì xóa đi cho
        // khỏi treo dữ liệu cũ gây gom nhóm sai.
        equipment: materialType === "SPARE" ? equipment || null : null,
        uom: str("uom") || "PCS",
        categoryId: categoryIdRaw ? Number(categoryIdRaw) : null,
        minStock,
        maxStock,
        isCritical: formData.get("isCritical") === "on",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: `Mã vật tư "${code}" đã có ở vật tư khác.` };
    }
    throw error;
  }
  revalidatePath("/materials");
  revalidatePath("/inventory");
  return { message: `Đã lưu "${nameVn}".`, success: true };
}
