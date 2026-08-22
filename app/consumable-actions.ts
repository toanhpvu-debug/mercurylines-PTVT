"use server";

import path from "path";
import { randomUUID } from "crypto";
import { mkdir, readdir, rename, stat, unlink, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { coQuanLyNhienLieu, requireActiveRole } from "@/lib/auth";
import {
  CATEGORY_LABEL,
  CATEGORY_VALUES,
  CONSUMER_VALUES,
  GRADES,
  mocGiuMauDau,
  tinhHanDung,
} from "@/lib/consumables";
import {
  QUAN_DANH_MUC_NHIEN_LIEU,
  ROLE_LABEL,
  SI_QUAN,
  VAN_HANH_HOA_CHAT,
  boPhanCuaChucDanh,
  trinhThangLenCongTy,
} from "@/lib/roles";
import { MAX_UPLOAD_BYTES, ensureUploadDir, getUploadDir } from "@/lib/uploads";
import type { PhieuDeXuat } from "@/lib/bunkerParse";

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

/**
 * Danh mục dầu / hóa chất dùng chung toàn đội.
 *
 * Có MÁY TRƯỞNG, khác với danh mục sơn: đây là danh mục nghiệp vụ của buồng máy
 * — người nắm rõ mã dầu, TBN, độ nhớt và hóa chất nào dùng cho nồi hơi chính là
 * máy trưởng, không phải văn phòng.
 */
async function requireFleet() {
  return requireActiveRole([...QUAN_DANH_MUC_NHIEN_LIEU]);
}

/**
 * Thư mục chứa file người dùng vừa đọc thử nhưng CHƯA lưu thành phiếu.
 *
 * Tách khỏi uploads/ để dọn được: file ở đây chắc chắn chưa có bản ghi nào trỏ
 * tới, nên quá hạn là xóa an toàn.
 */
async function ensureThuMucTam() {
  const dir = path.join(getUploadDir(), "tam-doc");
  await mkdir(dir, { recursive: true });
  return dir;
}

const HAN_FILE_TAM_MS = 24 * 60 * 60 * 1000;

/** Xóa file đọc thử quá 24 giờ mà không thành phiếu. */
async function donFileTamCu(dir: string) {
  try {
    const ds = await readdir(dir);
    const now = Date.now();
    for (const ten of ds) {
      const fp = path.join(dir, ten);
      const st = await stat(fp).catch(() => null);
      if (st && now - st.mtimeMs > HAN_FILE_TAM_MS) {
        await unlink(fp).catch(() => {});
      }
    }
  } catch {
    // Thư mục chưa có hoặc không đọc được — không phải lý do để chặn việc đọc file.
  }
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
  if (!(await requireFleet())) return { message: NO_PERMISSION };
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
  if (!(await requireFleet())) return { message: NO_PERMISSION };
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

  // Bản gốc đính kèm: hoặc file người dùng vừa chọn ở ô đính kèm, hoặc file đã
  // lưu sẵn ở bước "đọc từ PDF" (khỏi phải tải lên hai lần).
  let attachName: string | null = null;
  let attachStored: string | null = null;
  let attachSize: number | null = null;
  const tepDaCo = text(formData, "tepTam");
  const tepMoi = formData.get("attach");
  if (tepMoi instanceof File && tepMoi.size > 0) {
    if (tepMoi.size > MAX_UPLOAD_BYTES) {
      return { message: "File đính kèm vượt quá 20MB." };
    }
    const dir = await ensureUploadDir();
    const ext = tepMoi.name.toLowerCase().endsWith(".pdf") ? ".pdf" : "";
    if (!ext) return { message: "File đính kèm phải là PDF." };
    attachStored = `${randomUUID()}.pdf`;
    await writeFile(
      path.join(dir, attachStored),
      Buffer.from(await tepMoi.arrayBuffer())
    );
    attachName = tepMoi.name;
    attachSize = tepMoi.size;
  } else if (tepDaCo && /^[0-9a-f-]{36}\.pdf$/i.test(tepDaCo)) {
    // Chuyển file từ thư mục tạm sang uploads: từ lúc này nó là chứng từ của
    // một phiếu có thật, không còn là file đọc thử chờ dọn.
    const dir = await ensureUploadDir();
    const nguon = path.join(await ensureThuMucTam(), tepDaCo);
    const dich = path.join(dir, tepDaCo);
    try {
      await rename(nguon, dich);
      attachStored = tepDaCo;
      attachName = text(formData, "tepTamTen") || "ban-scan.pdf";
      attachSize = numOrNull(formData, "tepTamCo");
    } catch {
      // File tạm đã bị dọn (quá 24 giờ) — vẫn lưu phiếu, chỉ mất bản đính kèm.
      attachStored = null;
    }
  }

  await prisma.$transaction(async (tx) => {
    const receipt = await tx.consumableReceipt.create({
      data: {
        vesselId,
        productId,
        docNo,
        receivedAt,
        attachName,
        attachStored,
        attachSize: attachSize ? Math.trunc(attachSize) : null,
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
  // Dọn file đính kèm sau khi bản ghi đã xóa — xóa file trước mà transaction
  // hỏng thì mất bản gốc của một phiếu vẫn còn.
  if (receipt.attachStored) {
    await unlink(path.join(getUploadDir(), receipt.attachStored)).catch(() => {});
  }
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

// ─── Đọc phiếu từ file PDF (kể cả bản scan) ──────────────────────────────────

export type KetQuaDocPhieu = {
  message: string;
  success?: boolean;
  deXuat?: PhieuDeXuat;
  chu?: string;
  /** Tên file tạm đã lưu, để đính kèm khi lưu phiếu mà không phải tải lại. */
  tepTam?: string;
};

/**
 * Đọc một file PDF (BDN scan / phiếu giao) và ĐỀ XUẤT các ô để điền sẵn.
 *
 * KHÔNG ghi gì vào dữ liệu. Kết quả nhận dạng chữ không bao giờ chính xác 100%
 * — đọc nhầm một chữ số của khối lượng dầu là sai cả bảng cân đối nhiên liệu và
 * sai cả hồ sơ MARPOL. Người nhập phải đối chiếu với bản gốc rồi mới bấm lưu,
 * và bản gốc được đính kèm luôn vào phiếu để về sau còn đối chiếu được.
 */
export async function docPhieuTuPdf(
  _prev: KetQuaDocPhieu,
  formData: FormData
): Promise<KetQuaDocPhieu> {
  const vesselId = Number(formData.get("vesselId"));
  // Chỉ cần là người thao tác được ít nhất một nhóm trên tàu này — bước này
  // chưa ghi gì, quyền ghi kiểm ở lúc lưu phiếu.
  const actor = await requireActiveRole([...VAN_HANH_HOA_CHAT]);
  if (!actor || !coQuanLyNhienLieu(actor, vesselId)) {
    return { message: NO_PERMISSION };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { message: "Hãy chọn file PDF." };
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return { message: "File phải là PDF (.pdf)." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { message: "File vượt quá 20MB." };
  }

  const { docPdfBangOcr } = await import("@/lib/pdfOcr");
  const { docPhieuTuChu } = await import("@/lib/bunkerParse");

  // File đọc thử nằm ở thư mục TẠM riêng, không đổ thẳng vào uploads: đọc thử
  // rồi không lưu phiếu là chuyện thường (xem trước, chọn nhầm file), mỗi lần
  // như vậy mà để lại một file trong uploads thì thư mục phình mãi không ai
  // dám dọn vì không biết file nào còn được tham chiếu.
  const dirTam = await ensureThuMucTam();
  await donFileTamCu(dirTam);
  const storedName = `${randomUUID()}.pdf`;
  const fullPath = path.join(dirTam, storedName);
  await writeFile(fullPath, Buffer.from(await file.arrayBuffer()));

  const kq = await docPdfBangOcr(fullPath);
  if (!kq.ok) {
    // Giữ lại file: người dùng vẫn đính kèm được dù máy không đọc ra chữ.
    return {
      message: kq.loi,
      deXuat: undefined,
      tepTam: storedName,
    };
  }

  const deXuat = docPhieuTuChu(kq.text);
  const soO = deXuat.daDoc.length;
  return {
    message:
      soO === 0
        ? "Đọc được chữ nhưng không nhận ra ô nào quen thuộc. Hãy nhập tay và đối chiếu với bản gốc."
        : `Đã đọc ${soO} ô từ bản scan. Đối chiếu lại với bản gốc trước khi lưu — chữ nhận dạng từ ảnh không bao giờ đúng tuyệt đối.`,
    success: soO > 0,
    deXuat,
    chu: kq.text.slice(0, 4000),
    tepTam: storedName,
  };
}

// ─── Yêu cầu cấp dầu · dầu nhờn · hóa chất ───────────────────────────────────

/**
 * Lập yêu cầu cấp dầu/dầu nhờn/hóa chất từ trang của tàu và trình lên luôn.
 *
 * KHÔNG dựng đường phê duyệt riêng — đi đúng dây chuyền đang có của yêu cầu
 * vật tư, nối liền tới mua sắm:
 *
 *   Máy 2/3/4 lập  ->  Máy trưởng duyệt cấp tàu  ->  Công ty duyệt  ->  Mua sắm
 *   Máy trưởng lập ->  Thuyền trưởng duyệt cấp tàu -> Công ty duyệt -> Mua sắm
 *
 * Máy trưởng quản toàn bộ dầu và hóa chất của tàu nhưng KHÔNG tự duyệt yêu cầu
 * của chính mình — chặn ở capDuyetChoPhep, không phải ở đây, để nút bấm trên
 * giao diện và quyền thật không lệch nhau.
 */
export async function taoYeuCauNhienLieu(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const vesselId = Number(formData.get("vesselId"));
  const actor = await requireActiveRole([...VAN_HANH_HOA_CHAT, ...SI_QUAN]);
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
    return { message: "Nhập số lượng cho ít nhất một mặt hàng." };
  }

  const products = await prisma.consumableProduct.findMany({
    where: { id: { in: dong.map((d) => d.productId) } },
  });
  if (products.length !== dong.length) {
    return { message: "Có mặt hàng không còn trong danh mục." };
  }
  // Xin cấp nhóm nào thì phải có quyền nhóm đó — không mượn form để xin hộ
  // nhóm mình không phụ trách.
  for (const p of products) {
    if (!coQuanLyNhienLieu(actor, vesselId, p.category)) {
      return {
        message: `Bạn không phụ trách nhóm của mặt hàng "${p.name}" nên không xin cấp được.`,
      };
    }
  }
  const theoId = new Map(products.map((p) => [p.id, p]));

  const stocks = await prisma.consumableStock.findMany({
    where: { vesselId, productId: { in: dong.map((d) => d.productId) } },
  });
  const tonTheoId = new Map(stocks.map((s) => [s.productId, s.quantity]));

  const priority = ["LOW", "NORMAL", "HIGH", "URGENT"].includes(
    text(formData, "priority")
  )
    ? text(formData, "priority")
    : "NORMAL";
  const ghiChu = text(formData, "purpose");
  const department = boPhanCuaChucDanh(actor.role) ?? "ENGINE";

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

  // Thuyền trưởng / quản trị lập thì cấp tàu coi như đã ký — đi thẳng lên công
  // ty, cùng quy tắc với yêu cầu vật tư thường.
  const thangLenCongTy = trinhThangLenCongTy(actor.role);
  const now = new Date();

  const created = await prisma.$transaction(async (tx) => {
    const req = await tx.materialRequest.create({
      data: {
        requestNo,
        kind: "STORE",
        vesselId,
        requestedBy: actor.name,
        requestedByRole: actor.role,
        requestedById: actor.id,
        department,
        priority,
        status: thangLenCongTy ? "PENDING_OFFICE" : "PENDING_MASTER",
        submittedBy: actor.name,
        submittedAt: now,
        ...(thangLenCongTy
          ? {
              shipApprovedBy: actor.name,
              shipApprovedRole: actor.role,
              shipApprovedAt: now,
            }
          : {}),
        purpose: ghiChu || `Yêu cầu cấp dầu / hóa chất cho ${vessel.name}`,
        items: {
          create: dong.map((d) => {
            const p = theoId.get(d.productId)!;
            return {
              // Dầu và hóa chất nằm ở danh mục riêng, không phải danh mục vật
              // tư, nên ghi thành dòng nhập tay thay vì trỏ materialId sang
              // bảng khác.
              materialId: null,
              itemName: `${CATEGORY_LABEL[p.category] ?? p.category}: ${p.name}${
                p.maker ? ` (${p.maker})` : ""
              }`,
              itemCode: p.code,
              itemUom: p.uom,
              quantity: d.quantity,
              robSnapshot: tonTheoId.get(d.productId) ?? 0,
              // Bỏ qua bước duyệt cấp tàu thì SL tàu duyệt phải bằng SL xin:
              // chữ ký lúc lập chính là chữ ký cấp tàu. Để 0 thì cấp công ty
              // chỉ duyệt được tối đa 0 (trần của họ là số tàu đã duyệt).
              approvedQuantity: thangLenCongTy ? d.quantity : 0,
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
          note: `Lập yêu cầu cấp dầu / hóa chất ${dong.length} dòng`,
        },
        {
          requestId: req.id,
          fromStatus: "DRAFT",
          toStatus: thangLenCongTy ? "PENDING_OFFICE" : "PENDING_MASTER",
          actorName: actor.name,
          actorRole: actor.role,
          note: thangLenCongTy
            ? `${ROLE_LABEL[actor.role] ?? actor.role} lập và trình — cấp tàu đã ký, chuyển thẳng lên công ty`
            : "Trình duyệt",
        },
      ],
    });
    return req;
  });

  revalidateVessel(vesselId);
  revalidatePath("/requests");
  return {
    message: `Đã gửi yêu cầu ${created.requestNo} (${dong.length} mặt hàng) lên ${
      thangLenCongTy ? "quản lý kỹ thuật công ty" : "duyệt cấp tàu"
    }.`,
    success: true,
  };
}
