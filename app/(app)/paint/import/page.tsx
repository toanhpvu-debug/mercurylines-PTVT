import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CircleHelp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import PaintImportForm from "@/components/PaintImportForm";
import { Card, CardHeader, PageHeader } from "@/components/ui";

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
    <div className="space-y-5">
      <div>
        <Link
          href="/paint/products"
          className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeft className="size-4" />
          {t("paint.quayLaiDanhMuc")}
        </Link>
        <PageHeader
          title={t("paint.nhapDanhMucTieuDe")}
          subtitle={t("paint.nhapDanhMucMoTa")}
        />
      </div>

      <Card>
        <PaintImportForm
          vessels={vessels.map((v) => ({
            id: v.id,
            label: `${v.code} — ${v.name}`,
          }))}
        />
      </Card>

      <Card>
        <CardHeader
          icon={<CircleHelp className="size-4" />}
          title={t("paint.hoiTrungLap")}
        />
        <p className="text-sm text-[var(--text-secondary)]">
          {t("paint.dapTrungLap1")}{" "}
          <b className="text-[var(--text-primary)]">{t("paint.dapTrungLapDam1")}</b>{" "}
          {t("paint.dapTrungLap2")}{" "}
          <b className="text-[var(--text-primary)]">{t("paint.dapTrungLapDam2")}</b>
          {t("paint.dapTrungLap3")}
        </p>
      </Card>
    </div>
  );
}
