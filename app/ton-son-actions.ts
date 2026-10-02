"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireActiveRole } from "@/lib/auth";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import { VAN_HANH_SON, coQuanLySon } from "@/lib/roles";
import { docSoTon, soIn } from "@/lib/tonSon";
import {
  LoiTonSon,
  chuLoiTonSon,
  goTonSonTx,
  suaTonSonTx,
  xoaGiaoDichSonTx,
  type CachGoSon,
} from "@/lib/tonSonServer";

/*
 * SỬA / GỠ SƠN ĐÃ NHẬP trên trang sơn của tàu (bảng Tồn sơn, Lịch sử nhập/xuất).
 * Phần ghi database nằm ở lib/tonSonServer.ts (thử được bằng giao dịch cuộn
 * ngược); ở đây chỉ kiểm quyền, đọc form, ghi nhật ký và làm mới trang.
 *
 * Quyền: như nhập/xuất sơn — VAN_HANH_SON và quản sơn của đúng tàu đó. Sửa tên /
 * hãng / màu của một loại sơn đang dùng ở tàu khác thì chỉ thuyền trưởng / quản
 * trị (đổi định nghĩa dùng chung là đổi cho cả đội).
 */

export type KetQuaTonSon = { message: string; success?: boolean };

const chu = (fd: FormData, k: string, max = 300) => String(fd.get(k) ?? "").trim().slice(0, max);
const chuHoacNull = (fd: FormData, k: string, max = 200) => chu(fd, k, max) || null;

async function moTau(vesselId: number) {
  const actor = await requireActiveRole([...VAN_HANH_SON]);
  if (!actor || !Number.isInteger(vesselId) || vesselId <= 0 || !coQuanLySon(actor, vesselId)) return null;
  const tau = await prisma.vessel.findUnique({ where: { id: vesselId }, select: { code: true } });
  return tau ? { actor, tau } : null;
}

function lamMoi(vesselId: number, danhMuc = false) {
  revalidatePath("/paint");
  revalidatePath(`/paint/${vesselId}`);
  revalidatePath(`/paint/${vesselId}/bao-cao`);
  if (danhMuc) revalidatePath("/paint/products");
}

// ─── Sửa một dòng tồn ────────────────────────────────────────────────────────

export async function suaDongTonSon(_prev: KetQuaTonSon, fd: FormData): Promise<KetQuaTonSon> {
  const { t } = await layT();
  const vesselId = Number(fd.get("vesselId"));
  const productId = Number(fd.get("productId"));
  const mo = await moTau(vesselId);
  if (!mo || !Number.isInteger(productId) || productId <= 0) return { message: t("chung.khongCoQuyen") };
  const { actor, tau } = mo;

  const soLuongCu = Number(fd.get("soLuongCu"));
  // Ô trống = không đổi (form luôn gửi đủ ô; thiếu ô thì càng không được hiểu là 0).
  const soRaw = chu(fd, "soLuong", 40);
  const minRaw = chu(fd, "minQty", 40);
  const soLuongMoi = soRaw ? docSoTon(soRaw) : null;
  const minQty = !fd.has("minQty") ? null : minRaw ? docSoTon(minRaw) : 0;
  if (!Number.isFinite(soLuongCu) || (soRaw && soLuongMoi === null) || (minRaw && minQty === null)) {
    return { message: t("paint.tsLoiSoKhongHopLe") };
  }
  const suaSanPham = fd.get("suaSanPham") === "1";
  const packRaw = chu(fd, "packSize", 40);
  const packSize = packRaw ? docSoTon(packRaw) : 0;
  if (suaSanPham && packSize === null) return { message: t("paint.tsLoiSoKhongHopLe") };
  const lyDo = chu(fd, "lyDo", 200);
  // Thuyền trưởng / quản trị (kể cả người được thuyền trưởng ủy quyền) sửa được
  // loại sơn dùng chung — cùng cửa với "sửa loại sơn" ở Danh mục sơn.
  const toanDoi = ["ADMIN", "MASTER"].includes(actor.role) || actor.uyQuyen.some((u) => u.delegatorRole === "MASTER");

  try {
    const kq = await prisma.$transaction((tx) =>
      suaTonSonTx(tx, {
        vesselId,
        productId,
        soLuongCu,
        soLuongMoi,
        minQty,
        lyDo,
        nguoi: actor.name,
        toanDoi,
        sanPham: suaSanPham
          ? {
              name: chu(fd, "name", 200),
              maker: chuHoacNull(fd, "maker", 100),
              paintType: chu(fd, "paintType", 40) || "OTHER",
              colorName: chuHoacNull(fd, "colorName", 100),
              colorCode: chuHoacNull(fd, "colorCode", 60),
              uom: chu(fd, "uom", 20) || "L",
              packSize: packSize ?? 0,
            }
          : null,
      })
    );
    if (!kq.doiSo && !kq.doiMin && !kq.doiSanPham) return { message: t("paint.tsKhongCoGiDoi") };
    const viec = [
      kq.doiSo ? `tồn ${soIn(kq.truoc)} → ${soIn(kq.sau)} ${kq.uom} (lý do: ${lyDo})` : null,
      kq.doiMin ? `tối thiểu ${minQty}` : null,
      kq.doiSanPham ? "thông tin loại sơn" : null,
    ].filter(Boolean);
    await ghiNhatKyNguoiDung(actor, {
      action: "son-sua-ton",
      path: `/paint/${vesselId}`,
      vesselId,
      detail: `Sửa sơn ${kq.ten} (${tau.code}): ${viec.join("; ")}`,
    });
    lamMoi(vesselId, kq.doiSanPham);
    return {
      message: kq.doiSo
        ? t("paint.tsDaDieuChinh", { ten: kq.ten, truoc: soIn(kq.truoc), sau: soIn(kq.sau), dv: kq.uom })
        : t("paint.tsDaLuu", { ten: kq.ten }),
      success: true,
    };
  } catch (e) {
    if (e instanceof LoiTonSon) return { message: chuLoiTonSon(e, t) };
    throw e;
  }
}

