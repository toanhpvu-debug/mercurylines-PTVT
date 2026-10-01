"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireActiveRole } from "@/lib/auth";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import { ROLE_LABEL } from "@/lib/roles";
import { kiemChiDinhLanhDao, kiemUyQuyenDuyetPo } from "@/lib/donMuaQuyTrinh";

/*
 * KIỂM SOÁT DUYỆT PO — quản trị chỉ định lãnh đạo phòng Kỹ thuật – Vật tư (người
 * duyệt PO); lãnh đạo (hoặc quản trị lập hộ) ủy quyền CHỈ việc duyệt PO cho
 * người khác trong một khoảng thời gian. Thu hồi ủy quyền dùng thuHoiUyQuyen
 * (app/quyen-actions.ts) — cùng bảng Delegation, cùng luật "chỉ người giao hoặc
 * quản trị thu hồi, giữ lại dòng đã thu hồi".
 *
 * Phần `detail` của nhật ký giữ tiếng Việt — hồ sơ không đổi theo ngôn ngữ.
 */

type ActionState = { message: string; success?: boolean };

const DUONG_DAN = "/purchasing/duyet";

/** Quản trị bật / tắt chỉ định "lãnh đạo phòng KT-VT — người duyệt PO" cho một tài khoản. */
export async function chiDinhLanhDaoDuyet(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin || admin.role !== "ADMIN") return { message: t("chung.khongCoQuyen") };
  const userId = Number(formData.get("userId"));
  const bat = formData.get("bat") === "1";
  const u = Number.isInteger(userId) && userId > 0 ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!u) return { message: t("purchasing.chonNguoiChiDinh") };
  if (bat) {
    const loi = kiemChiDinhLanhDao(u);
    if (loi === "saiVaiTro") return { message: t("purchasing.chiDinhSaiVaiTro") };
    if (loi === "biKhoa") return { message: t("actionsModule.quyen_taiKhoanBiKhoa", { email: u.email }) };
  }
  if (u.duyetDonMua === bat) return { message: bat ? t("purchasing.daChiDinh", { ten: u.name }) : t("purchasing.daBoChiDinh", { ten: u.name }), success: true };
  await prisma.user.update({ where: { id: u.id }, data: { duyetDonMua: bat } });
  await ghiNhatKyNguoiDung(admin, {
    action: bat ? "chi-dinh-lanh-dao-duyet-po" : "bo-chi-dinh-lanh-dao-duyet-po",
    path: DUONG_DAN,
    vesselId: null,
    detail: `${bat ? "Chỉ định" : "Bỏ chỉ định"} lãnh đạo phòng KT-VT (người duyệt PO): ${u.email} (${ROLE_LABEL[u.role] ?? u.role})`,
  });
  revalidatePath(DUONG_DAN);
  return { message: bat ? t("purchasing.daChiDinh", { ten: u.name }) : t("purchasing.daBoChiDinh", { ten: u.name }), success: true };
}

/** Đọc ngày từ ô <input type="date">; cuối ngày cho mốc hết hạn. */
function ngay(v: FormDataEntryValue | null, cuoiNgay = false): Date | null {
  const s = String(v || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(cuoiNgay ? `${s}T23:59:59` : `${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Lãnh đạo phòng KT-VT ủy quyền duyệt PO (chỉ việc duyệt PO, không mượn vai
 * trò) cho một quản lý kỹ thuật / quản trị trong khoảng thời gian. Quản trị lập
 * hộ được cho bất kỳ lãnh đạo nào; lãnh đạo chỉ giao quyền của chính mình.
 */
export async function taoUyQuyenDuyetPo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t, ngay: dinhDangNgay } = await layT();
  const me = await getCurrentUser();
  if (!me || !me.isActive) return { message: t("chung.khongCoQuyen") };
  const laAdmin = me.role === "ADMIN";
  const giaoId = Number(formData.get("delegatorId")) || me.id;
  if (!laAdmin && giaoId !== me.id) return { message: t("actionsModule.quyen_chiUyQuyenCuaMinh") };
  const nhanId = Number(formData.get("delegateId"));
  const [giao, nhan] = await Promise.all([
    prisma.user.findUnique({ where: { id: giaoId } }),
    Number.isInteger(nhanId) && nhanId > 0 ? prisma.user.findUnique({ where: { id: nhanId } }) : null,
  ]);
  if (!giao) return { message: t("actionsModule.quyen_khongTimThayNguoiDung") };
  if (!nhan) return { message: t("actionsModule.quyen_chonNguoiNhan") };
  const startAt = ngay(formData.get("startAt"));
  const endAt = ngay(formData.get("endAt"), true);
  const loi = kiemUyQuyenDuyetPo({ giao, nhan, tu: startAt, den: endAt });
  if (loi || !startAt || !endAt) {
    const thongBao = {
      giaoKhongPhaiLanhDao: t("purchasing.uqGiaoKhongPhaiLanhDao"),
      tuUyQuyen: t("actionsModule.quyen_khongUyQuyenChoMinh"),
      nhanSaiVaiTro: t("purchasing.uqNhanSaiVaiTro"),
      nhanBiKhoa: t("actionsModule.quyen_taiKhoanBiKhoa", { email: nhan.email }),
      thieuNgay: t("actionsModule.quyen_nhapDuNgay"),
      denTruocTu: t("actionsModule.quyen_ngayHetHanSauBatDau"),
      quaMotNam: t("actionsModule.quyen_toiDaMotNam"),
    };
    return { message: loi ? thongBao[loi] : thongBao.thieuNgay };
  }
  const reason = String(formData.get("reason") || "").trim().slice(0, 300) || null;
  const uq = await prisma.delegation.create({
    data: { delegatorId: giao.id, delegateId: nhan.id, startAt, endAt, reason, phamVi: "DUYET_PO", createdById: me.id },
  });
  await ghiNhatKyNguoiDung(me, {
    action: "tao-uy-quyen-duyet-po",
    path: DUONG_DAN,
    vesselId: null,
    detail:
      `#${uq.id} ủy quyền duyệt PO: ${giao.email} → ${nhan.email} (${ROLE_LABEL[nhan.role] ?? nhan.role}), ` +
      `${startAt.toLocaleDateString("vi-VN")} → ${endAt.toLocaleDateString("vi-VN")}${reason ? `, lý do: ${reason}` : ""}`,
  });
  revalidatePath(DUONG_DAN);
  revalidatePath("/users");
  return { message: t("purchasing.daUyQuyenDuyetPo", { ten: nhan.name, ngay: dinhDangNgay(endAt) }), success: true };
}
