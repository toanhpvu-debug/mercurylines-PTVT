import Link from "next/link";
import {
  AlertTriangle,
  Anchor,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ClipboardList,
  Paintbrush,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CHUC_DANH, chucDanhCuaNguoiDung } from "@/lib/maVatTu";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
  vesselWhere,
} from "@/lib/auth";
import { MA_LOCALE } from "@/lib/i18n/ngonNgu";
import { layT } from "@/lib/i18n/server";
import {
  Badge,
  Card,
  CardHeader,
  Meter,
  PageHeader,
  Stat,
  TONE_DON_MUA,
  TONE_YEU_CAU,
  buttonClass,
  type Tone,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const REQ_OPEN = [
  "DRAFT",
  "PENDING_MASTER",
  "PENDING_OFFICE",
  "APPROVED",
  "IN_PROCUREMENT",
  "PARTIALLY_DELIVERED",
];
const PO_OPEN = ["DRAFT", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED"];

/** Thứ tự vẽ các thanh "theo trạng thái" — theo vòng đời, không theo bảng chữ cái. */
const REQ_THU_TU = [
  "DRAFT",
  "PENDING_MASTER",
  "PENDING_OFFICE",
  "APPROVED",
  "REJECTED",
  "IN_PROCUREMENT",
  "PARTIALLY_DELIVERED",
  "FULLY_DELIVERED",
  "CLOSED",
  "CANCELLED",
];
const PO_THU_TU = [
  "DRAFT",
  "SENT",
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
  "CANCELLED",
];

/** Màu thanh tồn thấp theo mức thiếu: càng thiếu càng đỏ. */
function toneThieu(pct: number): Tone {
  return pct < 40 ? "danger" : pct < 75 ? "warning" : "info";
}

const LINK = "text-sm text-brand-700 hover:underline dark:text-brand-300";

export default async function DashboardPage() {
  const user = await requireScopedUser();
  const { t, tTuDo, ngay, tenChucDanh, tenBoPhan, locale } = await layT();
  const scope = vesselScopeDayDu(user);
  // Chức danh giữ vật tư của người đang đăng nhập: dùng cho dải "phần của bạn"
  // ngay đầu trang. Người văn phòng (quản trị, quản lý kỹ thuật) không giữ kho
  // nào nên không hiện dải này.
  const chucDanhCuaToi = chucDanhCuaNguoiDung(user);
  // Đếm trong ĐÚNG PHẠM VI TÀU của người đang xem, không đếm toàn đội: thủy thủ
  // trưởng tàu MLS-001 mở app ra phải thấy số mặt hàng của tàu mình, chứ không
  // phải tổng của cả bảy tàu. Người văn phòng (phạm vi toàn đội) thì đếm chung.
  const [
    soVatTuCuaToi,
    vesselCount,
    materialCount,
    reqByStatus,
    poByStatus,
    recentRequests,
    recentTx,
    inventoryGroup,
    materials,
    vessels,
    spareLinks,
    paintStocks,
  ] = await Promise.all([
    chucDanhCuaToi
      ? prisma.material.count({
          where: {
            responsibleRank: chucDanhCuaToi,
            isActive: true,
            ...(scope.all
              ? {}
              : { vesselMaterials: { some: vesselWhere(scope) } }),
          },
        })
      : Promise.resolve(0),
    prisma.vessel.count({ where: vesselIdWhere(scope) }),
    prisma.material.count(),
    prisma.materialRequest.groupBy({
      by: ["status"],
      where: vesselWhere(scope),
      _count: true,
    }),
    prisma.purchaseOrder.groupBy({
      by: ["status"],
      where: vesselWhere(scope),
      _count: true,
    }),
    prisma.materialRequest.findMany({
      where: vesselWhere(scope),
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { vessel: { select: { id: true, name: true } } },
    }),
    prisma.inventoryTransaction.findMany({
      where: vesselWhere(scope),
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 6,
    }),
    prisma.inventory.groupBy({
      by: ["materialId", "vesselId"],
      where: vesselWhere(scope),
      _sum: { quantity: true },
    }),
    // Chỉ lấy 4 cột thật sự dùng tới (tra tên + mã + mức tối thiểu cho phần tồn
    // thấp và nhật ký kho gần đây), không kéo cả 15 cột của 600+ dòng.
    prisma.material.findMany({
      select: { id: true, code: true, nameVn: true, minStock: true },
    }),
    prisma.vessel.findMany({ where: vesselIdWhere(scope) }),
    // Phụ tùng thiết yếu: SPARE có mức tối thiểu, theo danh mục từng tàu.
    prisma.vesselMaterial.findMany({
      where: {
        ...vesselWhere(scope),
        material: {
          materialType: "SPARE",
          isActive: true,
          minStock: { gt: 0 },
        },
      },
      include: {
        material: {
          select: {
            id: true,
            nameVn: true,
            equipment: true,
            minStock: true,
            uom: true,
          },
        },
        vessel: { select: { id: true, name: true } },
      },
    }),
    // Tồn sơn toàn đội (theo phạm vi tàu) — để đếm loại dưới định mức tối thiểu.
    prisma.paintStock.findMany({
      where: vesselWhere(scope),
      select: { quantity: true, minQty: true },
    }),
  ]);

  const materialById = new Map(materials.map((m) => [m.id, m]));
  const vesselById = new Map(vessels.map((v) => [v.id, v]));

  const allLowStock = inventoryGroup
    .map((row) => {
      const material = materialById.get(row.materialId);
      const vessel = vesselById.get(row.vesselId);
      const total = Number(row._sum.quantity ?? 0);
      if (material && vessel && total < material.minStock) {
        return {
          materialCode: material.code,
          materialName: material.nameVn,
          vesselId: vessel.id,
          vesselName: vessel.name,
          total,
          minStock: material.minStock,
          pct: material.minStock > 0 ? total / material.minStock : 0,
        };
      }
      return null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.pct - b.pct);
  const lowStockRows = allLowStock.slice(0, 8);

  // Kiểm soát phụ tùng thiết yếu: tồn hiện tại (theo tàu) so với mức tối thiểu.
  const stockByKey = new Map(
    inventoryGroup.map((row) => [
      `${row.materialId}|${row.vesselId}`,
      Number(row._sum.quantity ?? 0),
    ])
  );
  const spareStatus = spareLinks
    .map((link) => {
      const current =
        stockByKey.get(`${link.material.id}|${link.vesselId}`) ?? 0;
      return {
        name: link.material.nameVn,
        equipment: link.material.equipment,
        uom: link.material.uom,
        vesselId: link.vesselId,
        vesselName: link.vessel.name,
        current,
        minStock: link.material.minStock,
        pct: link.material.minStock > 0 ? current / link.material.minStock : 1,
      };
    })
    .sort((a, b) => a.pct - b.pct);
  const spareShortages = spareStatus.filter((s) => s.current < s.minStock);
  const spareTopRows = spareShortages.slice(0, 8);

  const reqCount = (status: string) =>
    reqByStatus.find((r) => r.status === status)?._count ?? 0;
  const poCount = (status: string) =>
    poByStatus.find((r) => r.status === status)?._count ?? 0;
  const openRequests = REQ_OPEN.reduce((s, st) => s + reqCount(st), 0);
  const openPOs = PO_OPEN.reduce((s, st) => s + poCount(st), 0);
  const totalRequests = reqByStatus.reduce((s, r) => s + r._count, 0);
  const totalPOs = poByStatus.reduce((s, r) => s + r._count, 0);
  const maxReq = Math.max(1, ...reqByStatus.map((r) => r._count));
  const maxPo = Math.max(1, ...poByStatus.map((r) => r._count));

  const today = new Date().toLocaleDateString(MA_LOCALE[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const lowPaintCount = paintStocks.filter(
    (p) => p.minQty > 0 && p.quantity < p.minQty
  ).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("dashboard.tieuDe")}
        subtitle={
          <>
            {scope.all
              ? t("dashboard.tongQuanDoi")
              : t("dashboard.tongQuanTau", {
                  tau: vessels[0]?.name ?? t("dashboard.tauCuaBan"),
                })}
            <span className="text-[var(--text-muted)]"> · {today}</span>
          </>
        }
        action={
          <>
            <Link href="/requests" className={buttonClass("primary")}>
              <ClipboardList className="size-4" />
              {t("dashboard.taoYeuCau")}
            </Link>
            <Link href="/inventory" className={buttonClass("secondary")}>
              {t("dashboard.nhapXuatKho")}
            </Link>
            <Link href="/purchasing" className={buttonClass("secondary")}>
              {t("dashboard.muaSam")}
            </Link>
          </>
        }
      />

      {chucDanhCuaToi && (
        <Link
          href="/materials?rank=toi"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-500/30 bg-brand-500/8 px-5 py-4 transition hover:bg-brand-500/12"
        >
          <div>
            <p className="text-sm text-[var(--text-secondary)]">
              {t("dashboard.banLa")}{" "}
              <b className="text-[var(--text-primary)]">{tenChucDanh(chucDanhCuaToi)}</b> ·{" "}
              {tenBoPhan(CHUC_DANH[chucDanhCuaToi].boPhan)}
            </p>
            <p className="text-lg font-semibold text-[var(--text-primary)]">
              {soVatTuCuaToi > 0
                ? t("dashboard.matHangBanQuanLy", { n: soVatTuCuaToi })
                : t("dashboard.chuaCoMatHang")}
            </p>
          </div>
          <span className={buttonClass("primary", "sm")}>
            {soVatTuCuaToi > 0
              ? t("dashboard.xemVatTuCuaToi")
              : t("dashboard.moDanhMuc")}
          </span>
        </Link>
      )}

      {scope.unassigned && (
        <div className="rounded-lg bg-[var(--tone-warning-bg)] px-4 py-3 text-sm text-[var(--tone-warning-text)]">
          {t("dashboard.chuaGanTau")}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <Stat
          href="/vessels"
          icon={<Anchor className="size-4" />}
          label={t("dashboard.kpiDoiTau")}
          value={vesselCount}
          tone="brand"
        />
        <Stat
          href="/materials"
          icon={<Boxes className="size-4" />}
          label={t("dashboard.kpiVatTu")}
          value={materialCount}
        />
        <Stat
          href="/requests"
          icon={<ClipboardList className="size-4" />}
          label={t("dashboard.kpiYeuCau")}
          value={openRequests}
          tone="info"
        />
        <Stat
          href="/purchasing"
          icon={<ShoppingCart className="size-4" />}
          label={t("dashboard.kpiDonMua")}
          value={openPOs}
          tone="info"
        />
        <Stat
          href="/inventory"
          icon={<AlertTriangle className="size-4" />}
          label={t("dashboard.kpiCanhBao")}
          value={allLowStock.length}
          tone={allLowStock.length > 0 ? "danger" : "success"}
        />
        <Stat
          href="/paint"
          icon={<Paintbrush className="size-4" />}
          label={t("dashboard.kpiSon")}
          value={lowPaintCount}
          tone={lowPaintCount > 0 ? "warning" : "success"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Cột trái (2/3) */}
        <div className="space-y-5 lg:col-span-2">
          {/* Kiểm soát nhanh phụ tùng thiết yếu — mục quan trọng nhất trên
              Dashboard (thiếu là tàu có thể không chạy được): tiêu đề tô đỏ. */}
          <Card>
            <CardHeader
              icon={<Wrench className="size-4" />}
              title={
                <span className="text-rose-600 dark:text-rose-400">
                  {t("dashboard.kiemSoatPhuTung")}
                </span>
              }
              action={
                <div className="flex items-center gap-2">
                  {spareShortages.length > 0 ? (
                    <Badge tone="danger" dot>
                      {t("dashboard.thieuTheoDoi", {
                        thieu: spareShortages.length,
                        tong: spareStatus.length,
                      })}
                    </Badge>
                  ) : spareStatus.length > 0 ? (
                    <Badge tone="success" dot>
                      {t("dashboard.duTatCa", { tong: spareStatus.length })}
                    </Badge>
                  ) : null}
                  <Link href="/materials?type=SPARE" className={LINK}>
                    {t("dashboard.danhMuc")}
                  </Link>
                </div>
              }
            />
            {spareStatus.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {t("dashboard.chuaCoPhuTung")}{" "}
                <Link href="/materials/import" className={LINK}>
                  {t("dashboard.nhapTuFile")}
                </Link>
              </p>
            ) : spareShortages.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {t("dashboard.phuTungDuHet")}
              </p>
            ) : (
              <div className="space-y-3">
                {spareTopRows.map((row, index) => {
                  const pct = Math.max(0, Math.min(100, Math.round(row.pct * 100)));
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-medium text-[var(--text-primary)]">
                            {row.name}
                          </span>
                          {row.equipment && (
                            <span className="text-xs text-[var(--text-muted)]">
                              {" "}
                              · {row.equipment}
                            </span>
                          )}
                        </p>
                        <p className="text-xs">
                          <Link href={`/vessels/${row.vesselId}`} className={LINK}>
                            {row.vesselName}
                          </Link>
                        </p>
                      </div>
                      <div className="w-36 shrink-0">
                        <div className="tabular mb-1 flex justify-between text-xs">
                          <span className="font-semibold text-[var(--text-danger)]">
                            {row.current}
                          </span>
                          <span className="text-[var(--text-muted)]">
                            / {row.minStock} {row.uom}
                          </span>
                        </div>
                        <Meter value={pct} tone={toneThieu(pct)} className="h-2" />
                      </div>
                    </div>
                  );
                })}
                {spareShortages.length > spareTopRows.length && (
                  <Link href="/materials?type=SPARE" className={`block pt-1 ${LINK}`}>
                    {t("dashboard.xemTatCaThieu", { n: spareShortages.length })}
                  </Link>
                )}
              </div>
            )}
          </Card>

          {/* Cảnh báo tồn kho */}
          <Card>
            <CardHeader
              icon={<AlertTriangle className="size-4" />}
              title={t("dashboard.canhBaoTonThap")}
              action={
                allLowStock.length > 0 ? (
                  <Badge tone="danger" dot>
                    {t("dashboard.nCanhBao", { n: allLowStock.length })}
                  </Badge>
                ) : undefined
              }
            />
            {lowStockRows.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {t("dashboard.khongDuoiTon")}
              </p>
            ) : (
              <div className="space-y-3">
                {lowStockRows.map((row, index) => {
                  const pct = Math.max(0, Math.min(100, Math.round(row.pct * 100)));
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-medium text-[var(--text-primary)]">
                            {row.materialName}
                          </span>{" "}
                          <span className="font-display text-[10px] tracking-wide text-[var(--text-muted)]">
                            {row.materialCode}
                          </span>
                        </p>
                        <p className="text-xs">
                          <Link href={`/vessels/${row.vesselId}`} className={LINK}>
                            {row.vesselName}
                          </Link>
                        </p>
                      </div>
                      <div className="w-36 shrink-0">
                        <div className="tabular mb-1 flex justify-between text-xs">
                          <span className="font-semibold text-[var(--text-danger)]">
                            {row.total}
                          </span>
                          <span className="text-[var(--text-muted)]">/ {row.minStock}</span>
                        </div>
                        <Meter value={pct} tone={toneThieu(pct)} className="h-2" />
                      </div>
                    </div>
                  );
                })}
                {allLowStock.length > lowStockRows.length && (
                  <Link href="/inventory" className={`block pt-1 ${LINK}`}>
                    {t("dashboard.xemTatCaCanhBao", { n: allLowStock.length })}
                  </Link>
                )}
              </div>
            )}
          </Card>

          {/* Yêu cầu gần đây */}
          <Card>
            <CardHeader
              icon={<ClipboardList className="size-4" />}
              title={t("dashboard.yeuCauGanDay")}
              action={
                <Link href="/requests" className={LINK}>
                  {t("dashboard.xemTatCa")}
                </Link>
              }
            />
            {recentRequests.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {t("dashboard.chuaCoYeuCauVatTu")}
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {recentRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/requests/${request.id}`}
                        className="font-display text-xs tracking-wide text-brand-700 hover:underline dark:text-brand-300"
                      >
                        {request.requestNo}
                      </Link>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {request.vessel.name} ·{" "}
                        {tTuDo(
                          `labels.type_${request.kind === "SPARE" ? "SPARE" : "STORE"}`
                        )}{" "}
                        · {ngay(request.createdAt)}
                      </p>
                    </div>
                    <Badge tone={TONE_YEU_CAU[request.status] ?? "neutral"} dot>
                      {tTuDo(`labels.reqStatus_${request.status}`)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Cột phải (1/3) */}
        <div className="space-y-5">
          {/* Yêu cầu theo trạng thái */}
          <Card>
            <CardHeader title={t("dashboard.yeuCauTheoTrangThai")} />
            {totalRequests === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {t("dashboard.chuaCoYeuCau")}
              </p>
            ) : (
              <div className="space-y-2.5">
                {REQ_THU_TU.filter((status) => reqCount(status) > 0).map((status) => {
                  const count = reqCount(status);
                  return (
                    <div key={status}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-[var(--text-secondary)]">
                          {tTuDo(`labels.reqStatus_${status}`)}
                        </span>
                        <span className="tabular font-semibold text-[var(--text-primary)]">
                          {count}
                        </span>
                      </div>
                      <Meter value={count} max={maxReq} tone={TONE_YEU_CAU[status] ?? "neutral"} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Đơn mua hàng */}
          <Card>
            <CardHeader
              title={t("dashboard.donMuaHang")}
              action={
                <Link href="/purchasing" className={LINK}>
                  {t("dashboard.muaSamLink")}
                </Link>
              }
            />
            {totalPOs === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {t("dashboard.chuaCoDonMua")}
              </p>
            ) : (
              <div className="space-y-2.5">
                {PO_THU_TU.filter((status) => poCount(status) > 0).map((status) => {
                  const count = poCount(status);
                  return (
                    <div key={status}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-[var(--text-secondary)]">
                          {tTuDo(`labels.poStatus_${status}`)}
                        </span>
                        <span className="tabular font-semibold text-[var(--text-primary)]">
                          {count}
                        </span>
                      </div>
                      <Meter value={count} max={maxPo} tone={TONE_DON_MUA[status] ?? "neutral"} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Hoạt động kho gần đây */}
          <Card>
            <CardHeader
              title={t("dashboard.hoatDongKho")}
              action={
                <Link href="/inventory" className={LINK}>
                  {t("dashboard.tonKhoLink")}
                </Link>
              }
            />
            {recentTx.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {t("dashboard.chuaCoGiaoDich")}
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {recentTx.map((tx) => {
                  const material = materialById.get(tx.materialId);
                  const vessel = vesselById.get(tx.vesselId);
                  const isIn = tx.type === "IN";
                  return (
                    <div key={tx.id} className="flex items-center gap-3 py-2.5">
                      <span
                        className={`grid size-8 shrink-0 place-items-center rounded-full ${
                          isIn
                            ? "bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]"
                            : "bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]"
                        }`}
                      >
                        {isIn ? (
                          <ArrowDownToLine className="size-4" />
                        ) : (
                          <ArrowUpFromLine className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[var(--text-primary)]">
                          {material?.nameVn ??
                            t("dashboard.vatTuSo", { id: tx.materialId })}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {vessel?.name ?? "—"} · {ngay(tx.occurredAt)}{" "}
                          {tx.occurredAt.toLocaleTimeString(MA_LOCALE[locale], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {tx.performedBy ? ` · ${tx.performedBy}` : ""}
                        </p>
                      </div>
                      <span
                        className={`tabular text-sm font-semibold ${
                          isIn ? "text-[var(--text-success)]" : "text-[var(--text-warning)]"
                        }`}
                      >
                        {isIn ? "+" : "−"}
                        {tx.quantity}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
