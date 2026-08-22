"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { coQuanLyNhienLieu, requireActiveRole } from "@/lib/auth";
import {
  CATEGORY_VALUES,
  CONSUMER_VALUES,
  GRADES,
  mocGiuMauDau,
  tinhHanDung,
} from "@/lib/consumables";
import { VAN_HANH_HOA_CHAT } from "@/lib/roles";

// Server action cho module Dầu · Dầu nhờn · Hóa chất. Tách khỏi app/actions.ts
// và app/paint-actions.ts để mỗi nghiệp vụ đứng riêng.

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

function dateOrNull(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Quyền thao tác một NHÓM cụ thể trên một tàu.
 *
 * Luôn hỏi kèm nhóm chứ không chỉ hỏi "có vào được module không": đại phó vào
 * được module vì có phần hóa chất, nhưng không vì thế mà ghi được bunker.
 */
async function requireNhom(vesselId: number, category: string | null) {
  const actor = await requireActiveRole([...VAN_HANH_HOA_CHAT]);
  if (!actor) return null;
  if (!coQuanLyNhienLieu(actor, vesselId, category)) return null;
  return actor;
}

// Danh mục dùng chung toàn đội — văn phòng / thuyền trưởng quản, như danh mục sơn.
async function requireFleet() {
  return requireActiveRole(["ADMIN", "MASTER"]);
}

function revalidateVessel(vesselId: number) {
  revalidatePath("/consumables");
  revalidatePath(`/consumables/${vesselId}`);
}

// ─── Danh mục mặt hàng ───────────────────────────────────────────────────────

export async function saveConsumableProduct(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = Number(formData.get("id") || 0);
  const category = text(formData, "category");
  if (!CATEGORY_VALUES.includes(category)) {
    return { message: "Nhóm không hợp lệ." };
  }
  // Thêm mới thì người quản nhóm đó trên tàu làm được; sửa mặt hàng đang dùng
  // chung toàn đội thì không — cùng quy tắc với danh mục sơn.
  const duocPhep =
    id > 0
      ? await requireFleet()
      : await requireActiveRole([...VAN_HANH_HOA_CHAT]);
  if (!duocPhep) {
    return {
      message:
        id > 0
          ? "Sửa mặt hàng dùng chung là việc của thuyền trưởng hoặc văn phòng. Bạn thêm mặt hàng mới được."
          : NO_PERMISSION,
    };
  }

  const name = text(formData, "name");
  if (!name) return { message: "Tên mặt hàng là bắt buộc." };
  const grade = text(formData, "grade") || "OTHER";
  if (!GRADES[category].some((g) => g.value === grade)) {
    return { message: "Chủng loại không hợp lệ với nhóm đã chọn." };
  }

  const shelfRaw = numOrNull(formData, "shelfLifeMonths");
  const data = {
    name,
    nameEn: text(formData, "nameEn") || null,
    category,
    grade,
    maker: text(formData, "maker") || null,
    uom: text(formData, "uom") || (category === "FUEL" ? "MT" : "L"),
    packSize: num(formData, "packSize"),
    sulphurMax: numOrNull(formData, "sulphurMax"),
    viscosity: numOrNull(formData, "viscosity"),
    density: numOrNull(formData, "density"),
    bnValue: numOrNull(formData, "bnValue"),
    hazardClass: text(formData, "hazardClass") || null,
    shelfLifeMonths: shelfRaw ? Math.trunc(shelfRaw) : null,
    msdsNote: text(formData, "msdsNote") || null,
    notes: text(formData, "notes") || null,
  };

  const code = text(formData, "code");
  try {
    if (id > 0) {
      await prisma.consumableProduct.update({
        where: { id },
        data: code ? { ...data, code } : data,
      });
    } else {
      // Mã tự sinh theo nhóm: FO-0001 / LO-0001 / CH-0001.
      const prefix =
        category === "FUEL" ? "FO" : category === "LUBE" ? "LO" : "CH";
      let finalCode = code;
      if (!finalCode) {
        let seq = (await prisma.consumableProduct.count({ where: { category } })) + 1;
        finalCode = `${prefix}-${String(seq).padStart(4, "0")}`;
        while (
          await prisma.consumableProduct.findUnique({ where: { code: finalCode } })
        ) {
          seq += 1;
          finalCode = `${prefix}-${String(seq).padStart(4, "0")}`;
        }
      }
      await prisma.consumableProduct.create({ data: { ...data, code: finalCode } });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: `Mã "${code}" đã tồn tại.` };
    }
    throw error;
  }
  revalidatePath("/consumables/products");
  revalidatePath("/consumables");
  return { message: `Đã lưu "${name}".`, success: true };
}

export async function toggleConsumableProduct(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) return { message: NO_PERMISSION };
  const id = Number(formData.get("id"));
  const p = await prisma.consumableProduct.findUnique({ where: { id } });
  if (!p) return { message: "Không tìm thấy mặt hàng." };
  await prisma.consumableProduct.update({
    where: { id },
    data: { isActive: !p.isActive },
  });
  revalidatePath("/consumables/products");
  return {
    message: p.isActive ? `Đã ngừng dùng "${p.name}".` : `Đã dùng lại "${p.name}".`,
    success: true,
  };
}

