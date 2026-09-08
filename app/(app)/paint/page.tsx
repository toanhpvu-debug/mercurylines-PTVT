import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function PaintOverviewPage() {
  const user = await requireScopedUser();
  const { t, ngay } = await layT();
  const scope = vesselScopeDayDu(user);
  const canManageCatalog = ["ADMIN", "MASTER"].includes(user.role);

  if (scope.unassigned) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-blue-950">
          {t("paint.tieuDe")}
        </h2>
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          {t("chung.chuaGanTau")}
        </div>
      </div>
    );
  }

  // Hai truy vấn độc lập — chạy song song thay vì nối đuôi (bớt một vòng chờ DB).
  const [vessels, productCount] = await Promise.all([
    prisma.vessel.findMany({
      where: vesselIdWhere(scope),
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        _count: { select: { paintAreas: true, paintJobs: true } },
        paintStocks: {
          select: { quantity: true, minQty: true, product: { select: { uom: true } } },
        },
        paintJobs: {
          orderBy: { jobDate: "desc" },
          take: 1,
          select: { jobDate: true, paintedM2: true },
        },
      },
    }),
    prisma.paintProduct.count({ where: { isActive: true } }),
  ]);

  const fleetLow = vessels.reduce(
    (n, v) =>
      n + v.paintStocks.filter((s) => s.minQty > 0 && s.quantity < s.minQty).length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-blue-950">
            {t("paint.tieuDe")}
          </h2>
          <p className="text-slate-600">{t("paint.moTa")}</p>
        </div>
        {canManageCatalog && (
          <Link
            href="/paint/products"
            className="rounded border border-blue-300 bg-white px-4 py-2 text-sm text-blue-800 hover:bg-blue-50"
          >
            {t("paint.danhMucSonN", { n: productCount })}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {t("chung.tau")}
          </p>
          <p className="text-2xl font-bold text-blue-950">{vessels.length}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {t("paint.loaiSonDangDung")}
          </p>
          <p className="text-2xl font-bold text-blue-950">{productCount}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {t("paint.sonDuoiDinhMuc")}
          </p>
          <p
            className={`text-2xl font-bold ${
              fleetLow > 0 ? "text-red-600" : "text-blue-950"
            }`}
          >
            {fleetLow}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
        <p className="mb-3 font-semibold text-blue-950">{t("paint.theoTau")}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-blue-900 text-left text-white">
              <tr>
                <th className="p-2">{t("paint.cotMaTau")}</th>
                <th className="p-2">{t("paint.cotTenTau")}</th>
                <th className="p-2 text-right">{t("paint.cotKhuVuc")}</th>
                <th className="p-2 text-right">{t("paint.cotLoaiCoTon")}</th>
                <th className="p-2 text-right">{t("paint.cotDuoiDinhMuc")}</th>
                <th className="p-2 text-right">{t("paint.cotLanThiCong")}</th>
                <th className="p-2">{t("paint.cotGanNhat")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {vessels.map((v) => {
                const stocked = v.paintStocks.filter((s) => s.quantity > 0).length;
                const low = v.paintStocks.filter(
                  (s) => s.minQty > 0 && s.quantity < s.minQty
                ).length;
                const last = v.paintJobs[0];
                return (
                  <tr key={v.id} className="hover:bg-blue-50/50">
                    <td className="p-2 font-mono text-xs">
                      <Link
                        href={`/paint/${v.id}`}
                        className="text-blue-700 hover:underline"
                      >
                        {v.code}
                      </Link>
                    </td>
                    <td className="p-2">
                      <Link
                        href={`/paint/${v.id}`}
                        className="font-medium text-blue-900 hover:underline"
                      >
                        {v.name}
                      </Link>
                    </td>
                    <td className="p-2 text-right">{v._count.paintAreas}</td>
                    <td className="p-2 text-right">{stocked}</td>
                    <td className="p-2 text-right">
                      {low > 0 ? (
                        <span className="rounded bg-red-100 px-2 py-0.5 font-semibold text-red-700">
                          {low}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2 text-right">{v._count.paintJobs}</td>
                    <td className="p-2 text-slate-600">
                      {last
                        ? `${ngay(last.jobDate)}${
                            last.paintedM2
                              ? ` · ${t("paint.nM2", { n: last.paintedM2 })}`
                              : ""
                          }`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
