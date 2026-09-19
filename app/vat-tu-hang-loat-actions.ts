"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireActiveRole } from "@/lib/auth";
import { ghiNhatKy } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";

/*
 * Thao tác HÀNG LOẠT trên danh mục gốc (chọn nhiều dòng bằng ô tick ở
 * /materials). Chỉ ADMIN — giống hệt luật của nút Sửa / Xóa từng dòng
 * (updateMaterial, deleteMaterial trong app/actions.ts): đây chỉ là cùng
 * một việc làm cho nhiều dòng, không phải một cửa ngách với luật lỏng hơn.
 */

const TOI_DA = 500;

function locIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  const ra = new Set<number>();
  for (const x of ids) {
    const n = Number(x);
    if (Number.isInteger(n) && n > 0) ra.add(n);
  }
  return [...ra].slice(0, TOI_DA);
}

export type KetQuaXoaHangLoat = {
  message: string;
  success?: boolean;
  daXoa: number;
  boQua: { ma: string; lyDo: string }[];
};

/**
 * Xóa nhiều mặt hàng. Mỗi mặt hàng qua đúng ba cửa của deleteMaterial: chưa
 * dùng trong yêu cầu, không có dòng tồn, không bị tham chiếu — cái nào vướng
 * thì GIỮ LẠI và báo lý do, không vì một dòng vướng mà hủy cả đợt.
 */
export async function xoaVatTuHangLoat(idsRaw: number[]): Promise<KetQuaXoaHangLoat> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) return { message: t("chung.khongCoQuyen"), daXoa: 0, boQua: [] };
  const ids = locIds(idsRaw);
  if (!ids.length) return { message: t("chung.duLieuKhongHopLe"), daXoa: 0, boQua: [] };

  const [vatTu, trongYeuCau, coTon] = await Promise.all([
    prisma.material.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, nameVn: true } }),
    prisma.materialRequestItem.groupBy({ by: ["materialId"], where: { materialId: { in: ids } }, _count: { _all: true } }),
    prisma.inventory.groupBy({ by: ["materialId"], where: { materialId: { in: ids } }, _count: { _all: true } }),
  ]);
  const dungYeuCau = new Set(trongYeuCau.map((r) => r.materialId));
  const dangTon = new Set(coTon.map((r) => r.materialId));
  const boQua: { ma: string; lyDo: string }[] = [];
  const daXoa: string[] = [];
  for (const m of vatTu) {
    if (dungYeuCau.has(m.id)) {
      boQua.push({ ma: m.code, lyDo: t("actions.vatTu_daDungTrongYeuCau") });
      continue;
    }
    if (dangTon.has(m.id)) {
      boQua.push({ ma: m.code, lyDo: t("actions.vatTu_dangCoTonKho") });
      continue;
    }
    try {
      await prisma.material.delete({ where: { id: m.id } });
      daXoa.push(`${m.code} — ${m.nameVn}`);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2025")) {
        boQua.push({ ma: m.code, lyDo: error.code === "P2003" ? t("actions.vatTu_dangDuocThamChieu") : t("actions.vatTu_daBiXoa") });
        continue;
      }
      throw error;
    }
  }
  if (daXoa.length) {
    await ghiNhatKy({
      userId: admin.id,
      email: admin.email,
      role: admin.role,
      vesselId: null,
      action: "xoa-vat-tu-hang-loat",
      path: "/materials",
      detail: `Xóa ${daXoa.length} vật tư hàng loạt: ${daXoa.join("; ").slice(0, 1500)}${boQua.length ? ` — giữ lại ${boQua.length}` : ""}`,
    });
    revalidatePath("/materials");
  }
  const message =
    (daXoa.length ? t("materials.hangLoat_daXoa", { n: daXoa.length }) : "") +
    (boQua.length ? ` ${t("materials.hangLoat_boQua", { n: boQua.length, ds: boQua.map((b) => `${b.ma} (${b.lyDo})`).join("; ").slice(0, 600) })}` : "");
  return { message: message.trim(), success: daXoa.length > 0, daXoa: daXoa.length, boQua };
}