export async function deleteConsumableProduct(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  if (!(await requireActiveRole(["ADMIN"]))) return { message: NO_PERMISSION };
  const id = Number(formData.get("id"));
  const p = await prisma.consumableProduct.findUnique({
    where: { id },
    include: {
      _count: { select: { transactions: true, receipts: true, stocks: true } },
    },
  });
  if (!p) return { message: "Không tìm thấy mặt hàng." };
  const dinhKem =
    p._count.transactions + p._count.receipts + p._count.stocks;
  if (dinhKem > 0) {
    return {
      message: `Không xóa được: đã có ${p._count.receipts} phiếu nhận, ${p._count.transactions} giao dịch và ${p._count.stocks} dòng tồn gắn với mặt hàng này. Dùng "Ngừng dùng" để ẩn khỏi ô chọn mà vẫn giữ lịch sử.`,
    };
  }
  await prisma.consumableProduct.delete({ where: { id } });
  revalidatePath("/consumables/products");
  return { message: `Đã xóa "${p.name}".`, success: true };
}

// ─── Nhận hàng (BDN / phiếu giao) ────────────────────────────────────────────

/**
 * Ghi một lô nhận: vừa lưu chứng từ, vừa cộng tồn, vừa sinh giao dịch IN.
 *
 * Ba việc trong MỘT transaction. Tách ra thì có lúc phiếu đã lưu mà tồn chưa
 * cộng — nhìn vào đâu cũng thấy hợp lý, chỉ số tổng là sai.
 */
export async function createConsumableReceipt(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const vesselId = Number(formData.get("vesselId"));
  const productId = Number(formData.get("productId"));
  if (!vesselId || !productId) return { message: "Thiếu tàu hoặc mặt hàng." };

  const product = await prisma.consumableProduct.findUnique({
    where: { id: productId },
  });
  if (!product) return { message: "Mặt hàng không tồn tại." };

  const actor = await requireNhom(vesselId, product.category);
  if (!actor) return { message: NO_PERMISSION };

  const docNo = text(formData, "docNo");
  if (!docNo) {
    return {
      message:
        product.category === "FUEL"
          ? "Số BDN là bắt buộc — không có số BDN thì lô dầu không đối chiếu được khi kiểm tra."
          : "Số phiếu giao hàng là bắt buộc.",
    };
  }
  const quantity = num(formData, "quantity");
  if (!(quantity > 0)) return { message: "Số lượng phải lớn hơn 0." };

  const receivedAt = dateOrNull(formData, "receivedAt") ?? new Date();
  if (receivedAt.getTime() > Date.now()) {
    return { message: "Không ghi được ngày nhận ở tương lai." };
  }

  const sulphur = numOrNull(formData, "sulphur");
  // Hạn dùng: người dùng nhập thì lấy, không thì suy từ hạn dùng khai ở danh mục.
  const expiryDate =
    dateOrNull(formData, "expiryDate") ??
    (product.category === "CHEMICAL"
      ? tinhHanDung(receivedAt, product.shelfLifeMonths)
      : null);
  // Mẫu dầu: MARPOL VI Reg 18.8.1 — tự tính mốc 12 tháng, không bắt nhớ.
  const sampleKeepUntil =
    product.category === "FUEL" ? mocGiuMauDau(receivedAt) : null;

  await prisma.$transaction(async (tx) => {
    const receipt = await tx.consumableReceipt.create({
      data: {
        vesselId,
        productId,
        docNo,
        receivedAt,
        port: text(formData, "port") || null,
        supplier: text(formData, "supplier") || null,
        barge: text(formData, "barge") || null,
        quantity,
        density: numOrNull(formData, "density"),
        viscosity: numOrNull(formData, "viscosity"),
        sulphur,
        waterContent: numOrNull(formData, "waterContent"),
        flashPoint: numOrNull(formData, "flashPoint"),
        bnValue: numOrNull(formData, "bnValue"),
        expiryDate,
        sampleSealNo: text(formData, "sampleSealNo") || null,
        sampleKeepUntil,
        unitPrice: numOrNull(formData, "unitPrice"),
        currency: text(formData, "currency") || null,
        note: text(formData, "note") || null,
        performedBy: actor.name,
      },
    });
    const stock = await tx.consumableStock.findUnique({
      where: { vesselId_productId: { vesselId, productId } },
    });
    await tx.consumableStock.upsert({
      where: { vesselId_productId: { vesselId, productId } },
      update: { quantity: (stock?.quantity ?? 0) + quantity },
      create: { vesselId, productId, quantity },
    });
    await tx.consumableTransaction.create({
      data: {
        vesselId,
        productId,
        type: "IN",
        quantity,
        receiptId: receipt.id,
        occurredAt: receivedAt,
        performedBy: actor.name,
        note: `Nhận theo ${product.category === "FUEL" ? "BDN" : "phiếu"} ${docNo}`,
      },
    });
  });

  revalidateVessel(vesselId);
  const phan = [`Đã ghi nhận ${quantity} ${product.uom} theo ${docNo}.`];
  if (sampleKeepUntil) {
    phan.push(
      `Mẫu dầu giữ tới ${sampleKeepUntil.toLocaleDateString("vi-VN")} (MARPOL VI 18.8.1).`
    );
  }
  if (expiryDate) {
    phan.push(`Hạn dùng lô: ${expiryDate.toLocaleDateString("vi-VN")}.`);
  }
  return { message: phan.join(" "), success: true };
}

