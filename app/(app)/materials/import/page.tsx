import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScope,
  vesselWhere,
} from "@/lib/auth";
import MaterialImportForm from "@/components/MaterialImportForm";

export const dynamic = "force-dynamic";

export default async function MaterialImportPage() {
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  if (!["ADMIN", "MASTER"].includes(user.role)) {
    redirect("/materials");
  }
  const [vessels, warehouses] = await Promise.all([
    prisma.vessel.findMany({
      where: vesselIdWhere(scope),
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.warehouse.findMany({
      where: vesselWhere(scope),
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, vesselId: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/materials"
          className="text-sm text-blue-700 hover:underline"
        >
          ← Quay lại danh mục vật tư
        </Link>
        <h2 className="text-2xl font-bold text-blue-950">
          Nhập danh mục từ file
        </h2>
        <p className="text-slate-600">
          Upload file kiểm kê / danh mục theo form công ty — vật tư &amp; phụ
          tùng được tự động thêm vào danh mục của tàu đã chọn (kèm tồn kho nếu
          file có cột R.O.B), giúp kiểm soát nhanh toàn bộ vật tư đội tàu.
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <MaterialImportForm
          vessels={vessels.map((v) => ({
            id: v.id,
            label: `${v.code} — ${v.name}`,
          }))}
          warehouses={warehouses
            .filter((w) => w.vesselId !== null)
            .map((w) => ({
              id: w.id,
              vesselId: w.vesselId as number,
              label: `${w.code} — ${w.name}`,
            }))}
        />
      </div>
    </div>
  );
}
