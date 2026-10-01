import { prisma } from "@/lib/prisma";
import { requireActiveRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Tải lại file Word / Excel gốc của một chuẩn biểu mẫu (người xem được trang Biểu mẫu). */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const actor = await requireActiveRole(["ADMIN", "MASTER"]);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const code = decodeURIComponent((await ctx.params).code).slice(0, 40);
  const tep = await prisma.formStandardTep.findUnique({ where: { code }, select: { data: true, fileName: true, mimeType: true } });
  if (!tep) return new Response("Not found", { status: 404 });
  const tenTai = encodeURIComponent(tep.fileName.replace(/[^\w.\-()\[\] ]+/g, "_"));
  return new Response(new Uint8Array(tep.data), {
    headers: {
      "Content-Type": tep.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${tenTai}`,
      "Content-Length": String(tep.data.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
