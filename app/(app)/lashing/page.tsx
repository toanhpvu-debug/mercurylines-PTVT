import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScope,
} from "@/lib/auth";
import LashingReportForm from "@/components/LashingReportForm";
import {
  LashingGearAddForm,
  LashingGearRow,
} from "@/components/LashingGearManager";

export const dynamic = "force-dynamic";

export default async function LashingPage({
  searchParams,
}: {
  searchParams: Promise<{ vessel?: string }>;
}) {
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  const canReport = ["ADMIN", "MASTER"].includes(user.role);
  const canManageGear = user.role === "ADMIN";

  const vessels = await prisma.vessel.findMany({
    where: vesselIdWhere(scope),
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  const { vessel: vesselParam } = await searchParams;
  const requestedId = Number(vesselParam);
  const selectedVessel =
    vessels.find((v) => v.id === requestedId) ?? vessels[0] ?? null;

  if (scope.unassigned || !selectedVessel) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-blue-950">Dụng cụ chằng buộc container</h2>
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          Bạn chưa được gán tàu phụ trách. Vui lòng liên hệ quản trị viên.
        </div>
      </div>
    );
  }

  const [gears, latestReport, reports] = await Promise.all([
    prisma.lashingGear.findMany({
      where: { vesselId: selectedVessel.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.lashingReport.findFirst({
      where: { vesselId: selectedVessel.id },
      orderBy: [{ reportDate: "desc" }, { id: "desc" }],
      include: { lines: true },
    }),
    prisma.lashingReport.findMany({
      where: { vesselId: selectedVessel.id },
      orderBy: [{ reportDate: "desc" }, { id: "desc" }],
      take: 24,
      include: { lines: true },
    }),
  ]);
  const lastLineByGear = new Map(
    (latestReport?.lines ?? []).map((line) => [line.gearId, line])
  );
  const defaultDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-blue-950">Dụng cụ chằng buộc container</h2>
        <p className="text-slate-600">
          Sổ trang bị chuẩn và báo cáo theo mẫu MLS-11-13
        </p>
      </div>

      {scope.all && (
        <form className="flex items-center gap-2">
          <select
            name="vessel"
            defaultValue={selectedVessel.id}
            className="rounded border p-2"
          >
            {vessels.map((vessel) => (
              <option key={vessel.id} value={vessel.id}>
                {vessel.code} - {vessel.name}
              </option>
            ))}
          </select>
          <button className="rounded border px-4 py-2 hover:bg-blue-50">
            Xem tàu
          </button>
        </form>
      )}

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <h3 className="mb-2 text-lg font-semibold">
          Danh mục trang bị — {selectedVessel.name}
        </h3>
        {canManageGear ? (
          <>
            <p className="mb-3 text-xs text-slate-500">
              Tên dụng cụ · Part No. · SL tối thiểu (full load) · Trang bị
              chuẩn
            </p>
            <div>
              {gears.map((gear) => (
                <LashingGearRow key={gear.id} gear={gear} />
              ))}
            </div>
            <LashingGearAddForm vesselId={selectedVessel.id} />
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">Dụng cụ</th>
                  <th className="p-2">Part No.</th>
                  <th className="p-2">SL tối thiểu</th>
                  <th className="p-2">Trang bị chuẩn</th>
                </tr>
              </thead>
              <tbody>
                {gears.map((gear) => (
                  <tr key={gear.id} className="border-b">
                    <td className="p-2 font-medium">{gear.name}</td>
                    <td className="p-2">{gear.partNo}</td>
                    <td className="p-2">{gear.minQty}</td>
                    <td className="p-2">{gear.standardQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canReport && gears.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <h3 className="mb-4 text-lg font-semibold">
            Lập báo cáo mới (kiểm đếm thực tế)
          </h3>
          <LashingReportForm
            vesselId={selectedVessel.id}
            defaultDate={defaultDate}
            gears={gears.map((gear) => {
              const last = lastLineByGear.get(gear.id);
              return {
                id: gear.id,
                name: gear.name,
                partNo: gear.partNo,
                minQty: gear.minQty,
                standardQty: gear.standardQty,
                lastInOrder: last?.inOrder ?? null,
                lastOutOfOrder: last?.outOfOrder ?? null,
              };
            })}
          />
        </div>
      )}

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <h3 className="mb-4 text-lg font-semibold">Báo cáo đã lập</h3>
        {reports.length === 0 ? (
          <p className="text-slate-600">Chưa có báo cáo nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">Ngày</th>
                  <th className="p-2">Chuyến</th>
                  <th className="p-2">Vị trí</th>
                  <th className="p-2">Người lập</th>
                  <th className="p-2">Bị hỏng (tổng)</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const damaged = report.lines.reduce(
                    (sum, line) => sum + line.outOfOrder,
                    0
                  );
                  return (
                    <tr key={report.id} className="border-b">
                      <td className="p-2">
                        {report.reportDate.toLocaleDateString("vi-VN")}
                      </td>
                      <td className="p-2">{report.voyageNo}</td>
                      <td className="p-2">{report.position}</td>
                      <td className="p-2">{report.createdBy}</td>
                      <td className="p-2">{damaged}</td>
                      <td className="p-2">
                        <Link
                          href={`/lashing/${report.id}`}
                          className="text-blue-700 hover:underline"
                        >
                          Xem / In
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
