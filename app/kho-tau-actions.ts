"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageVesselCatalog, requireActiveRole } from "@/lib/auth";
import { VAN_HANH_TAU } from "@/lib/roles";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { laBanTau } from "@/lib/banCai";
import { layT } from "@/lib/i18n/server";
import { DO_DAI_TEN_KHO, LOAI_KHO, chuanHoaHauTo, laKhoCuoiCuaKhoi, loaiKhoTuMa, maKho, tenKhoDayDu, tenKhoNgan, type HangTrongKho, type LoaiKho } from "@/lib/khoTau";
import type { HamDich } from "@/lib/i18n";
import { chuyenHangTx, conTrongKho, hangTrongKho } from "@/lib/khoTauServer";

/*
 * KHO / VỊ TRÍ TRÊN TÀU (mục "Kho trên tàu" của hồ sơ tàu): thêm, sửa, xóa kho và chuyển hàng
 * giữa các kho của một tàu — quy ước mã và vì sao: lib/khoTau.ts, lib/khoTauServer.ts.
 *
 * Quyền: cùng cửa với danh mục của tàu (canManageVesselCatalog) — Thuyền trưởng / Máy trưởng của
 * ĐÚNG tàu đó (kể cả người được ủy quyền), hoặc quản trị. Xóa kho và chuyển hàng sửa / xóa dòng
 * mà gói đồng bộ không mang theo được (lịch sử nhập xuất đồng bộ theo ngày tạo, gói không có lệnh
 * xóa) nên chỉ làm ở bản văn phòng / máy chủ — cùng luật với xóa mặt hàng (lib/banCai.ts).
 */

export type KetQuaKho = { message: string; success?: boolean };

/** Người được quản lý kho của tàu này, hoặc null. */
async function nguoiQuanLyKho(vesselId: number) {
  const actor = await requireActiveRole([...VAN_HANH_TAU]);
  if (!actor || !canManageVesselCatalog(actor, vesselId)) return null;
  return actor;
}

function lamMoi(vesselId: number) {
  revalidatePath(`/vessels/${vesselId}`);
  revalidatePath("/inventory");
}

const nhanKhoi = (t: HamDich, loai: LoaiKho) => (loai === "ENG" ? t("vessels.khoi_ENG") : loai === "DECK" ? t("vessels.khoi_DECK") : t("vessels.khoi_STORE"));

