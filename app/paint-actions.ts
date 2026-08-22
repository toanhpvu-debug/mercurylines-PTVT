"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  canManageVesselCatalog,
  coQuanLySon,
  requireActiveRole,
  vesselScope,
} from "@/lib/auth";
import { PAINT_TYPE_VALUES } from "@/lib/paintTypes";
import { VAN_HANH_SON, boPhanCuaChucDanh } from "@/lib/roles";

// Server action cho module Quản lý sơn. Tách khỏi app/actions.ts (đã 2200 dòng)
// để phần sơn đứng riêng, dễ đọc và dễ sửa.

const NO_PERMISSION = "Bạn không có quyền thực hiện thao tác này.";

type ActionState = {
  message: string;
  success?: boolean;
  values?: Record<string, string>;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function num(formData: FormData, key: string, fallback = 0) {
  const raw = text(formData, key);
  if (!raw) return fallback;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Kiểm tra quyền thao tác phần SƠN của một tàu, trả về user hoặc null.
//
// Dùng quyền riêng của phần sơn (VAN_HANH_SON) chứ không phải quyền danh mục
// vật tư: đại phó là trưởng bộ phận boong nên quản kho sơn, nhưng không vì thế
// mà được sửa danh mục vật tư của tàu.
async function requireVesselAccess(vesselId: number) {
  const actor = await requireActiveRole([...VAN_HANH_SON]);
  if (!actor) return null;
  if (!coQuanLySon(actor, vesselId)) return null;
  return actor;
}

// Danh mục sơn dùng chung toàn đội và việc chép sơ đồ giữa các tàu vẫn thuộc
// văn phòng / thuyền trưởng — không phải việc của một bộ phận trên tàu.
async function requireFleetPaintAccess() {
  return requireActiveRole(["ADMIN", "MASTER"]);
}

function revalidateVessel(vesselId: number) {
  revalidatePath("/paint");
  revalidatePath(`/paint/${vesselId}`);
}

// ─── Danh mục sơn (dùng chung toàn đội) ──────────────────────────────────────

export async function savePaintProduct(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await requireFleetPaintAccess())) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id") || 0);
  const name = text(formData, "name");
  const code = text(formData, "code");
  const paintType = text(formData, "paintType") || "OTHER";
  if (!name) {
    return { message: "Tên sơn là bắt buộc." };
  }
  if (!PAINT_TYPE_VALUES.includes(paintType)) {
    return { message: "Loại sơn không hợp lệ." };
  }
  const data = {
    name,
    maker: text(formData, "maker") || null,
    paintType,
    colorCode: text(formData, "colorCode") || null,
    colorName: text(formData, "colorName") || null,
    uom: text(formData, "uom") || "L",
    packSize: num(formData, "packSize"),
    coverage: num(formData, "coverage"),
    dftPerCoat: num(formData, "dftPerCoat"),
    thinner: text(formData, "thinner") || null,
    notes: text(formData, "notes") || null,
  };
  try {
    if (id > 0) {
      await prisma.paintProduct.update({
        where: { id },
        data: code ? { ...data, code } : data,
      });
    } else {
      // Mã tự sinh SON-#### nếu người dùng không nhập.
      let finalCode = code;
      if (!finalCode) {
        const count = await prisma.paintProduct.count();
        let seq = count + 1;
        finalCode = `SON-${String(seq).padStart(4, "0")}`;
        while (
          await prisma.paintProduct.findUnique({ where: { code: finalCode } })
        ) {
          seq += 1;
          finalCode = `SON-${String(seq).padStart(4, "0")}`;
        }
      }
      await prisma.paintProduct.create({ data: { ...data, code: finalCode } });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: `Mã sơn "${code}" đã tồn tại.` };
    }
    throw error;
  }
  revalidatePath("/paint/products");
  revalidatePath("/paint");
  return { message: `Đã lưu sơn "${name}".`, success: true };
}

