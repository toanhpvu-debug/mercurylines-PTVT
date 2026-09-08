import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
  vesselWhere,
} from "@/lib/auth";
import MaterialImportForm from "@/components/MaterialImportForm";
import { layT } from "@/lib/i18n/server";
import { Card, PageHeader, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MaterialImportPage() {
  const user = await requireScopedUser();
  const { t } = await layT();
  const scope = vesselScopeDayDu(user);
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
    <div className="space-y-5">
      <div>
        <Link
          href="/materials"
          className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeft className="size-4" />
          {t("materials.quayLaiDanhMuc")}
        </Link>
        <PageHeader
          title={t("materials.nhapDanhMucTuFile")}
          subtitle={t("materials.nhapMoTa")}
        />
      </div>

      {/* Chưa có sẵn file danh mục thì phải có cái để phát cho tàu điền. Đặt
          TRƯỚC ô upload vì đó là bước đi trước: thu thập rồi mới nhập. */}
      <div className="rounded-xl border border-brand-500/30 bg-brand-500/8 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex max-w-2xl items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-700 dark:text-brand-400">
              <FileSpreadsheet className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                {t("materials.mauTieuDe")}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {t("materials.mauCoSheet")}{" "}
                <b className="text-[var(--text-primary)]">{t("chung.phuTung")}</b>
                {t("materials.mauSheetKhac")}{" "}
                <b className="text-[var(--text-primary)]">
                  {t("materials.mauSheetHuongDan")}
                </b>{" "}
                {t("materials.mauGiaiThichCot")}
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {t("materials.mauKhopSan")}{" "}
                <b className="text-[var(--text-primary)]">
                  {t("materials.mauDungDoiTen")}
                </b>{" "}
                {t("materials.mauChiDienBenDuoi")}
              </p>
            </div>
          </div>
          <a href="/api/materials/template" className={buttonClass("primary")}>
            <Download className="size-4" />
            {t("materials.taiFileMau")}
          </a>
        </div>
      </div>

      <Card>
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
      </Card>
    </div>
  );
}
