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
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-100">{children}</body>
    </html>
  );
}
