import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import PaintImportForm from "@/components/PaintImportForm";

export const dynamic = "force-dynamic";

export default async function PaintImportPage() {
  const user = await requireScopedUser();
  const { t } = await layT();
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
          ← {t("paint.quayLaiDanhMuc")}
        </Link>
        <h2 className="text-2xl font-bold text-blue-950">
          {t("paint.nhapDanhMucTieuDe")}
        </h2>
        <p className="text-slate-600">{t("paint.nhapDanhMucMoTa")}</p>
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
          {t("paint.hoiTrungLap")}
        </p>
        <p>
          {t("paint.dapTrungLap1")} <b>{t("paint.dapTrungLapDam1")}</b>{" "}
          {t("paint.dapTrungLap2")} <b>{t("paint.dapTrungLapDam2")}</b>
          {t("paint.dapTrungLap3")}
        </p>
      </div>
    </div>
  );
}
