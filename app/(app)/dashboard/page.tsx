import Link from "next/link";
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

export const dynamic = "force-dynamic";

// Màu của từng trạng thái; NHÃN lấy từ từ điển (labels.reqStatus_* / poStatus_*)
// để đổi theo ngôn ngữ — bảng này chỉ còn phần trang trí.
const REQ_STATUS: Record<string, { badge: string; bar: string }> = {
  DRAFT: { badge: "bg-slate-100 text-slate-600", bar: "bg-slate-400" },
  PENDING_MASTER: { badge: "bg-amber-100 text-amber-700", bar: "bg-amber-400" },
  PENDING_OFFICE: { badge: "bg-orange-100 text-orange-700", bar: "bg-orange-400" },
  APPROVED: { badge: "bg-green-100 text-green-700", bar: "bg-green-500" },
  REJECTED: { badge: "bg-red-100 text-red-700", bar: "bg-red-400" },
  IN_PROCUREMENT: { badge: "bg-blue-100 text-blue-700", bar: "bg-blue-500" },
  PARTIALLY_DELIVERED: { badge: "bg-indigo-100 text-indigo-700", bar: "bg-indigo-500" },
  FULLY_DELIVERED: { badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
  CLOSED: { badge: "bg-slate-100 text-slate-500", bar: "bg-slate-300" },
  CANCELLED: { badge: "bg-slate-100 text-slate-400", bar: "bg-slate-300" },
};

const PO_STATUS: Record<string, { bar: string }> = {
  DRAFT: { bar: "bg-slate-400" },
  SENT: { bar: "bg-blue-500" },
  CONFIRMED: { bar: "bg-indigo-500" },
  PARTIALLY_RECEIVED: { bar: "bg-amber-400" },
  RECEIVED: { bar: "bg-emerald-500" },
  CLOSED: { bar: "bg-slate-300" },
  CANCELLED: { bar: "bg-slate-300" },
};

const REQ_OPEN = [
  "DRAFT",
  "PENDING_MASTER",
  "PENDING_OFFICE",
  "APPROVED",
  "IN_PROCUREMENT",
  "PARTIALLY_DELIVERED",
];
const PO_OPEN = ["DRAFT", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED"];

function KpiCard({
  href,
  icon,
  iconBg,
  label,
  value,
  valueClass,
}: {
  href: string;
  icon: string;
  iconBg: string;
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-blue-300"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${iconBg}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className={`text-2xl font-bold ${valueClass ?? "text-blue-950"}`}>
            {value}
          </p>
        </div>
      </div>
    </Link>
  );
}

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
    // Đếm "vật tư tôi quản lý" gộp vào batch song song này thay vì chạy riêng
    // trước nó: phép đếm không phụ thuộc truy vấn nào khác, tách ra chỉ thêm
    // một vòng chờ database nối tiếp trên đúng trang mở đầu mỗi phiên. Chưa có
    // chức danh thì khỏi hỏi, trả thẳng 0.
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
    // thấp và nhật ký kho gần đây), không kéo cả 15 cột của 600+ dòng mỗi lần
    // mở dashboard.
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
    })
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
    <div className="space-y-6">
      {/* Tiêu đề + thao tác nhanh */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-blue-950">{t("dashboard.tieuDe")}</h2>
          <p className="text-slate-600">
            {scope.all
              ? t("dashboard.tongQuanDoi")
              : t("dashboard.tongQuanTau", {
                  tau: vessels[0]?.name ?? t("dashboard.tauCuaBan"),
                })}
            <span className="text-slate-400"> · {today}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/requests"
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            {t("dashboard.taoYeuCau")}
          </Link>
          <Link
            href="/inventory"
            className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-blue-950 hover:bg-blue-50"
          >
            {t("dashboard.nhapXuatKho")}
          </Link>
          <Link
            href="/purchasing"
            className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-blue-950 hover:bg-blue-50"
          >
            {t("dashboard.muaSam")}
          </Link>
        </div>
      </div>

      {chucDanhCuaToi && (
        <Link
          href="/materials?rank=toi"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-5 py-4 transition hover:border-blue-300 hover:bg-blue-50"
        >
          <div>
            <p className="text-sm text-slate-600">
              {t("dashboard.banLa")} <b>{tenChucDanh(chucDanhCuaToi)}</b> ·{" "}
              {tenBoPhan(CHUC_DANH[chucDanhCuaToi].boPhan)}
            </p>
            <p className="text-lg font-semibold text-blue-950">
              {soVatTuCuaToi > 0
                ? t("dashboard.matHangBanQuanLy", { n: soVatTuCuaToi })
                : t("dashboard.chuaCoMatHang")}
            </p>
          </div>
          <span className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white">
            {soVatTuCuaToi > 0
              ? t("dashboard.xemVatTuCuaToi")
              : t("dashboard.moDanhMuc")}
          </span>
        </Link>
      )}

      {scope.unassigned && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          {t("dashboard.chuaGanTau")}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          href="/vessels"
          icon="⚓"
          iconBg="bg-blue-100"
          label={t("dashboard.kpiDoiTau")}
          value={vesselCount}
        />
        <KpiCard
          href="/materials"
          icon="🧰"
          iconBg="bg-sky-100"
          label={t("dashboard.kpiVatTu")}
          value={materialCount}
        />
        <KpiCard
          href="/requests"
          icon="📝"
          iconBg="bg-indigo-100"
          label={t("dashboard.kpiYeuCau")}
          value={openRequests}
        />
        <KpiCard
          href="/purchasing"
          icon="🛒"
          iconBg="bg-violet-100"
          label={t("dashboard.kpiDonMua")}
          value={openPOs}
        />
        <KpiCard
          href="/inventory"
          icon="⚠️"
          iconBg="bg-red-100"
          label={t("dashboard.kpiCanhBao")}
          value={allLowStock.length}
          valueClass={allLowStock.length > 0 ? "text-red-600" : "text-blue-950"}
        />
        <KpiCard
          href="/paint"
          icon="🎨"
          iconBg="bg-amber-100"
          label={t("dashboard.kpiSon")}
          value={lowPaintCount}
          valueClass={lowPaintCount > 0 ? "text-amber-700" : "text-blue-950"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cột trái (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Kiểm soát nhanh phụ tùng thiết yếu */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              {/* Đỏ thay vì xanh như các tiêu đề khác: đây là mục quan trọng
                  nhất trên Dashboard (phụ tùng thiết yếu thiếu là tàu có thể
                  không chạy được), cùng tông với nhãn "Critical" ở danh mục. */}
              <h3 className="text-lg font-bold text-red-700">
                {t("dashboard.kiemSoatPhuTung")}
              </h3>
              <div className="flex items-center gap-2">
                {spareShortages.length > 0 ? (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                    {t("dashboard.thieuTheoDoi", {
                      thieu: spareShortages.length,
                      tong: spareStatus.length,
                    })}
                  </span>
                ) : spareStatus.length > 0 ? (
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                    {t("dashboard.duTatCa", { tong: spareStatus.length })}
                  </span>
                ) : null}
                <Link
                  href="/materials?type=SPARE"
                  className="text-sm text-blue-700 hover:underline"
                >
                  {t("dashboard.danhMuc")}
                </Link>
              </div>
            </div>
            {spareStatus.length === 0 ? (
              <p className="text-sm text-slate-600">
                {t("dashboard.chuaCoPhuTung")}{" "}
                <Link
                  href="/materials/import"
                  className="text-blue-700 hover:underline"
                >
                  {t("dashboard.nhapTuFile")}
                </Link>
              </p>
            ) : spareShortages.length === 0 ? (
              <p className="text-sm text-slate-600">{t("dashboard.phuTungDuHet")}</p>
            ) : (
              <div className="space-y-3">
                {spareTopRows.map((row, index) => {
                  const pct = Math.max(
                    0,
                    Math.min(100, Math.round(row.pct * 100))
                  );
                  const barColor =
                    pct < 40
                      ? "bg-red-500"
                      : pct < 75
                        ? "bg-amber-500"
                        : "bg-yellow-400";
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-medium text-blue-950">
                            {row.name}
                          </span>
                          {row.equipment && (
                            <span className="text-xs text-slate-400">
                              {" "}
                              · {row.equipment}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          <Link
                            href={`/vessels/${row.vesselId}`}
                            className="text-blue-700 hover:underline"
                          >
                            {row.vesselName}
                          </Link>
                        </p>
                      </div>
                      <div className="w-36 shrink-0">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="font-semibold text-red-600">
                            {row.current}
                          </span>
                          <span className="text-slate-400">
                            / {row.minStock} {row.uom}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {spareShortages.length > spareTopRows.length && (
                  <Link
                    href="/materials?type=SPARE"
                    className="block pt-1 text-sm text-blue-700 hover:underline"
                  >
                    {t("dashboard.xemTatCaThieu", { n: spareShortages.length })}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Cảnh báo tồn kho */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-blue-950">
                {t("dashboard.canhBaoTonThap")}
              </h3>
              {allLowStock.length > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                  {t("dashboard.nCanhBao", { n: allLowStock.length })}
                </span>
              )}
            </div>
            {lowStockRows.length === 0 ? (
              <p className="text-slate-600">{t("dashboard.khongDuoiTon")}</p>
            ) : (
              <div className="space-y-3">
                {lowStockRows.map((row, index) => {
                  const pct = Math.max(0, Math.min(100, Math.round(row.pct * 100)));
                  const barColor =
                    pct < 40
                      ? "bg-red-500"
                      : pct < 75
                        ? "bg-amber-500"
                        : "bg-yellow-400";
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-medium text-blue-950">
                            {row.materialName}
                          </span>{" "}
                          <span className="text-xs text-slate-400">
                            {row.materialCode}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          <Link
                            href={`/vessels/${row.vesselId}`}
                            className="text-blue-700 hover:underline"
                          >
                            {row.vesselName}
                          </Link>
                        </p>
                      </div>
                      <div className="w-36 shrink-0">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="font-semibold text-red-600">
                            {row.total}
                          </span>
                          <span className="text-slate-400">
                            / {row.minStock}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {allLowStock.length > lowStockRows.length && (
                  <Link
                    href="/inventory"
                    className="block pt-1 text-sm text-blue-700 hover:underline"
                  >
                    {t("dashboard.xemTatCaCanhBao", { n: allLowStock.length })}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Yêu cầu gần đây */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-blue-950">
                {t("dashboard.yeuCauGanDay")}
              </h3>
              <Link
                href="/requests"
                className="text-sm text-blue-700 hover:underline"
              >
                {t("dashboard.xemTatCa")}
              </Link>
            </div>
            {recentRequests.length === 0 ? (
              <p className="text-slate-600">{t("dashboard.chuaCoYeuCauVatTu")}</p>
            ) : (
              <div className="divide-y divide-blue-50">
                {recentRequests.map((request) => {
                  const st = REQ_STATUS[request.status] ?? {
                    badge: "bg-slate-100 text-slate-600",
                    bar: "bg-slate-300",
                  };
                  return (
                    <div
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/requests/${request.id}`}
                          className="text-sm font-medium text-blue-700 hover:underline"
                        >
                          {request.requestNo}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {request.vessel.name} ·{" "}
                          {tTuDo(`labels.type_${request.kind === "SPARE" ? "SPARE" : "STORE"}`)} ·{" "}
                          {ngay(request.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.badge}`}
                      >
                        {tTuDo(`labels.reqStatus_${request.status}`)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cột phải (1/3) */}
        <div className="space-y-6">
          {/* Yêu cầu theo trạng thái */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <h3 className="mb-4 text-lg font-semibold text-blue-950">
              {t("dashboard.yeuCauTheoTrangThai")}
            </h3>
            {totalRequests === 0 ? (
              <p className="text-sm text-slate-600">{t("dashboard.chuaCoYeuCau")}</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(REQ_STATUS)
                  .filter(([status]) => reqCount(status) > 0)
                  .map(([status, meta]) => {
                    const count = reqCount(status);
                    return (
                      <div key={status}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-600">
                            {tTuDo(`labels.reqStatus_${status}`)}
                          </span>
                          <span className="font-semibold text-blue-950">
                            {count}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${meta.bar}`}
                            style={{
                              width: `${Math.round((count / maxReq) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Đơn mua hàng */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-blue-950">
                {t("dashboard.donMuaHang")}
              </h3>
              <Link
                href="/purchasing"
                className="text-sm text-blue-700 hover:underline"
              >
                {t("dashboard.muaSamLink")}
              </Link>
            </div>
            {totalPOs === 0 ? (
              <p className="text-sm text-slate-600">{t("dashboard.chuaCoDonMua")}</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(PO_STATUS)
                  .filter(([status]) => poCount(status) > 0)
                  .map(([status, meta]) => {
                    const count = poCount(status);
                    return (
                      <div key={status}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-600">
                            {tTuDo(`labels.poStatus_${status}`)}
                          </span>
                          <span className="font-semibold text-blue-950">
                            {count}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${meta.bar}`}
                            style={{
                              width: `${Math.round((count / maxPo) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Hoạt động kho gần đây */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-blue-950">
                {t("dashboard.hoatDongKho")}
              </h3>
              <Link
                href="/inventory"
                className="text-sm text-blue-700 hover:underline"
              >
                {t("dashboard.tonKhoLink")}
              </Link>
            </div>
            {recentTx.length === 0 ? (
              <p className="text-sm text-slate-600">{t("dashboard.chuaCoGiaoDich")}</p>
            ) : (
              <div className="divide-y divide-blue-50">
                {recentTx.map((tx) => {
                  const material = materialById.get(tx.materialId);
                  const vessel = vesselById.get(tx.vesselId);
                  const isIn = tx.type === "IN";
                  return (
                    <div key={tx.id} className="flex items-center gap-3 py-2.5">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          isIn
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {isIn ? "↓" : "↑"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-blue-950">
                          {material?.nameVn ??
                            t("dashboard.vatTuSo", { id: tx.materialId })}
                        </p>
                        <p className="text-xs text-slate-500">
                          {vessel?.name ?? "—"} · {ngay(tx.occurredAt)}{" "}
                          {tx.occurredAt.toLocaleTimeString(MA_LOCALE[locale], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {tx.performedBy ? ` · ${tx.performedBy}` : ""}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          isIn ? "text-emerald-600" : "text-amber-600"
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
          </div>
        </div>
      </div>
    </div>
  );
}
