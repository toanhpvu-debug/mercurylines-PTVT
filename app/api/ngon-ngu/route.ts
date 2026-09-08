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
  // Location TƯƠNG ĐỐI, tự đặt tay thay vì NextResponse.redirect().
  //
  // NextResponse.redirect() bắt buộc một URL tuyệt đối, mà URL đó phải dựng từ
  // `req.url`. Sau Traefik, `req.url` là địa chỉ NỘI BỘ của container
  // (localhost:3000) chứ không phải tên miền người dùng đang mở, nên trên bản
  // chạy thật header Location thành "https://localhost:3000/dashboard" — bấm
  // đổi ngôn ngữ là trình duyệt lạc sang máy của chính người dùng. Đường dẫn
  // tương đối hợp lệ theo RFC 7231 và mọi trình duyệt đều hiểu, lại không cần
  // biết tên miền nên đúng ở cả máy nội bộ, sslip.io lẫn tên miền thật.
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: next },
  });
  res.cookies.set(COOKIE_NGON_NGU, lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
  return res;
}
