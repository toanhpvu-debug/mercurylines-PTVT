import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import DirectPurchaseForm from "@/components/DirectPurchaseForm";
import { layT } from "@/lib/i18n/server";

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
    <div className="space-y-6">
      <div>
        <Link
          href="/purchasing"
          className="text-sm text-blue-700 hover:underline"
        >
          {t("purchasing.quayLaiMuaSam")}
        </Link>
        <h2 className="text-2xl font-bold text-blue-950">
          {t("purchasing.tieuDeTrucTiep")}
        </h2>
        <p className="text-slate-600">
          {t("purchasing.moTaTrucTiepDau")}{" "}
          <b>{t("purchasing.damRfq")}</b>{" "}
          {t("purchasing.moTaTrucTiepGiua")} <b>PO</b>{" "}
          {t("purchasing.moTaTrucTiepCuoi")}
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
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
      </div>
    </div>
  );
}
