import { prisma } from "@/lib/prisma";

/**
 * Bản cài này là bản VĂN PHÒNG hay bản TRÊN TÀU?
 *
 * Quy ước của đồng bộ (lib/sync.ts, scripts/khai-bao-ban-cai.ts): SiteConfig
 * id=1 có vesselCode = mã tàu nếu là bản cài trên tàu; để trống (hoặc chưa
 * khai báo) là bản văn phòng — máy chủ online và máy văn phòng đều là "văn
 * phòng" theo nghĩa này.
 *
 * Dùng để chặn những việc chỉ được làm ở một nơi: XÓA mặt hàng khỏi danh mục
 * dùng chung. Xóa trên tàu rồi đồng bộ về là mất mặt hàng của cả đội tàu, và
 * gói đồng bộ không mang lệnh xóa nên hai bên còn lệch nhau mãi. Ai muốn xóa
 * thì làm ở văn phòng bằng tài khoản quản trị.
 */
export async function layBanCai(): Promise<{ laTau: boolean; vesselCode: string | null }> {
  try {
    const site = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { vesselCode: true } });
    const vesselCode = site?.vesselCode?.trim() || null;
    return { laTau: vesselCode !== null, vesselCode };
  } catch {
    // Bảng chưa có (migration cũ) — coi như văn phòng, đúng với mặc định trước nay.
    return { laTau: false, vesselCode: null };
  }
}

export async function laBanTau(): Promise<boolean> {
  return (await layBanCai()).laTau;
}
