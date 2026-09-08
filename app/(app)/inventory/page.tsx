import React from "react";
import Form from "next/form";
import Link from "next/link";
import {
  AlertTriangle,
  Anchor,
  ArrowLeftRight,
  Boxes,
  ChevronRight,
  Cog,
  Download,
  Filter,
  History,
  LifeBuoy,
  Package,
  UtensilsCrossed,
  Warehouse,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
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
import { cn } from "@/lib/cn";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Meter,
  Notice,
  PageHeader,
  Select,
  Stat,
  Table,
  Td,
  Th,
  Tr,
  TrNhom,
  buttonClass,
  type Tone,
} from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Biểu tượng bộ phận theo `key` của lib/departments.ts — thay cho trường
 * `icon` (emoji) ở đó, cùng bộ nét vẽ với trang Danh mục vật tư.
 */
const DEPT_ICON: Record<string, LucideIcon> = {
  DECK: Anchor,
  ENGINE: Cog,
  ELEC: Zap,
  SERVICE: UtensilsCrossed,
  SAFETY: LifeBuoy,
  OTHER: Package,
};

/** Màu thanh tồn thấp theo mức thiếu: càng thiếu càng đỏ (cùng Dashboard). */
function toneThieu(pct: number): Tone {
  return pct < 40 ? "danger" : pct < 75 ? "warning" : "info";
}

const LINK = "text-brand-700 hover:underline dark:text-brand-300";

