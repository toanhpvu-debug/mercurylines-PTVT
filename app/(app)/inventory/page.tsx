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
  Printer,
  Users,
  UtensilsCrossed,
  Warehouse,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { BarChart3, ClipboardCheck, FileSpreadsheet, QrCode, Tag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  sortWithinDepartment,
  DEPARTMENTS,
} from "@/lib/departments";
import { nhomCuaVatTu } from "@/lib/phanNhomBanChat";
import { chucDanhCuaNguoiDung } from "@/lib/maVatTu";
import { chucDanhBaoTrum, docLocChucDanh, phamViChucDanh } from "@/lib/chucDanhChiuTrachNhiem";
import { chucDanhGiuCua, tonTheoChucDanh } from "@/lib/tonTheoChucDanh";
import InventoryForm from "@/components/InventoryForm";
import NhapXuatHangLoat from "@/components/NhapXuatHangLoat";
import KhungBang from "@/components/KhungBang";
import ChonChucDanh from "@/components/ChonChucDanh";
import {
  duongDanTheKho,
  khoaDongTon,
  layNhapXuatGanNhat,
  type GiaoDichGanNhat,
} from "@/lib/theKho";
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
import { VAN_HANH_TAU, XUAT_TON_KHO } from "@/lib/roles";
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
  TableWrap,
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
/** Liên kết không tô màu sẵn (tên mặt hàng, mã kho) — rê chuột mới hiện, bảng khỏi xanh lè. */
const LINK_AN = "hover:text-brand-700 hover:underline dark:hover:text-brand-300";
/** Ô tick của dòng tồn (nhập / xuất hàng loạt — components/NhapXuatHangLoat.tsx). */
const O_TICK = "size-4 accent-brand-600 align-middle";

/**
 * Ô "nhập / xuất gần nhất" của một dòng tồn: ngày · số lượng, ghi chú ở dòng
 * dưới (cắt ngắn, rê chuột thấy đủ). Trả lời ngay câu "món này lần cuối động
 * tới khi nào" mà không phải mở thẻ kho.
 */
