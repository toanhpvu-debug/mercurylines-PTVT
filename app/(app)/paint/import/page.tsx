import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import PaintImportForm from "@/components/PaintImportForm";

export const dynamic = "force-dynamic";

export default async function PaintImportPage() {
  const user = await requireScopedUser();
  if (!["ADMIN", "MASTER"].includes(user.role)) {
    redirect("/paint");
  }
  const scope = vesselScopeDayDu(user);
  const vessels = await prisma.vessel.findMany({
    where: vesselIdWhere(scope),
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/paint/products"
          className="text-sm text-blue-700 hover:underline"
        >
          ← Quay lại danh mục sơn
        </Link>
        <h2 className="text-2xl font-bold text-blue-950">
          Nhập danh mục sơn từ file
        </h2>
        <p className="text-slate-600">
          Nạp nhanh danh mục sơn từ bảng của hãng (Jotun, International,
          Chugoku...) thay vì gõ tay từng loại.
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <PaintImportForm
          vessels={vessels.map((v) => ({
            id: v.id,
            label: `${v.code} — ${v.name}`,
          }))}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="mb-1 font-semibold text-slate-900">
          Nhập lại cùng một file có sinh trùng không?
        </p>
        <p>
          Không. Sơn được ghép theo <b>tên</b> (không phân biệt hoa thường): tên
          đã có thì chỉ <b>bổ sung những ô còn trống</b>, không ghi đè thông tin
          bạn đã chỉnh trong app. Nên mỗi khi hãng cập nhật bảng, cứ nhập đè lên.
        </p>
      </div>
    </div>
  );
}
