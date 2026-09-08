"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useNgonNgu } from "@/lib/i18n/client";
import { NGON_NGU, TEN_NGON_NGU } from "@/lib/i18n/ngonNgu";
import { cn } from "@/lib/cn";

/**
 * Nút đổi ngôn ngữ VI | EN — cùng dáng với app Quản lý thuyền viên.
 *
 * Là thẻ <a> thường (không phải <Link>) để Next không prefetch — prefetch một
 * đường dẫn có tác dụng phụ (đặt cookie) là đổi ngôn ngữ cho người ta dù họ
 * chưa bấm. Màu lấy từ biến theo chế độ nên dùng được ở cả thanh trên lẫn trang
 * đăng nhập. Cần bọc trong <Suspense> ở nơi dùng vì đọc useSearchParams.
 */
export default function ChonNgonNgu() {
  const { locale } = useNgonNgu();
  const pathname = usePathname() || "/";
  const sp = useSearchParams();
  const chuoi = sp?.toString();
  const next = encodeURIComponent(pathname + (chuoi ? `?${chuoi}` : ""));
  return (
    <div
      role="group"
      aria-label="Ngôn ngữ / Language"
      className="flex overflow-hidden rounded-lg border border-[var(--border-subtle)] text-xs font-semibold"
    >
      {NGON_NGU.map((l) => {
        const dangChon = l === locale;
        return (
          <a
            key={l}
            href={`/api/ngon-ngu?lang=${l}&next=${next}`}
            aria-current={dangChon ? "true" : undefined}
            title={TEN_NGON_NGU[l]}
            className={cn(
              "px-2.5 py-1.5 uppercase transition",
              dangChon
                ? "bg-brand-700 text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
            )}
          >
            {l}
          </a>
        );
      })}
    </div>
  );
}
