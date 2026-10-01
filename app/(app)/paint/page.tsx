import Link from "next/link";
import {
  AlertTriangle,
  Anchor,
  ClipboardList,
  Droplets,
  Paintbrush,
  Send,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
  vesselWhere,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { LAP_YEU_CAU, coQuanLySon } from "@/lib/roles";
import { cn } from "@/lib/cn";
import {
  Badge,
  Card,
  CardHeader,
  Notice,
  PageHeader,
  Stat,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
  buttonClass,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const LINK = "text-brand-700 hover:underline dark:text-brand-300";

export default async function PaintOverviewPage() {
  const user = await requireScopedUser();
  const { t, ngay } = await layT();
  const scope = vesselScopeDayDu(user);
  const canManageCatalog = ["ADMIN", "MASTER"].includes(user.role);

  if (scope.unassigned) {
    return (
      <div className="space-y-5">
        <PageHeader title={t("paint.tieuDe")} />
        <Notice tone="warning">{t("chung.chuaGanTau")}</Notice>
      </div>
    );
  }

  // Hai truy vấn độc lập — chạy song song thay vì nối đuôi (bớt một vòng chờ DB).
  const [vessels, productCount, choDuyetSon] = await Promise.all([
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
    // Yêu cầu sơn còn đang chờ duyệt (cấp tàu / công ty) của từng tàu.
    prisma.materialRequest.groupBy({
      by: ["vesselId"],
      where: {
        ...vesselWhere(scope),
        status: { in: ["PENDING_MASTER", "PENDING_OFFICE"] },
        items: { some: { paintProductId: { not: null } } },
      },
      _count: { _all: true },
    }),
  ]);
  const choDuyetTheoTau = new Map(choDuyetSon.map((g) => [g.vesselId, g._count._all]));
  // Lập yêu cầu sơn: người lập yêu cầu VÀ quản phần sơn của đúng tàu (đại phó,
  // thuyền trưởng, máy trưởng của tàu; quản trị).
  const coLapSon = (vesselId: number) => coQuanLySon(user, vesselId) && LAP_YEU_CAU.includes(user.role);
  const tauLapDuoc = vessels.filter((v) => coLapSon(v.id));

  const fleetLow = vessels.reduce(
    (n, v) =>
      n + v.paintStocks.filter((s) => s.minQty > 0 && s.quantity < s.minQty).length,
    0
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("paint.tieuDe")}
        subtitle={t("paint.moTa")}
        action={
          <>
            {/* Đại phó / thuyền trưởng một tàu: vào thẳng trang yêu cầu sơn của tàu mình. */}
            {tauLapDuoc.length === 1 && (
              <Link href={`/paint/${tauLapDuoc[0].id}/yeu-cau`} className={buttonClass("primary")}>
                <Send className="size-4" />
                {t("paint.ycNutLap")}
              </Link>
            )}
            {canManageCatalog && (
              <Link href="/paint/products" className={buttonClass("secondary")}>
                <ClipboardList className="size-4" />
                {t("paint.danhMucSonN", { n: productCount })}
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          icon={<Anchor className="size-4" />}
          label={t("chung.tau")}
          value={vessels.length}
          tone="brand"
        />
        <Stat
          icon={<Droplets className="size-4" />}
          label={t("paint.loaiSonDangDung")}
          value={productCount}
        />
        <Stat
          icon={<AlertTriangle className="size-4" />}
          label={t("paint.sonDuoiDinhMuc")}
          value={fleetLow}
          tone={fleetLow > 0 ? "danger" : "success"}
        />
      </div>

      <Card>
        <CardHeader
          icon={<Paintbrush className="size-4" />}
          title={t("paint.theoTau")}
        />
        <TableWrap>
          <Table dense>
            <thead>
              <tr>
                <Th>{t("paint.cotMaTau")}</Th>
                <Th>{t("paint.cotTenTau")}</Th>
                <Th align="right">{t("paint.cotKhuVuc")}</Th>
                <Th align="right">{t("paint.cotLoaiCoTon")}</Th>
                <Th align="right">{t("paint.cotDuoiDinhMuc")}</Th>
                <Th align="right">{t("paint.cotLanThiCong")}</Th>
                <Th>{t("paint.cotGanNhat")}</Th>
                <Th>{t("paint.cotYeuCauSon")}</Th>
              </tr>
            </thead>
            <tbody>
              {vessels.map((v) => {
                const stocked = v.paintStocks.filter((s) => s.quantity > 0).length;
                const low = v.paintStocks.filter(
                  (s) => s.minQty > 0 && s.quantity < s.minQty
                ).length;
                const last = v.paintJobs[0];
                return (
                  <Tr
                    key={v.id}
                    className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                  >
                    <Td className="whitespace-nowrap">
                      <Link
                        href={`/paint/${v.id}`}
                        className={cn("font-display text-xs tracking-wide", LINK)}
                      >
                        {v.code}
                      </Link>
                    </Td>
                    <Td>
                      <Link
                        href={`/paint/${v.id}`}
                        className={cn("font-medium", LINK)}
                      >
                        {v.name}
                      </Link>
                    </Td>
                    <Td align="right">{v._count.paintAreas}</Td>
                    <Td align="right">{stocked}</Td>
                    <Td align="right">
                      {low > 0 ? (
                        <Badge tone="danger">{low}</Badge>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </Td>
                    <Td align="right">{v._count.paintJobs}</Td>
                    <Td>
                      <span className="text-[var(--text-secondary)]">
                        {last
                          ? `${ngay(last.jobDate)}${
                              last.paintedM2
                                ? ` · ${t("paint.nM2", { n: last.paintedM2 })}`
                                : ""
                            }`
                          : "—"}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-2">
                        {coLapSon(v.id) && (
                          <Link href={`/paint/${v.id}/yeu-cau`} className={LINK}>
                            {t("paint.ycLapNgan")}
                          </Link>
                        )}
                        {(choDuyetTheoTau.get(v.id) ?? 0) > 0 && (
                          <Link href={`/requests?vessel=${v.id}`}>
                            <Badge tone="warning">{t("paint.ycChoDuyetN", { n: choDuyetTheoTau.get(v.id) ?? 0 })}</Badge>
                          </Link>
                        )}
                      </div>
                    </Td>
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
