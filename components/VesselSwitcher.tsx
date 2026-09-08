import Link from "next/link";
import { Anchor } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselIdWhere, vesselScope } from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui";

/**
 * Dải nút chọn tàu, đặt ở đầu mọi trang gắn với MỘT tàu.
 *
 * Trước đây muốn xem tàu khác trong cùng nghiệp vụ thì phải quay ra trang tổng
 * quan rồi bấm vào tàu kia — hai bước cho một việc làm liên tục (so sánh tồn
 * giữa các tàu, đi lần lượt từng tàu để kiểm tra).
 *
 * `duongDan` nhận id tàu và trả về đường dẫn của CHÍNH nghiệp vụ đang xem, nên
 * bấm sang tàu khác vẫn ở đúng trang đó chứ không nhảy về đầu.
 *
 * Chỉ hiện những tàu người dùng được xem: người gán tàu chỉ có một tàu nên
 * component tự ẩn — một nút chọn với đúng một lựa chọn là nhiễu.
 */
export default async function VesselSwitcher({
  hienTai,
  duongDan,
  nhan,
}: {
  hienTai: number;
  duongDan: (vesselId: number) => string;
  /** Nhãn đứng trước dải nút; bỏ trống thì lấy "Chuyển tàu:" theo ngôn ngữ. */
  nhan?: string;
}) {
  const user = await requireScopedUser();
  const { t } = await layT();
  const scope = vesselScope(user);
  const vessels = await prisma.vessel.findMany({
    where: vesselIdWhere(scope),
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, status: true },
  });

  if (vessels.length <= 1) return null;

  return (
    <Card padded={false} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      <span className="text-sm font-medium text-[var(--text-secondary)]">
        {nhan ?? t("inventory.chuyenTau")}
      </span>
      {vessels.map((v) => {
        const dangXem = v.id === hienTai;
        return (
          <Link
            key={v.id}
            href={duongDan(v.id)}
            title={`${v.code} — ${v.name}`}
            aria-current={dangXem ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition",
              "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none",
              dangXem
                ? "bg-brand-700 font-medium text-white"
                : "bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              v.status !== "ACTIVE" && "opacity-60"
            )}
          >
            <Anchor className="size-3.5 shrink-0" />
            <span className="font-display text-xs tracking-wide">{v.code}</span>
            <span className="ml-1 hidden text-xs opacity-80 sm:inline">
              {v.name}
            </span>
          </Link>
        );
      })}
    </Card>
  );
}
