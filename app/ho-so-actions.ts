"use server";

import path from "path";
import { unlink } from "fs/promises";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireActiveRole } from "@/lib/auth";
import { ghiNhatKy } from "@/lib/audit";
import { laBanTau } from "@/lib/banCai";
import { layT } from "@/lib/i18n/server";
import { getUploadDir } from "@/lib/uploads";

const TOI_DA_MOT_LAN = 200;

/**
 * Gỡ một hoặc nhiều hồ sơ "Báo cáo từ tàu" khỏi hệ thống (bản ghi + tệp trên
 * đĩa). Chỉ quản trị ở bản cài VĂN PHÒNG: hồ sơ là bản lưu bất biến của tàu,
 * gỡ là quyết định của công ty — bản cài trên tàu không gỡ được.
 *
 * Mỗi hồ sơ gỡ đi để lại một dòng nhật ký riêng (ai gỡ, hồ sơ nào, của ai nộp):
 * bản ghi và tệp mất rồi thì dòng nhật ký là dấu vết duy nhất còn lại.
 */
export async function goHoSo(idsRaw: number[]): Promise<{ message: string; success?: boolean; daGo: number }> {
  const { t } = await layT();
  const admin = await requireActiveRole(["ADMIN"]);
  if (!admin) return { message: t("chung.khongCoQuyen"), daGo: 0 };
  if (await laBanTau()) return { message: t("inventory.goHoSoChiVanPhong"), daGo: 0 };
  const ids = [...new Set((Array.isArray(idsRaw) ? idsRaw : []).map(Number))].filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return { message: t("inventory.goHoSoChuaChon"), daGo: 0 };
  if (ids.length > TOI_DA_MOT_LAN) return { message: t("inventory.goHoSoQuaNhieu", { n: TOI_DA_MOT_LAN }), daGo: 0 };

  const docs = await prisma.reportDocument.findMany({ where: { id: { in: ids } } });
  if (!docs.length) return { message: t("actions.hoSo_khongTimThay"), daGo: 0 };
  await prisma.reportDocument.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
  for (const doc of docs) {
    await ghiNhatKy({
      userId: admin.id,
      email: admin.email,
      role: admin.role,
      // Tàu của hồ sơ, không phải tàu của người quản trị.
      vesselId: doc.vesselId,
      action: "xoa-ho-so",
      path: "/documents",
      detail:
        `Gỡ hồ sơ #${doc.id} "${doc.title}" (${doc.reportType}` +
        `${doc.period ? `, kỳ ${doc.period}` : ""}) — file ${doc.fileName}` +
        `, sha256 ${doc.sha256.slice(0, 16)}, người nộp #${doc.uploadedById}` +
        (docs.length > 1 ? ` (gỡ cùng lúc ${docs.length} hồ sơ)` : ""),
    });
    try {
      await unlink(path.join(getUploadDir(), path.basename(doc.storedName)));
    } catch {
      // tệp đã không còn trên đĩa — bỏ qua
    }
  }
  revalidatePath("/documents");
  return { message: t("inventory.daGoHoSo", { n: docs.length }), success: true, daGo: docs.length };
}
