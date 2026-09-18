"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useNgonNgu } from "@/lib/i18n/client";

/**
 * Nút thu gọn / mở rộng một bộ phận trong bảng danh mục.
 *
 * Bảng do server dựng, mỗi bộ phận là một <tbody>. Nút này nằm trong dòng tiêu
 * đề của bộ phận và bật/tắt thuộc tính data-thu-gon trên đúng <tbody> chứa nó;
 * CSS trong globals.css ẩn mọi dòng trừ dòng tiêu đề khi thuộc tính bật. Không
 * cần đưa cả bảng 600 dòng sang client chỉ để đóng mở — một cú click, một thuộc
 * tính DOM, xong.
 */
export default function NutThuGonNhom() {
  const { t } = useNgonNgu();
  const [thuGon, setThuGon] = useState(false);
  return (
    <button
      type="button"
      aria-expanded={!thuGon}
      title={thuGon ? t("materials.moRongNhom") : t("materials.thuGonNhom")}
      onClick={(e) => {
        const tbody = (e.currentTarget as HTMLElement).closest("tbody");
        if (!tbody) return;
        const moi = !thuGon;
        tbody.toggleAttribute("data-thu-gon", moi);
        setThuGon(moi);
      }}
      className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
    >
      <ChevronDown className={`size-4 transition-transform ${thuGon ? "-rotate-90" : ""}`} />
      {thuGon ? t("materials.moRongNhom") : t("materials.thuGonNhom")}
    </button>
  );
}
