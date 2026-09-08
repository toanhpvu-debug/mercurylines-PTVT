import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mercury Lines Materials",
  description: "Hệ thống quản lý vật tư đội tàu Mercury Lines",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // suppressHydrationWarning ở <html> và <body>: nhiều tiện ích mở rộng của
  // trình duyệt (chặn quảng cáo, kiểm tra chính tả, đổi giao diện) chèn thêm
  // class hay thuộc tính data-* vào hai thẻ này TRƯỚC khi React kịp gắn vào
  // DOM. React thấy DOM khác với bản nó dựng ra nên báo "hydration mismatch" —
  // đúng cái class "mdl-js" đang bị báo.
  //
  // Đây là lỗi ở phía máy người dùng chứ không phải ở mã nguồn: mỗi máy cài
  // tiện ích khác nhau, không sửa được từ phía app. Cờ này chỉ áp cho THUỘC
  // TÍNH CỦA CHÍNH hai thẻ đó, không lan xuống nội dung bên trong — nghĩa là
  // sai lệch thật sự trong ứng dụng vẫn báo bình thường.
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-100" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
