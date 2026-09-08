import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session-crypto";
import { prisma } from "@/lib/prisma";
import { ghiNhatKy } from "@/lib/audit";

/**
 * Chặn cửa trước (default deny) và ghi nhật ký thao tác.
 *
 * Từ Next 16, proxy chạy trên Node.js runtime nên gọi được Prisma ngay tại đây
 * — nhờ vậy nhật ký bắt được MỌI request làm thay đổi dữ liệu, kể cả server
 * action mà người viết mã quên ghi log, và cả request bị chặn vì chưa đăng
 * nhập. Đặt việc ghi log ở từng action thì sớm muộn cũng sót chỗ.
 */

/**
 * Đường dẫn chỉ dành cho một số vai trò. Đây là LỚP CHẶN THỨ HAI: từng trang và
 * từng server action vẫn tự kiểm tra quyền của mình. Chặn ở đây để gõ thẳng URL
 * không lọt vào được, chặn ở trong để thao tác không lọt qua được.
 */
const DUONG_DAN_THEO_VAI_TRO: { tien_to: string; vaiTro: string[] }[] = [
  { tien_to: "/users", vaiTro: ["ADMIN"] },
  { tien_to: "/audit", vaiTro: ["ADMIN"] },
];

const PHUONG_THUC_GHI = ["POST", "PUT", "PATCH", "DELETE"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Đổi ngôn ngữ giao diện (GET, chỉ đặt cookie `lang`) phải chạy được cả khi
  // CHƯA đăng nhập — trang login có nút VI | EN — nên đi thẳng, không qua cửa.
  if (pathname === "/api/ngon-ngu") {
    return NextResponse.next();
  }
  const session = await decrypt(request.cookies.get("session")?.value);
  const ghiDuLieu = PHUONG_THUC_GHI.includes(request.method);

  if (pathname === "/login") {
    // Lần đăng nhập (kể cả sai mật khẩu) vẫn phải để lại dấu vết: dò mật khẩu
    // là thứ đầu tiên người ta muốn thấy khi soát lại một sự cố.
    if (ghiDuLieu) {
      await nhatKyRequest(request, null, "dang-nhap");
    }
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (ghiDuLieu) {
      await nhatKyRequest(request, null, "chua-dang-nhap", "TU_CHOI");
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Vai trò lấy từ DATABASE chứ không từ JWT. JWT chỉ được cấp lại lúc đăng
  // nhập nên vai trò trong đó có thể cũ tới 7 ngày, trong khi cả layout lẫn
  // Sidebar đều đọc vai trò mới từ database. Hai nguồn lệch nhau thì menu hiện
  // mục "Người dùng" mà bấm vào lại bị đá về /dashboard, lặp vô hạn.
  const nguoiDung = await docNguoiDung(session.userId);
  const vaiTroThat = nguoiDung?.role ?? session.role;

  // Khóa tài khoản phải có hiệu lực NGAY, kể cả khi phiên còn hạn.
  if (nguoiDung && !nguoiDung.isActive && pathname !== "/locked") {
    await nhatKyRequest(request, session, "tai-khoan-bi-khoa", "TU_CHOI", nguoiDung);
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Tài khoản đang bị khóa." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/locked", request.url));
  }

  const hanChe = DUONG_DAN_THEO_VAI_TRO.find(
    (x) => pathname === x.tien_to || pathname.startsWith(x.tien_to + "/")
  );
  if (hanChe && !hanChe.vaiTro.includes(vaiTroThat)) {
    await nhatKyRequest(request, session, "khong-du-quyen", "TU_CHOI", nguoiDung);
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Không đủ quyền." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (ghiDuLieu) {
    await nhatKyRequest(request, session, undefined, "OK", nguoiDung);
  }
  return NextResponse.next();
}

type NguoiDungProxy = {
  role: string;
  isActive: boolean;
  email: string;
  vesselId: number | null;
};

/** Đọc vai trò / trạng thái khóa / email / tàu hiện tại. Một truy vấn dùng
 * chung cho cả việc gác cửa lẫn việc ghi nhật ký. */
async function docNguoiDung(userId: number): Promise<NguoiDungProxy | null> {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true, email: true, vesselId: true },
    });
  } catch {
    // Database hỏng thì không tự ý nâng quyền: trả null để bên gọi rơi về
    // vai trò trong JWT, vốn hẹp hơn hoặc bằng.
    return null;
  }
}

async function nhatKyRequest(
  request: NextRequest,
  session: { userId: number; role: string } | null,
  action?: string,
  ketQua: "OK" | "TU_CHOI" | "LOI" = "OK",
  nguoiDung?: NguoiDungProxy | null
) {
  // Email, vai trò và tàu lấy từ database chứ không từ JWT: JWT có thể được cấp
  // từ trước khi người này đổi tàu, mà nhật ký phải ghi đúng lúc thao tác.
  // Bên gọi thường đã đọc sẵn bản ghi này rồi, truyền vào để khỏi truy vấn
  // lần hai cho cùng một request.
  let u = nguoiDung ?? null;
  if (session && !u) {
    u = await docNguoiDung(session.userId);
  }
  const email = u?.email ?? null;
  const vesselId = u?.vesselId ?? null;
  await ghiNhatKy({
    userId: session?.userId ?? null,
    email,
    role: u?.role ?? session?.role ?? null,
    vesselId,
    method: request.method,
    path: request.nextUrl.pathname,
    // Next gửi kèm mã server action ở header này; không có thì là request
    // thường (API route, submit form).
    action: action ?? request.headers.get("next-action") ?? "request",
    ketQua,
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
