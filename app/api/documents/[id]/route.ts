import path from "path";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireActiveRole,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import { LAP_YEU_CAU } from "@/lib/roles";
import { ALLOWED_EXTENSIONS, fileExtension, getUploadDir } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  // Danh sách vai trò cứng ["ADMIN","MASTER","CREW"] là di sản từ thời hệ
  // thống chỉ có 3 vai trò. Nay có 11 chức danh: máy trưởng, đại phó, phó 2/3,
  // máy 2/3/4 đều TẢI LÊN / xem được ở giao diện, và quản lý kỹ thuật là người
  // soát chứng từ toàn đội. Chống xem chéo tàu vẫn do trongPhamVi() lo.
  const user = await requireActiveRole([...LAP_YEU_CAU, "TECH_MANAGER"]);
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  const scope = vesselScopeDayDu(user);
  const { id: idRaw } = await context.params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  }
  const doc = await prisma.reportDocument.findUnique({ where: { id } });
  if (!doc || !trongPhamVi(scope, doc.vesselId)) {
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
