import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { TaiTruocPhong } from "@/components/TaiTruocPhong";
import { COOKIE_CHU_DE, docChuDe } from "@/lib/chuDe";
import { NgonNguProvider } from "@/lib/i18n/client";
import { layNgonNgu, layT } from "@/lib/i18n/server";

// Tiêu đề tab và mô tả theo ngôn ngữ đang chọn (cookie `lang`).
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await layT();
  return {
    title: t("chung.tenApp"),
    description: t("chung.moTaApp"),
    icons: { icon: "/favicon.svg" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Ngôn ngữ và chế độ sáng/tối đọc MỘT lần ở đây rồi trao xuống. Class `dark`
  // gắn ngay từ server để trang không lóe nền sáng rồi mới đổi sang tối
  // (xem lib/chuDe.ts). Server component tự gọi layT() — cùng cache theo
  // request nên không đọc cookie lại.
  const [locale, kho] = await Promise.all([layNgonNgu(), cookies()]);
  const chuDe = docChuDe(kho.get(COOKIE_CHU_DE)?.value);
  // suppressHydrationWarning ở <html> và <body>: nhiều tiện ích mở rộng của
  // trình duyệt (chặn quảng cáo, kiểm tra chính tả, đổi giao diện) chèn thêm
  // class hay thuộc tính data-* vào hai thẻ này TRƯỚC khi React kịp gắn vào
  // DOM. Cờ này chỉ áp cho THUỘC TÍNH CỦA CHÍNH hai thẻ đó, không lan xuống
  // nội dung bên trong — sai lệch thật sự trong ứng dụng vẫn báo bình thường.
  return (
    <html
      lang={locale}
      className={chuDe === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <body className="min-h-screen" suppressHydrationWarning>
        {/* Không vẽ gì; chỉ ghi thẻ preload phông vào <head> lúc dựng HTML. */}
        <TaiTruocPhong />
        <NgonNguProvider locale={locale}>{children}</NgonNguProvider>
      </body>
    </html>
  );
}
