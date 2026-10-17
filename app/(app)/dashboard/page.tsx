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
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
  buttonClass,
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

const LINK = "text-sm text-brand-700 hover:underline dark:text-brand-300";

export default async function DashboardPage() {
  const user = await requireScopedUser();
  const { t, tTuDo, ngay, tenChucDanh, tenBoPhan, locale } = await layT();
  const scope = vesselScopeDayDu(user);
  // Tàu trong phạm vi cho câu SQL gộp (null = toàn đội) — cùng cách trang Tồn kho.
  const tauPhamVi = scope.all ? null : (scope.vesselIds ?? [scope.vesselId ?? -1]);
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
    canhBaoTon,
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
    // CẢNH BÁO TỒN KHO theo tàu — ĐÚNG quy tắc trang Tồn kho (nhãn "N thiếu", ô "Chỉ thiếu"):
    // một dòng tồn (mặt hàng + kho) thiếu khi khả dụng = tồn − giữ ≤ tối thiểu; `het` = khả dụng ≤ 0.
    // Dashboard cũ đếm "tổng tồn < tối thiểu" — mà danh mục chưa đặt mức tối thiểu nào (0 / 805 dòng,
    // 2026-10-17) nên luôn ra 0 trong khi trang Tồn kho báo 9 / 39 thiếu (các dòng đã hết hàng).
    tauPhamVi === null
      ? prisma.$queryRaw<{ vesselId: number; thieu: number; het: number }[]>`
          SELECT i."vesselId" AS "vesselId",
            (COUNT(*) FILTER (WHERE i."quantity" - i."reservedQuantity" <= m."minStock"))::int AS "thieu",
            (COUNT(*) FILTER (WHERE i."quantity" - i."reservedQuantity" <= 0))::int AS "het"
          FROM "Inventory" i JOIN "Material" m ON m."id" = i."materialId"
          GROUP BY i."vesselId"`
      : prisma.$queryRaw<{ vesselId: number; thieu: number; het: number }[]>`
          SELECT i."vesselId" AS "vesselId",
            (COUNT(*) FILTER (WHERE i."quantity" - i."reservedQuantity" <= m."minStock"))::int AS "thieu",
            (COUNT(*) FILTER (WHERE i."quantity" - i."reservedQuantity" <= 0))::int AS "het"
          FROM "Inventory" i JOIN "Material" m ON m."id" = i."materialId"
          WHERE i."vesselId" = ANY(${tauPhamVi})
          GROUP BY i."vesselId"`,
    prisma.vessel.findMany({ where: vesselIdWhere(scope), orderBy: { code: "asc" } }),
    // Phụ tùng thiết yếu: danh mục RIÊNG MLS-11-04 của từng tàu (trang
    // /materials/thiet-yeu), chỉ các mục có mức tối thiểu quy đổi được.
    prisma.phuTungThietYeu.findMany({
      where: { ...vesselWhere(scope), toiThieuSo: { gt: 0 } },
      // Bảng theo tàu chỉ cần số: thiếu / theo dõi / chưa có số của từng tàu.
      select: { toiThieuSo: true, hienCo: true, materialId: true, vesselId: true },
    }),
    // Tồn sơn toàn đội (theo phạm vi tàu) — để đếm loại dưới định mức tối thiểu.
    prisma.paintStock.findMany({
      where: vesselWhere(scope),
      select: { vesselId: true, quantity: true, minQty: true },
    }),
  ]);

  const vesselById = new Map(vessels.map((v) => [v.id, v]));
  // Tên mặt hàng cho 6 dòng nhật ký kho (giao dịch không khai quan hệ tới Material) — hỏi đúng 6 id
  // thay vì kéo cả danh mục (780 dòng) như trước.
  const tenVatTu = new Map(
    (
      await prisma.material.findMany({
        where: { id: { in: [...new Set(recentTx.map((tx) => tx.materialId))] } },
        select: { id: true, nameVn: true },
      })
    ).map((m) => [m.id, m.nameVn])
  );

  // Kiểm soát phụ tùng thiết yếu: số hiện có (tháng gần nhất tàu đã lưu / lúc
  // nhập file; mục gắn kho mà chưa có số thì lấy tồn kho) so với mức tối thiểu.
  // Mục chưa có số nào không tính là thiếu — đếm riêng "chưa có số kiểm tra".
  const stockByKey = new Map(
    inventoryGroup.map((row) => [
      `${row.materialId}|${row.vesselId}`,
      Number(row._sum.quantity ?? 0),
    ])
  );
  const spareTracked = spareLinks.map((muc) => ({
    vesselId: muc.vesselId,
    current:
      muc.hienCo ??
      (muc.materialId !== null
        ? (stockByKey.get(`${muc.materialId}|${muc.vesselId}`) ?? null)
        : null),
    minStock: muc.toiThieuSo,
  }));

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
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const lowPaintCount = paintStocks.filter(
    (p) => p.minQty > 0 && p.quantity < p.minQty
  ).length;

  // CẢNH BÁO THEO TÀU: mỗi tàu một dòng — phụ tùng thiết yếu dưới tối thiểu (MLS-11-04), tồn kho hết /
  // thiếu, sơn dưới định mức; số nào cũng là liên kết mở đúng danh sách đã lọc của tàu đó.
  const tonTheoTau = new Map(canhBaoTon.map((r) => [r.vesselId, r]));
  const thietYeuTheoTau = new Map<number, { theoDoi: number; thieu: number; chuaCoSo: number }>();
  for (const s of spareTracked) {
    const x = thietYeuTheoTau.get(s.vesselId) ?? { theoDoi: 0, thieu: 0, chuaCoSo: 0 };
    x.theoDoi++;
    if (s.current === null) x.chuaCoSo++;
    else if (s.current < s.minStock) x.thieu++;
    thietYeuTheoTau.set(s.vesselId, x);
  }
  const sonTheoTau = new Map<number, number>();
  for (const p of paintStocks) if (p.minQty > 0 && p.quantity < p.minQty) sonTheoTau.set(p.vesselId, (sonTheoTau.get(p.vesselId) ?? 0) + 1);
  const canhBaoTau = vessels
    .map((v) => {
      const ton = tonTheoTau.get(v.id);
      const ty = thietYeuTheoTau.get(v.id) ?? null;
      const son = sonTheoTau.get(v.id) ?? 0;
      return { v, ty, tonThieu: ton?.thieu ?? 0, tonHet: ton?.het ?? 0, son, tong: (ty?.thieu ?? 0) + (ton?.thieu ?? 0) + son };
    })
    // Tàu nhiều cảnh báo lên đầu; bằng nhau thì theo mã tàu.
    .sort((a, b) => b.tong - a.tong || a.v.code.localeCompare(b.v.code));
  // Hiện dòng cho tàu có cảnh báo hoặc có danh mục thiết yếu; tàu không có gì gom vào một dòng cuối.
  const tauCoDong = canhBaoTau.filter((x) => x.tong > 0 || x.ty !== null);
  const tauKhongCanhBao = canhBaoTau.filter((x) => x.tong === 0 && x.ty === null);
  const tongTonThieu = canhBaoTau.reduce((n, x) => n + x.tonThieu, 0);
  const soTauTonThieu = canhBaoTau.filter((x) => x.tonThieu > 0).length;

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
          href="/inventory?low=1"
          icon={<AlertTriangle className="size-4" />}
          label={t("dashboard.kpiCanhBao")}
          value={tongTonThieu}
          sub={tongTonThieu > 0 ? t("dashboard.kpiCanhBaoSub", { n: soTauTonThieu }) : undefined}
          tone={tongTonThieu > 0 ? "danger" : "success"}
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
          {/* Cảnh báo theo tàu: một dòng mỗi tàu, số nào cũng bấm được để mở đúng danh sách đã lọc của
              tàu đó — thay hai danh sách dài (8 phụ tùng thiết yếu + 8 dòng tồn thấp) cho Dashboard gọn. */}
          <Card>
            <CardHeader
              icon={<AlertTriangle className="size-4" />}
              title={t("dashboard.canhBaoTheoTau")}
              subtitle={t("dashboard.canhBaoTheoTauGoiY")}
            />
            {canhBaoTau.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">{t("dashboard.chuaGanTau")}</p>
            ) : tauCoDong.length === 0 ? null : (
              <TableWrap>
                <Table dense>
                  <thead>
                    <tr>
                      <Th>{t("dashboard.cot_tau")}</Th>
                      <Th className="text-right">{t("dashboard.cot_thietYeu")}</Th>
                      <Th className="text-right">{t("dashboard.cot_tonKho")}</Th>
                      <Th className="text-right">{t("dashboard.cot_son")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {tauCoDong.map(({ v, ty, tonThieu, tonHet, son }) => (
                      <Tr key={v.id}>
                        <Td className="whitespace-nowrap">
                          <Link href={`/vessels/${v.id}`} className="font-medium text-[var(--text-brand)] hover:underline">
                            <span className="font-display text-xs tracking-wide">{v.code}</span> {v.name}
                          </Link>
                        </Td>
                        <Td className="tabular text-right whitespace-nowrap">
                          {ty === null ? (
                            <Link href={`/materials/thiet-yeu?vessel=${v.id}`} className="text-xs text-[var(--text-muted)] hover:underline">
                              {t("dashboard.chuaNhapDanhMuc")}
                            </Link>
                          ) : (
                            <Link
                              href={`/materials/thiet-yeu?vessel=${v.id}`}
                              className={`hover:underline ${ty.thieu > 0 ? "font-semibold text-[var(--text-danger)]" : "text-[var(--text-success)]"}`}
                            >
                              {ty.thieu > 0 ? t("dashboard.thieuTrenTong", { thieu: ty.thieu, tong: ty.theoDoi }) : t("dashboard.duTong", { tong: ty.theoDoi })}
                            </Link>
                          )}
                          {ty !== null && ty.chuaCoSo > 0 && (
                            <span className="block text-xs text-[var(--text-warning)]">{t("dashboard.chuaCoSoN", { n: ty.chuaCoSo })}</span>
                          )}
                        </Td>
                        <Td className="tabular text-right whitespace-nowrap">
                          {tonThieu > 0 ? (
                            <>
                              <Link href={`/inventory?vessel=${v.id}&low=1`} className="font-semibold text-[var(--text-danger)] hover:underline">
                                {tonThieu}
                              </Link>
                              <span className="block text-xs text-[var(--text-muted)]">
                                {tonHet === tonThieu ? t("dashboard.hetHang") : t("dashboard.hetVaDuoi", { het: tonHet, duoi: tonThieu - tonHet })}
                              </span>
                            </>
                          ) : (
                            <span className="text-[var(--text-muted)]">–</span>
                          )}
                        </Td>
                        <Td className="tabular text-right whitespace-nowrap">
                          {son > 0 ? (
                            <Link href={`/paint/${v.id}`} className="font-semibold text-[var(--text-warning)] hover:underline">
                              {son}
                            </Link>
                          ) : (
                            <span className="text-[var(--text-muted)]">–</span>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
            {tauKhongCanhBao.length > 0 && (
              <p className={`text-sm text-[var(--text-secondary)] ${tauCoDong.length ? "mt-3" : ""}`}>
                <span className="text-[var(--text-success)]">✓</span> {t("dashboard.khongCanhBao")}{" "}
                {tauKhongCanhBao.map(({ v }, i) => (
                  <span key={v.id}>
                    {i ? " · " : ""}
                    <Link href={`/vessels/${v.id}`} className="text-[var(--text-brand)] hover:underline">
                      {v.code}
                    </Link>
                  </span>
                ))}
              </p>
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
                          {tenVatTu.get(tx.materialId) ??
                            t("dashboard.vatTuSo", { id: tx.materialId })}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {vessel?.name ?? "—"} · {ngay(tx.occurredAt)}{" "}
                          {tx.occurredAt.toLocaleTimeString(MA_LOCALE[locale], {
                            timeZone: "Asia/Ho_Chi_Minh",
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
