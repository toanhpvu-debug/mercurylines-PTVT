import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Chuyển trang: « đầu · ‹ trước · Trang 2/8 · sau › · cuối ». Danh mục vật tư: ở dòng tiêu đề mỗi bộ
 * phận (nút chỉ có biểu tượng) và ở dòng cuối bộ phận (`coChu`: nút trước / sau ghi cả chữ — đọc hết
 * trang là bấm); hồ sơ tàu: bảng tồn kho. Là liên kết thường (dựng ở máy chủ) — `href` mang #neo để
 * trang mở lại đúng chỗ.
 */
export default function PhanTrang({
  trang,
  soTrang,
  href,
  nhan,
  coChu = false,
}: {
  trang: number;
  soTrang: number;
  href: (n: number) => string;
  nhan: { dau: string; truoc: string; sau: string; cuoi: string; trang: string };
  /** Nút trước / sau ghi cả chữ (dòng cuối bộ phận). */
  coChu?: boolean;
}) {
  const nut = (n: number, ten: string, Icon: LucideIcon, tat: boolean, chu?: "truoc" | "sau") => {
    const ghiChu = coChu && chu !== undefined;
    const noiDung = !ghiChu ? (
      <Icon className="size-4" />
    ) : chu === "truoc" ? (
      <>
        <Icon className="size-4" />
        {ten}
      </>
    ) : (
      <>
        {ten}
        <Icon className="size-4" />
      </>
    );
    const lop = cn(
      "inline-flex h-7 items-center justify-center gap-1 rounded-md",
      ghiChu ? "border border-[var(--border-subtle)] px-2" : "w-7"
    );
    return tat ? (
      <span aria-hidden="true" className={cn(lop, "text-[var(--text-muted)] opacity-40")}>
        {noiDung}
      </span>
    ) : (
      <Link
        href={href(n)}
        title={ten}
        aria-label={ten}
        className={cn(
          lop,
          "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
          // Dòng tiêu đề nền chìm → nhấn nổi; dòng cuối nền bảng → nhấn chìm.
          coChu ? "hover:bg-[var(--surface-sunken)]" : "hover:bg-[var(--surface-raised)]"
        )}
      >
        {noiDung}
      </Link>
    );
  };
  return (
    <nav aria-label={nhan.trang} className={cn("no-print inline-flex items-center text-xs font-medium", coChu ? "gap-1" : "gap-0.5")}>
      {nut(1, nhan.dau, ChevronsLeft, trang <= 1)}
      {nut(trang - 1, nhan.truoc, ChevronLeft, trang <= 1, "truoc")}
      <span className="tabular px-1.5 whitespace-nowrap text-[var(--text-secondary)]">{nhan.trang}</span>
      {nut(trang + 1, nhan.sau, ChevronRight, trang >= soTrang, "sau")}
      {nut(soTrang, nhan.cuoi, ChevronsRight, trang >= soTrang)}
    </nav>
  );
}
