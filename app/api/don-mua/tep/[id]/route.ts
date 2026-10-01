import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireActiveRole } from "@/lib/auth";
import { ROLES, trongPhamVi } from "@/lib/roles";
import { coLanhDaoDuyetPo, phamViDonMua } from "@/lib/duyetPoServer";
import { getUploadDir } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/** File đính kèm đơn mua (bản PO nhà cung cấp ký xác nhận...). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await requireActiveRole([...ROLES]);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const id = Number((await ctx.params).id);
  const tep = Number.isInteger(id) && id > 0 ? await prisma.tepDonMua.findUnique({ where: { id } }) : null;
  const po = tep ? await prisma.purchaseOrder.findUnique({ where: { id: tep.poId }, select: { vesselId: true } }) : null;
  if (!tep || !po || !trongPhamVi(phamViDonMua(actor, await coLanhDaoDuyetPo()), po.vesselId)) return new Response("Not found", { status: 404 });
  let data: Buffer;
  try {
    data = await readFile(path.join(getUploadDir(), path.basename(tep.storedName)));
  } catch {
    return new Response("File missing", { status: 404 });
  }
  const tenTai = encodeURIComponent(tep.fileName.replace(/[^\w.\-()\[\] ]+/g, "_"));
  const xemDuoc = /^(application\/pdf|image\/(png|jpeg))$/.test(tep.mimeType);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": tep.mimeType,
      "Content-Disposition": `${xemDuoc ? "inline" : "attachment"}; filename*=UTF-8''${tenTai}`,
      "Content-Length": String(data.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
