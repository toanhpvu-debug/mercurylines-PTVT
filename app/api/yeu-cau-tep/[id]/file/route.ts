import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { trongPhamVi, vesselScopeDayDu } from "@/lib/roles";
import { getUploadDir } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const LOAI_NOI_DUNG: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
};

/**
 * File MLS-11-05A/B gốc của một yêu cầu lập nhanh từ file: PDF mở ngay, Word /
 * Excel tải về. Người tải lên luôn xem được; khi file đã thành yêu cầu thì ai xem
 * được yêu cầu đó (tàu trong phạm vi) cũng xem được file gốc của nó.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) return new Response("Unauthorized", { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const tep = await prisma.yeuCauTep.findUnique({ where: { id }, select: { nguoiTaiId: true, storedName: true, fileName: true, requestId: true } });
  if (!tep) return new Response("Not found", { status: 404 });
  let duocXem = tep.nguoiTaiId === user.id || user.role === "ADMIN";
  if (!duocXem && tep.requestId) {
    const yc = await prisma.materialRequest.findUnique({ where: { id: tep.requestId }, select: { vesselId: true } });
    duocXem = Boolean(yc && trongPhamVi(vesselScopeDayDu(user), yc.vesselId));
  }
  if (!duocXem) return new Response("Not found", { status: 404 });
  // storedName do máy sinh (yeu-cau-uuid.ext) — vẫn chặn đường dẫn lạ cho chắc.
  const safeName = path.basename(tep.storedName);
  let data: Buffer;
  try {
    data = await readFile(path.join(getUploadDir(), safeName));
  } catch {
    return new Response("File missing", { status: 404 });
  }
  const duoi = (safeName.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  const tenTai = encodeURIComponent(tep.fileName.replace(/[^\w.\-()\[\] ]+/g, "_"));
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": LOAI_NOI_DUNG[duoi] ?? "application/octet-stream",
      "Content-Disposition": `${duoi === ".pdf" ? "inline" : "attachment"}; filename*=UTF-8''${tenTai}`,
      "Content-Length": String(data.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
