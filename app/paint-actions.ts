"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  canManageVesselCatalog,
  coQuanLySon,
  requireActiveRole,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import type { HamDich } from "@/lib/i18n";
import { layT } from "@/lib/i18n/server";
import { PAINT_TYPE_VALUES } from "@/lib/paintTypes";
import { VAN_HANH_SON } from "@/lib/roles";

// Server action cho module Quản lý sơn. Tách khỏi app/actions.ts (đã 2200 dòng)
// để phần sơn đứng riêng, dễ đọc và dễ sửa.
//
// Câu trả về cho người dùng đi qua t() nên theo ngôn ngữ giao diện; chữ ghi vào
// database (itemName, purpose, note của giao dịch và của nhật ký phê duyệt) giữ
// nguyên tiếng Việt — hồ sơ không đổi theo người đang xem. Chữ do bộ đọc file
// sinh ra (lib/paintImport.ts) cũng đi thẳng ra, không dịch lại ở đây.

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

// P2025 = "bản ghi cần thao tác không còn nữa". Xảy ra thường xuyên ở đây:
// trang sơn của tàu mở lâu, hai người cùng nhìn một danh sách rồi cùng bấm
// xóa/sửa một dòng — người gửi lệnh sau thao tác vào bản ghi đã biến mất.
//
// Mọi chỗ xóa/sửa theo id trong file này đều đọc bản ghi trước rồi mới ghi, nên
// luôn có khe hở giữa hai lệnh. Không bắt thì server action ném ra ngoài, Next
// trả 500 và người dùng gặp trang lỗi trắng thay vì một câu tiếng Việt.
function laBanGhiDaMat(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

// Tiền tố đánh dấu lỗi "không đủ tồn" do chính file này nêu ra bên trong
// transaction rồi bắt lại ở ngoài: câu thông báo đổi theo ngôn ngữ nên không so
// chuỗi được.
const LOI_TON = "LOI_TON:";

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
  const { t } = await layT();
  const id = Number(formData.get("id") || 0);
  // THÊM MỚI thì người quản sơn trên tàu làm được; SỬA một loại đang có thì
  // không. Thêm một loại sơn mới không ảnh hưởng tàu khác, còn sửa định nghĩa
  // dùng chung thì đổi luôn sơ đồ sơn và tồn kho của cả đội.
  const duocPhep =
    id > 0
      ? await requireFleetPaintAccess()
      : await requireActiveRole([...VAN_HANH_SON]);
  if (!duocPhep) {
    return {
      message:
        id > 0
          ? t("actionsModule.son_suaLoaiSonDungChung")
          : t("chung.khongCoQuyen"),
    };
  }
  const name = text(formData, "name");
  const code = text(formData, "code");
  const paintType = text(formData, "paintType") || "OTHER";
  if (!name) {
    return { message: t("actionsModule.son_tenSonBatBuoc") };
  }
  if (!PAINT_TYPE_VALUES.includes(paintType)) {
    return { message: t("actionsModule.son_loaiSonKhongHopLe") };
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
      return { message: t("actionsModule.son_maSonDaTonTai", { ma: code }) };
    }
    if (laBanGhiDaMat(error)) {
      return { message: t("actionsModule.son_loaiSonNayDaXoa") };
    }
    throw error;
  }
  revalidatePath("/paint/products");
  revalidatePath("/paint");
  return {
    message: t("actionsModule.son_daLuuSon", { ten: name }),
    success: true,
  };
}

export async function togglePaintProduct(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  const product = await prisma.paintProduct.findUnique({ where: { id } });
  if (!product) return { message: t("actionsModule.son_khongTimThayLoaiSon") };
  try {
    await prisma.paintProduct.update({
      where: { id },
      data: { isActive: !product.isActive },
    });
  } catch (error) {
    if (laBanGhiDaMat(error)) {
      return { message: t("actionsModule.son_loaiSonDaXoa") };
    }
    throw error;
  }
  revalidatePath("/paint/products");
  return {
    message: product.isActive
      ? t("actionsModule.daNgungDungTen", { ten: product.name })
      : t("actionsModule.daDungLaiTen", { ten: product.name }),
    success: true,
  };
}