function ONhapXuat({
  gd,
  isIn,
  ngay,
  chuaCo,
}: {
  gd?: GiaoDichGanNhat;
  isIn: boolean;
  ngay: (d: Date) => string;
  chuaCo: string;
}) {
  if (!gd) {
    return <span className="text-xs text-[var(--text-muted)]">{chuaCo}</span>;
  }
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="text-xs">
        <span className="font-medium">{ngay(gd.occurredAt)}</span>{" "}
        <span
          className={cn(
            "font-semibold",
            isIn ? "text-[var(--text-success)]" : "text-[var(--text-warning)]"
          )}
        >
          {isIn ? "+" : "−"}
          {gd.quantity}
        </span>
      </span>
      {gd.note && (
        <span
          className="max-w-44 truncate text-xs text-[var(--text-muted)]"
          title={gd.note}
        >
          {gd.note}
        </span>
      )}
    </span>
  );
}

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
    rank?: string;
  }>;
}) {
  const user = await requireScopedUser();
  const { t, tTuDo, ngay, ngayGio, tenChucDanh, tenBoPhan } = await layT();
  const scope = vesselScopeDayDu(user);
  // Phải khớp đúng danh sách của createInventoryTransaction (VAN_HANH_TAU,
  // app/actions.ts) — liệt kê tay ở đây làm máy trưởng không thấy form dù server
  // vẫn cho ghi. Tính cả danh tính mượn qua ủy quyền.
  const canTransact = danhTinhHieuLuc(user).some((d) =>
    VAN_HANH_TAU.includes(d.role)
  );
  // Nút tải MLS-11-06 chỉ hiện cho người API xuất cho tải (thủy thủ trưởng, bếp trưởng… bấm là lỗi).
  const xuatDuoc = danhTinhHieuLuc(user).some((d) =>
    XUAT_TON_KHO.includes(d.role)
  );
  // Người ghi được phiếu thì bảng có thêm cột ô tick (nhập / xuất hàng loạt): các dòng trải ngang
  // bảng (tiêu đề bộ phận, nhóm thiết bị, "còn N dòng nữa") trải thêm một cột.
  const soCot = canTransact ? 10 : 9;
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
  // Chức danh quản lý (?rank=): chỉ dòng tồn của mặt hàng chức danh đó giữ và kiểm kê — chỉ huy
  // gồm cả phần cấp dưới (lib/chucDanhChiuTrachNhiem.ts, như báo cáo quý / thống kê / MLS-11-06);
  // "toi" = chức danh của người đang xem.
  const chucDanhCuaToi = chucDanhCuaNguoiDung(user);
  const rank = docLocChucDanh(params.rank, chucDanhCuaToi);
  const phamVi = rank ? phamViChucDanh(rank) : [];

  // Tàu đang hiện, suy thẳng từ phạm vi (không cần đợi truy vấn tàu) để câu
  // "nhập/xuất gần nhất" chạy chung một chặng với các truy vấn khác.
  const tauDangHien: number[] | null = vesselFilter
    ? [vesselFilter]
    : scope.all
      ? null
      : (scope.vesselIds ?? [scope.vesselId ?? -1]);

  const [inventories, materials, warehouses, vessels, recentTx, ganNhat] =
    await Promise.all([
      prisma.inventory.findMany({
        where: {
          ...vesselWhere(scope),
          ...(vesselFilter ? { vesselId: vesselFilter } : {}),
          ...(whFilter ? { warehouseId: whFilter } : {}),
        },
        orderBy: [{ vesselId: "asc" }, { materialId: "asc" }],
        // `select` đúng cột trang đọc thay vì `include` cả quan hệ: `vessel: true`
        // chép 14 cột của tàu vào từng dòng tồn, `category` chép cả bản ghi nhóm
        // — đo: 756 KB → 330 KB từ DB cho 630 dòng (152 ms → 47 ms). Thiếu cột
        // thì tsc báo ngay vì kiểu suy từ select.
        select: {
          id: true,
          vesselId: true,
          materialId: true,
          warehouseId: true,
          quantity: true,
          reservedQuantity: true,
          vessel: { select: { id: true, code: true, name: true } },
          warehouse: { select: { id: true, code: true } },
          material: {
            select: {
              id: true,
              code: true,
              nameVn: true,
              nameEn: true,
              impa: true,
              minStock: true,
              materialType: true,
              equipment: true,
              department: true,
              nhomQuanLy: true,
              // Người giữ đã gán quyết định nhóm bộ phận (lib/phanNhomBanChat.ts) — như Danh mục.
              responsibleRank: true,
              uom: true,
              // Mã nhóm thiết bị: phụ tùng máy chính → Máy hai, máy phụ → Máy ba… (chức danh giữ).
              category: { select: { code: true, name: true } },
            },
          },
        },
      }),
      // Ô chọn vật tư của form nhập/xuất và bảng lịch sử: chỉ 3 cột, và chỉ mặt
      // hàng thuộc TÀU ĐANG XEM — người của một tàu không cần 597 mặt hàng của
      // cả đội (đo: ~21,5 KB nén thừa mỗi lần mở trang). Người toàn đội giữ nguyên.
      prisma.material.findMany({
        where: {
          isActive: true,
          ...(tauDangHien === null
            ? {}
            : { vesselMaterials: { some: { vesselId: { in: tauDangHien } } } }),
        },
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
      // Lần nhập / xuất gần nhất của từng dòng tồn — MỘT câu SQL (lib/theKho.ts),
      // chạy song song với các truy vấn trên chứ không nối đuôi.
      layNhapXuatGanNhat(tauDangHien),
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
  const coBan = inventories.filter((inv) => {
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

  // Chức danh giữ của từng dòng — MỘT lần mỗi dòng (bên trong chạy nhomCuaVatTu, cả chục
  // regex), và chỉ khi cần: lọc theo chức danh hoặc khung kiểm soát của một tàu.
  const chucDanhTheoDong = new Map(
    rank || vesselFilter ? coBan.map((inv) => [inv, chucDanhGiuCua(inv.material)] as const) : []
  );
  const filtered = rank
    ? coBan.filter((inv) => chucDanhBaoTrum(rank, chucDanhTheoDong.get(inv)))
    : coBan;

  // Kiểm soát theo chức danh: khi đang xem MỘT tàu (báo cáo MLS-11-06 xuất theo từng tàu). Tính
  // trên các dòng qua mọi bộ lọc TRỪ chức danh — bấm một chức danh ra đúng số dòng đã đếm.
  const tauKiemSoat = vesselFilter
    ? (vessels.find((v) => v.id === vesselFilter) ?? null)
    : null;
  const nhomChucDanh = tauKiemSoat
    ? tonTheoChucDanh(
        coBan.map((inv) => {
          const gn = ganNhat.get(khoaDongTon(inv.materialId, inv.warehouseId));
          const lan = [gn?.IN?.occurredAt, gn?.OUT?.occurredAt].filter(
            (d): d is Date => d instanceof Date
          );
          return {
            chucDanh: chucDanhTheoDong.get(inv) ?? null,
            khaDung: inv.quantity - inv.reservedQuantity,
            minStock: inv.material.minStock,
            capNhat: lan.length
              ? new Date(Math.max(...lan.map((d) => d.getTime())))
              : null,
          };
        })
      )
    : [];
  const soChucDanh = nhomChucDanh.reduce((s, g) => s + g.dong.length, 0);
  /** Lại trang này, giữ bộ lọc đang chọn và đổi vài tham số (null = bỏ tham số đó). */
  const hrefTonKho = (doi: Record<string, string | null>) => {
    const giu: Record<string, string | null> = {
      vessel: vesselFilter && chonDuocTau(scope) ? String(vesselFilter) : null,
      wh: whFilter ? String(whFilter) : null,
      type: typeFilter !== "ALL" ? typeFilter : null,
      q: q ? String(params.q ?? "") : null,
      low: lowOnly ? "1" : null,
      rank: rank ? (params.rank === "toi" ? "toi" : rank) : null,
      ...doi,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(giu)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/inventory?${s}` : "/inventory";
  };
  /** Báo cáo kiểm kê MLS-11-06 (Excel, quý hiện tại, mọi kho của tàu) của riêng một chức danh. */
  const lienXuatChucDanh = (tauId: number, cd: string) =>
    `/api/export/inventory?${new URLSearchParams({
      vessel: String(tauId),
      ...(typeFilter !== "ALL" ? { type: typeFilter } : {}),
      rank: cd,
    })}`;
  /** Báo cáo tồn kho theo quý của chức danh — trang có nút In và Xuất Excel. */
  const lienBaoCaoQuy = (tauId: number, cd: string) =>
    `/inventory/bao-cao-quy?${new URLSearchParams({ vessel: String(tauId), type: typeFilter, rank: cd })}`;

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
  // Nhóm theo bản chất mặt hàng — cùng hàm với trang Danh mục (lib/phanNhomBanChat.ts).
  const deptKeyOf = (inv: InvRow): string =>
    nhomCuaVatTu({
      nameVn: inv.material.nameVn,
      nameEn: inv.material.nameEn,
      impa: inv.material.impa,
      materialType: inv.material.materialType,
      code: inv.material.code,
      department: inv.material.department,
      categoryName: inv.material.category?.name,
      equipment: inv.material.equipment,
      nhomQuanLy: inv.material.nhomQuanLy,
      responsibleRank: inv.material.responsibleRank,
      nguonPhu: inv.warehouse.code,
    }).nhom;
  const deptSections = DEPARTMENTS;
  // Phân nhóm MỘT lần mỗi dòng (nhomCuaVatTu chạy tới 24 regex): lọc theo từng
  // bộ phận bên dưới gọi lại cho mỗi bộ phận — 6 lần mỗi dòng, 12,4 → 2,3 ms.
  const nhomTheoDong = new Map(filtered.map((inv) => [inv, deptKeyOf(inv)]));
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
        action={
          <>
            <Link href="/inventory/kiem-ke" className={buttonClass("primary")}>
              <ClipboardCheck className="size-4" />
              {t("kiemKe.nutMo")}
            </Link>
            <Link href={`/inventory/bao-cao-quy${vesselFilter ? `?vessel=${vesselFilter}` : ""}`} className={buttonClass("secondary")}>
              <FileSpreadsheet className="size-4" />
              {t("tonQuy.nutBaoCao")}
            </Link>
            <Link href={`/inventory/thong-ke${vesselFilter ? `?vessel=${vesselFilter}` : ""}`} className={buttonClass("secondary")}>
              <BarChart3 className="size-4" />
              {t("tonQuy.nutThongKe")}
            </Link>
            <Link href="/quet" className={buttonClass("secondary")}>
              <QrCode className="size-4" />
              {t("qr.nutQuetMa")}
            </Link>
            <Link
              href={`/inventory/nhan-qr${vesselFilter ? `?vessel=${vesselFilter}` : ""}`}
              className={buttonClass("secondary")}
            >
              <Tag className="size-4" />
              {t("qr.nhanTieuDe")}
            </Link>
          </>
        }
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
        {/* key theo bộ lọc: bấm chức danh / mã kho trong bảng là điều hướng phía trình duyệt —
            không dựng lại form thì các ô chọn (defaultValue) vẫn hiện giá trị cũ. */}
        <Form
          key={[vesselFilter ?? "", whFilter ?? "", typeFilter, params.q ?? "", lowOnly ? 1 : 0, params.rank ?? ""].join("|")}
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
          {/* Rộng như ô tàu: chữ "Tất cả kho / vị trí" và mã kho / vị trí dài (ML-001-ENG-ER-STORE) không bị cắt. */}
          <div className="w-52">
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
          <div className="w-56">
            <ChonChucDanh
              giaTri={params.rank === "toi" && rank ? "toi" : rank}
              chucDanhCuaToi={chucDanhCuaToi}
              title={t("tonQuy.chucDanh")}
            />
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

      {/* 2b. Kiểm soát theo chức danh — người giữ & kiểm kê (cột Giữ bởi ở Danh mục). Mở sẵn khi chưa
          chọn chức danh; đã chọn thì gập lại cho bảng tồn của phần đó lên trên. */}
      <Card padded={false}>
        <details open={!rank} className="group">
          <summary className={SUMMARY}>
            <ChevronRight
              aria-hidden="true"
              className="size-4 text-[var(--text-muted)] transition-transform group-open:rotate-90"
            />
            <Users className="size-4 text-[var(--text-muted)]" />
            {t("inventory.cd_tieuDe")}
            {tauKiemSoat && (
              <span className="text-xs font-normal text-[var(--text-muted)]">
                {tauKiemSoat.code} · {t("inventory.cd_nChucDanh", { n: soChucDanh })}
              </span>
            )}
            {rank && <Badge tone="brand">{tenChucDanh(rank)}</Badge>}
          </summary>
          <div className="border-t border-[var(--border-subtle)] px-4 py-4">
            {!tauKiemSoat ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                {t("inventory.cd_chonTau")}
                {vessels.map((v) => (
                  <Link
                    key={v.id}
                    href={hrefTonKho({ vessel: String(v.id), wh: null, full: null })}
                    className={buttonClass("secondary", "sm")}
                  >
                    {v.code}
                  </Link>
                ))}
              </div>
            ) : nhomChucDanh.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">{t("inventory.khongCoDongKhop")}</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-[var(--text-secondary)]">{t("inventory.cd_moTa")}</p>
                <TableWrap>
                  {/* xuongDong + tiêu đề dài được xuống dòng: đủ 6 cột trong khung ở 1366 px, nút In không bị cắt. */}
                  <Table dense xuongDong>
                    <thead>
                      <tr>
                        <Th>{t("tonQuy.tkCd_chucDanh")}</Th>
                        <Th align="right">{t("inventory.cd_cotDong")}</Th>
                        <Th align="right" className="whitespace-normal">{t("tonQuy.tkCd_thieu")}</Th>
                        <Th align="right">{t("inventory.cd_cotHet")}</Th>
                        <Th className="whitespace-normal">{t("inventory.cd_cotCapNhat")}</Th>
                        <Th>{t("inventory.cd_cotBaoCao")}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {nhomChucDanh.map((g) => (
                        <React.Fragment key={g.boPhan ?? "KHAC"}>
                          <TrNhom colSpan={6}>
                            <span className="inline-flex flex-wrap items-center gap-2">
                              {g.boPhan ? tenBoPhan(g.boPhan) : t("tonQuy.chucDanhNhomKhac")}
                              <span className="text-xs font-normal text-[var(--text-muted)]">
                                {t("inventory.nDong", { n: g.soDong })}
                              </span>
                              {g.thieu > 0 && <Badge tone="danger">{t("inventory.nThieu", { n: g.thieu })}</Badge>}
                            </span>
                          </TrNhom>
                          {g.dong.map((d) => {
                            const ten = d.chucDanh ? tenChucDanh(d.chucDanh) : "";
                            return (
                              <Tr
                                key={d.chucDanh ?? "?"}
                                className={
                                  d.chucDanh && phamVi.includes(d.chucDanh) ? "bg-brand-500/10" : undefined
                                }
                              >
                                <Td className="whitespace-nowrap">
                                  {d.chucDanh ? (
                                    <Link
                                      href={hrefTonKho({ rank: d.chucDanh, full: null })}
                                      prefetch={false}
                                      className={cn("font-medium", LINK)}
                                      title={t("inventory.cd_xemPhan", { ten })}
                                    >
                                      {ten}{" "}
                                      <span className="text-xs text-[var(--text-muted)]">({d.chucDanh})</span>
                                    </Link>
                                  ) : (
                                    <span className="text-[var(--text-muted)]">{t("tonQuy.chucDanhChuaRo")}</span>
                                  )}
                                </Td>
                                <Td align="right" className="font-semibold">
                                  {d.soDong}
                                </Td>
                                <Td align="right">
                                  {d.thieu > 0 && d.chucDanh ? (
                                    <Link
                                      href={hrefTonKho({ rank: d.chucDanh, low: "1", full: null })}
                                      prefetch={false}
                                      className="font-semibold text-[var(--text-danger)] hover:underline"
                                      title={t("inventory.cd_xemThieu", { ten })}
                                    >
                                      {d.thieu}
                                    </Link>
                                  ) : (
                                    <span className={d.thieu ? "font-semibold text-[var(--text-danger)]" : "text-[var(--text-muted)]"}>
                                      {d.thieu || "–"}
                                    </span>
                                  )}
                                </Td>
                                <Td align="right">
                                  <span className={d.het ? "font-semibold text-[var(--text-danger)]" : "text-[var(--text-muted)]"}>
                                    {d.het || "–"}
                                  </span>
                                </Td>
                                <Td className="text-xs whitespace-nowrap">
                                  {d.capNhat ? (
                                    ngay(d.capNhat)
                                  ) : (
                                    <span className="text-[var(--text-muted)]">{t("inventory.chuaNhapXuat")}</span>
                                  )}
                                </Td>
                                <Td className="whitespace-nowrap">
                                  {d.chucDanh && (
                                    <span className="inline-flex gap-1.5">
                                      {xuatDuoc && (
                                        <a
                                          href={lienXuatChucDanh(tauKiemSoat.id, d.chucDanh)}
                                          className={buttonClass("secondary", "sm")}
                                          title={t("inventory.cd_titleExcel", { ten })}
                                        >
                                          <Download className="size-4" />
                                          MLS-11-06
                                        </a>
                                      )}
                                      <Link
                                        href={lienBaoCaoQuy(tauKiemSoat.id, d.chucDanh)}
                                        prefetch={false}
                                        className={buttonClass("ghost", "sm")}
                                        title={t("inventory.cd_titleIn", { ten })}
                                      >
                                        <Printer className="size-4" />
                                        {t("inventory.cd_nutIn")}
                                      </Link>
                                    </span>
                                  )}
                                </Td>
                              </Tr>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </>
            )}
          </div>
        </details>
      </Card>

      {/* Đang lọc một chức danh: nói rõ phạm vi (chỉ huy gồm cả cấp dưới) + báo cáo của riêng phần đó. */}
      {rank && (
        <Notice tone="info" className="flex flex-wrap items-center gap-2">
          <span className="mr-auto">
            {t("tonQuy.dangXemPhan", {
              ten: tenChucDanh(rank),
              ds: phamVi.map((c) => tenChucDanh(c)).join(", "),
            })}
          </span>
          {tauKiemSoat ? (
            <>
              {xuatDuoc && (
                <a href={lienXuatChucDanh(tauKiemSoat.id, rank)} className={buttonClass("primary", "sm")}>
                  <Download className="size-4" />
                  {t("inventory.cd_nutXuat", { ten: tenChucDanh(rank) })}
                </a>
              )}
              <Link href={lienBaoCaoQuy(tauKiemSoat.id, rank)} className={buttonClass("secondary", "sm")}>
                <Printer className="size-4" />
                {t("inventory.cd_nutBaoCaoQuy")}
              </Link>
              <Link
                href={`/inventory/thong-ke?${new URLSearchParams({ vessel: String(tauKiemSoat.id), type: typeFilter, rank })}`}
                className={buttonClass("secondary", "sm")}
              >
                <BarChart3 className="size-4" />
                {t("tonQuy.nutThongKe")}
              </Link>
            </>
          ) : xuatDuoc ? (
            <span className="text-xs">{t("inventory.cd_moiTauMotNut")}</span>
          ) : null}
          <Link href={hrefTonKho({ rank: null, full: null })} className={buttonClass("ghost", "sm")}>
            <X className="size-4" />
            {t("inventory.cd_boLoc")}
          </Link>
        </Notice>
      )}

      {/* Nhập / xuất hàng loạt: nghe ô tick của mọi bảng bên dưới; key theo bộ lọc → đổi lọc là chọn lại. */}
      {canTransact && groups.length > 0 && <NhapXuatHangLoat key={JSON.stringify(params)} />}

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
                    {/* Đang lọc chức danh → báo cáo của riêng phần chức danh đó (tên tệp có đuôi _2E…). */}
                    {xuatDuoc && (
                      <a
                        href={
                          rank
                            ? lienXuatChucDanh(vessel.id, rank)
                            : `/api/export/inventory?vessel=${vessel.id}${typeFilter !== "ALL" ? `&type=${typeFilter}` : ""}`
                        }
                        {...(rank ? { title: t("inventory.cd_titleExcel", { ten: tenChucDanh(rank) }) } : {})}
                        className={buttonClass("secondary", "sm")}
                      >
                        <Download className="size-4" />
                        MLS-11-06
                      </a>
                    )}
                  </summary>
                  {/* Bảng có thanh cuộn riêng + tiêu đề ghim để dò nhanh trong danh sách dài; thanh
                      nhỏ phía trên để phóng / thu chữ, mở rộng khung, xem toàn màn hình. */}
                  <KhungBang
                    ten="ton-kho"
                    caoMacDinh={singleVessel ? "cao" : "gon"}
                    className="mx-4 mb-4"
                    tieuDe={`${vessel.code} — ${vessel.name} · ${t("inventory.nDong", { n: rows.length })}`}
                  >
                    <Table dense>
                      <thead className="sticky top-0 z-10 bg-[var(--surface-raised)]">
                        {/* Mã → Tên mặt hàng → Kho (như bảng tồn kho ở hồ sơ tàu): dò theo mã trước. */}
                        <tr>
                          {canTransact && (
                            <Th className="w-8">
                              <input type="checkbox" data-chon-ton-bang={`tau-${vessel.id}`} aria-label={t("inventory.hl_chonCaBang")} className={O_TICK} />
                            </Th>
                          )}
                          <Th>{t("chung.ma")}</Th>
                          <Th>{t("inventory.cotTenVatTu")}</Th>
                          <Th>{t("chung.kho")}</Th>
                          <Th>{t("chung.donVi")}</Th>
                          <Th align="right">{t("inventory.cotTon")}</Th>
                          <Th align="right">{t("inventory.cotKhaDung")}</Th>
                          <Th align="right">{t("inventory.cotToiThieu")}</Th>
                          <Th>{t("inventory.cotNhapGanNhat")}</Th>
                          <Th>{t("inventory.cotXuatGanNhat")}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {deptSections.map((dept) => {
                          const deptRowsFull = sortDeptRows(
                            rows.filter((inv) => (nhomTheoDong.get(inv) ?? deptKeyOf(inv)) === dept.key)
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
                              <TrNhom colSpan={soCot}>
                                <span className="inline-flex flex-wrap items-center gap-2">
                                  {canTransact && (
                                    <input
                                      type="checkbox"
                                      data-chon-ton-nhom={`${vessel.id}-${dept.key}`}
                                      aria-label={t("inventory.hl_chonCaNhom")}
                                      title={t("inventory.hl_chonCaNhom")}
                                      className={O_TICK}
                                    />
                                  )}
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
                                    colSpan={soCot}
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
                                      href={hrefTonKho({ full: "1" })}
                                      className={LINK}
                                    >
                                      {t("chung.xemTatCa")}
                                    </Link>
                                  </Td>
                                </tr>
                              )}
                              {deptRows.map((inventory) => {
                                const gn = ganNhat.get(
                                  khoaDongTon(inventory.materialId, inventory.warehouseId)
                                );
                                const available =
                                  inventory.quantity -
                                  inventory.reservedQuantity;
                                const isLow =
                                  available <= inventory.material.minStock;
                                const isSpare =
                                  inventory.material.materialType === "SPARE";
                                // Lọc chức danh chỉ huy (gồm cấp dưới): ghi ai giữ dòng này.
                                const cdGiu =
                                  phamVi.length > 1
                                    ? chucDanhTheoDong.get(inventory)
                                    : null;
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
                                          colSpan={soCot}
                                          className="border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)]/60 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]"
                                        >
                                          <Wrench className="mr-1 inline size-3" />
                                          {t("inventory.phuTungThietBi", {
                                            ten: equipment ?? "",
                                          })}
                                        </td>
                                      </tr>
                                    )}
                                    <Tr className="transition-colors hover:bg-[var(--surface-sunken)]/50">
                                      {canTransact && (
                                        <Td>
                                          <input
                                            type="checkbox"
                                            data-chon-ton={inventory.id}
                                            data-bang={`tau-${vessel.id}`}
                                            data-nhom={`${vessel.id}-${dept.key}`}
                                            aria-label={inventory.material.code}
                                            className={O_TICK}
                                          />
                                        </Td>
                                      )}
                                      <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                                        <Link
                                          href={duongDanTheKho(
                                            inventory.materialId,
                                            inventory.warehouseId
                                          )}
                                          prefetch={false}
                                          className={LINK}
                                          title={t("inventory.moTheKho")}
                                        >
                                          {inventory.material.code}
                                        </Link>
                                      </Td>
                                      <Td>
                                        <div
                                          className={cn(
                                            // max-w-xs: tên dài xuống dòng để Kho / ĐVT / Tồn luôn trong
                                            // khung ở 1366 px (bảng vẫn min-w-max; Khả dụng, Tối thiểu,
                                            // Nhập / Xuất gần nhất cuộn ngang như trước).
                                            "flex max-w-xs flex-wrap items-center gap-1.5",
                                            isSpare && "pl-3"
                                          )}
                                        >
                                          <Link
                                            href={duongDanTheKho(
                                              inventory.materialId,
                                              inventory.warehouseId
                                            )}
                                            prefetch={false}
                                            className={LINK_AN}
                                          >
                                            {inventory.material.nameVn}
                                          </Link>
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
                                          {cdGiu && (
                                            <span className="text-xs text-[var(--text-muted)]">
                                              {t("tonQuy.giuBoi", { ten: tenChucDanh(cdGiu) })}
                                            </span>
                                          )}
                                        </div>
                                      </Td>
                                      <Td className="whitespace-nowrap">
                                        {/* Bấm mã kho → chỉ kho / vị trí đó (đang lọc đúng kho này thì thôi). */}
                                        {whFilter === inventory.warehouseId ? (
                                          <span className="font-display text-xs tracking-wide text-[var(--text-muted)]">
                                            {inventory.warehouse.code}
                                          </span>
                                        ) : (
                                          <Link
                                            href={`/inventory?vessel=${inventory.vesselId}&wh=${inventory.warehouseId}`}
                                            prefetch={false}
                                            className={cn("font-display text-xs tracking-wide text-[var(--text-muted)]", LINK_AN)}
                                            title={t("inventory.xemHangCuaKho")}
                                          >
                                            {inventory.warehouse.code}
                                          </Link>
                                        )}
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
                                      <Td className="whitespace-nowrap">
                                        <ONhapXuat
                                          gd={gn?.IN}
                                          isIn
                                          ngay={ngay}
                                          chuaCo={t("inventory.chuaNhapXuat")}
                                        />
                                      </Td>
                                      <Td className="whitespace-nowrap">
                                        <ONhapXuat
                                          gd={gn?.OUT}
                                          isIn={false}
                                          ngay={ngay}
                                          chuaCo={t("inventory.chuaNhapXuat")}
                                        />
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
                  </KhungBang>
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
              <KhungBang ten="nhat-ky-kho" tieuDe={t("inventory.lichSuGanDay")}>
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
                                <Link
                                  href={duongDanTheKho(tx.materialId, tx.warehouseId)}
                                  prefetch={false}
                                  className={cn("font-display text-xs tracking-wide", LINK)}
                                  title={t("inventory.moTheKho")}
                                >
                                  {material.code}
                                </Link>
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
              </KhungBang>
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