const soNguyenDuong = (x: unknown) => {
  const n = Number(x);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Thêm (không có id) hoặc sửa một kho. Mã ghép từ mã tàu + khối + mã vị trí (lib/khoTau.ts maKho),
 * tên lưu kèm tên tàu như các kho sẵn có. Đổi khối của kho đang có hàng là hợp lệ (kho xếp nhầm
 * khối) — hộp sửa đã cảnh báo báo cáo theo bộ phận sẽ tính hàng của kho vào khối mới.
 */
export async function luuKhoTau(x: { vesselId: number; id?: number | null; loai: string; hauTo: string; ten: string }): Promise<KetQuaKho> {
  const { t } = await layT();
  const vesselId = soNguyenDuong(x?.vesselId);
  if (!vesselId) return { message: t("chung.duLieuKhongHopLe") };
  const actor = await nguoiQuanLyKho(vesselId);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  const tau = await prisma.vessel.findUnique({ where: { id: vesselId }, select: { id: true, code: true, name: true } });
  if (!tau) return { message: t("actions.tau_khongTimThay") };

  const loai = String(x.loai ?? "") as LoaiKho;
  if (!(LOAI_KHO as readonly string[]).includes(loai)) return { message: t("vessels.kho_loaiKhongHopLe") };
  const tenRieng = tenKhoNgan(String(x.ten ?? "").replace(/\s+/g, " "), tau.name);
  if (!tenRieng) return { message: t("vessels.kho_tenBatBuoc") };
  if (tenRieng.length > DO_DAI_TEN_KHO) return { message: t("vessels.kho_tenQuaDai", { n: DO_DAI_TEN_KHO }) };
  const code = maKho(tau.code, loai, chuanHoaHauTo(String(x.hauTo ?? "")));
  const name = tenKhoDayDu(tenRieng, tau.name);

  const id = x.id === null || x.id === undefined ? null : soNguyenDuong(x.id);
  if (x.id !== null && x.id !== undefined && !id) return { message: t("chung.duLieuKhongHopLe") };
  try {
    if (id) {
      const cu = await prisma.warehouse.findUnique({ where: { id }, select: { id: true, code: true, name: true, vesselId: true } });
      if (!cu || cu.vesselId !== vesselId) return { message: t("vessels.kho_khongTimThay") };
      if (cu.code === code && cu.name === name) return { message: t("vessels.kho_khongDoi"), success: true };
      if (loaiKhoTuMa(cu.code) !== loai) {
        const cuoi = laKhoCuoiCuaKhoi(cu, await prisma.warehouse.findMany({ where: { vesselId }, select: { id: true, code: true } }));
        if (cuoi) return { message: t("vessels.kho_khongDoiKhoiCuoi", { khoi: nhanKhoi(t, cuoi) }) };
      }
      await prisma.warehouse.update({ where: { id }, data: { code, name } });
      await ghiNhatKyNguoiDung(actor, {
        action: "kho-sua",
        path: `/vessels/${vesselId}`,
        vesselId,
        detail: `Sửa kho #${id}: ${cu.code} "${cu.name}" → ${code} "${name}"`,
      });
      lamMoi(vesselId);
      return { message: t("vessels.kho_daLuu", { ma: code }), success: true };
    }
    const moi = await prisma.warehouse.create({ data: { code, name, warehouseType: "VESSEL", vesselId } });
    await ghiNhatKyNguoiDung(actor, {
      action: "kho-them",
      path: `/vessels/${vesselId}`,
      vesselId,
      detail: `Thêm kho #${moi.id}: ${code} "${name}"`,
    });
    lamMoi(vesselId);
    return { message: t("vessels.kho_daThem", { ma: code }), success: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return { message: t("vessels.kho_maDaCo", { ma: code }) };
      if (e.code === "P2025") return { message: t("vessels.kho_khongTimThay") };
    }
    throw e;
  }
}

/** Xóa một kho đã trống thật (lib/khoTauServer.ts conTrongKho). */
export async function xoaKhoTau(khoIdRaw: number): Promise<KetQuaKho> {
  const { t } = await layT();
  const khoId = soNguyenDuong(khoIdRaw);
  if (!khoId) return { message: t("chung.duLieuKhongHopLe") };
  const kho = await prisma.warehouse.findUnique({ where: { id: khoId }, select: { id: true, code: true, name: true, vesselId: true } });
  if (!kho || !kho.vesselId) return { message: t("vessels.kho_khongTimThay") };
  const actor = await nguoiQuanLyKho(kho.vesselId);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  if (await laBanTau()) return { message: t("vessels.kho_chiVanPhong") };
  const con = await conTrongKho(prisma, khoId);
  if (con.dongTon) return { message: t("vessels.kho_conHang", { n: con.dongTon }) };
  if (con.giaoDich) return { message: t("vessels.kho_conLichSu", { n: con.giaoDich }) };
  if (con.kiemKeCho) return { message: t("vessels.kho_conKiemKeCho", { n: con.kiemKeCho }) };
  const cuoi = laKhoCuoiCuaKhoi(kho, await prisma.warehouse.findMany({ where: { vesselId: kho.vesselId }, select: { id: true, code: true } }));
  if (cuoi) return { message: t("vessels.kho_cuoiCungCuaKhoi", { khoi: nhanKhoi(t, cuoi) }) };
  // Xóa có điều kiện trong MỘT câu: phiếu nhập vừa ghi vào kho sau lúc kiểm ở trên thì không xóa
  // (khóa ngoại Inventory → Warehouse là CASCADE, xóa nhầm là mất luôn dòng tồn vừa nhập).
  const daXoa = await prisma.$executeRaw`
    DELETE FROM "Warehouse" w
    WHERE w."id" = ${khoId}
      AND NOT EXISTS (SELECT 1 FROM "Inventory" i WHERE i."warehouseId" = w."id")
      AND NOT EXISTS (SELECT 1 FROM "InventoryTransaction" g WHERE g."warehouseId" = w."id")`;
  if (!daXoa) return { message: t("vessels.kho_vuaCoHang") };
  await ghiNhatKyNguoiDung(actor, {
    action: "kho-xoa",
    path: `/vessels/${kho.vesselId}`,
    vesselId: kho.vesselId,
    detail: `Xóa kho #${kho.id}: ${kho.code} "${kho.name}"`,
  });
  lamMoi(kho.vesselId);
  return { message: t("vessels.kho_daXoa", { ma: kho.code }), success: true };
}

/** Danh sách hàng của một kho cho hộp "Chuyển hàng". */
export async function layHangTrongKho(khoIdRaw: number): Promise<{ message: string; hang?: HangTrongKho[] }> {
  const { t } = await layT();
  const khoId = soNguyenDuong(khoIdRaw);
  if (!khoId) return { message: t("chung.duLieuKhongHopLe") };
  const kho = await prisma.warehouse.findUnique({ where: { id: khoId }, select: { id: true, vesselId: true } });
  if (!kho || !kho.vesselId) return { message: t("vessels.kho_khongTimThay") };
  if (!(await nguoiQuanLyKho(kho.vesselId))) return { message: t("chung.khongCoQuyen") };
  return { message: "", hang: await hangTrongKho(prisma, { id: kho.id, vesselId: kho.vesselId }) };
}

const TOI_DA_CHUYEN = 2000;

/** Chuyển các dòng tồn đã chọn sang kho khác cùng tàu (đổi vị trí lưu — lib/khoTauServer.ts chuyenHangTx). */
export async function chuyenHangSangKho(tuKhoRaw: number, denKhoRaw: number, idsRaw: number[]): Promise<KetQuaKho> {
  const { t } = await layT();
  const tuKhoId = soNguyenDuong(tuKhoRaw);
  const denKhoId = soNguyenDuong(denKhoRaw);
  const ids = [...new Set((Array.isArray(idsRaw) ? idsRaw : []).map(soNguyenDuong).filter((n): n is number => n !== null))].slice(0, TOI_DA_CHUYEN);
  if (!tuKhoId || !denKhoId) return { message: t("vessels.kho_chuaChonKhoDich") };
  if (tuKhoId === denKhoId) return { message: t("vessels.kho_cungMotKho") };
  if (!ids.length) return { message: t("vessels.kho_chuaChonHang") };
  const [tu, den] = await Promise.all([
    prisma.warehouse.findUnique({ where: { id: tuKhoId }, select: { id: true, code: true, vesselId: true } }),
    prisma.warehouse.findUnique({ where: { id: denKhoId }, select: { id: true, code: true, vesselId: true } }),
  ]);
  if (!tu || !den || !tu.vesselId) return { message: t("vessels.kho_khongTimThay") };
  if (tu.vesselId !== den.vesselId) return { message: t("vessels.kho_khacTau") };
  const actor = await nguoiQuanLyKho(tu.vesselId);
  if (!actor) return { message: t("chung.khongCoQuyen") };
  if (await laBanTau()) return { message: t("vessels.kho_chiVanPhong") };

  let kq;
  try {
    kq = await prisma.$transaction((tx) => chuyenHangTx(tx, tu.id, den.id, ids), { timeout: 60_000, maxWait: 10_000 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2028" || e.code === "P2024")) return { message: t("actions.giaoDich_heThongBan") };
    throw e;
  }
  if (!kq.soMatHang) return { message: t("vessels.kho_hangDaDoi") };
  await ghiNhatKyNguoiDung(actor, {
    action: "kho-chuyen-hang",
    path: `/vessels/${tu.vesselId}`,
    vesselId: tu.vesselId,
    detail: `Chuyển ${kq.soMatHang} mặt hàng ${tu.code} → ${den.code} (cộng vào dòng có sẵn: ${kq.soGop}; dòng nhập / xuất đi theo: ${kq.soGiaoDich}) [${kq.ma.slice(0, 60).join(", ")}${kq.ma.length > 60 ? ", …" : ""}]`,
  });
  lamMoi(tu.vesselId);
  return { message: t("vessels.kho_daChuyen", { n: kq.soMatHang, ma: den.code, gop: kq.soGop, gd: kq.soGiaoDich }), success: true };
}
