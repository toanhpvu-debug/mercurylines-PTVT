import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NGON_NGU, docNgonNgu } from "@/lib/i18n/ngonNgu";

/**
 * Đổi ngôn ngữ giao diện: GET /api/ngon-ngu?lang=en&next=/materials
 *
 * Đặt cookie `lang` (1 năm) rồi quay về trang đang xem. Là GET (không phải
 * server action) vì hai lẽ: chạy được cả khi CHƯA đăng nhập (trang login có
 * nút đổi ngôn ngữ), và không bị proxy.ts ghi nhật ký như một request ghi dữ
 * liệu. proxy.ts cho đường dẫn này đi thẳng, không qua cửa đăng nhập.
 *
 * `next` chỉ nhận đường dẫn tương đối trong app ("/..." và không phải "//...")
 * — không bao giờ chuyển hướng ra ngoài theo tham số người khác gửi tới.
 */
export async function GET(req: NextRequest) {
  const lang = docNgonNgu(req.nextUrl.searchParams.get("lang"));
  const nextRaw = req.nextUrl.searchParams.get("next") ?? "/";
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/\\")
      ? nextRaw
      : "/";
  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(COOKIE_NGON_NGU, lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
  return res;
}
