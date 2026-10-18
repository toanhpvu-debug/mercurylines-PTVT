"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireActiveRole, trongPhamVi, vesselScopeDayDu } from "@/lib/auth";
import { VAN_HANH_TAU } from "@/lib/roles";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import { docThoiDiemThucHien, ghiNhapXuatTx, khoaDongTonTx } from "@/lib/nhapXuatServer";

/*
 * NHẬP / XUẤT HÀNG LOẠT: tick nhiều dòng tồn ở bảng tồn kho (trang Tồn kho, hồ sơ tàu) rồi ghi số
 * lượng từng dòng trong MỘT hộp. Cùng quyền và cùng lõi ghi tồn với phiếu từng dòng
 * (createInventoryTransaction, lib/nhapXuatServer.ts): Thuyền trưởng / Máy trưởng / quản trị (kể cả
 * ủy quyền), chỉ tàu trong phạm vi. Ghi như một phiếu: một giao dịch, thiếu tồn ở bất kỳ dòng xuất
 * nào thì không ghi dòng nào và báo đủ các dòng thiếu.
 */

const TOI_DA = 500;

export type DongNhapXuat = {
  id: number;
  ma: string;
  ten: string;
  dvt: string;
  khoMa: string;
  tauMa: string;
  ton: number;
  giu: number;
};

export type KetQuaNhapXuat = { message: string; success?: boolean; thieu?: { id: number; con: number }[] };

function locIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  const ra = new Set<number>();
  for (const x of ids) {
    const n = Number(x);
    if (Number.isInteger(n) && n > 0) ra.add(n);
  }
  return [...ra];
}

/** Các dòng tồn đã tick (số tồn mới nhất) để điền hộp nhập / xuất. */
export async function layDongTonNhapXuat(idsRaw: number[]): Promise<{ message: string; dong?: DongNhapXuat[] }> {
  const { t } = await layT();
  const actor = await requireActiveRole([...VAN_HANH_TAU]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const ids = locIds(idsRaw);
  if (!ids.length) return { message: t("chung.duLieuKhongHopLe") };
  if (ids.length > TOI_DA) return { message: t("inventory.hl_quaNhieu", { n: TOI_DA }) };
  const scope = vesselScopeDayDu(actor);
  const dong = await prisma.inventory.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      vesselId: true,
      quantity: true,
      reservedQuantity: true,
      material: { select: { code: true, nameVn: true, uom: true } },
      warehouse: { select: { code: true } },
      vessel: { select: { code: true } },
    },
    orderBy: [{ vessel: { code: "asc" } }, { material: { code: "asc" } }, { warehouseId: "asc" }],
  });
  const trong = dong.filter((d) => trongPhamVi(scope, d.vesselId));
  if (trong.length !== ids.length) return { message: t("inventory.hl_dongDaDoi") };
  return {
    message: "",
    dong: trong.map((d) => ({
      id: d.id,
      ma: d.material.code,
      ten: d.material.nameVn,
      dvt: d.material.uom,
      khoMa: d.warehouse.code,
      tauMa: d.vessel.code,
      ton: d.quantity,
      giu: d.reservedQuantity,
    })),
  };
}

