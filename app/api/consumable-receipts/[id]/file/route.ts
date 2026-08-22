import path from "path";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coQuanLyNhienLieu, requireActiveRole, vesselScope } from "@/lib/auth";
import { VAN_HANH_HOA_CHAT } from "@/lib/roles";
import { getUploadDir } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Tải bản gốc đính kèm của một phiếu nhận (BDN scan / phiếu giao).
 *
 * Xem được là đủ quyền theo phạm vi tàu — không đòi quyền GHI: sĩ quan trực ca
 * cần đối chiếu số liệu với bản gốc mà không nhất thiết được ghi phiếu. Nhưng
 * vẫn phải đúng tàu của mình.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireActiveRole([...VAN_HANH_HOA_CHAT, "TECH_MANAGER"]);
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  const { id: idRaw } = await context.params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  }
  const receipt = await prisma.consumableReceipt.findUnique({ where: { id } });
  if (!receipt || !receipt.attachStored) {
    return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  }
  const scope = vesselScope(user);
  const trongPhamVi =
    scope.all ||
    scope.vesselId === receipt.vesselId ||
    coQuanLyNhienLieu(user, receipt.vesselId);
  if (!trongPhamVi) {
    return NextResponse.json({ error: "Không tìm thấy." }, { status: 404 });
  }

  // Tên file lưu là UUID do hệ thống sinh, nhưng vẫn ghép đường dẫn tường minh
  // để không có cách nào thoát ra ngoài thư mục upload.
  const ten = path.basename(receipt.attachStored);
  let data: Buffer;
  try {
    data = await readFile(path.join(getUploadDir(), ten));
  } catch {
    return NextResponse.json(
      { error: "File không còn trên máy chủ." },
      { status: 404 }
    );
  }
  const tenHienThi = receipt.attachName ?? `${receipt.docNo}.pdf`;
  const asciiName =
    tenHienThi.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") ||
    `phieu-${receipt.id}.pdf`;
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(data.length),
      "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(tenHienThi)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
