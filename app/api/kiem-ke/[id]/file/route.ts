import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireActiveRole, vesselScopeDayDu } from "@/lib/auth";
import { ROLES, trongPhamVi } from "@/lib/roles";
import { getUploadDir } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Trả file kiểm kê gốc (PDF scan / Excel) để xem ngay trong trang đối chiếu (PDF
 * nhúng iframe) hoặc tải về. Chỉ người trong phạm vi tàu của file mới xem được
 * — số tồn kho của tàu không phải tài liệu công khai.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await requireActiveRole([...ROLES]);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const kkId = Number(id);
  if (!Number.isInteger(kkId) || kkId <= 0) return new Response("Not found", { status: 404 });
  const phieu = await prisma.kiemKeTep.findUnique({
    where: { id: kkId },
    select: { vesselId: true, storedName: true, fileName: true, loaiTep: true },
  });
  if (!phieu || !trongPhamVi(vesselScopeDayDu(actor), phieu.vesselId)) {
    return new Response("Not found", { status: 404 });
  }
  // storedName do máy sinh (kiem-ke-uuid.ext) — vẫn chặn đường dẫn lạ cho chắc.
  const safeName = path.basename(phieu.storedName);
  let data: Buffer;
  try {
    data = await readFile(path.join(getUploadDir(), safeName));
  } catch {
    return new Response("File missing", { status: 404 });
  }
  const tenTai = encodeURIComponent(phieu.fileName.replace(/[^\w.\-()\[\] ]+/g, "_"));
  const laPdf = phieu.loaiTep === "PDF";
  const laXls = /\.xls$/i.test(phieu.storedName);
  return new Response(new Uint8Array(data), {
    headers: {
      // PDF xem ngay trong trang; Excel thì tải về (trình duyệt không hiện được).
      "Content-Type": laPdf
        ? "application/pdf"
        : laXls
          ? "application/vnd.ms-excel"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `${laPdf ? "inline" : "attachment"}; filename*=UTF-8''${tenTai}`,
      "Content-Length": String(data.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      // Cho trang duyệt (cùng nguồn) nhúng bằng iframe — xem thêm next.config.ts.
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}
