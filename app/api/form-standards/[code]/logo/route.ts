import { prisma } from "@/lib/prisma";
import { requireActiveRole } from "@/lib/auth";
import { ROLES } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Logo của một chuẩn biểu mẫu (lấy từ file Word / Excel gốc) — in ở đầu chứng
 * từ PO / RFQ. Đường dẫn có ?v=<sha> nên cho trình duyệt giữ lâu: tải file gốc
 * mới là đường dẫn đổi theo.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const actor = await requireActiveRole([...ROLES]);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const code = decodeURIComponent((await ctx.params).code).slice(0, 40);
  const tep = await prisma.formStandardTep.findUnique({ where: { code }, select: { logo: true, logoMime: true } });
  if (!tep?.logo || !tep.logoMime || !tep.logoMime.startsWith("image/")) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(tep.logo), {
    headers: {
      "Content-Type": tep.logoMime,
      "Content-Length": String(tep.logo.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
