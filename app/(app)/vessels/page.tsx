import Link from "next/link";
import { Plus, Ship } from "lucide-react";
import { prisma } from "@/lib/prisma";
import VesselForm from "@/components/VesselForm";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";
import {
  Badge,
  Card,
  CardHeader,
  Notice,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
  type Tone,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const LINK = "text-brand-700 hover:underline dark:text-brand-300";

// Chỉ giữ TONE ở đây; nhãn trạng thái lấy từ từ điển (labels.vesselStatus_* cho
// ACTIVE/INACTIVE, vessels.trangThaiBaoDuong cho MAINTENANCE).
const TONE_TRANG_THAI: Record<string, Tone> = {
  ACTIVE: "success",
  MAINTENANCE: "warning",
  INACTIVE: "muted",
};

export default async function VesselsPage() {
  const user = await requireScopedUser();
  const { t, tTuDo } = await layT();
  const scope = vesselScopeDayDu(user);
  const canManage = user.role === "ADMIN";
  const vessels = await prisma.vessel.findMany({
    where: vesselIdWhere(scope),
    orderBy: { code: "asc" },
    include: {
      _count: {
        select: {
          warehouses: true,
          materialRequests: true,
        },
      },
    },
  });
  const nhanTrangThai = (ma: string) =>
    ma === "MAINTENANCE"
      ? t("vessels.trangThaiBaoDuong")
      : tTuDo(`labels.vesselStatus_${ma in TONE_TRANG_THAI ? ma : "ACTIVE"}`);
  return (
    <div className="space-y-5">
      <PageHeader
        title={scope.all ? t("vessels.doiTauTieuDe") : t("vessels.tauCuaBan")}
        subtitle={t("vessels.doiTauMoTa")}
      />
      {scope.unassigned && (
        <Notice tone="warning">{t("chung.chuaGanTau")}</Notice>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {canManage && (
          <Card>
            <CardHeader
              icon={<Plus className="size-4" />}
              title={t("vessels.themTauMoi")}
            />
            <VesselForm />
          </Card>
        )}
        <Card className={cn(canManage ? "xl:col-span-2" : "xl:col-span-3")}>
          <CardHeader
            icon={<Ship className="size-4" />}
            title={t("vessels.danhSachTau")}
          />
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("vessels.maTau")}</Th>
                  <Th>{t("vessels.tenTau")}</Th>
                  <Th>IMO</Th>
                  <Th>{t("vessels.loaiTau")}</Th>
                  <Th align="right">{t("vessels.cotSoKho")}</Th>
                  <Th align="right">{t("vessels.cotSoYeuCau")}</Th>
                  <Th>{t("chung.trangThai")}</Th>
                </tr>
              </thead>
              <tbody>
                {vessels.map((vessel) => (
                  <Tr
                    key={vessel.id}
                    className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                  >
                    <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                      <Link href={`/vessels/${vessel.id}`} className={LINK}>
                        {vessel.code}
                      </Link>
                    </Td>
                    <Td className="font-medium">
                      <Link href={`/vessels/${vessel.id}`} className={LINK}>
                        {vessel.name}
                      </Link>
                    </Td>
                    <Td className="font-display text-xs tracking-wide whitespace-nowrap text-[var(--text-secondary)]">
                      {vessel.imo}
                    </Td>
                    <Td className="text-[var(--text-secondary)]">
                      {vessel.vesselType}
                    </Td>
                    <Td align="right">{vessel._count.warehouses}</Td>
                    <Td align="right">{vessel._count.materialRequests}</Td>
                    <Td>
                      <Badge
                        tone={TONE_TRANG_THAI[vessel.status] ?? "success"}
                        dot
                      >
                        {nhanTrangThai(vessel.status)}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>
    </div>
  );
}
