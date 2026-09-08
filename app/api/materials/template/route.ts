import { NextResponse } from "next/server";

import { requireActiveRole } from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { LAP_YEU_CAU, VAN_HANH_TAU } from "@/lib/roles";
import { TEN_FILE_MAU, taoFileMauDanhMuc } from "@/lib/materialTemplate";

export const dynamic = "force-dynamic";

// Tải file Excel mẫu để thu thập danh mục vật tư ngoài tàu.
//
// Ai tải được: người trên tàu và văn phòng — cùng nhóm với người lập yêu cầu
// vật tư. File mẫu không chứa dữ liệu của công ty, chỉ có tiêu đề cột và hướng
// dẫn, nên không cần siết chặt hơn; nhưng vẫn phải đăng nhập, vì đây là tài
// liệu nội bộ và mọi đường dẫn khác của app cũng vậy.
export async function GET() {
  const { t } = await layT();
  const user = await requireActiveRole([
    ...new Set([...VAN_HANH_TAU, ...LAP_YEU_CAU, "TECH_MANAGER"]),
  ]);
  if (!user) {
    return NextResponse.json(
      { error: t("actionsModule.chuaDangNhap") },
      { status: 401 }
    );
  }

  const buffer = await taoFileMauDanhMuc();
  // Tên file chỉ có ký tự ASCII nên không cần filename* — nhưng vẫn ghi cả hai
  // cho đồng nhất với các route tải file khác.
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${TEN_FILE_MAU}"; filename*=UTF-8''${encodeURIComponent(TEN_FILE_MAU)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
