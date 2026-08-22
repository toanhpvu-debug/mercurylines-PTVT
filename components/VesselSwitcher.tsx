import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselIdWhere, vesselScope } from "@/lib/auth";

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
  nhan = "Chuyển tàu:",
}: {
  hienTai: number;
  duongDan: (vesselId: number) => string;
  nhan?: string;
}) {
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  const vessels = await prisma.vessel.findMany({
    where: vesselIdWhere(scope),
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, status: true },
  });

  if (vessels.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-blue-100">
      <span className="text-sm font-medium text-slate-600">{nhan}</span>
      {vessels.map((v) => {
        const dangXem = v.id === hienTai;
        return (
          <Link
            key={v.id}
            href={duongDan(v.id)}
            title={`${v.code} — ${v.name}`}
            aria-current={dangXem ? "page" : undefined}
            className={`rounded px-3 py-1.5 text-sm ${
              dangXem
                ? "bg-blue-700 font-medium text-white"
                : v.status === "ACTIVE"
                  ? "bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-900"
                  : "bg-slate-50 text-slate-400 hover:bg-slate-100"
            }`}
          >
            ⚓ {v.code}
            <span className="ml-1 hidden text-xs opacity-80 sm:inline">
              {v.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