/** Tiêu đề khung gập: cùng một dáng cho mọi <details> trên trang. */
const SUMMARY =
  "flex cursor-pointer select-none list-none flex-wrap items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] [&::-webkit-details-marker]:hidden";

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
    <div className="space-y-5">
      {/* 1. Tổng quan */}
      <PageHeader
        title={scope.all ? t("inventory.tieuDeDoi") : t("inventory.tieuDeTau")}
        subtitle={t("inventory.moTa")}
      />

      {scope.unassigned && (
        <Notice tone="warning">{t("inventory.chuaGanTauTonKho")}</Notice>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          icon={<Boxes className="size-4" />}
          label={t("inventory.chiSoDong")}
          value={filtered.length}
        />
        <Stat
          icon={<AlertTriangle className="size-4" />}
          label={t("inventory.chiSoDuoiToiThieu")}
          value={lowCount}
          tone={lowCount > 0 ? "danger" : "success"}
        />
        <Stat
          icon={<Anchor className="size-4" />}
          label={t("chung.tau")}
          value={groups.length}
          tone="brand"
        />
      </div>

      {/* 2. Bộ lọc — thanh mỏng một hàng */}
      <Card padded={false}>
        {/* next/form: bấm "Lọc" chỉ tải phần nội dung (chuyển trang phía client,
            khung chờ hiện ngay) thay vì tải lại cả trang như <form method="get">. */}
        <Form
          action="/inventory"
          className="flex flex-wrap items-center gap-2 px-4 py-3"
        >
          {chonDuocTau(scope) && (
            <div className="w-52">
              <Select
                name="vessel"
                defaultValue={vesselFilter ?? ""}
                title={t("chung.tau")}
              >
                <option value="">{t("chung.tatCaTau")}</option>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} — {v.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="w-40">
            <Select
              name="wh"
              defaultValue={whFilter ?? ""}
              title={t("chung.kho")}
            >
              <option value="">{t("inventory.tatCaKho")}</option>
              {filterWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select
              name="type"
              defaultValue={typeFilter}
              title={t("inventory.loai")}
            >
              <option value="ALL">{t("inventory.loaiCaHai")}</option>
              <option value="STORE">{t("labels.typeLong_STORE")}</option>
              <option value="SPARE">{t("labels.typeLong_SPARE")}</option>
            </Select>
          </div>
          <div className="min-w-40 flex-1">
            <Input
              name="q"
              defaultValue={String(params.q ?? "")}
              placeholder={t("inventory.timPlaceholder")}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm whitespace-nowrap">
            <input
              type="checkbox"
              name="low"
              value="1"
              defaultChecked={lowOnly}
              className="size-4 rounded accent-brand-600"
            />
            <span className="text-[var(--text-secondary)]">
              {t("inventory.chiThieu")}
            </span>
          </label>
          <Button
            type="submit"
            variant="primary"
            icon={<Filter className="size-4" />}
          >
            {t("chung.loc")}
          </Button>
          <Link href="/inventory" className={buttonClass("secondary")}>
            {t("chung.boLoc")}
          </Link>
        </Form>
      </Card>

      {/* 3. Tồn kho nhóm theo tàu */}
      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Warehouse className="size-5" />}
            title={t("inventory.khongCoDongKhop")}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map(({ vessel, rows }) => {
            const groupLow = rows.filter(
              (inv) =>
                inv.quantity - inv.reservedQuantity <= inv.material.minStock
            ).length;
            return (
              <Card key={vessel.id} padded={false}>
                <details
                  open={singleVessel || groupLow > 0}
                  className="group"
                >
                  <summary className={cn(SUMMARY, "justify-between")}>
                    <span className="flex flex-wrap items-center gap-2">
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 text-[var(--text-muted)] transition-transform group-open:rotate-90"
                      />
                      <Link
                        href={`/vessels/${vessel.id}`}
                        className="inline-flex items-center gap-1.5 hover:underline"
                      >
                        <Anchor className="size-4 text-[var(--text-muted)]" />
                        <span className="font-display text-xs tracking-wide">
                          {vessel.code}
                        </span>
                        <span>— {vessel.name}</span>
                      </Link>
                      <span className="text-xs font-normal text-[var(--text-muted)]">
                        {t("inventory.nDong", { n: rows.length })}
                      </span>
                      {groupLow > 0 ? (
                        <Badge tone="danger" dot>
                          {t("inventory.nThieu", { n: groupLow })}
                        </Badge>
                      ) : (
                        <Badge tone="success" dot>
                          {t("inventory.du")}
                        </Badge>
                      )}
                    </span>
                    <a
                      href={`/api/export/inventory?vessel=${vessel.id}${typeFilter !== "ALL" ? `&type=${typeFilter}` : ""}`}
                      className={buttonClass("secondary", "sm")}
                    >
                      <Download className="size-4" />
                      MLS-11-06
                    </a>
                  </summary>
                  {/* Bảng có thanh cuộn riêng + tiêu đề ghim để dò nhanh trong danh sách dài */}
                  <div className="mx-4 mb-4 max-h-80 overflow-auto rounded-lg border border-[var(--border-subtle)]">
                    <Table dense>
                      <thead className="sticky top-0 z-10 bg-[var(--surface-raised)]">
                        <tr>
                          <Th>{t("chung.kho")}</Th>
                          <Th>{t("chung.ma")}</Th>
                          <Th>{t("inventory.cotTenVatTu")}</Th>
                          <Th>{t("chung.donVi")}</Th>
                          <Th align="right">{t("inventory.cotTon")}</Th>
                          <Th align="right">{t("inventory.cotKhaDung")}</Th>
                          <Th align="right">{t("inventory.cotToiThieu")}</Th>
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
                          const DeptIcon = DEPT_ICON[dept.key] ?? Package;
                          let prevEquipment: string | null = null;
                          return (
                            <React.Fragment key={dept.key}>
                              {/* Tiêu đề bộ phận */}
                              <TrNhom colSpan={7}>
                                <span className="inline-flex flex-wrap items-center gap-2">
                                  <DeptIcon className="size-4 text-[var(--text-muted)]" />
                                  {tTuDo(`labels.dept_${dept.key}`)}
                                  <span className="text-xs font-normal text-[var(--text-muted)]">
                                    {t("inventory.nDong", {
                                      n: deptRowsFull.length,
                                    })}
                                  </span>
                                  {deptLow > 0 && (
                                    <Badge tone="danger">
                                      {t("inventory.nThieu", { n: deptLow })}
                                    </Badge>
                                  )}
                                </span>
                              </TrNhom>
                              {conLai > 0 && (
                                <tr>
                                  <Td
                                    colSpan={7}
                                    className="bg-[var(--surface-sunken)]/60 text-xs"
                                  >
                                    <span className="text-[var(--text-muted)]">
                                      {t("inventory.dangHienNDongDau", {
                                        n: deptRows.length,
                                      })}{" "}
                                      <b className="text-[var(--text-primary)]">
                                        {conLai}
                                      </b>{" "}
                                      {t("inventory.conLaiDongNua")}
                                    </span>{" "}
                                    <Link
                                      href={`?${new URLSearchParams({
                                        ...(params.vessel ? { vessel: params.vessel } : {}),
                                        ...(params.wh ? { wh: params.wh } : {}),
                                        ...(typeFilter !== "ALL" ? { type: typeFilter } : {}),
                                        ...(q ? { q: params.q ?? "" } : {}),
                                        ...(lowOnly ? { low: "1" } : {}),
                                        full: "1",
                                      }).toString()}`}
                                      className={LINK}
                                    >
                                      {t("chung.xemTatCa")}
                                    </Link>
                                  </Td>
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
                                // Tỷ lệ tồn / tối thiểu cho thanh mức thiếu (chỉ vẽ ở dòng thiếu).
                                const pct =
                                  inventory.material.minStock > 0
                                    ? Math.max(
                                        0,
                                        Math.min(
                                          100,
                                          Math.round(
                                            (available /
                                              inventory.material.minStock) *
                                              100
                                          )
                                        )
                                      )
                                    : 0;
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
                                      <tr>
                                        <td
                                          colSpan={7}
                                          className="border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)]/60 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]"
                                        >
                                          <Wrench className="mr-1 inline size-3" />
                                          {t("inventory.phuTungThietBi", {
                                            ten: equipment ?? "",
                                          })}
                                        </td>
                                      </tr>
                                    )}
                                    <Tr className="transition-colors hover:bg-[var(--surface-sunken)]/50">
                                      <Td className="whitespace-nowrap">
                                        <span className="font-display text-xs tracking-wide text-[var(--text-muted)]">
                                          {inventory.warehouse.code}
                                        </span>
                                      </Td>
                                      <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                                        {inventory.material.code}
                                      </Td>
                                      <Td>
                                        <div
                                          className={cn(
                                            "flex flex-wrap items-center gap-1.5",
                                            isSpare && "pl-3"
                                          )}
                                        >
                                          <span>{inventory.material.nameVn}</span>
                                          {isSpare && (
                                            <Badge tone="brand">
                                              {t("inventory.badgePhuTung")}
                                            </Badge>
                                          )}
                                          {isLow && (
                                            <Badge tone="danger">
                                              {t("inventory.badgeThieu")}
                                            </Badge>
                                          )}
                                        </div>
                                      </Td>
                                      <Td>
                                        <span className="text-xs text-[var(--text-secondary)]">
                                          {inventory.material.uom}
                                        </span>
                                      </Td>
                                      <Td align="right">
                                        {inventory.quantity}
                                        {inventory.reservedQuantity > 0 && (
                                          <span className="text-xs text-[var(--text-muted)]">
                                            {" "}
                                            {t("inventory.dangGiu", {
                                              n: inventory.reservedQuantity,
                                            })}
                                          </span>
                                        )}
                                      </Td>
                                      <Td align="right">
                                        <span
                                          className={cn(
                                            "font-semibold",
                                            isLow
                                              ? "text-[var(--text-danger)]"
                                              : "text-[var(--text-success)]"
                                          )}
                                        >
                                          {available}
                                        </span>
                                        {isLow && inventory.material.minStock > 0 && (
                                          <div className="mt-1 ml-auto w-16">
                                            <Meter
                                              value={pct}
                                              tone={toneThieu(pct)}
                                            />
                                          </div>
                                        )}
                                      </Td>
                                      <Td align="right">
                                        <span className="text-[var(--text-muted)]">
                                          {inventory.material.minStock}
                                        </span>
                                      </Td>
                                    </Tr>
                                  </React.Fragment>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                </details>
              </Card>
            );
          })}
        </div>
      )}

      {/* 4. Thao tác nhập / xuất (gập) */}
      {canTransact && (
        <Card padded={false}>
          <details className="group">
            <summary className={SUMMARY}>
              <ChevronRight
                aria-hidden="true"
                className="size-4 text-[var(--text-muted)] transition-transform group-open:rotate-90"
              />
              <ArrowLeftRight className="size-4 text-[var(--text-muted)]" />
              {t("inventory.nutNhapXuat")}
            </summary>
            <div className="border-t border-[var(--border-subtle)] px-4 py-4">
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
        </Card>
      )}

      {/* 5. Nhật ký giao dịch (gập) */}
      <Card padded={false}>
        <details className="group">
          <summary className={SUMMARY}>
            <ChevronRight
              aria-hidden="true"
              className="size-4 text-[var(--text-muted)] transition-transform group-open:rotate-90"
            />
            <History className="size-4 text-[var(--text-muted)]" />
            {t("inventory.lichSuGanDay")}
            <span className="text-xs font-normal text-[var(--text-muted)]">
              ({t("inventory.nGiaoDichMoiNhat", { n: recentTx.length })})
            </span>
          </summary>
          <div className="border-t border-[var(--border-subtle)] px-4 py-4">
            {recentTx.length === 0 ? (
              <EmptyState
                icon={<History className="size-5" />}
                title={t("inventory.chuaCoGiaoDich")}
              />
            ) : (
              <div className="max-h-80 overflow-auto rounded-lg border border-[var(--border-subtle)]">
                <Table dense>
                  <thead className="sticky top-0 z-10 bg-[var(--surface-raised)]">
                    <tr>
                      <Th>{t("inventory.cotThoiDiem")}</Th>
                      <Th>{t("inventory.loai")}</Th>
                      <Th>{t("chung.vatTu")}</Th>
                      <Th>{t("chung.kho")}</Th>
                      <Th align="right">{t("inventory.cotSoLuongNgan")}</Th>
                      <Th>{t("chung.nguoiThucHien")}</Th>
                      <Th>{t("chung.ghiChu")}</Th>
                      <Th>{t("inventory.cotGhiSoLuc")}</Th>
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
                      const isIn = tx.type === "IN";
                      return (
                        <Tr
                          key={tx.id}
                          className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                        >
                          <Td className="font-medium whitespace-nowrap">
                            {ngayGio(tx.occurredAt)}
                          </Td>
                          <Td>
                            <Badge tone={isIn ? "success" : "warning"}>
                              {tTuDo(`labels.tx_${tx.type}`)}
                            </Badge>
                          </Td>
                          <Td>
                            {material ? (
                              <span className="inline-flex flex-wrap items-center gap-1.5">
                                <span className="font-display text-xs tracking-wide">
                                  {material.code}
                                </span>
                                <span>— {material.nameVn}</span>
                                {/* Có tên rồi vẫn phải nói rõ hàng đã ngừng dùng:
                                    người xem lịch sử dễ đi tìm mặt hàng này trong
                                    danh mục hiện hành rồi tưởng dữ liệu sai. */}
                                {idNgungDung.has(tx.materialId) && (
                                  <Badge tone="muted">
                                    {t("inventory.daNgungDung")}
                                  </Badge>
                                )}
                              </span>
                            ) : (
                              // Chỉ còn rơi vào đây khi bản ghi vật tư bị xóa hẳn
                              // khỏi database, không phải khi ngừng dùng.
                              `#${tx.materialId}`
                            )}
                          </Td>
                          <Td className="whitespace-nowrap">
                            <span className="font-display text-xs tracking-wide text-[var(--text-muted)]">
                              {warehouse ? warehouse.code : `#${tx.warehouseId}`}
                            </span>
                          </Td>
                          <Td align="right">
                            <span
                              className={cn(
                                "font-semibold",
                                isIn
                                  ? "text-[var(--text-success)]"
                                  : "text-[var(--text-warning)]"
                              )}
                            >
                              {isIn ? "+" : "−"}
                              {tx.quantity}
                            </span>
                          </Td>
                          <Td>{tx.performedBy ?? "—"}</Td>
                          <Td>
                            <span className="text-[var(--text-secondary)]">
                              {tx.note}
                            </span>
                          </Td>
                          <Td>
                            <span className="text-xs text-[var(--text-muted)]">
                              {backdated ? ngayGio(tx.createdAt) : "—"}
                            </span>
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              {t("inventory.ghiChuGhiSoLuc")}
            </p>
          </div>
        </details>
      </Card>
    </div>
  );
}
