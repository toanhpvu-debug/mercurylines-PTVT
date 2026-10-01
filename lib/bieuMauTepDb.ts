import "server-only";

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { DUOI_TEP_BIEU_MAU, TOI_DA_TEP_BIEU_MAU, mimeTepBieuMau, trichBieuMauTuTep, type KetQuaTrichBieuMau } from "@/lib/bieuMauTuTep";

/*
 * File gốc + logo của chuẩn biểu mẫu (bảng FormStandardTep, nối theo code).
 * Dùng chung cho các action thêm / sửa / xóa chuẩn biểu mẫu (app/actions.ts)
 * và trang /purchasing/forms, đầu chứng từ PO / RFQ (lib/formStandardsDb.ts).
 */

export type TepBieuMauNhan = { ten: string; buffer: Buffer; trich: Extract<KetQuaTrichBieuMau, { ok: true }> };

/** Lấy file "tepGoc" trong form (nếu có) và đọc đầu chứng từ. null = không chọn file. */
export async function tepBieuMauTuForm(formData: FormData, khoa = "tepGoc"): Promise<TepBieuMauNhan | { loi: string } | null> {
  const file = formData.get(khoa);
  if (!(file instanceof File) || file.size === 0) return null;
  const duoi = (file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  if (!(DUOI_TEP_BIEU_MAU as readonly string[]).includes(duoi)) return { loi: "Chỉ nhận file Word (.docx, .doc) hoặc Excel (.xlsx, .xls)." };
  if (file.size > TOI_DA_TEP_BIEU_MAU) return { loi: "File quá 10 MB." };
  const buffer = Buffer.from(await file.arrayBuffer());
  const trich = await trichBieuMauTuTep(buffer, file.name);
  if (!trich.ok) return { loi: trich.loi };
  return { ten: file.name.slice(0, 200), buffer, trich };
}

/** Lưu (thay) file gốc + logo của một chuẩn biểu mẫu. */
export async function luuTepBieuMau(code: string, tep: TepBieuMauNhan, nguoi: string) {
  const du = {
    fileName: tep.ten,
    mimeType: mimeTepBieuMau(tep.ten),
    size: tep.buffer.length,
    sha256: createHash("sha256").update(tep.buffer).digest("hex"),
    data: Uint8Array.from(tep.buffer),
    logo: tep.trich.logo ? Uint8Array.from(tep.trich.logo.data) : null,
    logoMime: tep.trich.logo?.mime ?? null,
    logoTen: tep.trich.logo?.ten ?? null,
    dongChu: tep.trich.dongChu.join("\n").slice(0, 4000),
    uploadedBy: nguoi,
    uploadedAt: new Date(),
  };
  await prisma.formStandardTep.upsert({ where: { code }, update: du, create: { code, ...du } });
}

export async function goTepBieuMau(code: string) {
  await prisma.formStandardTep.deleteMany({ where: { code } });
}

export async function doiMaTepBieuMau(cu: string, moi: string) {
  if (cu === moi) return;
  await prisma.formStandardTep.deleteMany({ where: { code: moi } });
  await prisma.formStandardTep.updateMany({ where: { code: cu }, data: { code: moi } });
}

/** Thông tin hiển thị (không kéo dữ liệu nhị phân) của file gốc theo từng mã. */
export async function thongTinTepBieuMau(codes?: string[]) {
  const ds = await prisma.formStandardTep.findMany({
    where: codes ? { code: { in: codes } } : undefined,
    select: { code: true, fileName: true, size: true, sha256: true, logoMime: true, uploadedBy: true, uploadedAt: true },
  });
  return new Map(ds.map((d) => [d.code, d]));
}

/** Đường dẫn logo (kèm dấu phiên bản để trình duyệt không giữ ảnh cũ) — null nếu chưa có logo. */
export function duongDanLogo(code: string, t: { sha256: string; logoMime: string | null } | undefined): string | null {
  return t?.logoMime ? `/api/form-standards/${encodeURIComponent(code)}/logo?v=${t.sha256.slice(0, 10)}` : null;
}
