"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Làm mới dữ liệu trang (router.refresh) mỗi `giay` giây trong lúc còn gắn
 * trên trang — dùng khi một việc chạy nền ở máy chủ (AI đọc phiếu giao) và
 * trang cần hiện tiến độ rồi tự hiện kết quả khi xong. Trang server ngừng vẽ
 * thành phần này thì việc làm mới cũng dừng.
 *
 * Tab đang ẩn (người dùng chuyển sang tab khác trong lúc chờ AI đọc) thì không
 * làm mới — mỗi lần là tải lại cả trang (đo 2026-10-02: ≥ 150 KB/phút/tab ở
 * /requests), vô ích khi không ai nhìn và tốn đường truyền vệ tinh. Quay lại
 * tab là làm mới ngay một lần.
 */
export default function TuLamMoi({ giay = 5 }: { giay?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) router.refresh();
    }, Math.max(2, giay) * 1000);
    const khiHien = () => {
      if (!document.hidden) router.refresh();
    };
    document.addEventListener("visibilitychange", khiHien);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", khiHien);
    };
  }, [router, giay]);
  return null;
}
