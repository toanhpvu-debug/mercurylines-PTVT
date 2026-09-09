import Link from "next/link";
import { Anchor, ClipboardList, FileText, Printer, Ship } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  chonDuocTau,
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import LashingReportForm from "@/components/LashingReportForm";
import {
  LashingGearAddForm,
  LashingGearRow,
} from "@/components/LashingGearManager";
import { layT } from "@/lib/i18n/server";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
  buttonClass,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LashingPage({
  searchParams,
}: {
  searchParams: Promise<{ vessel?: string }>;
}) {
  const user = await requireScopedUser();
  const { t, ngay } = await layT();
  const scope = vesselScopeDayDu(user);
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
      <div className="space-y-5">
        <PageHeader
          title={t("vessels.changBuocTieuDe")}
          subtitle={t("vessels.changBuocMoTa")}
        />
        <Notice tone="warning">{t("chung.chuaGanTau")}</Notice>
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
    <div className="space-y-5">
      <PageHeader
        title={t("vessels.changBuocTieuDe")}
        subtitle={t("vessels.changBuocMoTa")}
        action={
          chonDuocTau(scope) ? (
            <form className="flex flex-wrap items-end gap-2">
              <Field label={t("chung.tau")} className="w-56">
                <Select name="vessel" defaultValue={selectedVessel.id}>
                  {vessels.map((vessel) => (
                    <option key={vessel.id} value={vessel.id}>
                      {vessel.code} - {vessel.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                type="submit"
                variant="primary"
                icon={<Ship className="size-4" />}
              >
                {t("vessels.xemTau")}
              </Button>
            </form>
          ) : undefined
        }
      />

      <Card>
        <CardHeader
          icon={<Anchor className="size-4" />}
          title={t("vessels.danhMucTrangBi", { ten: selectedVessel.name })}
          subtitle={canManageGear ? t("vessels.goiYCotTrangBi") : undefined}
        />
        {canManageGear ? (
          <>
            <div>
              {gears.map((gear) => (
                <LashingGearRow key={gear.id} gear={gear} />
              ))}
            </div>
            <LashingGearAddForm vesselId={selectedVessel.id} />
          </>
        ) : gears.length === 0 ? (
          <EmptyState
            icon={<Anchor className="size-5" />}
            title={t("vessels.chuaCoDungCu")}
          />
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("vessels.cotDungCu")}</Th>
                  <Th>Part No.</Th>
                  <Th align="right">{t("vessels.slToiThieu")}</Th>
                  <Th align="right">{t("vessels.trangBiChuan")}</Th>
                </tr>
              </thead>
              <tbody>
                {gears.map((gear) => (
                  <Tr
                    key={gear.id}
                    className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                  >
                    <Td className="font-medium">{gear.name}</Td>
                    <Td className="font-display text-xs tracking-wide whitespace-nowrap text-[var(--text-secondary)]">
                      {gear.partNo}
                    </Td>
                    <Td align="right">{gear.minQty}</Td>
                    <Td align="right">{gear.standardQty}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {canReport && gears.length > 0 && (
        <Card>
          <CardHeader
            icon={<ClipboardList className="size-4" />}
            title={t("vessels.lapBaoCaoMoi")}
          />
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
        </Card>
      )}

      <Card>
        <CardHeader
          icon={<FileText className="size-4" />}
          title={t("vessels.baoCaoDaLap")}
        />
        {reports.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title={t("vessels.chuaCoBaoCao")}
          />
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("chung.ngay")}</Th>
                  <Th>{t("vessels.cotChuyen")}</Th>
                  <Th>{t("vessels.cotViTri")}</Th>
                  <Th>{t("vessels.cotNguoiLap")}</Th>
                  <Th align="right">{t("vessels.cotBiHongTong")}</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const damaged = report.lines.reduce(
                    (sum, line) => sum + line.outOfOrder,
                    0
                  );
                  return (
                    <Tr
                      key={report.id}
                      className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                    >
                      <Td className="tabular whitespace-nowrap">
                        {ngay(report.reportDate)}
                      </Td>
                      <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                        {report.voyageNo}
                      </Td>
                      <Td className="text-[var(--text-secondary)]">
                        {report.position}
                      </Td>
                      <Td>{report.createdBy}</Td>
                      <Td align="right">
                        {/* Còn nguyên vẹn hay đang hỏng là thứ người đọc dò
                            trước tiên trong bảng — tô màu theo trạng thái. */}
                        <Badge tone={damaged > 0 ? "danger" : "success"}>
                          {damaged}
                        </Badge>
                      </Td>
                      <Td>
                        <Link
                          href={`/lashing/${report.id}`}
                          className={buttonClass("secondary", "sm")}
                        >
                          <Printer className="size-4" />
                          {t("vessels.xemIn")}
                        </Link>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
