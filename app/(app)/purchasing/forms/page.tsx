import Link from "next/link";
import { redirect } from "next/navigation";
import { Anchor, ArrowLeft, FilePlus, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import VesselFormStandardRow from "@/components/VesselFormStandardRow";
import {
  FormStandardAddForm,
  FormStandardEditForm,
  FormStandardRowActions,
} from "@/components/FormStandardManager";
import { layT } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function VesselFormsPage() {
  const user = await requireScopedUser();
  const { t } = await layT();
  const scope = vesselScopeDayDu(user);
  const canManage = user.role === "ADMIN";
  if (!["ADMIN", "MASTER"].includes(user.role)) {
    redirect("/purchasing");
  }
  const [vessels, allStandards] = await Promise.all([
    prisma.vessel.findMany({
      where: vesselIdWhere(scope),
      orderBy: { code: "asc" },
    }),
    prisma.formStandard.findMany({ orderBy: { code: "asc" } }),
  ]);
  const activeStandards = allStandards.filter((s) => s.isActive);
  const stdByCode = new Map(allStandards.map((s) => [s.code, s]));
  const standardOptions = activeStandards.map((s) => ({
    key: s.code,
    label: s.label,
  }));
  const usageByCode = new Map<string, number>();
  for (const v of vessels) {
    usageByCode.set(
      v.formStandard,
      (usageByCode.get(v.formStandard) ?? 0) + 1
    );
  }

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
          title={t("purchasing.tieuDeBieuMau")}
          subtitle={t("purchasing.moTaBieuMau")}
        />
      </div>

      {/* Quản lý danh sách biểu mẫu */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {canManage && (
          <Card>
            <CardHeader
              icon={<FilePlus className="size-4" />}
              title={t("purchasing.themBieuMauMoi")}
            />
            <FormStandardAddForm />
          </Card>
        )}
        <Card className={canManage ? "xl:col-span-2" : "xl:col-span-3"}>
          <CardHeader
            icon={<FileText className="size-4" />}
            title={t("purchasing.danhSachBieuMau", { n: allStandards.length })}
          />
          <div className="space-y-3">
            {allStandards.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "rounded-lg border border-[var(--border-subtle)] p-4",
                  !s.isActive && "bg-[var(--surface-sunken)] opacity-70"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge tone="brand">
                        <span className="font-display text-xs tracking-wide">
                          {s.code}
                        </span>
                      </Badge>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {s.label}
                      </span>
                      {s.isActive ? (
                        <Badge tone="success" dot>
                          {t("labels.active_true")}
                        </Badge>
                      ) : (
                        <Badge tone="muted" dot>
                          {t("labels.active_false")}
                        </Badge>
                      )}
                      <span className="text-xs text-[var(--text-muted)]">
                        {t("purchasing.soTauDangGan", {
                          n: usageByCode.get(s.code) ?? 0,
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-primary)]">
                      {s.companyName}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {s.address}
                    </p>
                    {s.repAddress && (
                      <p className="text-xs text-[var(--text-secondary)]">
                        {s.repAddress}
                      </p>
                    )}
                    <p className="text-xs text-[var(--text-muted)]">
                      {[
                        s.tel ? `Tel: ${s.tel}` : null,
                        s.email,
                        s.website,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap items-start gap-2">
                      <FormStandardEditForm
                        standard={{
                          id: s.id,
                          code: s.code,
                          label: s.label,
                          companyName: s.companyName,
                          address: s.address,
                          repAddress: s.repAddress,
                          tel: s.tel,
                          email: s.email,
                          website: s.website,
                        }}
                      />
                      <FormStandardRowActions id={s.id} isActive={s.isActive} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Gán biểu mẫu cho tàu */}
      <Card>
        <CardHeader
          icon={<Anchor className="size-4" />}
          title={t("purchasing.ganBieuMauChoTau")}
        />
        <TableWrap>
          <Table dense>
            <thead>
              <tr>
                <Th>{t("purchasing.cotMaTau")}</Th>
                <Th>{t("purchasing.cotTenTau")}</Th>
                <Th>IMO</Th>
                <Th>{t("purchasing.cotBieuMauHienTai")}</Th>
                {canManage && <Th>{t("purchasing.cotDoiBieuMau")}</Th>}
              </tr>
            </thead>
            <tbody>
              {vessels.map((v) => {
                const std = stdByCode.get(v.formStandard);
                return (
                  <Tr
                    key={v.id}
                    className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                  >
                    <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                      {v.code}
                    </Td>
                    <Td>{v.name}</Td>
                    <Td className="font-display text-xs tracking-wide">
                      {v.imo}
                    </Td>
                    <Td>
                      <Badge tone={std ? "brand" : "danger"} dot>
                        {std
                          ? std.label
                          : `${v.formStandard} (${t("purchasing.khongTonTai")})`}
                      </Badge>
                    </Td>
                    {canManage && (
                      <Td>
                        <VesselFormStandardRow
                          id={v.id}
                          formStandard={v.formStandard}
                          hullNo={v.hullNo}
                          standards={standardOptions}
                        />
                      </Td>
                    )}
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </div>
  );
}
