"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveRole } from "@/lib/auth";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import { LAP_YEU_CAU, VAN_HANH_SON, coQuanLySon } from "@/lib/roles";
import { docDongGuiSon } from "@/lib/yeuCauSon";

/*
 * Gửi yêu cầu sơn từ trang /paint/<tàu>/yeu-cau — dòng chọn từ danh mục sơn,
 * gõ tay, hoặc điền sẵn từ phiếu MLS-11-05 đã tải. Ghi xong chuyển sang trang
 * chứng từ /requests/<id> (bản in MLS-11-05B, trạng thái chờ thuyền trưởng duyệt).
 */

export type GuiYeuCauSon = {
  vesselId: number;
  tuTep?: number | null;
  purpose: string;
  priority: string;
  /** yyyy-mm-dd hoặc "" */
  requiredDate: string;
  dong: unknown[];
};

export async function guiYeuCauSon(input: GuiYeuCauSon): Promise<{ message: string }> {
  const { t } = await layT();
  const vesselId = Number(input?.vesselId);
  const actor = await requireActiveRole([...VAN_HANH_SON]);
  // Lập yêu cầu là quyền của người lập yêu cầu (LAP_YEU_CAU) VÀ quản phần sơn của
  // đúng tàu này — đại phó, thuyền trưởng, máy trưởng của tàu; quản trị.
  if (!actor || !Number.isInteger(vesselId) || vesselId <= 0 || !coQuanLySon(actor, vesselId) || !LAP_YEU_CAU.includes(actor.role)) {
    return { message: t("chung.khongCoQuyen") };
  }
  const r = docDongGuiSon(input.dong);
  if (!r.ok) return { message: t("paint.ycSoLuongSai", { n: r.dongLoi }) };
  if (!r.dong.length) return { message: t("actionsModule.son_nhapSoLuongItNhatMot") };
  let requiredDate: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(input.requiredDate ?? ""))) {
    const d = new Date(`${input.requiredDate}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) requiredDate = d;
  }
  const tuTep = Number(input.tuTep);
  const { taoYeuCauSonTx } = await import("@/lib/yeuCauSonServer");
  const kq = await prisma.$transaction((tx) =>
    taoYeuCauSonTx(tx, {
      vesselId,
      nguoi: { id: actor.id, name: actor.name, role: actor.role },
      dong: r.dong,
      purpose: String(input.purpose ?? "").trim().slice(0, 300) || null,
      priority: String(input.priority ?? "NORMAL"),
      requiredDate,
      tuTep: Number.isInteger(tuTep) && tuTep > 0 ? tuTep : null,
    })
  );
  await ghiNhatKyNguoiDung(actor, {
    action: "yeu-cau-son",
    path: `/requests/${kq.id}`,
    vesselId,
    detail: `Lập yêu cầu cấp sơn ${kq.requestNo}: ${kq.soDong} dòng${tuTep > 0 ? " (từ file MLS-11-05)" : ""}, ${kq.status === "PENDING_MASTER" ? "chờ tàu duyệt" : "chờ công ty duyệt"}`,
  });
  revalidatePath("/paint");
  revalidatePath(`/paint/${vesselId}`);
  revalidatePath(`/paint/${vesselId}/yeu-cau`);
  revalidatePath("/requests");
  redirect(`/requests/${kq.id}`);
}
