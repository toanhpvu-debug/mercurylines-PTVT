import Link from "next/link";
import { prisma } from "@/lib/prisma";
import VesselForm from "@/components/VesselForm";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScope,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const statusBadges: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Hoạt động", className: "bg-green-100 text-green-700" },
  MAINTENANCE: {
    label: "Bảo dưỡng",
    className: "bg-yellow-100 text-yellow-700",
  },
  INACTIVE: {
    label: "Ngừng khai thác",
    className: "bg-slate-200 text-slate-600",
  },
};

export default async function VesselsPage() {
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  const canManage = user.role === "ADMIN";
  const vessels = await prisma.vessel.findMany({
    where: vesselIdWhere(scope),
    orderBy: { code: "asc" },
    include: {
      _count: {
        select: {
          warehouses: true,
          materialRequests: true,
        },
      },
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-blue-950">
          {scope.all ? "Đội tàu Mercury Lines" : "Tàu của bạn"}
        </h2>
        <p className="text-slate-600">Quản lý tàu và thông tin cơ bản</p>
      </div>
      {scope.unassigned && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          Bạn chưa được gán tàu phụ trách. Vui lòng liên hệ quản trị viên.
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {canManage && (
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <h3 className="mb-4 text-lg font-semibold">Thêm tàu mới</h3>
            <VesselForm />
          </div>
        )}
        <div
          className={`rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 ${
            canManage ? "xl:col-span-2" : "xl:col-span-3"
          }`}
        >
          <h3 className="mb-4 text-lg font-semibold">Danh sách tàu</h3>
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">Mã tàu</th>
                  <th className="p-2">Tên tàu</th>
                  <th className="p-2">IMO</th>
                  <th className="p-2">Loại tàu</th>
                  <th className="p-2">Số kho</th>
                  <th className="p-2">Số yêu cầu</th>
                  <th className="p-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {vessels.map((vessel) => (
                  <tr key={vessel.id} className="border-b hover:bg-slate-50">
                    <td className="p-2 font-medium">
                      <Link
                        href={`/vessels/${vessel.id}`}
                        className="text-blue-700 hover:underline"
                      >
                        {vessel.code}
                      </Link>
                    </td>
                    <td className="p-2">
                      <Link
                        href={`/vessels/${vessel.id}`}
                        className="text-blue-700 hover:underline"
                      >
                        {vessel.name}
                      </Link>
                    </td>
                    <td className="p-2">{vessel.imo}</td>
                    <td className="p-2">{vessel.vesselType}</td>
                    <td className="p-2">{vessel._count.warehouses}</td>
                    <td className="p-2">{vessel._count.materialRequests}</td>
                    <td className="p-2">
                      <span
                        className={`rounded px-2 py-1 ${
                          (statusBadges[vessel.status] ?? statusBadges.ACTIVE)
                            .className
                        }`}
                      >
                        {(statusBadges[vessel.status] ?? statusBadges.ACTIVE)
                          .label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
