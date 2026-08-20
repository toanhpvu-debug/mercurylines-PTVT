import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  vesselIdWhere,
  vesselScope,
  vesselWhere,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const REQ_STATUS: Record<string, { label: string; badge: string; bar: string }> = {
  DRAFT: { label: "Nháp", badge: "bg-slate-100 text-slate-600", bar: "bg-slate-400" },
  PENDING_MASTER: { label: "Chờ duyệt", badge: "bg-amber-100 text-amber-700", bar: "bg-amber-400" },
  APPROVED: { label: "Đã duyệt", badge: "bg-green-100 text-green-700", bar: "bg-green-500" },
  REJECTED: { label: "Từ chối", badge: "bg-red-100 text-red-700", bar: "bg-red-400" },
  IN_PROCUREMENT: { label: "Đang mua sắm", badge: "bg-blue-100 text-blue-700", bar: "bg-blue-500" },
  PARTIALLY_DELIVERED: { label: "Giao một phần", badge: "bg-indigo-100 text-indigo-700", bar: "bg-indigo-500" },
  FULLY_DELIVERED: { label: "Giao đủ", badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
  CLOSED: { label: "Hoàn tất", badge: "bg-slate-100 text-slate-500", bar: "bg-slate-300" },
  CANCELLED: { label: "Đã hủy", badge: "bg-slate-100 text-slate-400", bar: "bg-slate-300" },
};

const PO_STATUS: Record<string, { label: string; bar: string }> = {
  DRAFT: { label: "Nháp", bar: "bg-slate-400" },
  SENT: { label: "Đã gửi NCC", bar: "bg-blue-500" },
  CONFIRMED: { label: "NCC xác nhận", bar: "bg-indigo-500" },
  PARTIALLY_RECEIVED: { label: "Nhận một phần", bar: "bg-amber-400" },
  RECEIVED: { label: "Đã nhận đủ", bar: "bg-emerald-500" },
  CLOSED: { label: "Hoàn tất", bar: "bg-slate-300" },
  CANCELLED: { label: "Đã hủy", bar: "bg-slate-300" },
};

const REQ_OPEN = [
  "DRAFT",
  "PENDING_MASTER",
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
  const scope = vesselScope(user);
  const [
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
  ] = await Promise.all([
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
    prisma.material.findMany(),
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

  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Tiêu đề + thao tác nhanh */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-blue-950">Dashboard</h2>
          <p className="text-slate-600">
            {scope.all
              ? "Tổng quan vật tư đội tàu Mercury Lines"
              : `Tổng quan vật tư ${vessels[0]?.name ?? "tàu của bạn"}`}
            <span className="text-slate-400"> · {today}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/requests"
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            + Tạo yêu cầu vật tư
          </Link>
          <Link
            href="/inventory"
            className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-blue-950 hover:bg-blue-50"
          >
            Nhập / xuất kho
          </Link>
          <Link
            href="/purchasing"
            className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-blue-950 hover:bg-blue-50"
          >
            Mua sắm
          </Link>
        </div>
      </div>

      {scope.unassigned && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          Bạn chưa được gán tàu phụ trách nên chưa xem được dữ liệu tàu. Vui
          lòng liên hệ quản trị viên.
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          href="/vessels"
          icon="⚓"
          iconBg="bg-blue-100"
          label="Đội tàu"
          value={vesselCount}
        />
        <KpiCard
          href="/materials"
          icon="🧰"
          iconBg="bg-sky-100"
          label="Vật tư danh mục"
          value={materialCount}
        />
        <KpiCard
          href="/requests"
          icon="📝"
          iconBg="bg-indigo-100"
          label="Yêu cầu đang xử lý"
          value={openRequests}
        />
        <KpiCard
          href="/purchasing"
          icon="🛒"
          iconBg="bg-violet-100"
          label="Đơn mua đang mở"
          value={openPOs}
        />
        <KpiCard
          href="/inventory"
          icon="⚠️"
          iconBg="bg-red-100"
          label="Cảnh báo tồn kho"
          value={allLowStock.length}
          valueClass={allLowStock.length > 0 ? "text-red-600" : "text-blue-950"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cột trái (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Kiểm soát nhanh phụ tùng thiết yếu */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-blue-950">
                ⚙️ Kiểm soát phụ tùng thiết yếu
              </h3>
              <div className="flex items-center gap-2">
                {spareShortages.length > 0 ? (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                    {spareShortages.length} thiếu / {spareStatus.length} theo dõi
                  </span>
                ) : spareStatus.length > 0 ? (
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                    Đủ {spareStatus.length}/{spareStatus.length}
                  </span>
                ) : null}
                <Link
                  href="/materials?type=SPARE"
                  className="text-sm text-blue-700 hover:underline"
                >
                  Danh mục →
                </Link>
              </div>
            </div>
            {spareStatus.length === 0 ? (
              <p className="text-sm text-slate-600">
                Chưa có phụ tùng thiết yếu (SPARE có mức tối thiểu) trong danh
                mục tàu.{" "}
                <Link
                  href="/materials/import"
                  className="text-blue-700 hover:underline"
                >
                  Nhập từ file MLS-11-04 →
                </Link>
              </p>
            ) : spareShortages.length === 0 ? (
              <p className="text-sm text-slate-600">
                ✅ Tất cả phụ tùng thiết yếu đều đủ mức tối thiểu.
              </p>
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
                    Xem tất cả {spareShortages.length} phụ tùng thiếu →
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Cảnh báo tồn kho */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-blue-950">
                Cảnh báo tồn kho thấp
              </h3>
              {allLowStock.length > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                  {allLowStock.length} cảnh báo
                </span>
              )}
            </div>
            {lowStockRows.length === 0 ? (
              <p className="text-slate-600">
                ✅ Không có vật tư nào dưới tồn tối thiểu.
              </p>
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
                    Xem tất cả {allLowStock.length} cảnh báo →
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Yêu cầu gần đây */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-blue-950">
                Yêu cầu vật tư gần đây
              </h3>
              <Link
                href="/requests"
                className="text-sm text-blue-700 hover:underline"
              >
                Xem tất cả →
              </Link>
            </div>
            {recentRequests.length === 0 ? (
              <p className="text-slate-600">Chưa có yêu cầu vật tư nào.</p>
            ) : (
              <div className="divide-y divide-blue-50">
                {recentRequests.map((request) => {
                  const st = REQ_STATUS[request.status] ?? {
                    label: request.status,
                    badge: "bg-slate-100 text-slate-600",
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
                          {request.kind === "SPARE" ? "Phụ tùng" : "Vật tư"} ·{" "}
                          {request.createdAt.toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.badge}`}
                      >
                        {st.label}
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
              Yêu cầu theo trạng thái
            </h3>
            {totalRequests === 0 ? (
              <p className="text-sm text-slate-600">Chưa có yêu cầu nào.</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(REQ_STATUS)
                  .filter(([status]) => reqCount(status) > 0)
                  .map(([status, meta]) => {
                    const count = reqCount(status);
                    return (
                      <div key={status}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-600">{meta.label}</span>
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
                Đơn mua hàng
              </h3>
              <Link
                href="/purchasing"
                className="text-sm text-blue-700 hover:underline"
              >
                Mua sắm →
              </Link>
            </div>
            {totalPOs === 0 ? (
              <p className="text-sm text-slate-600">Chưa có đơn mua nào.</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(PO_STATUS)
                  .filter(([status]) => poCount(status) > 0)
                  .map(([status, meta]) => {
                    const count = poCount(status);
                    return (
                      <div key={status}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-600">{meta.label}</span>
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
                Hoạt động kho gần đây
              </h3>
              <Link
                href="/inventory"
                className="text-sm text-blue-700 hover:underline"
              >
                Tồn kho →
              </Link>
            </div>
            {recentTx.length === 0 ? (
              <p className="text-sm text-slate-600">
                Chưa có giao dịch nhập/xuất nào.
              </p>
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
                          {material?.nameVn ?? `Vật tư #${tx.materialId}`}
                        </p>
                        <p className="text-xs text-slate-500">
                          {vessel?.name ?? "—"} ·{" "}
                          {tx.occurredAt.toLocaleDateString("vi-VN")}{" "}
                          {tx.occurredAt.toLocaleTimeString("vi-VN", {
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
