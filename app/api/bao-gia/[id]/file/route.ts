import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireActiveRole } from "@/lib/auth";
import { trongPhamVi, vesselScopeDayDu } from "@/lib/roles";
import { DUYET_DON_MUA, LAP_DON_MUA } from "@/lib/donMuaQuyTrinh";
import { getUploadDir } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
};

/** File báo giá gốc của nhà cung cấp: PDF xem trong trang (iframe), Word / Excel tải về. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await requireActiveRole([...new Set([...LAP_DON_MUA, ...DUYET_DON_MUA])]);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const id = Number((await ctx.params).id);
  const bg = Number.isInteger(id) && id > 0 ? await prisma.baoGiaNcc.findUnique({ where: { id }, select: { vesselId: true, storedName: true, fileName: true } }) : null;
  if (!bg || !trongPhamVi(vesselScopeDayDu(actor), bg.vesselId)) return new Response("Not found", { status: 404 });
  const ten = path.basename(bg.storedName);
  let data: Buffer;
  try {
    data = await readFile(path.join(getUploadDir(), ten));
  } catch {
    return new Response("File missing", { status: 404 });
  }
  const ext = path.extname(ten).toLowerCase();
  const tenTai = encodeURIComponent(bg.fileName.replace(/[^\w.\-()\[\] ]+/g, "_"));
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": `${ext === ".pdf" ? "inline" : "attachment"}; filename*=UTF-8''${tenTai}`,
      "Content-Length": String(data.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}
