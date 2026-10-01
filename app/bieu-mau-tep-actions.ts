"use server";

import { requireActiveRole } from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import type { TruongBieuMau } from "@/lib/bieuMauTuTep";

export type KetQuaDocTepBieuMau =
  | { ok: true; truong: TruongBieuMau; logo: string | null; dongChu: string[]; canhBao: string[] }
  | { ok: false; loi: string };

/**
 * Đọc thử file Word / Excel gốc để ĐIỀN SẴN form thêm / sửa chuẩn biểu mẫu —
 * không lưu gì. Logo trả về dạng data URL để xem trước. Lưu thật diễn ra khi
 * bấm Thêm / Lưu (file vẫn nằm trong ô chọn file của form).
 */
export async function docTepBieuMau(formData: FormData): Promise<KetQuaDocTepBieuMau> {
  const { t } = await layT();
  if (!(await requireActiveRole(["ADMIN"]))) return { ok: false, loi: t("chung.khongCoQuyen") };
  const { tepBieuMauTuForm } = await import("@/lib/bieuMauTepDb");
  const tep = await tepBieuMauTuForm(formData);
  if (!tep) return { ok: false, loi: t("actions.nhap_vuiLongChonFile") };
  if ("loi" in tep) return { ok: false, loi: tep.loi };
  const { logo } = tep.trich;
  return {
    ok: true,
    truong: tep.trich.truong,
    logo: logo ? `data:${logo.mime};base64,${logo.data.toString("base64")}` : null,
    dongChu: tep.trich.dongChu,
    canhBao: tep.trich.canhBao,
  };
}
