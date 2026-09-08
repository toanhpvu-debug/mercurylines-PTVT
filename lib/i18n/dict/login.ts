import { tuDien } from "./_kieu";

/** Trang đăng nhập, trang tài khoản bị khóa, trang lỗi. */
export const login = tuDien(
  {
    email: "Email",
    matKhau: "Mật khẩu",
    hienMatKhau: "Hiện mật khẩu",
    anMatKhau: "Ẩn mật khẩu",
    dangNhap: "Đăng nhập",
    dangDangNhap: "Đang đăng nhập...",
    biKhoaTieuDe: "Tài khoản đang bị khóa",
    biKhoaNoiDung:
      "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được mở lại.",
    loiTieuDe: "Có lỗi xảy ra",
    loiNoiDung:
      "Ứng dụng gặp lỗi khi hiển thị trang này. Thử tải lại; nếu vẫn lỗi, báo quản trị viên.",
    thuLai: "Thử lại",
    veDashboard: "Về Dashboard",
  },
  {
    email: "Email",
    matKhau: "Password",
    hienMatKhau: "Show password",
    anMatKhau: "Hide password",
    dangNhap: "Sign in",
    dangDangNhap: "Signing in...",
    biKhoaTieuDe: "Account locked",
    biKhoaNoiDung:
      "Your account has been locked. Please contact the administrator to have it reactivated.",
    loiTieuDe: "Something went wrong",
    loiNoiDung:
      "The application hit an error while rendering this page. Try reloading; if it persists, tell the administrator.",
    thuLai: "Try again",
    veDashboard: "Back to Dashboard",
  }
);
