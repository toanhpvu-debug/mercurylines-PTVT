import React from "react";
import Form from "next/form";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  sortWithinDepartment,
  DEPARTMENTS,
  departmentOfMaterial,
} from "@/lib/departments";
import InventoryForm from "@/components/InventoryForm";
import {
  chonDuocTau,
  danhTinhHieuLuc,
  requireScopedUser,
  trongPhamVi,
  vesselIdWhere,
  vesselScopeDayDu,
  vesselWhere,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { VAN_HANH_TAU } from "@/lib/roles";

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
    full?: string;
  }>;
}) {
  const user = await requireScopedUser();
  const { t, tTuDo, ngayGio } = await layT();
  const scope = vesselScopeDayDu(user);
  // Phải khớp đúng danh sách của createInventoryTransaction (VAN_HANH_TAU,
  // app/actions.ts) — liệt kê tay ở đây làm máy trưởng không thấy form dù server
  // vẫn cho ghi. Tính cả danh tính mượn qua ủy quyền.
  const canTransact = danhTinhHieuLuc(user).some((d) =>
    VAN_HANH_TAU.includes(d.role)
  );
  const params = await searchParams;

  // Bộ lọc — người dùng bị giới hạn tàu thì ?vessel bị bỏ qua (chống truy cập chéo).
  const vesselFilterRaw = Number(params.vessel);
  const vesselFilter = chonDuocTau(scope)
    ? Number.isInteger(vesselFilterRaw) &&
      vesselFilterRaw > 0 &&
      trongPhamVi(scope, vesselFilterRaw)
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
  const showAll = params.full === "1";

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
        where: vesselIdWhere(scope),
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
      prisma.inventoryTransaction.findMany({
        where: vesselWhere(scope),
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 25,
      }),
    ]);
  // Chỉ dựng sẵn một số dòng đầu mỗi bộ phận, giống trang Danh mục vật tư.
  //
  // Bảng tồn kho của cả đội tàu là bảng dài nhất trong app: mỗi tàu vài trăm
  // mặt hàng × 7 tàu. Dựng hết ra HTML thì trang nặng và trình duyệt phải dựng
  // hàng nghìn ô — trong khi người mở trang gần như luôn đi tìm MỘT mặt hàng,
  // và đã có ô tìm kiếm cùng bộ lọc "chỉ hàng dưới định mức" để tới thẳng nó.
  const GIOI_HAN_MOI_BO_PHAN = 40;

  // Vật tư ĐÃ NGỪNG DÙNG vẫn nằm nguyên trong lịch sử nhập xuất, nhưng truy vấn
  // `materials` ở trên cố ý chỉ lấy isActive:true — ô chọn vật tư của form
  // nhập/xuất không được phép chào lại hàng đã ngừng. Hệ quả nếu chỉ tra bảng
  // đó: mọi dòng lịch sử của mặt hàng vừa bị ngừng dùng hiện ra là "#123",
  // đúng những dòng người ta cần tra lại nhất thì lại không đọc được là gì.
  // Nên tra BÙ đúng phần thiếu thay vì nới bộ lọc của form.
  const idThieu = [...new Set(recentTx.map((t) => t.materialId))].filter(
    (id) => !materials.some((m) => m.id === id)
  );
  const materialNgungDung = idThieu.length
    ? await prisma.material.findMany({
        where: { id: { in: idThieu } },
        select: { id: true, code: true, nameVn: true },
      })
    : [];
  const idNgungDung = new Set(materialNgungDung.map((m) => m.id));
  const materialById = new Map(
    [...materials, ...materialNgungDung].map((m) => [m.id, m])
  );

  const warehouseById = new Map(warehouses.map((w) => [w.id, w]));

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
      inv.material.materialType,
      inv.material.department
    );
  const deptSections = DEPARTMENTS;
  const sortDeptRows = (rows: InvRow[]) =>
    sortWithinDepartment(rows, (inv) => ({
      materialType: inv.material.materialType,
      equipment: inv.material.equipment,
      categoryName: inv.material.category?.name ?? null,
      nameVn: inv.material.nameVn,
    }));

  return (
    <div className="space-y-4">
      {/* 1. Tổng quan */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-blue-950">
            {scope.all ? t("inventory.tieuDeDoi") : t("inventory.tieuDeTau")}
          </h2>
          <p className="text-sm text-slate-600">{t("inventory.moTa")}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm ring-1 ring-blue-100">
            <span className="text-slate-500">{t("inventory.chiSoDong")}:</span>{" "}
            <b className="text-blue-950">{filtered.length}</b>
          </span>
          <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm ring-1 ring-blue-100">
            <span className="text-slate-500">
              {t("inventory.chiSoDuoiToiThieu")}:
            </span>{" "}
            <b className={lowCount > 0 ? "text-red-600" : "text-green-700"}>
              {lowCount}
            </b>
          </span>
          <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm ring-1 ring-blue-100">
            <span className="text-slate-500">{t("chung.tau")}:</span>{" "}
            <b className="text-blue-950">{groups.length}</b>
          </span>
        </div>
      </div>

      {scope.unassigned && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          {t("inventory.chuaGanTauTonKho")}
        </div>
      )}

      {/* 2. Bộ lọc — thanh mỏng một hàng */}
      <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-blue-100">
        {/* next/form: bấm "Lọc" chỉ tải phần nội dung (chuyển trang phía client,
            khung chờ hiện ngay) thay vì tải lại cả trang như <form method="get">. */}
        <Form action="/inventory" className="flex flex-wrap items-center gap-2 text-sm">
          {chonDuocTau(scope) && (
            <select
              name="vessel"
              defaultValue={vesselFilter ?? ""}
              className="rounded border p-1.5"
              title={t("chung.tau")}
            >
              <option value="">{t("chung.tatCaTau")}</option>
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
            title={t("chung.kho")}
          >
            <option value="">{t("inventory.tatCaKho")}</option>
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
            title={t("inventory.loai")}
          >
            <option value="ALL">{t("inventory.loaiCaHai")}</option>
            <option value="STORE">{t("labels.typeLong_STORE")}</option>
            <option value="SPARE">{t("labels.typeLong_SPARE")}</option>
          </select>
          <input
            name="q"
            defaultValue={String(params.q ?? "")}
            placeholder={t("inventory.timPlaceholder")}
            className="min-w-40 flex-1 rounded border p-1.5"
          />
          <label className="flex items-center gap-1.5 whitespace-nowrap">
            <input
              type="checkbox"
              name="low"
              value="1"
              defaultChecked={lowOnly}
            />
            <span className="text-slate-700">{t("inventory.chiThieu")}</span>
          </label>
          <button className="rounded bg-blue-700 px-4 py-1.5 text-white hover:bg-blue-800">
            {t("chung.loc")}
          </button>
          <Link
            href="/inventory"
            className="rounded border border-blue-200 px-3 py-1.5 text-blue-950 hover:bg-blue-50"
          >
            {t("chung.boLoc")}
          </Link>
        </Form>
      </div>

      {/* 3. Tồn kho nhóm theo tàu */}
      {groups.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-slate-600 shadow-sm ring-1 ring-blue-100">
          {t("inventory.khongCoDongKhop")}
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
                      {t("inventory.nDong", { n: rows.length })}
                    </span>
                    {groupLow > 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        {t("inventory.nThieu", { n: groupLow })}
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        {t("inventory.du")}
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
                        <th className="p-1.5">{t("chung.kho")}</th>
                        <th className="p-1.5">{t("chung.ma")}</th>
                        <th className="p-1.5">{t("inventory.cotTenVatTu")}</th>
                        <th className="p-1.5">{t("chung.donVi")}</th>
                        <th className="p-1.5 text-right">
                          {t("inventory.cotTon")}
                        </th>
                        <th className="p-1.5 text-right">
                          {t("inventory.cotKhaDung")}
                        </th>
                        <th className="p-1.5 text-right">
                          {t("inventory.cotToiThieu")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptSections.map((dept) => {
                        const deptRowsFull = sortDeptRows(
                          rows.filter((inv) => deptKeyOf(inv) === dept.key)
                        );
                        if (!deptRowsFull.length) return null;
                        // Cắt bớt để trang không phình theo số dòng tồn kho;
                        // số ở tiêu đề vẫn là TỔNG THẬT, không phải số đang hiện.
                        const deptRows = showAll
                          ? deptRowsFull
                          : deptRowsFull.slice(0, GIOI_HAN_MOI_BO_PHAN);
                        const conLai = deptRowsFull.length - deptRows.length;
                        const deptLow = deptRowsFull.filter(
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
                                {dept.icon} {tTuDo(`labels.dept_${dept.key}`)}
                                <span className="ml-2 font-normal normal-case text-slate-500">
                                  {t("inventory.nDong", {
                                    n: deptRowsFull.length,
                                  })}
                                  {deptLow > 0
                                    ? ` · ${t("inventory.nThieu", { n: deptLow })}`
                                    : ""}
                                </span>
                              </td>
                            </tr>
                            {conLai > 0 && (
                              <tr className="border-b bg-slate-50/60">
                                <td colSpan={7} className="px-3 py-1.5 text-xs text-slate-500">
                                  {t("inventory.dangHienNDongDau", {
                                    n: deptRows.length,
                                  })}{" "}
                                  <b>{conLai}</b> {t("inventory.conLaiDongNua")}{" "}
                                  <Link
                                    href={`?${new URLSearchParams({
                                      ...(params.vessel ? { vessel: params.vessel } : {}),
                                      ...(params.wh ? { wh: params.wh } : {}),
                                      ...(typeFilter !== "ALL" ? { type: typeFilter } : {}),
                                      ...(q ? { q: params.q ?? "" } : {}),
                                      ...(lowOnly ? { low: "1" } : {}),
                                      full: "1",
                                    }).toString()}`}
                                    className="text-blue-700 hover:underline"
                                  >
                                    {t("chung.xemTatCa")}
                                  </Link>
                                </td>
                              </tr>
                            )}
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
                                ? (inventory.material.equipment ??
                                  t("inventory.thietBiKhac"))
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
                                        {t("inventory.phuTungThietBi", {
                                          ten: equipment ?? "",
                                        })}
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
                                          {t("inventory.badgePhuTung")}
                                        </span>
                                      )}
                                      {isLow && (
                                        <span className="ml-1.5 rounded bg-red-100 px-1 py-0.5 text-[10px] font-semibold text-red-700">
                                          {t("inventory.badgeThieu")}
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
                                          {t("inventory.dangGiu", {
                                            n: inventory.reservedQuantity,
                                          })}
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
            {t("inventory.nutNhapXuat")}
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
          {t("inventory.lichSuGanDay")}{" "}
          <span className="text-sm font-normal text-slate-500">
            ({t("inventory.nGiaoDichMoiNhat", { n: recentTx.length })})
          </span>
        </summary>
        <div className="px-4 pb-4">
          {recentTx.length === 0 ? (
            <p className="text-slate-600">{t("inventory.chuaCoGiaoDich")}</p>
          ) : (
            <div className="max-h-80 overflow-auto rounded border border-blue-100">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-blue-200 bg-blue-50 text-left text-xs uppercase tracking-wide text-blue-950">
                    <th className="p-1.5">{t("inventory.cotThoiDiem")}</th>
                    <th className="p-1.5">{t("inventory.loai")}</th>
                    <th className="p-1.5">{t("chung.vatTu")}</th>
                    <th className="p-1.5">{t("chung.kho")}</th>
                    <th className="p-1.5 text-right">
                      {t("inventory.cotSoLuongNgan")}
                    </th>
                    <th className="p-1.5">{t("chung.nguoiThucHien")}</th>
                    <th className="p-1.5">{t("chung.ghiChu")}</th>
                    <th className="p-1.5">{t("inventory.cotGhiSoLuc")}</th>
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
                          {ngayGio(tx.occurredAt)}
                        </td>
                        <td className="p-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              tx.type === "IN"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {tTuDo(`labels.tx_${tx.type}`)}
                          </span>
                        </td>
                        <td className="p-1.5">
                          {material ? (
                            <>
                              {material.code} — {material.nameVn}
                              {/* Có tên rồi vẫn phải nói rõ hàng đã ngừng dùng:
                                  người xem lịch sử dễ đi tìm mặt hàng này trong
                                  danh mục hiện hành rồi tưởng dữ liệu sai. */}
                              {idNgungDung.has(tx.materialId) && (
                                <span className="ml-1 rounded bg-slate-200 px-1 py-0.5 text-[10px] font-medium text-slate-600">
                                  {t("inventory.daNgungDung")}
                                </span>
                              )}
                            </>
                          ) : (
                            // Chỉ còn rơi vào đây khi bản ghi vật tư bị xóa hẳn
                            // khỏi database, không phải khi ngừng dùng.
                            `#${tx.materialId}`
                          )}
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
                          {backdated ? ngayGio(tx.createdAt) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {t("inventory.ghiChuGhiSoLuc")}
          </p>
        </div>
      </details>
    </div>
  );
}