/** Ghi nhập (IN) hoặc xuất (OUT) cho các dòng tồn đã chọn, mỗi dòng một số lượng — tất cả hoặc không. */
export async function ghiNhapXuatHangLoat(x: { type: string; occurredAt: string; note: string; dong: { id: number; soLuong: number }[] }): Promise<KetQuaNhapXuat> {
  const { t } = await layT();
  const actor = await requireActiveRole([...VAN_HANH_TAU]);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const type = x?.type === "IN" || x?.type === "OUT" ? x.type : null;
  if (!type) return { message: t("actions.kho_loaiGiaoDichKhongHopLe") };
  const thoiDiem = docThoiDiemThucHien(String(x.occurredAt ?? ""));
  if ("loi" in thoiDiem) return { message: t(thoiDiem.loi === "tuongLai" ? "actions.kho_thoiDiemTuongLai" : "actions.kho_thoiDiemKhongHopLe") };
  const note = String(x.note ?? "").trim().slice(0, 500) || null;

  // Một dòng tồn một số lượng (trùng id thì lấy lần cuối); số phải > 0.
  const theoId = new Map<number, number>();
  for (const d of Array.isArray(x.dong) ? x.dong : []) {
    const id = Number(d?.id);
    const so = Number(d?.soLuong);
    if (!Number.isInteger(id) || id <= 0) return { message: t("chung.duLieuKhongHopLe") };
    if (!Number.isFinite(so) || !(so > 0)) return { message: t("inventory.hl_soKhongHopLe") };
    theoId.set(id, so);
  }
  if (!theoId.size) return { message: t("inventory.hl_chuaCoSo") };
  if (theoId.size > TOI_DA) return { message: t("inventory.hl_quaNhieu", { n: TOI_DA }) };

  const scope = vesselScopeDayDu(actor);
  const dong = await prisma.inventory.findMany({
    where: { id: { in: [...theoId.keys()] } },
    select: { id: true, materialId: true, warehouseId: true, vesselId: true, material: { select: { code: true } } },
  });
  if (dong.length !== theoId.size || dong.some((d) => !trongPhamVi(scope, d.vesselId))) return { message: t("inventory.hl_dongDaDoi") };

  const thieu: { id: number; ma: string; con: number; can: number }[] = [];
  try {
    await prisma.$transaction(
      async (tx) => {
        await khoaDongTonTx(tx, dong);
        for (const d of dong) {
          const soLuong = theoId.get(d.id)!;
          const daGhi = await ghiNhapXuatTx(tx, {
            type,
            materialId: d.materialId,
            warehouseId: d.warehouseId,
            vesselId: d.vesselId,
            quantity: soLuong,
            note,
            occurredAt: thoiDiem.ngay,
            performedBy: actor.name,
          });
          if (!daGhi) {
            const con = await tx.inventory.findUnique({ where: { id: d.id }, select: { quantity: true } });
            thieu.push({ id: d.id, ma: d.material.code, con: con?.quantity ?? 0, can: soLuong });
          }
        }
        // Thiếu tồn ở dòng nào thì cuộn ngược CẢ phiếu: ghi nửa chừng là sổ sách lệch với tờ phiếu giấy.
        if (thieu.length) throw new Error("thieu-ton");
      },
      { timeout: 60_000, maxWait: 10_000 }
    );
  } catch (e) {
    if (thieu.length) {
      return {
        message: t("inventory.hl_khongDuTon", { ds: thieu.slice(0, 15).map((d) => `${d.ma} (${d.con} < ${d.can})`).join(", ") + (thieu.length > 15 ? ", …" : "") }),
        thieu: thieu.map((d) => ({ id: d.id, con: d.con })),
      };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2028" || e.code === "P2024")) return { message: t("actions.giaoDich_heThongBan") };
    throw e;
  }

  const tau = [...new Set(dong.map((d) => d.vesselId))];
  const ma = dong.map((d) => `${d.material.code}×${theoId.get(d.id)}`);
  await ghiNhatKyNguoiDung(actor, {
    action: type === "IN" ? "kho-nhap-hang-loat" : "kho-xuat-hang-loat",
    path: "/inventory",
    vesselId: tau.length === 1 ? tau[0] : null,
    detail: `${type === "IN" ? "Nhập" : "Xuất"} hàng loạt ${dong.length} dòng${note ? ` — ${note}` : ""}: ${ma.slice(0, 60).join(", ")}${ma.length > 60 ? ", …" : ""}`,
  });
  revalidatePath("/inventory");
  for (const v of tau) revalidatePath(`/vessels/${v}`);
  return { message: t(type === "IN" ? "inventory.hl_daNhap" : "inventory.hl_daXuat", { n: dong.length }), success: true };
}
