"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useNgonNgu } from "@/lib/i18n/client";
import { NGON_NGU, TEN_NGON_NGU } from "@/lib/i18n/ngonNgu";

/**
 * Nút đổi ngôn ngữ VI | EN. Là thẻ <a> thường (không phải <Link>) để Next không
 * prefetch — prefetch một đường dẫn có tác dụng phụ (đặt cookie) là đổi ngôn
 * ngữ cho người ta dù họ chưa bấm.
 *
 * `toi` = kiểu nền tối (thanh bên); mặc định là kiểu nền sáng (trang đăng nhập).
 * Cần bọc trong <Suspense> ở nơi dùng vì đọc useSearchParams.
 */
export default function ChonNgonNgu({ toi }: { toi?: boolean }) {
  const { locale } = useNgonNgu();
  const pathname = usePathname() || "/";
  const sp = useSearchParams();
  const chuoi = sp?.toString();
  const next = encodeURIComponent(pathname + (chuoi ? `?${chuoi}` : ""));
  return (
    <div
      role="group"
      aria-label="Ngôn ngữ / Language"
      className={`inline-flex overflow-hidden rounded-lg text-xs font-semibold ring-1 ${
        toi ? "ring-white/20" : "ring-slate-300"
      }`}
    >
      {NGON_NGU.map((l) => {
        const dangChon = l === locale;
        return (
          <a
            key={l}
            href={`/api/ngon-ngu?lang=${l}&next=${next}`}
            aria-current={dangChon ? "true" : undefined}
            title={TEN_NGON_NGU[l]}
            className={`px-2.5 py-1 transition ${
              dangChon
                ? toi
                  ? "bg-sky-500/30 text-white"
                  : "bg-blue-700 text-white"
                : toi
                  ? "text-blue-100/80 hover:bg-white/10 hover:text-white"
                  : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {l.toUpperCase()}
          </a>
        );
      })}
    </div>
  );
}