export async function deleteConsumableReceipt(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const id = Number(formData.get("id"));
  const receipt = await prisma.consumableReceipt.findUnique({
    where: { id },
    include: { product: true },
  });
  if (!receipt) return { message: "Không tìm thấy phiếu." };
  const actor = await requireNhom(receipt.vesselId, receipt.product.category);
  if (!actor) return { message: NO_PERMISSION };

  await prisma.$transaction(async (tx) => {
    // Trừ lại đúng lượng đã cộng khi nhận, rồi mới xóa phiếu — xóa suông thì
    // tồn giữ nguyên phần của một lô không còn tồn tại.
    const stock = await tx.consumableStock.findUnique({
      where: {
        vesselId_productId: {
          vesselId: receipt.vesselId,
          productId: receipt.productId,
        },
      },
    });
    if (stock) {
      await tx.consumableStock.update({
        where: { id: stock.id },
        data: { quantity: Math.max(0, stock.quantity - receipt.quantity) },
      });
    }
    await tx.consumableTransaction.deleteMany({ where: { receiptId: id } });
    await tx.consumableReceipt.delete({ where: { id } });
  });
  revalidateVessel(receipt.vesselId);
  return { message: `Đã xóa phiếu ${receipt.docNo} và hoàn lại tồn.`, success: true };
}

// ─── Tiêu thụ / xuất ─────────────────────────────────────────────────────────

export async function createConsumableMove(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const vesselId = Number(formData.get("vesselId"));
  const productId = Number(formData.get("productId"));
  if (!vesselId || !productId) return { message: "Thiếu tàu hoặc mặt hàng." };

  const product = await prisma.consumableProduct.findUnique({
    where: { id: productId },
  });
  if (!product) return { message: "Mặt hàng không tồn tại." };

  const actor = await requireNhom(vesselId, product.category);
  if (!actor) return { message: NO_PERMISSION };

  const type = text(formData, "type");
  if (!["IN", "OUT", "CONSUME"].includes(type)) {
    return { message: "Loại giao dịch không hợp lệ." };
  }
  const quantity = num(formData, "quantity");
  if (!(quantity > 0)) return { message: "Số lượng phải lớn hơn 0." };

  // Nơi tiêu thụ chỉ có nghĩa với CONSUME. Ghi vào IN/OUT là dữ liệu vô nghĩa
  // làm báo cáo cộng nhầm.
  let consumer: string | null = null;
  if (type === "CONSUME") {
    consumer = text(formData, "consumer") || "OTHER";
    if (!CONSUMER_VALUES.includes(consumer)) {
      return { message: "Nơi tiêu thụ không hợp lệ." };
    }
  }

  const occurredAt = dateOrNull(formData, "occurredAt") ?? new Date();
  if (occurredAt.getTime() > Date.now()) {
    return { message: "Không ghi được thời điểm ở tương lai." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const stock = await tx.consumableStock.findUnique({
        where: { vesselId_productId: { vesselId, productId } },
      });
      const current = stock?.quantity ?? 0;
      if (type !== "IN" && quantity > current) {
        throw new Error(
          `Không đủ tồn: còn ${current} ${product.uom}, muốn ghi ${quantity}.`
        );
      }
      const next = type === "IN" ? current + quantity : current - quantity;
      await tx.consumableStock.upsert({
        where: { vesselId_productId: { vesselId, productId } },
        update: { quantity: next },
        create: { vesselId, productId, quantity: next },
      });
      await tx.consumableTransaction.create({
        data: {
          vesselId,
          productId,
          type,
          quantity,
          consumer,
          occurredAt,
          performedBy: actor.name,
          note: text(formData, "note") || null,
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
    message:
      type === "IN"
        ? "Đã ghi nhận vào tồn."
        : type === "CONSUME"
          ? "Đã ghi tiêu thụ."
          : "Đã ghi xuất.",
    success: true,
  };
}

export async function saveConsumableMin(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const vesselId = Number(formData.get("vesselId"));
  const productId = Number(formData.get("productId"));
  const product = await prisma.consumableProduct.findUnique({
    where: { id: productId },
  });
  if (!product) return { message: "Mặt hàng không tồn tại." };
  if (!(await requireNhom(vesselId, product.category))) {
    return { message: NO_PERMISSION };
  }
  const minQty = num(formData, "minQty");
  await prisma.consumableStock.upsert({
    where: { vesselId_productId: { vesselId, productId } },
    update: { minQty },
    create: { vesselId, productId, minQty, quantity: 0 },
  });
  revalidateVessel(vesselId);
  return { message: "Đã lưu định mức.", success: true };
}
