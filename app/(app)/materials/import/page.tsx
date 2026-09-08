import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
  vesselWhere,
} from "@/lib/auth";
import MaterialImportForm from "@/components/MaterialImportForm";
import { layT } from "@/lib/i18n/server";

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
    <div className="space-y-6">
      <div>
        <Link
          href="/materials"
          className="text-sm text-blue-700 hover:underline"
        >
          ← {t("materials.quayLaiDanhMuc")}
        </Link>
        <h2 className="text-2xl font-bold text-blue-950">
          {t("materials.nhapDanhMucTuFile")}
        </h2>
        <p className="text-slate-600">{t("materials.nhapMoTa")}</p>
      </div>

      {/* Chưa có sẵn file danh mục thì phải có cái để phát cho tàu điền. Đặt
          TRƯỚC ô upload vì đó là bước đi trước: thu thập rồi mới nhập. */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-blue-950">
              {t("materials.mauTieuDe")}
            </h3>
            <p className="mt-1 text-sm text-slate-700">
              {t("materials.mauCoSheet")} <b>{t("chung.phuTung")}</b>
              {t("materials.mauSheetKhac")}{" "}
              <b>{t("materials.mauSheetHuongDan")}</b>{" "}
              {t("materials.mauGiaiThichCot")}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {t("materials.mauKhopSan")}{" "}
              <b>{t("materials.mauDungDoiTen")}</b>{" "}
              {t("materials.mauChiDienBenDuoi")}
            </p>
          </div>
          <a
            href="/api/materials/template"
            className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            ⬇ {t("materials.taiFileMau")}
          </a>
        </div>
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