// ─── Gỡ một loại sơn khỏi tồn của tàu ────────────────────────────────────────

export async function goDongTonSon(_prev: KetQuaTonSon, fd: FormData): Promise<KetQuaTonSon> {
  const { t } = await layT();
  const vesselId = Number(fd.get("vesselId"));
  const productId = Number(fd.get("productId"));
  const mo = await moTau(vesselId);
  if (!mo || !Number.isInteger(productId) || productId <= 0) return { message: t("chung.khongCoQuyen") };
  const { actor, tau } = mo;
  const cach: CachGoSon = fd.get("cach") === "XOA" ? "XOA" : "GIU";
  const lyDo = chu(fd, "lyDo", 200);
  try {
    const kq = await prisma.$transaction((tx) => goTonSonTx(tx, { vesselId, productId, cach, lyDo, nguoi: actor.name }));
    await ghiNhatKyNguoiDung(actor, {
      action: cach === "XOA" ? "son-xoa-han" : "son-go-ton",
      path: `/paint/${vesselId}`,
      vesselId,
      detail:
        cach === "XOA"
          ? `Xóa hẳn sơn ${kq.ten} khỏi ${tau.code} (nhập nhầm): ${kq.soGiaoDich} dòng nhập/điều chỉnh, tồn ${soIn(kq.soLuong)} ${kq.uom}${kq.xoaLoai ? ", xóa loại sơn khỏi danh mục" : ""}; lý do: ${lyDo}`
          : `Gỡ sơn ${kq.ten} khỏi danh sách tồn ${tau.code} (còn ${soIn(kq.soLuong)} ${kq.uom}, giữ lịch sử); lý do: ${lyDo}`,
    });
    lamMoi(vesselId, kq.xoaLoai);
    return {
      message:
        cach === "XOA"
          ? t(kq.xoaLoai ? "paint.tsDaXoaHanCaLoai" : "paint.tsDaXoaHan", { ten: kq.ten, n: kq.soGiaoDich })
          : t("paint.tsDaGo", { ten: kq.ten, so: soIn(kq.soLuong), dv: kq.uom }),
      success: true,
    };
  } catch (e) {
    if (e instanceof LoiTonSon) return { message: chuLoiTonSon(e, t) };
    throw e;
  }
}