export type PatchHangLoat = {
  /** Chuỗi = đặt (rỗng = xóa thiết bị); undefined = giữ nguyên. Chỉ áp cho phụ tùng. */
  equipment?: string;
  /** null = bỏ khỏi nhóm; số = nhóm; undefined = giữ nguyên. */
  categoryId?: number | null;
  uom?: string;
  minStock?: number;
  maxStock?: number;
  isCritical?: boolean;
  isActive?: boolean;
};

export type KetQuaSuaHangLoat = { message: string; success?: boolean; soDoi: number };

/** Đổi vài trường cho nhiều mặt hàng; trường không gửi thì giữ nguyên. */
export async function suaVatTuHangLoat(idsRaw: number[], patch: PatchHangLoat): Promise<KetQuaSuaHangLoat> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) return { message: t("chung.khongCoQuyen"), soDoi: 0 };
  const ids = locIds(idsRaw);
  if (!ids.length || !patch || typeof patch !== "object") return { message: t("chung.duLieuKhongHopLe"), soDoi: 0 };

  // Unchecked: updateMany đặt thẳng cột categoryId (không qua quan hệ).
  const data: Prisma.MaterialUncheckedUpdateManyInput = {};
  const mota: string[] = [];
  if (typeof patch.uom === "string" && patch.uom.trim()) {
    data.uom = patch.uom.trim().slice(0, 20).toUpperCase();
    mota.push(`ĐVT=${data.uom}`);
  }
  if (patch.minStock !== undefined) {
    const n = Number(patch.minStock);
    if (!Number.isFinite(n) || n < 0) return { message: t("actions.vatTu_tonToiThieuKhongHopLe"), soDoi: 0 };
    data.minStock = n;
    mota.push(`min=${n}`);
  }
  if (patch.maxStock !== undefined) {
    const n = Number(patch.maxStock);
    if (!Number.isFinite(n) || n < 0) return { message: t("actions.vatTu_tonToiDaKhongHopLe"), soDoi: 0 };
    data.maxStock = n;
    mota.push(`max=${n}`);
  }
  if (typeof patch.isCritical === "boolean") {
    data.isCritical = patch.isCritical;
    mota.push(`critical=${patch.isCritical}`);
  }
  if (typeof patch.isActive === "boolean") {
    data.isActive = patch.isActive;
    mota.push(`active=${patch.isActive}`);
  }
  if (patch.categoryId !== undefined) {
    if (patch.categoryId === null) {
      data.categoryId = null;
      mota.push("nhóm=∅");
    } else {
      const cid = Number(patch.categoryId);
      const nhom = Number.isInteger(cid) ? await prisma.category.findUnique({ where: { id: cid }, select: { id: true, name: true } }) : null;
      if (!nhom) return { message: t("chung.duLieuKhongHopLe"), soDoi: 0 };
      data.categoryId = nhom.id;
      mota.push(`nhóm=${nhom.name}`);
    }
  }
  const coThietBi = typeof patch.equipment === "string";
  if (!Object.keys(data).length && !coThietBi) return { message: t("materials.hangLoat_khongCoGiDoi"), soDoi: 0 };

  let soDoi = 0;
  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) {
      const r = await tx.material.updateMany({ where: { id: { in: ids } }, data });
      soDoi = r.count;
    }
    if (coThietBi) {
      // Thiết bị chỉ có nghĩa với phụ tùng (xem updateMaterial) — vật tư bỏ qua.
      const tb = (patch.equipment as string).trim().slice(0, 120) || null;
      const r = await tx.material.updateMany({ where: { id: { in: ids }, materialType: "SPARE" }, data: { equipment: tb } });
      soDoi = Math.max(soDoi, r.count);
      mota.push(`thiết bị=${tb ?? "∅"} (${r.count} phụ tùng)`);
    }
  });
  await ghiNhatKy({
    userId: admin.id,
    email: admin.email,
    role: admin.role,
    vesselId: null,
    action: "sua-vat-tu-hang-loat",
    path: "/materials",
    detail: `Sửa hàng loạt ${ids.length} vật tư: ${mota.join(", ")} — id ${ids.slice(0, 60).join(",")}${ids.length > 60 ? "…" : ""}`,
  });
  revalidatePath("/materials");
  return { message: t("materials.hangLoat_daSua", { n: soDoi }), success: true, soDoi };
}
