import "server-only";

import { prisma } from "@/lib/prisma";
import { DEFAULT_STANDARD, type FormStandardInfo } from "@/lib/formStandards";
import { duongDanLogo } from "@/lib/bieuMauTepDb";

// Lấy biểu mẫu cho một tàu theo code; nếu không thấy thì lấy biểu mẫu đầu tiên đang dùng, cuối cùng là fallback.
export async function getStandardForVessel(
  code: string | null | undefined
): Promise<FormStandardInfo> {
  const kemLogo = async (s: FormStandardInfo): Promise<FormStandardInfo> => {
    const tep = await prisma.formStandardTep.findUnique({ where: { code: s.code }, select: { sha256: true, logoMime: true } });
    return { ...s, logoUrl: duongDanLogo(s.code, tep ?? undefined) };
  };
  if (code) {
    const s = await prisma.formStandard.findUnique({ where: { code } });
    if (s) return kemLogo(s);
  }
  const any = await prisma.formStandard.findFirst({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });
  return any ? kemLogo(any) : DEFAULT_STANDARD;
}

export async function listActiveStandards() {
  return prisma.formStandard.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });
}