export async function togglePaintProduct(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  const product = await prisma.paintProduct.findUnique({ where: { id } });
  if (!product) return { message: "Không tìm thấy loại sơn." };
  await prisma.paintProduct.update({
    where: { id },
    data: { isActive: !product.isActive },
  });
  revalidatePath("/paint/products");
  return {
    message: product.isActive
      ? `Đã ngừng dùng "${product.name}".`
      : `Đã dùng lại "${product.name}".`,
    success: true,
  };
}

export async function deletePaintProduct(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  const product = await prisma.paintProduct.findUnique({
    where: { id },
    include: {
      _count: { select: { schemeLayers: true, jobLines: true, stocks: true } },
    },
  });
  if (!product) return { message: "Không tìm thấy loại sơn." };
  // Giữ lịch sử: đã dùng trong sơ đồ sơn hoặc nhật ký thì không xóa được.
  const used =
    product._count.schemeLayers + product._count.jobLines;
  if (used > 0) {
    return {
      message: `Không xóa được: "${product.name}" đang dùng trong ${product._count.schemeLayers} lớp sơ đồ và ${product._count.jobLines} dòng nhật ký. Hãy dùng "Ngừng dùng".`,
    };
  }
  const stocked = await prisma.paintStock.count({
    where: { productId: id, quantity: { gt: 0 } },
  });
  if (stocked > 0) {
    return {
      message: `Không xóa được: còn tồn trên ${stocked} tàu. Hãy xuất hết hoặc dùng "Ngừng dùng".`,
    };
  }
  await prisma.paintStock.deleteMany({ where: { productId: id } });
  await prisma.paintProduct.delete({ where: { id } });
  revalidatePath("/paint/products");
  return { message: `Đã xóa "${product.name}".`, success: true };
}

// ─── Khu vực sơn của tàu ─────────────────────────────────────────────────────

export async function savePaintArea(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const vesselId = Number(formData.get("vesselId"));
  if (!(await requireVesselAccess(vesselId))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id") || 0);
  const name = text(formData, "name");
  if (!name) return { message: "Tên khu vực là bắt buộc." };
  const data = {
    name,
    areaM2: num(formData, "areaM2"),
    sortOrder: Math.trunc(num(formData, "sortOrder")),
    notes: text(formData, "notes") || null,
  };
  try {
    if (id > 0) {
      await prisma.paintArea.update({ where: { id }, data });
    } else {
      await prisma.paintArea.create({ data: { ...data, vesselId } });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: `Tàu này đã có khu vực tên "${name}".` };
    }
    throw error;
  }
  revalidateVessel(vesselId);
  return { message: `Đã lưu khu vực "${name}".`, success: true };
}

export async function deletePaintArea(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const vesselId = Number(formData.get("vesselId"));
  if (!(await requireVesselAccess(vesselId))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  const area = await prisma.paintArea.findUnique({
    where: { id },
    include: { _count: { select: { jobs: true } } },
  });
  if (!area || area.vesselId !== vesselId) {
    return { message: "Không tìm thấy khu vực." };
  }
  if (area._count.jobs > 0) {
    return {
      message: `Không xóa được: đã có ${area._count.jobs} lần thi công ghi vào khu vực này. Xóa các bản ghi nhật ký trước nếu thật sự cần.`,
    };
  }
  // Xóa khu vực thì các lớp sơ đồ của nó bị xóa theo (onDelete: Cascade).
  await prisma.paintArea.delete({ where: { id } });
  revalidateVessel(vesselId);
  return { message: `Đã xóa khu vực "${area.name}".`, success: true };
}

// ─── Sơ đồ sơn: các lớp của một khu vực ──────────────────────────────────────

export async function savePaintSchemeLayer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const vesselId = Number(formData.get("vesselId"));
  if (!(await requireVesselAccess(vesselId))) {
    return { message: NO_PERMISSION };
  }
  const areaId = Number(formData.get("areaId"));
  const productId = Number(formData.get("productId"));
  if (!areaId || !productId) {
    return { message: "Chọn khu vực và loại sơn." };
  }
  const area = await prisma.paintArea.findUnique({ where: { id: areaId } });
  if (!area || area.vesselId !== vesselId) {
    return { message: "Khu vực không thuộc tàu này." };
  }
  const id = Number(formData.get("id") || 0);
  const data = {
    productId,
    layerNo: Math.max(1, Math.trunc(num(formData, "layerNo", 1))),
    coats: Math.max(1, Math.trunc(num(formData, "coats", 1))),
    dft: num(formData, "dft"),
    notes: text(formData, "notes") || null,
  };
  if (id > 0) {
    await prisma.paintSchemeLayer.update({ where: { id }, data });
  } else {
    await prisma.paintSchemeLayer.create({ data: { ...data, areaId } });
  }
  revalidateVessel(vesselId);
  return { message: "Đã lưu lớp sơn.", success: true };
}

