import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import DirectPurchaseForm from "@/components/DirectPurchaseForm";
import { layT } from "@/lib/i18n/server";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DirectPurchasePage() {
  const user = await requireScopedUser();
  const { t } = await layT();
  const scope = vesselScopeDayDu(user);
  if (!["ADMIN", "MASTER"].includes(user.role)) {
    redirect("/purchasing");
  }
  const [vessels, suppliers] = await Promise.all([
    prisma.vessel.findMany({
      where: vesselIdWhere(scope),
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/purchasing"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeft className="size-4" />
          {t("purchasing.quayLaiMuaSam")}
        </Link>
        <PageHeader
          title={t("purchasing.tieuDeTrucTiep")}
          subtitle={
            <>
              {t("purchasing.moTaTrucTiepDau")}{" "}
              <b>{t("purchasing.damRfq")}</b>{" "}
              {t("purchasing.moTaTrucTiepGiua")} <b>PO</b>{" "}
              {t("purchasing.moTaTrucTiepCuoi")}
            </>
          }
        />
      </div>

      <Card>
        <DirectPurchaseForm
          vessels={vessels.map((v) => ({
            id: v.id,
            label: `${v.code} — ${v.name}`,
          }))}
          suppliers={suppliers.map((s) => ({
            id: s.id,
            label: `${s.code} — ${s.name}`,
          }))}
        />
      </Card>
    </div>
  );
}
