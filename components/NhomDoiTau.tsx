"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type TauTrongMenu = {
  id: number;
  code: string;
  name: string;
};

/**
 * Mục "Đội tàu" ở thanh bên: bấm vào thì sổ xuống danh sách từng tàu.
 *
 * Trước đây phải vào trang Đội tàu rồi mới bấm tiếp vào tên tàu — hai lần tải
 * trang chỉ để xem một con tàu, trong khi người dùng gần như luôn biết sẵn
 * mình cần tàu nào. Sổ thẳng ở thanh bên thì đi một bước.
 *
 * Đang đứng ở trang của một con tàu thì danh sách mở sẵn, để thấy ngay mình
 * đang ở đâu trong đội tàu.
 */
export default function NhomDoiTau({ vessels }: { vessels: TauTrongMenu[] }) {
  const pathname = usePathname();
  const dangOTrangTau = pathname?.startsWith("/vessels") ?? false;
  const [mo, setMo] = useState(dangOTrangTau);

  const kieuDong =
    "group flex items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 text-sm text-blue-100/90 transition hover:border-sky-400 hover:bg-white/10 hover:text-white";

  // Không có tàu nào trong phạm vi (tài khoản chưa được gán tàu) thì giữ
  // nguyên một dòng liên kết thường — sổ ra một danh sách rỗng chỉ gây rối.
  if (vessels.length === 0) {
    return (
      <Link href="/vessels" className={kieuDong}>
        <span className="w-5 text-center text-base opacity-80 group-hover:opacity-100">
          ⚓
        </span>
        Đội tàu
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setMo((truoc) => !truoc)}
        aria-expanded={mo}
        className={`${kieuDong} w-full text-left`}
      >
        <span className="w-5 text-center text-base opacity-80 group-hover:opacity-100">
          ⚓
        </span>
        <span className="flex-1">Đội tàu</span>
        <span
          className={`text-[10px] opacity-70 transition-transform ${
            mo ? "rotate-90" : ""
          }`}
          aria-hidden
        >
          ▶
        </span>
      </button>

      {mo && (
        <div className="mt-1 space-y-0.5 border-l border-white/10 pl-3 ml-5">
          <Link
            href="/vessels"
            className="block rounded px-2 py-1.5 text-xs text-sky-300/90 transition hover:bg-white/10 hover:text-white"
          >
            Tất cả đội tàu →
          </Link>
          {vessels.map((tau) => {
            const dangXem = pathname === `/vessels/${tau.id}`;
            return (
              <Link
                key={tau.id}
                href={`/vessels/${tau.id}`}
                className={`block rounded px-2 py-1.5 text-xs transition hover:bg-white/10 hover:text-white ${
                  dangXem
                    ? "bg-white/10 font-medium text-white"
                    : "text-blue-100/80"
                }`}
              >
                <span className="text-sky-300/80">{tau.code}</span> — {tau.name}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
