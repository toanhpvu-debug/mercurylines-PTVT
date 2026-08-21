import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  compareWithinDepartment,
  DEPARTMENTS,
  departmentOfMaterial,
} from "@/lib/departments";
import InventoryForm from "@/components/InventoryForm";
import { requireScopedUser, vesselScope, vesselWhere } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Bố cục theo luồng làm việc: Tổng quan (KPI) → Bộ lọc → Tồn kho theo tàu
// → Thao tác nhập/xuất (gập) → Nhật ký giao dịch (gập).
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    vessel?: string;
    wh?: string;
    type?: string;
    q?: string;
    low?: string;
  }>;
}) {
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  const canTransact = ["ADMIN", "MASTER"].includes(user.role);
  const params = await searchParams;

  // Bộ lọc — người dùng bị giới hạn tàu thì ?vessel bị bỏ qua (chống truy cập chéo).
  const vesselFilterRaw = Number(params.vessel);
  const vesselFilter = scope.all
    ? Number.isInteger(vesselFilterRaw) && vesselFilterRaw > 0
      ? vesselFilterRaw
      : null
    : (scope.vesselId ?? null);
  const whFilterRaw = Number(params.wh);
  const whFilter =
    Number.isInteger(whFilterRaw) && whFilterRaw > 0 ? whFilterRaw : null;
  const typeFilter = ["STORE", "SPARE"].includes(String(params.type))
    ? String(params.type)
    : "ALL";
  const q = String(params.q ?? "").trim().toLowerCase();
  const lowOnly = params.low === "1";

  const [inventories, materials, warehouses, vessels, recentTx] =
    await Promise.all([
      prisma.inventory.findMany({
        where: {
          ...vesselWhere(scope),
          ...(vesselFilter ? { vesselId: vesselFilter } : {}),
          ...(whFilter ? { warehouseId: whFilter } : {}),
        },
        orderBy: [{ vesselId: "asc" }, { materialId: "asc" }],
        include: {
          vessel: true,
          warehouse: true,
          material: { include: { category: true } },
        },
      }),
      // Chỉ lấy 3 cột thật sự dùng (ô chọn vật tư của form nhập/xuất và bảng
      // lịch sử giao dịch) — trước đây kéo toàn bộ cột của 600+ vật tư.
      prisma.material.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, nameVn: true },
      }),
      prisma.warehouse.findMany({
        where: vesselWhere(scope),
        orderBy: { code: "asc" },
        include: { vessel: true },
      }),
      prisma.vessel.findMany({
        where: scope.all ? {} : { id: scope.vesselId ?? -1 },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
      prisma.inventoryTransaction.findMany({
        where: vesselWhere(scope),
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 25,
      }),
    ]);
  const materialById = new Map(materials.map((m) => [m.id, m]));
  const warehouseById = new Map(warehouses.map((w) => [w.id, w]));
  const fmtTime = (d: Date) =>
    `${d.toLocaleDateString("vi-VN")} ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;

  // Áp bộ lọc loại / tìm kiếm / chỉ-thiếu (dữ liệu nhỏ — lọc tại chỗ).
  const filtered = inventories.filter((inv) => {
    if (typeFilter !== "ALL" && inv.material.materialType !== typeFilter)
      return false;
    if (
      q &&
      !inv.material.nameVn.toLowerCase().includes(q) &&
      !inv.material.code.toLowerCase().includes(q) &&
      !(inv.material.impa ?? "").toLowerCase().includes(q)
    )
      return false;
    if (
      lowOnly &&
      !(inv.quantity - inv.reservedQuantity <= inv.material.minStock)
    )
      return false;
    return true;
  });

  // Nhóm theo tàu để nhìn tổng quan đội tàu.
  const byVessel = new Map<
    number,
    { vessel: (typeof inventories)[number]["vessel"]; rows: typeof filtered }
  >();
  for (const inv of filtered) {
    const g = byVessel.get(inv.vesselId);
    if (g) g.rows.push(inv);
    else byVessel.set(inv.vesselId, { vessel: inv.vessel, rows: [inv] });
  }
  const groups = [...byVessel.values()].sort((a, b) =>
    a.vessel.code.localeCompare(b.vessel.code)
  );
  const lowCount = filtered.filter(
    (inv) => inv.quantity - inv.reservedQuantity <= inv.material.minStock
  ).length;
  const singleVessel = groups.length === 1;

  // Kho hiển thị trong bộ lọc: theo tàu đã chọn (nếu có).
  const filterWarehouses = vesselFilter
    ? warehouses.filter((w) => w.vesselId === vesselFilter)
    : warehouses;

  // Phân bộ phận dùng chung với trang Danh mục vật tư (lib/departments.ts).
  type InvRow = (typeof filtered)[number];
  const deptKeyOf = (inv: InvRow): string =>
    departmentOfMaterial(
      [
        inv.material.category?.name,
        inv.material.equipment,
        inv.warehouse.code,
      ],
      inv.material.materialType
    );
  const deptSections = DEPARTMENTS;
  const withCat = (m: InvRow["material"]) => ({
    ...m,
    categoryName: m.category?.name ?? null,
  });
  const sortDeptRows = (rows: InvRow[]) =>
    [...rows].sort((a, b) =>
      compareWithinDepartment(withCat(a.material), withCat(b.material))
    );

  return (
    <div className="space-y-4">
      {/* 1. Tổng quan */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-blue-950">
            {scope.all ? "Tồn kho đội tàu" : "Tồn kho tàu của bạn"}
          </h2>
          <p className="text-sm text-slate-600">
            Tổng quan → lọc → chi tiết từng tàu · nhập/xuất và nhật ký ở cuối
            trang
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm ring-1 ring-blue-100">
            <span className="text-slate-500">Dòng:</span>{" "}
            <b className="text-blue-950">{filtered.length}</b>
          </span>
          <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm ring-1 ring-blue-100">
            <span className="text-slate-500">Dưới tối thiểu:</span>{" "}
            <b className={lowCount > 0 ? "text-red-600" : "text-green-700"}>
              {lowCount}
            </b>
          </span>
          <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm ring-1 ring-blue-100">
            <span className="text-slate-500">Tàu:</span>{" "}
            <b className="text-blue-950">{groups.length}</b>
          </span>
        </div>
      </div>

      {scope.unassigned && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          Bạn chưa được gán tàu phụ trách nên chưa xem được tồn kho. Vui lòng
          liên hệ quản trị viên.
        </div>
      )}

      {/* 2. Bộ lọc — thanh mỏng một hàng */}
      <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-blue-100">
        <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
          {scope.all && (
            <select
              name="vessel"
              defaultValue={vesselFilter ?? ""}
              className="rounded border p-1.5"
              title="Tàu"
            >
              <option value="">Tất cả tàu</option>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} — {v.name}
                </option>
              ))}
            </select>
          )}
          <select
            name="wh"
            defaultValue={whFilter ?? ""}
            className="rounded border p-1.5"
            title="Kho"
          >
            <option value="">Tất cả kho</option>
            {filterWarehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code}
              </option>
            ))}
          </select>
          <select
            name="type"
            defaultValue={typeFilter}
            className="rounded border p-1.5"
            title="Loại"
          >
            <option value="ALL">Store + Spare</option>
            <option value="STORE">Vật tư (Store)</option>
            <option value="SPARE">Phụ tùng (Spare)</option>
          </select>
          <input
            name="q"
            defaultValue={String(params.q ?? "")}
            placeholder="Tìm tên / mã / IMPA..."
            className="min-w-40 flex-1 rounded border p-1.5"
          />
          <label className="flex items-center gap-1.5 whitespace-nowrap">
            <input
              type="checkbox"
              name="low"
              value="1"
              defaultChecked={lowOnly}
            />
            <span className="text-slate-700">Chỉ thiếu</span>
          </label>
          <button className="rounded bg-blue-700 px-4 py-1.5 text-white hover:bg-blue-800">
            Lọc
          </button>
          <Link
            href="/inventory"
            className="rounded border border-blue-200 px-3 py-1.5 text-blue-950 hover:bg-blue-50"
          >
            Xóa lọc
          </Link>
        </form>
      </div>

      {/* 3. Tồn kho nhóm theo tàu */}
      {groups.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-slate-600 shadow-sm ring-1 ring-blue-100">
          Không có dòng tồn kho nào khớp bộ lọc.
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(({ vessel, rows }) => {
            const groupLow = rows.filter(
              (inv) =>
                inv.quantity - inv.reservedQuantity <= inv.material.minStock
            ).length;
            return (
              <details
                key={vessel.id}
                open={singleVessel || groupLow > 0}
                className="group rounded-xl bg-white shadow-sm ring-1 ring-blue-100"
              >
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5 hover:bg-blue-50/50">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="text-xs text-slate-400 transition-transform group-open:rotate-90"
                    >
                      ▶
                    </span>
                    <Link
                      href={`/vessels/${vessel.id}`}
                      className="text-sm font-semibold text-blue-950 hover:underline"
                    >
                      ⚓ {vessel.code} — {vessel.name}
                    </Link>
                    <span className="text-xs text-slate-500">
                      {rows.length} dòng
                    </span>
                    {groupLow > 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        {groupLow} thiếu
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        đủ
                      </span>
                    )}
                  </span>
                  <a
                    href={`/api/export/inventory?vessel=${vessel.id}${typeFilter !== "ALL" ? `&type=${typeFilter}` : ""}`}
                    className="rounded border border-blue-200 px-2.5 py-1 text-xs text-blue-950 hover:bg-blue-50"
                  >
                    ⬇ MLS-11-06
                  </a>
                </summary>
                {/* Bảng có thanh cuộn riêng + tiêu đề ghim để dò nhanh trong danh sách dài */}
                <div className="mx-4 mb-3 max-h-80 overflow-auto rounded border border-blue-100">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-blue-200 bg-blue-50 text-left text-xs uppercase tracking-wide text-blue-950">
                        <th className="p-1.5">Kho</th>
                        <th className="p-1.5">Mã</th>
                        <th className="p-1.5">Tên vật tư</th>
                        <th className="p-1.5">ĐVT</th>
                        <th className="p-1.5 text-right">Tồn</th>
                        <th className="p-1.5 text-right">Khả dụng</th>
                        <th className="p-1.5 text-right">Tối thiểu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptSections.map((dept) => {
                        const deptRows = sortDeptRows(
                          rows.filter((inv) => deptKeyOf(inv) === dept.key)
                        );
                        if (!deptRows.length) return null;
                        const deptLow = deptRows.filter(
                          (inv) =>
                            inv.quantity - inv.reservedQuantity <=
                            inv.material.minStock
                        ).length;
                        let prevEquipment: string | null = null;
                        return (
                          <React.Fragment key={dept.key}>
                            {/* Tiêu đề bộ phận */}
                            <tr className="border-b border-blue-200 bg-blue-100/70">
                              <td
                                colSpan={7}
                                className="p-1.5 text-xs font-bold uppercase tracking-wide text-blue-950"
                              >
                                {dept.icon} {dept.label}
                                <span className="ml-2 font-normal normal-case text-slate-500">
                                  {deptRows.length} dòng
                                  {deptLow > 0 ? ` · ${deptLow} thiếu` : ""}
                                </span>
                              </td>
                            </tr>
                            {deptRows.map((inventory) => {
                              const available =
                                inventory.quantity -
                                inventory.reservedQuantity;
                              const isLow =
                                available <= inventory.material.minStock;
                              const isSpare =
                                inventory.material.materialType === "SPARE";
                              // Tiêu đề nhóm thiết bị cho phụ tùng
                              const equipment = isSpare
                                ? (inventory.material.equipment ?? "Thiết bị khác")
                                : null;
                              const showEquipmentHeader =
                                equipment !== null &&
                                equipment !== prevEquipment;
                              if (equipment !== null) prevEquipment = equipment;
                              return (
                                <React.Fragment key={inventory.id}>
                                  {showEquipmentHeader && (
                                    <tr className="border-b bg-indigo-50/60">
                                      <td
                                        colSpan={7}
                                        className="p-1 pl-4 text-[11px] font-semibold text-indigo-800"
                                      >
                                        🔧 Phụ tùng — {equipment}
                                      </td>
                                    </tr>
                                  )}
                                  <tr
                                    className={`border-b ${isLow ? "bg-red-50/60" : ""}`}
                                  >
                                    <td className="p-1.5 text-xs text-slate-500">
                                      {inventory.warehouse.code}
                                    </td>
                                    <td className="p-1.5 text-xs text-slate-500">
                                      {inventory.material.code}
                                    </td>
                                    <td
                                      className={`p-1.5 ${isSpare ? "pl-5" : ""}`}
                                    >
                                      {inventory.material.nameVn}
                                      {isSpare && (
                                        <span className="ml-1.5 rounded bg-indigo-100 px-1 py-0.5 text-[10px] text-indigo-700">
                                          PT
                                        </span>
                                      )}
                                      {isLow && (
                                        <span className="ml-1.5 rounded bg-red-100 px-1 py-0.5 text-[10px] font-semibold text-red-700">
                                          THIẾU
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-1.5 text-xs">
                                      {inventory.material.uom}
                                    </td>
                                    <td className="p-1.5 text-right">
                                      {inventory.quantity}
                                      {inventory.reservedQuantity > 0 && (
                                        <span className="text-xs text-slate-400">
                                          {" "}
                                          (giữ {inventory.reservedQuantity})
                                        </span>
                                      )}
                                    </td>
                                    <td
                                      className={`p-1.5 text-right font-semibold ${
                                        isLow
                                          ? "text-red-600"
                                          : "text-green-700"
                                      }`}
                                    >
                                      {available}
                                    </td>
                                    <td className="p-1.5 text-right text-slate-500">
                                      {inventory.material.minStock}
                                    </td>
                                  </tr>
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      )}

      {/* 4. Thao tác nhập / xuất (gập) */}
      {canTransact && (
        <details className="rounded-xl bg-white shadow-sm ring-1 ring-blue-100">
          <summary className="cursor-pointer rounded-xl px-4 py-3 font-semibold text-blue-950 hover:bg-blue-50/50">
            ➕ Nhập / xuất kho
          </summary>
          <div className="px-4 pb-4">
            <InventoryForm
              materials={materials.map((material) => ({
                id: material.id,
                code: material.code,
                nameVn: material.nameVn,
              }))}
              warehouses={warehouses.map((warehouse) => ({
                id: warehouse.id,
                code: warehouse.code,
                name: warehouse.name,
              }))}
            />
          </div>
        </details>
      )}

      {/* 5. Nhật ký giao dịch (gập) */}
      <details className="rounded-xl bg-white shadow-sm ring-1 ring-blue-100">
        <summary className="cursor-pointer rounded-xl px-4 py-3 font-semibold text-blue-950 hover:bg-blue-50/50">
          🕘 Lịch sử nhập xuất gần đây{" "}
          <span className="text-sm font-normal text-slate-500">
            ({recentTx.length} giao dịch mới nhất — có thời điểm & người thực
            hiện)
          </span>
        </summary>
        <div className="px-4 pb-4">
          {recentTx.length === 0 ? (
            <p className="text-slate-600">Chưa có giao dịch nào.</p>
          ) : (
            <div className="max-h-80 overflow-auto rounded border border-blue-100">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-blue-200 bg-blue-50 text-left text-xs uppercase tracking-wide text-blue-950">
                    <th className="p-1.5">Thời điểm thực hiện</th>
                    <th className="p-1.5">Loại</th>
                    <th className="p-1.5">Vật tư</th>
                    <th className="p-1.5">Kho</th>
                    <th className="p-1.5 text-right">SL</th>
                    <th className="p-1.5">Người thực hiện</th>
                    <th className="p-1.5">Ghi chú</th>
                    <th className="p-1.5">Ghi sổ lúc</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTx.map((tx) => {
                    const material = materialById.get(tx.materialId);
                    const warehouse = warehouseById.get(tx.warehouseId);
                    const backdated =
                      Math.abs(
                        tx.createdAt.getTime() - tx.occurredAt.getTime()
                      ) >
                      60 * 1000;
                    return (
                      <tr key={tx.id} className="border-b">
                        <td className="p-1.5 font-medium text-blue-950">
                          {fmtTime(tx.occurredAt)}
                        </td>
                        <td className="p-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              tx.type === "IN"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {tx.type === "IN" ? "Nhập" : "Xuất"}
                          </span>
                        </td>
                        <td className="p-1.5">
                          {material
                            ? `${material.code} — ${material.nameVn}`
                            : `#${tx.materialId}`}
                        </td>
                        <td className="p-1.5 text-xs text-slate-500">
                          {warehouse ? warehouse.code : `#${tx.warehouseId}`}
                        </td>
                        <td
                          className={`p-1.5 text-right font-semibold ${
                            tx.type === "IN"
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }`}
                        >
                          {tx.type === "IN" ? "+" : "−"}
                          {tx.quantity}
                        </td>
                        <td className="p-1.5">{tx.performedBy ?? "—"}</td>
                        <td className="p-1.5 text-slate-500">{tx.note}</td>
                        <td className="p-1.5 text-xs text-slate-400">
                          {backdated ? fmtTime(tx.createdAt) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Cột &quot;Ghi sổ lúc&quot; chỉ hiện khi giao dịch được nhập bù (thời
            điểm thực hiện khác thời điểm ghi vào hệ thống).
          </p>
        </div>
      </details>
    </div>
  );
}
