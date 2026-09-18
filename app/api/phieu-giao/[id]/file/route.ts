import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireActiveRole, vesselScopeDayDu } from "@/lib/auth";
import { ROLES, trongPhamVi } from "@/lib/roles";
import { getUploadDir } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Trả bản scan phiếu giao hàng để xem ngay trong trang duyệt (iframe) hoặc mở
 * tab mới. Chỉ người trong phạm vi tàu của phiếu mới xem được — phiếu giao có
 * giá cả, nhà cung cấp, không phải tài liệu công khai.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await requireActiveRole([...ROLES]);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const phieuId = Number(id);
  if (!Number.isInteger(phieuId) || phieuId <= 0) return new Response("Not found", { status: 404 });
  const phieu = await prisma.phieuGiaoNhan.findUnique({
    where: { id: phieuId },
    select: { vesselId: true, storedName: true, fileName: true, mimeType: true },
  });
  if (!phieu || !trongPhamVi(vesselScopeDayDu(actor), phieu.vesselId)) {
    return new Response("Not found", { status: 404 });
  }
  // storedName do máy sinh (uuid.pdf) — vẫn chặn đường dẫn lạ cho chắc.
  const safeName = path.basename(phieu.storedName);
  let data: Buffer;
  try {
    data = await readFile(path.join(getUploadDir(), safeName));
  } catch {
    return new Response("File missing", { status: 404 });
  }
  const tenTai = encodeURIComponent(phieu.fileName.replace(/[^\w.\-()\[\] ]+/g, "_"));
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": phieu.mimeType || "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${tenTai}`,
      "Content-Length": String(data.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      // Cho trang duyệt (cùng nguồn) nhúng bằng iframe — xem thêm next.config.ts.
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}
