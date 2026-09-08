/**
 * Kiểm tra cấu hình lúc KHỞI ĐỘNG, không đợi tới lúc người dùng bấm nút.
 *
 * Lý do: `SESSION_SECRET` rỗng không làm app chết lúc chạy lên — trang /login
 * vẫn hiện bình thường. Nó chỉ vỡ đúng vào giây người ta gõ đúng mật khẩu rồi
 * bấm Đăng nhập, và vỡ ở chỗ khó đoán nhất (`encrypt()` ném ra ngoài server
 * action, màn hình đỏ nói về tồn kho / mã trùng). Không ai vào được app mà
 * cũng không ai biết vì sao. Thà từ chối khởi động, in một câu rõ ràng.
 *
 * `.env.example` giao sẵn dòng `SESSION_SECRET=""` nên đây là lỗi máy mới rất
 * dễ gặp, chứ không phải trường hợp hiếm.
 */
const TOI_THIEU = 32;

export function register() {
  // Chỉ kiểm một lần ở runtime Node. Middleware chạy runtime edge, kiểm lại ở
  // đó chỉ lặp cùng một thông báo.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length >= TOI_THIEU) return;

  const lyDo = secret
    ? `chỉ dài ${secret.length} ký tự, cần tối thiểu ${TOI_THIEU}`
    : "đang rỗng";

  throw new Error(
    [
      "",
      "══════════════════════════════════════════════════════════════",
      ` SESSION_SECRET chưa được cấu hình (${lyDo}).`,
      "",
      " Không có khóa này thì KHÔNG TÀI KHOẢN NÀO đăng nhập được:",
      " màn hình sẽ báo một lỗi hoàn toàn khác, rất khó lần ra.",
      "",
      " Cách sửa — sinh một khóa rồi dán vào file .env:",
      "",
      '   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      "",
      '   SESSION_SECRET="<dán chuỗi vừa sinh vào đây>"',
      "",
      " Đổi khóa này sẽ làm mọi phiên đang đăng nhập bị đăng xuất.",
      "══════════════════════════════════════════════════════════════",
      "",
    ].join("\n")
  );
}