export async function deletePaintProduct(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  const product = await prisma.paintProduct.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          schemeLayers: true,
          jobLines: true,
          stocks: true,
          transactions: true,
        },
      },
    },
  });
  if (!product) return { message: t("actionsModule.son_khongTimThayLoaiSon") };
  // Giữ lịch sử: đã dùng trong sơ đồ sơn, nhật ký thi công, hoặc đã từng
  // nhập/xuất trên tàu thì không xóa được. Khóa ngoại PaintTransaction là
  // ON DELETE RESTRICT nên bỏ sót "transactions" ở đây sẽ khiến lệnh xóa
  // tồn kho phía dưới commit xong rồi mới vỡ — mất sạch định mức minQty.
  const used =
    product._count.schemeLayers +
    product._count.jobLines +
    product._count.transactions;
  if (used > 0) {
    return {
      message: t("actionsModule.son_khongXoaDuocDaDung", {
        ten: product.name,
        gd: product._count.transactions,
        lop: product._count.schemeLayers,
        nk: product._count.jobLines,
      }),
    };
  }
  const stocked = await prisma.paintStock.count({
    where: { productId: id, quantity: { gt: 0 } },
  });
  if (stocked > 0) {
    return {
      message: t("actionsModule.son_khongXoaDuocConTon", { n: stocked }),
    };
  }
  // Hai lệnh phải đi chung một transaction: nếu lệnh sau vỡ vì còn tham
  // chiếu, lệnh trước cũng phải quay lại, không được để mất dòng tồn kho.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.paintStock.deleteMany({ where: { productId: id } });
      await tx.paintProduct.delete({ where: { id } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return {
          message: t("actionsModule.son_khongXoaDuocConThamChieu", {
            ten: product.name,
          }),
        };
      }
      if (error.code === "P2025") {
        return { message: t("actionsModule.son_loaiSonDaXoa") };
      }
    }
    throw error;
  }
  revalidatePath("/paint/products");
  revalidatePath("/paint");
  return {
    message: t("actionsModule.daXoaTen", { ten: product.name }),
    success: true,
  };
}

// ─── Khu vực sơn của tàu ─────────────────────────────────────────────────────

export async function savePaintArea(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { t } = await layT();
  const vesselId = Number(formData.get("vesselId"));
  if (!(await requireVesselAccess(vesselId))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id") || 0);
  const name = text(formData, "name");
  if (!name) return { message: t("actionsModule.son_tenKhuVucBatBuoc") };
  const data = {
    name,
    areaM2: num(formData, "areaM2"),
    sortOrder: Math.trunc(num(formData, "sortOrder")),
    notes: text(formData, "notes") || null,
  };
  try {
    if (id > 0) {
      // Khu vực mang id này phải THUỘC đúng tàu vừa kiểm quyền. Không thì người
      // quản sơn tàu A gửi vesselId = A kèm id khu vực của tàu B là ghi đè được
      // dữ liệu tàu B — cùng khuôn với deletePaintArea / savePaintSchemeLayer.
      const hienCo = await prisma.paintArea.findUnique({ where: { id } });
      if (!hienCo || hienCo.vesselId !== vesselId) {
        return { message: t("actionsModule.son_khongTimThayKhuVuc") };
      }
      await prisma.paintArea.update({ where: { id }, data });
    } else {
      await prisma.paintArea.create({ data: { ...data, vesselId } });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: t("actionsModule.son_khuVucTrungTen", { ten: name }) };
    }
    if (laBanGhiDaMat(error)) {
      return { message: t("actionsModule.son_khuVucDaXoa") };
    }
    throw error;
  }
  revalidateVessel(vesselId);
  return {
    message: t("actionsModule.son_daLuuKhuVuc", { ten: name }),
    success: true,
  };
}

