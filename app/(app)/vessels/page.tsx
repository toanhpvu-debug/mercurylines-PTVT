import Link from "next/link";
import { prisma } from "@/lib/prisma";
import VesselForm from "@/components/VesselForm";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

// Chỉ giữ MÀU ở đây; nhãn trạng thái lấy từ từ điển (labels.vesselStatus_* cho
// ACTIVE/INACTIVE, vessels.trangThaiBaoDuong cho MAINTENANCE).
const mauTrangThai: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  MAINTENANCE: "bg-yellow-100 text-yellow-700",
  INACTIVE: "bg-slate-200 text-slate-600",
};

export default async function VesselsPage() {
  const user = await requireScopedUser();
  const { t, tTuDo } = await layT();
  const scope = vesselScopeDayDu(user);
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
  const nhanTrangThai = (ma: string) =>
    ma === "MAINTENANCE"
      ? t("vessels.trangThaiBaoDuong")
      : tTuDo(`labels.vesselStatus_${ma in mauTrangThai ? ma : "ACTIVE"}`);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-blue-950">
          {scope.all ? t("vessels.doiTauTieuDe") : t("vessels.tauCuaBan")}
        </h2>
        <p className="text-slate-600">{t("vessels.doiTauMoTa")}</p>
      </div>
      {scope.unassigned && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          {t("chung.chuaGanTau")}
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {canManage && (
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <h3 className="mb-4 text-lg font-semibold">
              {t("vessels.themTauMoi")}
            </h3>
            <VesselForm />
          </div>
        )}
        <div
          className={`rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 ${
            canManage ? "xl:col-span-2" : "xl:col-span-3"
          }`}
        >
          <h3 className="mb-4 text-lg font-semibold">
            {t("vessels.danhSachTau")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">{t("vessels.maTau")}</th>
                  <th className="p-2">{t("vessels.tenTau")}</th>
                  <th className="p-2">IMO</th>
                  <th className="p-2">{t("vessels.loaiTau")}</th>
                  <th className="p-2">{t("vessels.cotSoKho")}</th>
                  <th className="p-2">{t("vessels.cotSoYeuCau")}</th>
                  <th className="p-2">{t("chung.trangThai")}</th>
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
                          mauTrangThai[vessel.status] ?? mauTrangThai.ACTIVE
                        }`}
                      >
                        {nhanTrangThai(vessel.status)}
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
