"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Làm mới dữ liệu trang (router.refresh) mỗi `giay` giây trong lúc còn gắn
 * trên trang — dùng khi một việc chạy nền ở máy chủ (AI đọc phiếu giao) và
 * trang cần hiện tiến độ rồi tự hiện kết quả khi xong. Trang server ngừng vẽ
 * thành phần này thì việc làm mới cũng dừng.
 */
export default function TuLamMoi({ giay = 5 }: { giay?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), Math.max(2, giay) * 1000);
    return () => window.clearInterval(id);
  }, [router, giay]);
  return null;
}
