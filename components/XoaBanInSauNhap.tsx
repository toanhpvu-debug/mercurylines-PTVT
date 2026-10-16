"use client";

import { useEffect } from "react";
import { xoaBanInCuaTau } from "@/lib/thietYeu";

/**
 * Vừa nhập tệp MLS-11-04 (trang có ?daNhap=): danh mục / số đã đổi theo tệp nên bản in sửa
 * tay cũ của tàu trên máy này không còn khớp — bỏ đi. Đặt TRƯỚC bảng báo cáo trong cây:
 * effect này chạy trước khi bảng đọc bản in đã lưu.
 */
export default function XoaBanInSauNhap({ vesselId }: { vesselId: number }) {
  useEffect(() => {
    xoaBanInCuaTau(vesselId);
  }, [vesselId]);
  return null;
}