// ─── Xóa một dòng nhập/xuất ──────────────────────────────────────────────────

export async function xoaGiaoDichSon(_prev: KetQuaTonSon, fd: FormData): Promise<KetQuaTonSon> {
  const { t } = await layT();
  const vesselId = Number(fd.get("vesselId"));
  const giaoDichId = Number(fd.get("giaoDichId"));
  const mo = await moTau(vesselId);
  if (!mo || !Number.isInteger(giaoDichId) || giaoDichId <= 0) return { message: t("chung.khongCoQuyen") };
  const { actor, tau } = mo;
  const lyDo = chu(fd, "lyDo", 200);
  try {
    const kq = await prisma.$transaction((tx) => xoaGiaoDichSonTx(tx, { vesselId, giaoDichId, lyDo }));
    await ghiNhatKyNguoiDung(actor, {
      action: "son-xoa-giao-dich",
      path: `/paint/${vesselId}`,
      vesselId,
      detail: `Xóa dòng ${kq.dieuChinh ? "điều chỉnh" : kq.type === "IN" ? "nhập" : "xuất"} ${soIn(kq.soLuong)} ${kq.uom} sơn ${kq.ten} (${tau.code}, "${kq.note ?? ""}") và hoàn lại tồn; lý do: ${lyDo}`,
    });
    lamMoi(vesselId);
    return { message: t("paint.gdDaXoa", { ten: kq.ten }), success: true };
  } catch (e) {
    if (e instanceof LoiTonSon) return { message: chuLoiTonSon(e, t) };
    throw e;
  }
}

// ─── Nhận dạng lại tên các loại sơn đã nhập (hàng loạt) ─────────────────────

/**
 * Ghi tên / hãng / hệ sơn / màu / mã màu / dung tích người dùng đã duyệt trong hộp
 * "Nhận dạng tên sơn" (đề xuất từ lib/tenSon.ts, sửa tay được) cho các loại sơn
 * đang có trong tồn của tàu. Gọi thẳng với mảng (không qua FormData).
 */
export async function apDungNhanDangSon(vesselId: number, ds: unknown): Promise<KetQuaTonSon> {
  const { t } = await layT();
  const mo = await moTau(vesselId);
  if (!mo) return { message: t("chung.khongCoQuyen") };
  const { actor, tau } = mo;
  if (!Array.isArray(ds) || ds.length === 0 || ds.length > 500) return { message: t("chung.duLieuKhongHopLe") };
  const chuoi = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const sach = ds.map((x) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const pack = typeof o.packSize === "number" ? o.packSize : docSoTon(chuoi(o.packSize, 20)) ?? 0;
    return {
      productId: Number(o.productId),
      name: chuoi(o.name, 200),
      maker: chuoi(o.maker, 100) || null,
      paintType: chuoi(o.paintType, 40) || "OTHER",
      colorName: chuoi(o.colorName, 100) || null,
      colorCode: chuoi(o.colorCode, 60) || null,
      uom: chuoi(o.uom, 20) || "L",
      packSize: pack,
    };
  });
  if (sach.some((s) => !Number.isInteger(s.productId) || s.productId <= 0)) return { message: t("chung.duLieuKhongHopLe") };
  const toanDoi = ["ADMIN", "MASTER"].includes(actor.role) || actor.uyQuyen.some((u) => u.delegatorRole === "MASTER");
  try {
    const { apDungNhanDangTx } = await import("@/lib/tonSonServer");
    const kq = await prisma.$transaction((tx) => apDungNhanDangTx(tx, { vesselId, ds: sach, toanDoi }), { timeout: 60000, maxWait: 10000 });
    await ghiNhatKyNguoiDung(actor, {
      action: "son-nhan-dang-ten",
      path: `/paint/${vesselId}`,
      vesselId,
      detail: `Nhận dạng lại tên ${kq.soLoai} loại sơn (${tau.code}): ${kq.ten.join("; ")}`.slice(0, 2000),
    });
    lamMoi(vesselId, true);
    return { message: t("paint.ndDaApDung", { n: kq.soLoai }), success: true };
  } catch (e) {
    if (e instanceof LoiTonSon) return { message: chuLoiTonSon(e, t) };
    throw e;
  }
}
