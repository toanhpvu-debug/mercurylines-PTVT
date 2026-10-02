import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireActiveRole, vesselScopeDayDu } from "@/lib/auth";
import { trongPhamVi } from "@/lib/roles";
import { getUploadDir } from "@/lib/uploads";
import { VAN_HANH_SON } from "@/lib/roles";

export const dynamic = "force-dynamic";

const LOAI_NOI_DUNG: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
};

/** Phiếu giao sơn gốc đã tải lên để nhập tồn sơn: PDF xem ngay (nhúng iframe), Word / Excel tải về. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await requireActiveRole([...VAN_HANH_SON]);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const tep = await prisma.sonPhieuTep.findUnique({ where: { id }, select: { vesselId: true, storedName: true, fileName: true } });
  if (!tep || !trongPhamVi(vesselScopeDayDu(actor), tep.vesselId)) return new Response("Not found", { status: 404 });
  // storedName do máy sinh (phieu-son-uuid.ext) — vẫn chặn đường dẫn lạ cho chắc.
  const safeName = path.basename(tep.storedName);
  let data: Buffer;
  try {
    data = await readFile(path.join(getUploadDir(), safeName));
  } catch {
    return new Response("File missing", { status: 404 });
  }
  const duoi = (safeName.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  const laPdf = duoi === ".pdf";
  const tenTai = encodeURIComponent(tep.fileName.replace(/[^\w.\-()\[\] ]+/g, "_"));
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": LOAI_NOI_DUNG[duoi] ?? "application/octet-stream",
      "Content-Disposition": `${laPdf ? "inline" : "attachment"}; filename*=UTF-8''${tenTai}`,
      "Content-Length": String(data.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}
