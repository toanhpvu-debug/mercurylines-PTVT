import path from "path";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveRole, vesselScope } from "@/lib/auth";
import { ALLOWED_EXTENSIONS, fileExtension, getUploadDir } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireActiveRole(["ADMIN", "MASTER", "CREW"]);
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  const scope = vesselScope(user);
  const { id: idRaw } = await context.params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  }
  const doc = await prisma.reportDocument.findUnique({ where: { id } });
  if (!doc || (!scope.all && doc.vesselId !== scope.vesselId)) {
    return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  }
  let data: Buffer;
  try {
    data = await readFile(path.join(getUploadDir(), doc.storedName));
  } catch {
    return NextResponse.json(
      { error: "File không còn trên máy chủ." },
      { status: 404 }
    );
  }
  const allowed = ALLOWED_EXTENSIONS[fileExtension(doc.storedName)];
  const disposition = allowed?.inline ? "inline" : "attachment";
  const asciiName =
    doc.fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") ||
    `document-${doc.id}`;
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": allowed?.mime ?? "application/octet-stream",
      "Content-Length": String(data.length),
      "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
