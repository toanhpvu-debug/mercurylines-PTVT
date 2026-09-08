import type { Metadata } from "next";
import "./globals.css";
import { NgonNguProvider } from "@/lib/i18n/client";
import { layNgonNgu, layT } from "@/lib/i18n/server";

// Tiêu đề tab và mô tả theo ngôn ngữ đang chọn (cookie `lang`).
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await layT();
  return { title: t("chung.tenApp"), description: t("chung.moTaApp") };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Ngôn ngữ đọc MỘT lần ở đây rồi trao xuống: <html lang> cho trình duyệt /
  // bộ đọc màn hình, và NgonNguProvider cho mọi client component. Server
  // component tự gọi layT() — cùng cache theo request nên không đọc cookie lại.
  const locale = await layNgonNgu();
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
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-slate-100" suppressHydrationWarning>
        <NgonNguProvider locale={locale}>{children}</NgonNguProvider>
      </body>
    </html>
  );
}