export async function deletePaintArea(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const vesselId = Number(formData.get("vesselId"));
  if (!(await requireVesselAccess(vesselId))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  const area = await prisma.paintArea.findUnique({
    where: { id },
    include: { _count: { select: { jobs: true } } },
  });
  if (!area || area.vesselId !== vesselId) {
    return { message: t("actionsModule.son_khongTimThayKhuVuc") };
  }
  if (area._count.jobs > 0) {
    return {
      message: t("actionsModule.son_khongXoaDuocKhuVuc", {
        n: area._count.jobs,
      }),
    };
  }
  // Xóa khu vực thì các lớp sơ đồ của nó bị xóa theo (onDelete: Cascade).
  try {
    await prisma.paintArea.delete({ where: { id } });
  } catch (error) {
    if (laBanGhiDaMat(error)) {
      return { message: t("actionsModule.banGhiDaXoaTruoc") };
    }
    throw error;
  }
  revalidateVessel(vesselId);
  return {
    message: t("actionsModule.son_daXoaKhuVuc", { ten: area.name }),
    success: true,
  };
}

// ─── Sơ đồ sơn: các lớp của một khu vực ──────────────────────────────────────

export async function savePaintSchemeLayer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { t } = await layT();
  const vesselId = Number(formData.get("vesselId"));
  if (!(await requireVesselAccess(vesselId))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const areaId = Number(formData.get("areaId"));
  const productId = Number(formData.get("productId"));
  if (!areaId || !productId) {
    return { message: t("actionsModule.son_chonKhuVucVaLoaiSon") };
  }
  const area = await prisma.paintArea.findUnique({ where: { id: areaId } });
  if (!area || area.vesselId !== vesselId) {
    return { message: t("actionsModule.son_khuVucKhongThuocTau") };
  }
  const id = Number(formData.get("id") || 0);
  // id đến thẳng từ form và KHÔNG ràng buộc gì với areaId vừa kiểm tra ở trên:
  // sửa tay một con số trong form là ghi đè được lớp sơ đồ của tàu khác (quyền
  // tàu A vẫn qua, khu vực A vẫn qua, rồi update theo id của một lớp thuộc tàu
  // B). Đọc lớp kèm khu vực rồi đối chiếu vesselId — đúng khuôn mà
  // deletePaintSchemeLayer ngay bên dưới đã làm.
  if (id > 0) {
    const hienCo = await prisma.paintSchemeLayer.findUnique({
      where: { id },
      include: { area: true },
    });
    if (!hienCo || hienCo.area.vesselId !== vesselId) {
      return { message: t("actionsModule.son_khongTimThayLopSon") };
    }
  }
  const data = {
    productId,
    layerNo: Math.max(1, Math.trunc(num(formData, "layerNo", 1))),
    coats: Math.max(1, Math.trunc(num(formData, "coats", 1))),
    dft: num(formData, "dft"),
    notes: text(formData, "notes") || null,
  };
  try {
    if (id > 0) {
      await prisma.paintSchemeLayer.update({ where: { id }, data });
    } else {
      await prisma.paintSchemeLayer.create({ data: { ...data, areaId } });
    }
  } catch (error) {
    if (laBanGhiDaMat(error)) {
      return { message: t("actionsModule.son_lopSonDaXoa") };
    }
    throw error;
  }
  revalidateVessel(vesselId);
  return { message: t("actionsModule.son_daLuuLopSon"), success: true };
}

export async function deletePaintSchemeLayer(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const vesselId = Number(formData.get("vesselId"));
  if (!(await requireVesselAccess(vesselId))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const id = Number(formData.get("id"));
  const layer = await prisma.paintSchemeLayer.findUnique({
    where: { id },
    include: { area: true },
  });
  if (!layer || layer.area.vesselId !== vesselId) {
    return { message: t("actionsModule.son_khongTimThayLopSon") };
  }
  try {
    await prisma.paintSchemeLayer.delete({ where: { id } });
  } catch (error) {
    if (laBanGhiDaMat(error)) {
      return { message: t("actionsModule.banGhiDaXoaTruoc") };
    }
    throw error;
  }
  revalidateVessel(vesselId);
  return { message: t("actionsModule.son_daXoaLopSon"), success: true };
}

// ─── Tồn sơn: nhập / xuất ────────────────────────────────────────────────────

export async function paintStockMove(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { t } = await layT();
  const vesselId = Number(formData.get("vesselId"));
  const actor = await requireVesselAccess(vesselId);
  if (!actor) return { message: t("chung.khongCoQuyen") };

  const type = text(formData, "type");
  const quantity = num(formData, "quantity");
  if (!["IN", "OUT"].includes(type)) {
    return { message: t("actionsModule.loaiGiaoDichKhongHopLe") };
  }

  // Hai đường chọn sơn: lấy từ danh mục, hoặc khai một loại MỚI ngay tại đây.
  // Đường nhập hàng loạt từ file đã tự tạo loại chưa có; bắt đường thủ công
  // phải sang trang danh mục khai trước rồi quay lại là bắt làm hai lần cùng
  // một việc, mà lúc nhận sơn ở cầu cảng thì loại mới là chuyện thường.
  let productId = Number(formData.get("productId"));
  const tenMoi = text(formData, "newName");
  if (!productId && tenMoi) {
    if (type === "OUT") {
      return { message: t("actionsModule.son_loaiMoiChuaCoTon") };
    }
    const paintTypeMoi = text(formData, "newPaintType") || "OTHER";
    if (!PAINT_TYPE_VALUES.includes(paintTypeMoi)) {
      return { message: t("actionsModule.son_loaiSonKhongHopLe") };
    }
    // Ghép theo TÊN với loại đã có để không sinh bản trùng khi gõ lại đúng tên
    // một loại đang có trong danh mục.
    const norm = (v: string) =>
      v.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
    const daCo = (await prisma.paintProduct.findMany()).find(
      (p) => norm(p.name) === norm(tenMoi)
    );
    if (daCo) {
      productId = daCo.id;
    } else {
      const count = await prisma.paintProduct.count();
      let seq = count + 1;
      let finalCode = `SON-${String(seq).padStart(4, "0")}`;
      while (
        await prisma.paintProduct.findUnique({ where: { code: finalCode } })
      ) {
        seq += 1;
        finalCode = `SON-${String(seq).padStart(4, "0")}`;
      }
      const moi = await prisma.paintProduct.create({
        data: {
          code: finalCode,
          name: tenMoi,
          maker: text(formData, "newMaker") || null,
          paintType: paintTypeMoi,
          colorName: text(formData, "newColorName") || null,
          uom: text(formData, "newUom") || "L",
          packSize: num(formData, "newPackSize"),
        },
      });
      productId = moi.id;
    }
  }
  if (!productId) {
    return { message: t("actionsModule.son_chonHoacKhaiLoaiSon") };
  }
  if (!(quantity > 0)) {
    return { message: t("actionsModule.soLuongPhaiLonHonKhong") };
  }
  const occurredRaw = text(formData, "occurredAt");
  let occurredAt = new Date();
  if (occurredRaw) {
    const d = new Date(occurredRaw);
    if (Number.isNaN(d.getTime())) {
      return { message: t("actionsModule.thoiDiemKhongHopLe") };
    }
    if (d.getTime() > Date.now()) {
      return { message: t("actionsModule.khongGhiThoiDiemTuongLai") };
    }
    occurredAt = d;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Cộng/trừ NGUYÊN TỬ ngay trong câu lệnh UPDATE, không đọc số tồn ra
      // JavaScript rồi ghi đè bằng một số tuyệt đối.
      //
      // Đây là phiếu NHẬP/XUẤT chứ không phải kiểm kê: mỗi phiếu là một khoản
      // cộng hoặc trừ vào số đang có, ai ghi trước ghi sau đều phải cộng dồn.
      // Kiểu đọc-rồi-ghi-đè cũ mất bản ghi của người khác — transaction của
      // PostgreSQL mặc định READ COMMITTED nên hai thủy thủ cùng nhận sơn một
      // lúc sẽ cùng đọc ra số cũ (ví dụ 100), một người ghi 100+20, người kia
      // ghi 100+30, kết quả còn 130 thay vì 150 và không ai biết là đã mất 20.
      if (type === "IN") {
        await tx.paintStock.upsert({
          where: { vesselId_productId: { vesselId, productId } },
          update: { quantity: { increment: quantity } },
          create: { vesselId, productId, quantity },
        });
      } else {
        // Điều kiện "còn đủ tồn" nằm ngay trong WHERE nên việc kiểm tra và
        // việc trừ là MỘT thao tác duy nhất: không còn khe hở giữa lúc kiểm
        // tra và lúc ghi để một phiếu xuất khác chen vào làm tồn âm.
        const daTru = await tx.paintStock.updateMany({
          where: { vesselId, productId, quantity: { gte: quantity } },
          data: { quantity: { decrement: quantity } },
        });
        if (daTru.count === 0) {
          // Không trừ được thì hoặc chưa có dòng tồn, hoặc còn ít hơn số muốn
          // xuất. Đọc lại chỉ để báo con số thật cho người dùng.
          const con = await tx.paintStock.findUnique({
            where: { vesselId_productId: { vesselId, productId } },
          });
          throw new Error(
            LOI_TON +
              t("actionsModule.son_khongDuTonXuat", {
                con: con?.quantity ?? 0,
                muon: quantity,
              })
          );
        }
      }
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
    if (error instanceof Error && error.message.startsWith(LOI_TON)) {
      return { message: error.message.slice(LOI_TON.length) };
    }
    throw error;
  }
  revalidateVessel(vesselId);
  return {
    message:
      type === "IN"
        ? t("actionsModule.son_daNhapSon")
        : t("actionsModule.son_daXuatSon"),
    success: true,
  };
}

// ─── Nhật ký thi công sơn ────────────────────────────────────────────────────

export async function createPaintJob(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { t } = await layT();
  const vesselId = Number(formData.get("vesselId"));
  const actor = await requireVesselAccess(vesselId);
  if (!actor) return { message: t("chung.khongCoQuyen") };

  const jobDateRaw = text(formData, "jobDate");
  if (!jobDateRaw) return { message: t("actionsModule.son_chonNgayThiCong") };
  const jobDate = new Date(jobDateRaw);
  if (Number.isNaN(jobDate.getTime())) {
    return { message: t("actionsModule.son_ngayThiCongKhongHopLe") };
  }
  if (jobDate.getTime() > Date.now() + 24 * 3600 * 1000) {
    return { message: t("actionsModule.son_khongGhiNgayTuongLai") };
  }

  const areaIdRaw = text(formData, "areaId");
  let areaId: number | null = null;
  if (areaIdRaw) {
    const aid = Number(areaIdRaw);
    const area = await prisma.paintArea.findUnique({ where: { id: aid } });
    if (!area || area.vesselId !== vesselId) {
      return { message: t("actionsModule.son_khuVucKhongThuocTau") };
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
    return { message: t("actionsModule.son_nhapItNhatMotDong") };
  }
  // Trừ tồn theo THỨ TỰ productId tăng dần. `updateMany ... decrement` giữ khóa
  // dòng tới hết giao dịch, nên hai nhật ký thi công lưu cùng lúc mà chạm hai
  // loại sơn A và B theo thứ tự ngược nhau sẽ kẹp chết nhau (deadlock). Người
  // dùng cũng hay chọn trùng loại sơn hoặc bấm đúp nút Lưu. Cố định thứ tự khóa
  // ở đây thì hai nhật ký thi công không bao giờ tạo vòng chờ với nhau.
  lines.sort((a, b) => a.productId - b.productId);

  try {
    await prisma.$transaction(async (tx) => {
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
        // Điều kiện "còn đủ tồn" nằm ngay trong WHERE nên việc kiểm tra và việc
        // trừ là MỘT lệnh duy nhất. Kiểu đọc tồn ra rồi so rồi mới trừ để hở
        // khoảng giữa hai lệnh: hai người cùng ghi nhật ký thi công (hay một
        // người bấm đúp nút Lưu) đều đọc ra cùng số cũ, cả hai cùng qua vòng
        // kiểm tra, rồi cả hai cùng trừ. Cột quantity không có ràng buộc >= 0
        // nên tồn tụt xuống âm và nằm im, sổ sơn lệch vĩnh viễn mà không ai
        // nhận được cảnh báo. Đây cũng là ngữ nghĩa của hai đường xuất sơn kia
        // (phiếu lẻ và nhập/xuất hàng loạt) — cả ba phải giống nhau.
        const daTru = await tx.paintStock.updateMany({
          where: {
            vesselId,
            productId: line.productId,
            quantity: { gte: line.quantity },
          },
          data: { quantity: { decrement: line.quantity } },
        });
        if (daTru.count === 0) {
          // Không trừ được thì hoặc chưa có dòng tồn, hoặc còn ít hơn số đã
          // dùng. Đọc lại chỉ để báo tên sơn và con số thật cho người dùng.
          const con = await tx.paintStock.findUnique({
            where: {
              vesselId_productId: { vesselId, productId: line.productId },
            },
            include: { product: true },
          });
          const p =
            con?.product ??
            (await tx.paintProduct.findUnique({ where: { id: line.productId } }));
          throw new Error(
            LOI_TON +
              t("actionsModule.son_khongDuTonSon", {
                ten: p?.name ?? line.productId,
                con: con?.quantity ?? 0,
                can: line.quantity,
              })
          );
        }
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
    if (error instanceof Error && error.message.startsWith(LOI_TON)) {
      return { message: error.message.slice(LOI_TON.length) };
    }
    // Dòng tồn của một loại sơn vừa bị xóa xong giữa lúc ghi — lệnh theo id ném
    // P2025, để lọt ra ngoài là trang lỗi trắng. Chỉ nói phạm vi thật của nhánh
    // này là DÒNG TỒN / LOẠI SƠN: khu vực bị xóa không rơi vào đây.
    if (laBanGhiDaMat(error)) {
      return { message: t("actionsModule.son_loaiSonVuaBiXoa") };
    }
    // Khu vực bị xóa giữa lúc kiểm tra ở trên và lúc tạo bản ghi thì KHÔNG ném
    // P2025 mà ném P2003 (vi phạm khóa ngoại areaId, hoặc productId của một
    // dòng sơn). Thiếu nhánh này thì đúng cái trường hợp mà câu thông báo trên
    // nhắc tên lại là trường hợp vẫn trả 500.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return { message: t("actionsModule.son_khuVucHoacLoaiSonVuaBiXoa") };
    }
    throw error;
  }
  revalidateVessel(vesselId);
  return { message: t("actionsModule.son_daGhiNhatKy"), success: true };
}

export async function deletePaintJob(
  _prev: { message: string },
  formData: FormData
): Promise<{ message: string; success?: boolean }> {
  const { t } = await layT();
  const vesselId = Number(formData.get("vesselId"));
  const actor = await requireVesselAccess(vesselId);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const id = Number(formData.get("id"));
  const job = await prisma.paintJob.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!job || job.vesselId !== vesselId) {
    return { message: t("actionsModule.son_khongTimThayThiCong") };
  }
  // Xóa nhật ký thì hoàn lại tồn đã trừ, nếu không sổ sơn sẽ lệch vĩnh viễn.
  try {
    await prisma.$transaction(async (tx) => {
      for (const line of job.lines) {
        await tx.paintStock.upsert({
          where: {
            vesselId_productId: { vesselId, productId: line.productId },
          },
          update: { quantity: { increment: line.quantity } },
          create: {
            vesselId,
            productId: line.productId,
            quantity: line.quantity,
          },
        });
      }
      await tx.paintTransaction.deleteMany({ where: { jobId: id } });
      await tx.paintJob.delete({ where: { id } });
    });
  } catch (error) {
    // Người thứ hai bấm xóa cùng một bản ghi thi công: transaction đã hoàn lại
    // hết nên tồn không bị cộng hai lần, chỉ cần báo là bản ghi không còn nữa.
    if (laBanGhiDaMat(error)) {
      return { message: t("actionsModule.son_banGhiThiCongDaXoa") };
    }
    throw error;
  }
  revalidateVessel(vesselId);
  return { message: t("actionsModule.son_daXoaNhatKy"), success: true };
}


// ─── Sao chép sơ đồ sơn từ tàu khác ──────────────────────────────────────────
// Tàu cùng loạt (sister ship) dùng chung hệ sơn — khai lại từ đầu cho từng tàu
// vừa mất công vừa dễ sai lệch.

export async function copyPaintScheme(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { t } = await layT();
  const vesselId = Number(formData.get("vesselId"));
  if (!(await requireVesselAccess(vesselId))) {
    return { message: t("chung.khongCoQuyen") };
  }
  const fromVesselId = Number(formData.get("fromVesselId"));
  if (!fromVesselId || fromVesselId === vesselId) {
    return { message: t("actionsModule.son_chonTauKhac") };
  }
  // Chỉ đọc sơ đồ của tàu người dùng được phép xem.
  const actor = await requireFleetPaintAccess();
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const scope = vesselScopeDayDu(actor);
  if (!trongPhamVi(scope, fromVesselId)) {
    return { message: t("actionsModule.son_khongXemDuocTauNguon") };
  }

  const source = await prisma.paintArea.findMany({
    where: { vesselId: fromVesselId },
    include: { layers: { orderBy: { layerNo: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });
  if (!source.length) {
    return { message: t("actionsModule.son_tauNguonChuaCoKhuVuc") };
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
      message: t("actionsModule.son_khongSaoChepDuoc", { n: skipped }),
    };
  }
  return {
    message:
      t("actionsModule.son_daSaoChep", { kv: addedAreas, lop: addedLayers }) +
      (skipped
        ? " " + t("actionsModule.son_boQuaKhuVucDaCo", { n: skipped })
        : ""),
    success: true,
  };
}

// ─── Dùng chung cho hai đường nhập sơn từ file ───────────────────────────────

// Chỉ nêu tên sơn thì người dùng không biết mở sheet nào ra sửa — file kiểm kê
// thật tách nhiều sheet theo bộ phận và hay có cùng một tên sơn ở vài sheet.
function moTaDongSon(item: { name: string; sheet: string | null }) {
  return item.sheet ? `“${item.name}” (sheet ${item.sheet})` : `“${item.name}”`;
}

// Phân loại lỗi hạ tầng khi ghi một lô sơn từ file.
//
// Hai nút nhập file sơn (danh mục và nhập/xuất hàng loạt) nằm cạnh nhau trên
// cùng một trang; để mỗi bên tự viết câu báo thì cùng một sự cố lại nói hai
// giọng, và bên nào quên bắt thì trả trang lỗi trắng 500. Gom về một chỗ để sửa
// câu chữ một lần là cả hai đường cùng đổi.
//
// Trả null nghĩa là chưa nhận ra lỗi — bên gọi ghi log rồi trả câu chung của
// riêng nó. Cả khối ghi nằm trong MỘT transaction nên mọi trường hợp dưới đây
// đều là "chưa ghi dòng nào"; nói rõ ra để người dùng khỏi phải đi dò xem file
// đã vào được đến đâu rồi mới dám bấm lại.
function loiGhiFileSon(
  error: unknown,
  viTri: string,
  t: HamDich
): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (error.code) {
    case "P2002":
      return t("actionsModule.son_loiTrungMa", { viTri });
    // P2034 = write conflict / deadlock. Không phải mã lý thuyết: hai đường
    // nhập file đều khóa từng dòng PaintStock theo đúng thứ tự sơn trong file,
    // nên hai người nhập hai file liệt kê sơn ngược thứ tự nhau là công thức
    // kinh điển của deadlock. Rơi xuống câu chung "hãy kiểm tra lại dòng đó
    // trong file" thì người dùng đi sửa hoặc xóa một dòng hoàn toàn lành, mất
    // luôn số lượng của dòng đó — trong khi chỉ cần bấm lại y nguyên là xong.
    case "P2034":
      return t("actionsModule.son_loiTranhTon", { viTri });
    case "P2025":
      return t("actionsModule.son_loiLoaiSonVuaXoa", { viTri });
    case "P2003":
      return t("actionsModule.son_loiKhoaNgoai", { viTri });
    // P2028 là mã chung của Transaction API: hết thời gian chạy vì file dài,
    // NHƯNG cũng ném ra khi không xin được transaction trong maxWait lúc pool
    // kết nối đang bận. Quy về một nguyên nhân "file quá dài" là bắt người dùng
    // ngồi cắt nhỏ một file 20 dòng giữa giờ cao điểm — mà mỗi mảnh lại là một
    // transaction riêng nên mất luôn tính "cả lô hoặc không gì cả".
    case "P2028":
      return t("actionsModule.son_loiQuaThoiGian", { viTri });
    default:
      return null;
  }
}

// ─── Nhập danh mục sơn từ file Excel hoặc text dán tay ───────────────────────

export async function importPaintProducts(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { t } = await layT();
  const actor = await requireFleetPaintAccess();
  if (!actor) return { message: t("chung.khongCoQuyen") };

  // Tàu để ghi tồn — tùy chọn. Bỏ trống thì chỉ nạp danh mục dùng chung.
  const vesselRaw = text(formData, "vesselId");
  let vesselId: number | null = null;
  if (vesselRaw) {
    const vid = Number(vesselRaw);
    if (!Number.isInteger(vid) || vid <= 0) {
      return { message: t("actionsModule.son_tauKhongHopLe") };
    }
    if (!canManageVesselCatalog(actor, vid)) {
      return { message: t("actionsModule.son_chiGhiTonTauPhuTrach") };
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
      return { message: t("actionsModule.son_chuaDocPdfDanhMuc") };
    }
    if (!/\.(xls|xlsx)$/.test(name)) {
      return { message: t("actionsModule.filePhaiLaExcel") };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { message: t("actionsModule.fileVuotQua10Mb") };
    }
    parsed = parsePaintExcel(Buffer.from(await file.arrayBuffer()));
  } else {
    return { message: t("actionsModule.son_chonFileHoacDanPdf") };
  }

  // parsed.error do lib/paintImport.ts sinh ra — đưa thẳng ra, không dịch lại.
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

  // Giữ lại dòng đang ghi dở để nếu vỡ giữa chừng còn chỉ đúng chỗ hỏng trong
  // file. Dùng object chứ không dùng biến rời vì biến được gán bên trong hàm
  // callback thì TypeScript không theo dõi được giá trị lúc đọc ở khối catch.
  const viTri = { dong: "" };

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const item of parsed.items) {
          viTri.dong = moTaDongSon(item);
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
  } catch (error) {
    // Không bắt thì server action ném thẳng ra ngoài, Next.js trả 500 và người
    // dùng chỉ thấy trang lỗi trắng — trong khi cùng người đó, cùng trang này,
    // bấm nút nhập/xuất hàng loạt bên cạnh lại nhận được một câu tiếng Việt rõ
    // ràng. Đường này còn dễ vỡ hơn: duyệt toàn bộ parsed.items (tới 2000 dòng,
    // không gộp trùng) trong một transaction chỉ 60 giây, và mã SON-#### sinh
    // theo bộ đếm trong bộ nhớ nên hai phiên nhập song song rất dễ đâm P2002.
    const oDau = viTri.dong || t("actionsModule.son_dongDauTien");
    const loi = loiGhiFileSon(error, oDau, t);
    if (loi) return { message: loi };
    // Lỗi chưa lường trước: người dùng vẫn phải nhận một câu rõ ràng, nhưng nuốt
    // luôn cả nguyên nhân thì không ai lần ra được nữa — ghi ra log server.
    console.error(
      `[nhap-danh-muc-son] tàu ${vesselId ?? "không chọn"}, ${viTri.dong || "dòng đầu"}:`,
      error
    );
    return {
      message: t("actionsModule.son_khongNhapDuocDanhMuc", { viTri: oDau }),
    };
  }

  revalidatePath("/paint");
  revalidatePath("/paint/products");
  if (vesselId) revalidatePath(`/paint/${vesselId}`);

  const parts = [
    t("actionsModule.son_daDocNDong", { n: parsed.items.length }),
    t("actionsModule.son_nLoaiSonMoi", { n: created }),
    t("actionsModule.son_nLoaiBoSung", { n: updated }),
  ];
  if (stockRows) {
    parts.push(t("actionsModule.son_nDongGhiTon", { n: stockRows }));
  }
  if (parsed.skippedRows) {
    parts.push(t("actionsModule.son_nDongBoQua", { n: parsed.skippedRows }));
  }
  if (parsed.sheets?.length) {
    const read = parsed.sheets.filter((s) => !s.skipped);
    if (read.length)
      parts.push(
        t("actionsModule.son_sheetDaDoc", {
          ds: read.map((s) => `${s.name} (${s.count})`).join("; "),
        })
      );
  }
  // Bộ đọc file cắt bớt khi vượt ngưỡng dòng/cột và chỉ bật cờ truncated. Im
  // lặng thì người dùng đọc "Đã đọc N dòng" rồi tin là cả danh mục đã vào, mà
  // chính những loại sơn bị cắt mới là những loại họ đi tìm sau này.
  if (parsed.truncated) {
    parts.push(t("actionsModule.son_fileBiCatDanhMuc"));
  }
  return { message: parts.join(" · "), success: true };
}
