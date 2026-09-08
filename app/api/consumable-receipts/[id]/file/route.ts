import path from "path";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  coQuanLyNhienLieu,
  requireActiveRole,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { XIN_CAP_NHIEN_LIEU } from "@/lib/roles";
import { getUploadDir } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Tải bản gốc đính kèm của một phiếu nhận (BDN scan / phiếu giao).
 *
 * Xem được là đủ quyền theo phạm vi tàu — không đòi quyền GHI: sĩ quan trực ca
 * cần đối chiếu số liệu với bản gốc mà không nhất thiết được ghi phiếu. Nhưng
 * vẫn phải đúng tàu của mình.
 *
 * Vì vậy cổng vai trò lấy XIN_CAP_NHIEN_LIEU chứ không phải VAN_HANH_HOA_CHAT:
 * nhóm sau là quyền GHI (chỉ thuyền trưởng, máy trưởng, đại phó), nên Máy 2/3/4
 * vẫn THẤY link "Xem bản gốc" ở trang chi tiết tàu — trang đó mở cho mọi người
 * trong phạm vi tàu — mà bấm vào thì nhận 401, đúng cái bẫy giao diện hứa một
 * đằng máy chủ trả một nẻo.
 *
 * Thêm TECH_MANAGER vì quản lý kỹ thuật ở bờ là người đối chiếu số liệu bunker
 * với BDN scan, mà chức danh đó không nằm trong XIN_CAP_NHIEN_LIEU.
 *
 * Danh sách này được soi lại ở app/(app)/consumables/[id]/page.tsx (biến
 * coXemBanGoc) để quyết định có hiện link hay không. Sửa cổng ở đây thì phải
 * sửa cả bên đó, nếu không lại lệch: hoặc hiện link rồi trả 401, hoặc giấu link
 * của người máy chủ vẫn cho tải.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { t } = await layT();
  const user = await requireActiveRole([...XIN_CAP_NHIEN_LIEU, "TECH_MANAGER"]);
  if (!user) {
    // Nhánh này gộp cả "chưa đăng nhập" lẫn "đăng nhập rồi nhưng sai chức
    // danh", nên KHÔNG nói "Chưa đăng nhập.": link mở ra tab mới, người đang
    // đăng nhập hẳn hoi mà đọc câu đó sẽ tưởng phiên hết hạn và đi đăng nhập
    // lại mãi không xong. Nói đúng cái thiếu là quyền.
    return NextResponse.json(
      { error: t("actionsModule.taiLieu_khongXemDuocBanGoc") },
      { status: 401 }
    );
  }
  const { id: idRaw } = await context.params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: t("chung.khongTimThay") },
      { status: 404 }
    );
  }
  const receipt = await prisma.consumableReceipt.findUnique({ where: { id } });
  if (!receipt || !receipt.attachStored) {
    return NextResponse.json(
      { error: t("chung.khongTimThay") },
      { status: 404 }
    );
  }
  // Phải dùng trongPhamVi() chứ không so tay: người phụ trách từ 2 tàu trở lên
  // được xếp vào scope.vesselIds (mảng) và scope.vesselId khi đó là null, nên
  // phép so sánh trực tiếp luôn sai và họ nhận 404 ở mọi phiếu.
  const scope = vesselScopeDayDu(user);
  const duocXem =
    trongPhamVi(scope, receipt.vesselId) ||
    coQuanLyNhienLieu(user, receipt.vesselId);
  if (!duocXem) {
    return NextResponse.json(
      { error: t("chung.khongTimThay") },
      { status: 404 }
    );
  }

  // Tên file lưu là UUID do hệ thống sinh, nhưng vẫn ghép đường dẫn tường minh
  // để không có cách nào thoát ra ngoài thư mục upload.
  const ten = path.basename(receipt.attachStored);
  let data: Buffer;
  try {
    data = await readFile(path.join(getUploadDir(), ten));
  } catch {
    return NextResponse.json(
      { error: t("actionsModule.fileKhongConTrenMayChu") },
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
