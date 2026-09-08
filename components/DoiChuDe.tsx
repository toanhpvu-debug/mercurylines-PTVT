"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { COOKIE_CHU_DE, type ChuDe } from "@/lib/chuDe";

/**
 * Nút đổi chế độ sáng / tối.
 *
 * Đổi ngay trên trình duyệt (gắn/bỏ class `dark` ở <html>) để không phải tải
 * lại trang, và ghi cookie `theme` để lần mở sau server dựng đúng chế độ ngay
 * từ đầu. Trạng thái ban đầu nhận từ server (cùng cookie đó) chứ không đọc DOM
 * trong effect — hai bên luôn khớp nhau, không cần useEffect.
 */
export default function DoiChuDe({
  banDau,
  nhan,
}: {
  banDau: ChuDe;
  nhan: { sang: string; toi: string };
}) {
  const [toi, setToi] = useState(banDau === "dark");
  const doi = () => {
    const moi: ChuDe = toi ? "light" : "dark";
    document.documentElement.classList.toggle("dark", moi === "dark");
    document.cookie = `${COOKIE_CHU_DE}=${moi}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setToi(moi === "dark");
  };
  const label = toi ? nhan.sang : nhan.toi;
  return (
    <button
      type="button"
      onClick={doi}
      aria-label={label}
      title={label}
      className="rounded-lg border border-[var(--border-subtle)] p-2 text-[var(--text-secondary)] transition hover:bg-[var(--surface-sunken)]"
    >
      {toi ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
