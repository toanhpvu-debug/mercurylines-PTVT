"use client";

import { useEffect } from "react";

/**
 * Tự tải lại trang khi trình duyệt đang chạy BẢN CŨ của app sau một lần cập
 * nhật máy chủ (Dokploy deploy trong lúc người dùng đang mở trang).
 *
 * Dấu hiệu: mọi nút gọi server action đều vỡ với "Server Action ... was not
 * found on the server" — mã hành động của bản cũ không còn trong bản mới. Chỉ
 * có tải lại trang mới hết; người dùng không biết điều đó nên thấy như app
 * hỏng. Ở đây bắt lỗi ở cấp cửa sổ (error / unhandledrejection) và tải lại
 * MỘT lần; cờ trong sessionStorage chặn vòng lặp nếu lỗi vẫn còn sau khi tải.
 *
 * Nơi tự bắt được lỗi (trang duyệt phiếu giao) còn giữ ô đang sửa trước khi
 * tải lại — xem components/PhieuGiaoDuyet.tsx.
 */
export const LOI_BAN_CU = /failed-to-find-server-action|was not found on the server|Failed to find Server Action/i;
const CO_DA_TAI_LAI = "mercury.da-tai-lai-ban-cu";

export function laLoiBanCu(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : String((e as { message?: string })?.message ?? "");
  return LOI_BAN_CU.test(msg);
}

/** Tải lại một lần; trả về false nếu vừa tải lại trong 15 giây (tránh lặp vô hạn). */
export function taiLaiBanMoi(): boolean {
  try {
    const truoc = Number(window.sessionStorage.getItem(CO_DA_TAI_LAI) ?? 0);
    if (Date.now() - truoc < 15_000) return false;
    window.sessionStorage.setItem(CO_DA_TAI_LAI, String(Date.now()));
  } catch {
    /* sessionStorage bị chặn: vẫn tải lại một lần */
  }
  window.location.reload();
  return true;
}

export default function TuTaiLaiKhiBanCu() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (laLoiBanCu(e.error ?? e.message)) taiLaiBanMoi();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (laLoiBanCu(e.reason)) taiLaiBanMoi();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