export async function deletePaintSchemeLayer(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const vesselId = Number(formData.get("vesselId"));
  if (!(await requireVesselAccess(vesselId))) {
    return { message: NO_PERMISSION };
  }
  const id = Number(formData.get("id"));
  const layer = await prisma.paintSchemeLayer.findUnique({
    where: { id },
    include: { area: true },
  });
  if (!layer || layer.area.vesselId !== vesselId) {
    return { message: "Không tìm thấy lớp sơn." };
  }
  await prisma.paintSchemeLayer.delete({ where: { id } });
  revalidateVessel(vesselId);
  return { message: "Đã xóa lớp sơn.", success: true };
}

// ─── Tồn sơn: nhập / xuất ────────────────────────────────────────────────────

export async function paintStockMove(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const vesselId = Number(formData.get("vesselId"));
  const actor = await requireVesselAccess(vesselId);
  if (!actor) return { message: NO_PERMISSION };

  const productId = Number(formData.get("productId"));
  const type = text(formData, "type");
  const quantity = num(formData, "quantity");
  if (!productId) return { message: "Chọn loại sơn." };
  if (!["IN", "OUT"].includes(type)) {
    return { message: "Loại giao dịch không hợp lệ." };
  }
  if (!(quantity > 0)) {
    return { message: "Số lượng phải lớn hơn 0." };
  }
  const occurredRaw = text(formData, "occurredAt");
  let occurredAt = new Date();
  if (occurredRaw) {
    const d = new Date(occurredRaw);
    if (Number.isNaN(d.getTime())) {
      return { message: "Thời điểm không hợp lệ." };
    }
    if (d.getTime() > Date.now()) {
      return { message: "Không ghi được thời điểm ở tương lai." };
    }
    occurredAt = d;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const stock = await tx.paintStock.findUnique({
        where: { vesselId_productId: { vesselId, productId } },
      });
      const current = stock?.quantity ?? 0;
      if (type === "OUT" && quantity > current) {
        throw new Error(
          `Không đủ tồn: còn ${current}, muốn xuất ${quantity}.`
        );
      }
      const next = type === "IN" ? current + quantity : current - quantity;
      await tx.paintStock.upsert({
        where: { vesselId_productId: { vesselId, productId } },
        update: { quantity: next },
        create: { vesselId, productId, quantity: next },
      });
      await tx.paintTransaction.create({
        data: {
          vesselId,
          productId,
          type,
          quantity,
          note: text(formData, "note") || null,
          occurredAt,
          performedBy: actor.name,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Không đủ tồn")) {
      return { message: error.message };
    }
    throw error;
  }
  revalidateVessel(vesselId);
  return {
    message: type === "IN" ? "Đã nhập sơn." : "Đã xuất sơn.",
    success: true,
  };
}

export async function savePaintStockMin(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const vesselId = Number(formData.get("vesselId"));
  if (!(await requireVesselAccess(vesselId))) {
    return { message: NO_PERMISSION };
  }
  const productId = Number(formData.get("productId"));
  const minQty = num(formData, "minQty");
  if (!productId) return { message: "Thiếu loại sơn." };
  await prisma.paintStock.upsert({
    where: { vesselId_productId: { vesselId, productId } },
    update: { minQty },
    create: { vesselId, productId, minQty, quantity: 0 },
  });
  revalidateVessel(vesselId);
  return { message: "Đã lưu định mức tối thiểu.", success: true };
}

// ─── Nhật ký thi công sơn ────────────────────────────────────────────────────

export async function createPaintJob(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const vesselId = Number(formData.get("vesselId"));
  const actor = await requireVesselAccess(vesselId);
  if (!actor) return { message: NO_PERMISSION };

  const jobDateRaw = text(formData, "jobDate");
  if (!jobDateRaw) return { message: "Chọn ngày thi công." };
  const jobDate = new Date(jobDateRaw);
  if (Number.isNaN(jobDate.getTime())) {
    return { message: "Ngày thi công không hợp lệ." };
  }
  if (jobDate.getTime() > Date.now() + 24 * 3600 * 1000) {
    return { message: "Không ghi được ngày ở tương lai." };
  }

  const areaIdRaw = text(formData, "areaId");
  let areaId: number | null = null;
  if (areaIdRaw) {
    const aid = Number(areaIdRaw);
    const area = await prisma.paintArea.findUnique({ where: { id: aid } });
    if (!area || area.vesselId !== vesselId) {
      return { message: "Khu vực không thuộc tàu này." };
    }
    areaId = aid;
  }

  // Các dòng sơn đã dùng: productId[] + quantity[] song song.
  const productIds = formData.getAll("lineProductId").map((v) => Number(v));
  const quantities = formData.getAll("lineQuantity").map((v) => Number(v));
  const lines: { productId: number; quantity: number }[] = [];
  for (let i = 0; i < productIds.length; i++) {
    const pid = productIds[i];
    const qty = quantities[i];
    if (!pid || !Number.isFinite(qty) || qty <= 0) continue;
    // Gộp nếu người dùng chọn trùng loại sơn ở nhiều dòng.
    const found = lines.find((l) => l.productId === pid);
    if (found) found.quantity += qty;
    else lines.push({ productId: pid, quantity: qty });
  }
  if (!lines.length) {
    return { message: "Nhập ít nhất một dòng sơn đã dùng (loại sơn + số lượng)." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Kiểm tra đủ tồn trước khi ghi, để không tạo nhật ký treo.
      for (const line of lines) {
        const stock = await tx.paintStock.findUnique({
          where: {
            vesselId_productId: { vesselId, productId: line.productId },
          },
          include: { product: true },
        });
        const current = stock?.quantity ?? 0;
        if (line.quantity > current) {
          const p =
            stock?.product ??
            (await tx.paintProduct.findUnique({ where: { id: line.productId } }));
          throw new Error(
            `Không đủ tồn "${p?.name ?? line.productId}": còn ${current}, cần ${line.quantity}.`
          );
        }
      }
      const job = await tx.paintJob.create({
        data: {
          vesselId,
          areaId,
          jobDate,
          paintedM2: num(formData, "paintedM2"),
          coats: Math.max(1, Math.trunc(num(formData, "coats", 1))),
          weather: text(formData, "weather") || null,
          airTemp: numOrNull(formData, "airTemp"),
          humidity: numOrNull(formData, "humidity"),
          surfaceTemp: numOrNull(formData, "surfaceTemp"),
          performedBy: text(formData, "performedBy") || actor.name,
          notes: text(formData, "notes") || null,
          lines: { create: lines },
        },
      });
      // Thi công thì trừ tồn và ghi giao dịch OUT gắn với công việc.
      for (const line of lines) {
        await tx.paintStock.update({
          where: {
            vesselId_productId: { vesselId, productId: line.productId },
          },
          data: { quantity: { decrement: line.quantity } },
        });
        await tx.paintTransaction.create({
          data: {
            vesselId,
            productId: line.productId,
            type: "OUT",
            quantity: line.quantity,
            jobId: job.id,
            note: "Thi công sơn",
            occurredAt: jobDate,
            performedBy: actor.name,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Không đủ tồn")) {
      return { message: error.message };
    }
    throw error;
  }
  revalidateVessel(vesselId);
  return { message: "Đã ghi nhật ký thi công và trừ tồn sơn.", success: true };
}

export async function deletePaintJob(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const vesselId = Number(formData.get("vesselId"));
  const actor = await requireVesselAccess(vesselId);
  if (!actor) return { message: NO_PERMISSION };
  const id = Number(formData.get("id"));
  const job = await prisma.paintJob.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!job || job.vesselId !== vesselId) {
    return { message: "Không tìm thấy bản ghi thi công." };
  }
  // Xóa nhật ký thì hoàn lại tồn đã trừ, nếu không sổ sơn sẽ lệch vĩnh viễn.
  await prisma.$transaction(async (tx) => {
    for (const line of job.lines) {
      await tx.paintStock.upsert({
        where: {
          vesselId_productId: { vesselId, productId: line.productId },
        },
        update: { quantity: { increment: line.quantity } },
        create: { vesselId, productId: line.productId, quantity: line.quantity },
      });
    }
    await tx.paintTransaction.deleteMany({ where: { jobId: id } });
    await tx.paintJob.delete({ where: { id } });
  });
  revalidateVessel(vesselId);
  return {
    message: "Đã xóa bản ghi thi công và hoàn lại tồn sơn.",
    success: true,
  };
}

// Danh sách tàu theo phạm vi của người dùng — dùng cho trang tổng quan sơn.
export async function listPaintVessels(user: {
  role: string;
  vesselId: number | null;
}) {
  const scope = vesselScope(user);
  return prisma.vessel.findMany({
    where: scope.all ? {} : { id: scope.vesselId ?? -1 },
    orderBy: { code: "asc" },
  });
}

// ─── Sao chép sơ đồ sơn từ tàu khác ──────────────────────────────────────────
// Tàu cùng loạt (sister ship) dùng chung hệ sơn — khai lại từ đầu cho từng tàu
// vừa mất công vừa dễ sai lệch.

export async function copyPaintScheme(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const vesselId = Number(formData.get("vesselId"));
  if (!(await requireVesselAccess(vesselId))) {
    return { message: NO_PERMISSION };
  }
  const fromVesselId = Number(formData.get("fromVesselId"));
  if (!fromVesselId || fromVesselId === vesselId) {
    return { message: "Chọn một tàu khác để sao chép sơ đồ." };
  }
  // Chỉ đọc sơ đồ của tàu người dùng được phép xem.
  const actor = await requireFleetPaintAccess();
  if (!actor) return { message: NO_PERMISSION };
  const scope = vesselScope(actor);
  if (!scope.all && scope.vesselId !== fromVesselId) {
    return { message: "Bạn không được xem sơ đồ của tàu nguồn." };
  }

  const source = await prisma.paintArea.findMany({
    where: { vesselId: fromVesselId },
    include: { layers: { orderBy: { layerNo: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });
  if (!source.length) {
    return { message: "Tàu nguồn chưa có khu vực sơn nào." };
  }
  const existing = await prisma.paintArea.findMany({
    where: { vesselId },
    select: { name: true },
  });
  const taken = new Set(existing.map((a) => a.name));

  let addedAreas = 0;
  let addedLayers = 0;
  let skipped = 0;
  await prisma.$transaction(async (tx) => {
    for (const area of source) {
      // Trùng tên khu vực thì bỏ qua, KHÔNG ghi đè — tránh mất sơ đồ đã chỉnh riêng.
      if (taken.has(area.name)) {
        skipped += 1;
        continue;
      }
      const created = await tx.paintArea.create({
        data: {
          vesselId,
          name: area.name,
          areaM2: area.areaM2,
          sortOrder: area.sortOrder,
          notes: area.notes,
        },
      });
      addedAreas += 1;
      for (const layer of area.layers) {
        await tx.paintSchemeLayer.create({
          data: {
            areaId: created.id,
            productId: layer.productId,
            layerNo: layer.layerNo,
            coats: layer.coats,
            dft: layer.dft,
            notes: layer.notes,
          },
        });
        addedLayers += 1;
      }
    }
  });

  revalidateVessel(vesselId);
  if (!addedAreas) {
    return {
      message: `Không sao chép được khu vực nào — cả ${skipped} khu vực đều đã tồn tại trên tàu này.`,
    };
  }
  return {
    message:
      `Đã sao chép ${addedAreas} khu vực và ${addedLayers} lớp sơn.` +
      (skipped ? ` Bỏ qua ${skipped} khu vực đã có sẵn.` : ""),
    success: true,
  };
}

// ─── Nhập danh mục sơn từ file Excel hoặc text dán tay ───────────────────────

export async function importPaintProducts(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requireFleetPaintAccess();
  if (!actor) return { message: NO_PERMISSION };

  // Tàu để ghi tồn — tùy chọn. Bỏ trống thì chỉ nạp danh mục dùng chung.
  const vesselRaw = text(formData, "vesselId");
  let vesselId: number | null = null;
  if (vesselRaw) {
    const vid = Number(vesselRaw);
    if (!Number.isInteger(vid) || vid <= 0) {
      return { message: "Tàu không hợp lệ." };
    }
    if (!canManageVesselCatalog(actor, vid)) {
      return { message: "Bạn chỉ ghi tồn được cho tàu mình phụ trách." };
    }
    vesselId = vid;
  }

  const { parsePaintExcel, parsePaintText } = await import("@/lib/paintImport");
  const pasted = text(formData, "pasted");
  const file = formData.get("file");
  let parsed;

  if (pasted) {
    parsed = parsePaintText(pasted);
  } else if (file instanceof File && file.size > 0) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) {
      return {
        message:
          "Chưa đọc trực tiếp được file PDF. Hãy mở PDF, bôi đen bảng (Ctrl+A), copy (Ctrl+C) rồi dán vào ô “Dán từ PDF” bên dưới — cách này chính xác hơn vì trình đọc PDF lo phần trích chữ.",
      };
    }
    if (!/\.(xls|xlsx)$/.test(name)) {
      return { message: "File phải là Excel (.xls hoặc .xlsx)." };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { message: "File vượt quá 10MB." };
    }
    parsed = parsePaintExcel(Buffer.from(await file.arrayBuffer()));
  } else {
    return { message: "Hãy chọn file Excel hoặc dán nội dung từ PDF." };
  }

  if (parsed.error) return { message: parsed.error };

  // Ghép với sơn đã có theo TÊN (không phân biệt hoa thường) để nhập lại cùng
  // file không sinh bản sao.
  const existing = await prisma.paintProduct.findMany();
  const norm = (v: string) => v.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  const byName = new Map(existing.map((p) => [norm(p.name), p]));
  let seq = existing.length + 1;
  const usedCodes = new Set(existing.map((p) => p.code));
  const nextCode = () => {
    let code = `SON-${String(seq).padStart(4, "0")}`;
    while (usedCodes.has(code)) {
      seq += 1;
      code = `SON-${String(seq).padStart(4, "0")}`;
    }
    seq += 1;
    usedCodes.add(code);
    return code;
  };

  let created = 0;
  let updated = 0;
  let stockRows = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const item of parsed.items) {
        const key = norm(item.name);
        let product = byName.get(key);
        if (product) {
          // Chỉ điền thêm ô còn trống, KHÔNG ghi đè dữ liệu đã có trong app —
          // người dùng có thể đã chỉnh tay chính xác hơn file.
          const patch: Record<string, unknown> = {};
          if (!product.maker && item.maker) patch.maker = item.maker;
          if (product.paintType === "OTHER" && item.paintType)
            patch.paintType = item.paintType;
          if (!product.colorCode && item.colorCode) patch.colorCode = item.colorCode;
          if (!product.colorName && item.colorName) patch.colorName = item.colorName;
          if (!product.packSize && item.packSize) patch.packSize = item.packSize;
          if (!product.coverage && item.coverage) patch.coverage = item.coverage;
          if (!product.dftPerCoat && item.dftPerCoat)
            patch.dftPerCoat = item.dftPerCoat;
          if (!product.thinner && item.thinner) patch.thinner = item.thinner;
          if (Object.keys(patch).length) {
            product = await tx.paintProduct.update({
              where: { id: product.id },
              data: patch,
            });
            updated += 1;
          }
        } else {
          product = await tx.paintProduct.create({
            data: {
              code: nextCode(),
              name: item.name,
              maker: item.maker,
              paintType: item.paintType ?? "OTHER",
              colorCode: item.colorCode,
              colorName: item.colorName,
              uom: item.uom || "L",
              packSize: item.packSize ?? 0,
              coverage: item.coverage ?? 0,
              dftPerCoat: item.dftPerCoat ?? 0,
              thinner: item.thinner,
            },
          });
          byName.set(key, product);
          created += 1;
        }

        // Ghi tồn nếu chọn tàu và file có cột số lượng.
        if (vesselId && item.quantity !== null && item.quantity >= 0) {
          const stock = await tx.paintStock.findUnique({
            where: { vesselId_productId: { vesselId, productId: product.id } },
          });
          const current = stock?.quantity ?? 0;
          const delta = item.quantity - current;
          await tx.paintStock.upsert({
            where: { vesselId_productId: { vesselId, productId: product.id } },
            update: { quantity: item.quantity },
            create: { vesselId, productId: product.id, quantity: item.quantity },
          });
          if (delta !== 0) {
            await tx.paintTransaction.create({
              data: {
                vesselId,
                productId: product.id,
                type: delta > 0 ? "IN" : "OUT",
                quantity: Math.abs(delta),
                note: "Nhập danh mục sơn từ file",
                performedBy: actor.name,
              },
            });
          }
          stockRows += 1;
        }
      }
    },
    { timeout: 60000, maxWait: 10000 }
  );

  revalidatePath("/paint");
  revalidatePath("/paint/products");
  if (vesselId) revalidatePath(`/paint/${vesselId}`);

  const parts = [
    `Đã đọc ${parsed.items.length} dòng:`,
    `${created} loại sơn mới`,
    `${updated} loại đã có được bổ sung thông tin`,
  ];
  if (stockRows) parts.push(`${stockRows} dòng ghi tồn`);
  if (parsed.skippedRows) parts.push(`${parsed.skippedRows} dòng bỏ qua`);
  if (parsed.sheets?.length) {
    const read = parsed.sheets.filter((s) => !s.skipped);
    if (read.length)
      parts.push(
        "Sheet đã đọc: " + read.map((s) => `${s.name} (${s.count})`).join("; ")
      );
  }
  return { message: parts.join(" · "), success: true };
}

// ─── Yêu cầu cấp sơn gửi lên phê duyệt ───────────────────────────────────────

/**
 * Lập yêu cầu cấp sơn từ trang Quản lý sơn của tàu và trình lên luôn.
 *
 * KHÔNG dựng một đường phê duyệt riêng cho sơn. Yêu cầu sơn đi đúng dây chuyền
 * đang có của yêu cầu vật tư:
 *
 *   Đại phó lập  ->  Thuyền trưởng duyệt cấp tàu  ->  Công ty duyệt  ->  Mua sắm
 *
 * Bộ phận của yêu cầu lấy theo chức danh người lập, nên yêu cầu của đại phó
 * (boong) về đúng bàn thuyền trưởng, còn yêu cầu sơn buồng máy của máy trưởng
 * nằm trong thẩm quyền máy trưởng. Dựng đường duyệt thứ hai chỉ để phục vụ sơn
 * là tự tạo ra một bộ quy tắc nữa phải giữ cho khớp với bộ đang có.
 */
export async function taoYeuCauSon(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const vesselId = Number(formData.get("vesselId"));
  const actor = await requireVesselAccess(vesselId);
  if (!actor) return { message: NO_PERMISSION };

  const vessel = await prisma.vessel.findUnique({
    where: { id: vesselId },
    select: { code: true, name: true },
  });
  if (!vessel) return { message: "Tàu không tồn tại." };

  // Các dòng gửi lên: sl_<productId> = số lượng xin cấp.
  const dong: { productId: number; quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("sl_")) continue;
    const productId = Number(key.slice(3));
    const quantity = Number(String(value).replace(",", "."));
    if (!Number.isInteger(productId) || productId <= 0) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    dong.push({ productId, quantity });
  }
  if (dong.length === 0) {
    return { message: "Nhập số lượng cho ít nhất một loại sơn." };
  }

  const products = await prisma.paintProduct.findMany({
    where: { id: { in: dong.map((d) => d.productId) } },
  });
  if (products.length !== dong.length) {
    return { message: "Có loại sơn không còn trong danh mục." };
  }
  const theoId = new Map(products.map((p) => [p.id, p]));

  // Tồn sơn hiện tại của tàu — in vào cột ROB của chứng từ để người duyệt thấy
  // ngay còn bao nhiêu mà xin thêm bấy nhiêu.
  const stocks = await prisma.paintStock.findMany({
    where: { vesselId, productId: { in: dong.map((d) => d.productId) } },
  });
  const tonTheoId = new Map(stocks.map((s) => [s.productId, s.quantity]));

  const ghiChu = text(formData, "purpose");
  const priority = ["LOW", "NORMAL", "HIGH", "URGENT"].includes(
    text(formData, "priority")
  )
    ? text(formData, "priority")
    : "NORMAL";
  // Bộ phận theo chức danh người lập; không đoán được thì về boong vì sơn vỏ
  // là việc của boong.
  const department = boPhanCuaChucDanh(actor.role) ?? "DECK";

  // Số yêu cầu theo đúng quy ước chứng từ đang dùng: MR-<mã tàu>-<năm>-<số>.
  const vesselTag = vessel.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const base = `MR-${vesselTag}-${String(new Date().getFullYear()).slice(-2)}-`;
  const latest = await prisma.materialRequest.findFirst({
    where: { requestNo: { startsWith: base } },
    orderBy: { requestNo: "desc" },
    select: { requestNo: true },
  });
  let seq = latest ? Number(latest.requestNo.slice(base.length)) + 1 : 1;
  if (!Number.isFinite(seq) || seq < 1) seq = 1;
  let requestNo = `${base}${String(seq).padStart(4, "0")}`;
  while (await prisma.materialRequest.findUnique({ where: { requestNo } })) {
    seq += 1;
    requestNo = `${base}${String(seq).padStart(4, "0")}`;
  }

  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const req = await tx.materialRequest.create({
      data: {
        requestNo,
        kind: "STORE",
        vesselId,
        requestedBy: actor.name,
        requestedByRole: actor.role,
        department,
        priority,
        // Lập và trình trong một lần bấm, nhưng vẫn ghi đủ hai mốc ở nhật ký
        // để dấu vết giống hệt đường lập tay.
        status: "PENDING_MASTER",
        submittedBy: actor.name,
        submittedAt: now,
        purpose: ghiChu || `Yêu cầu cấp sơn cho ${vessel.name}`,
        items: {
          create: dong.map((d) => {
            const p = theoId.get(d.productId)!;
            const mau = p.colorName ? ` · ${p.colorName}` : "";
            return {
              // Sơn nằm ở danh mục sơn, không phải danh mục vật tư, nên ghi
              // thành dòng nhập tay thay vì trỏ materialId sang bảng khác.
              materialId: null,
              itemName: `${p.name}${p.maker ? ` (${p.maker})` : ""}${mau}`,
              itemCode: p.code,
              itemUom: p.uom,
              quantity: d.quantity,
              robSnapshot: tonTheoId.get(d.productId) ?? 0,
              approvedQuantity: 0,
              note: null,
            };
          }),
        },
      },
    });
    await tx.materialRequestEvent.createMany({
      data: [
        {
          requestId: req.id,
          fromStatus: null,
          toStatus: "DRAFT",
          actorName: actor.name,
          actorRole: actor.role,
          note: `Lập yêu cầu cấp sơn ${dong.length} dòng từ trang Quản lý sơn`,
        },
        {
          requestId: req.id,
          fromStatus: "DRAFT",
          toStatus: "PENDING_MASTER",
          actorName: actor.name,
          actorRole: actor.role,
          note: "Trình duyệt",
        },
      ],
    });
    return req;
  });

  revalidateVessel(vesselId);
  revalidatePath("/requests");
  return {
    message: `Đã gửi yêu cầu ${created.requestNo} (${dong.length} loại sơn) lên phê duyệt.`,
    success: true,
  };
}
