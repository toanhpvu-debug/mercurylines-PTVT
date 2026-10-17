import { Fragment } from "react";
import Form from "next/form";
import Link from "next/link";
import { NGUOI_TAI_PHIEU_GIAO } from "@/lib/phieuGiao";
import { LAP_YEU_CAU } from "@/lib/roles";
import { laBanTau } from "@/lib/banCai";
import ChonHangLoat from "@/components/ChonHangLoat";
import {
  Anchor,
  ArrowRight,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Cog,
  FileText,
  Filter,
  LifeBuoy,
  Package,
  Plus,
  Upload,
  UtensilsCrossed,
  Warehouse,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  BO_PHAN,
  CHUC_DANH,
  chucDanhCuaNguoiDung,
  type BoPhan,
} from "@/lib/maVatTu";
import {
  sortWithinDepartment,
  DEPARTMENTS,
  THIET_BI_CHUA_RO,
  equipmentOf,
} from "@/lib/departments";
import {
  chucDanhChiuTrachNhiem,
  laNguoiPhuTrach,
} from "@/lib/chucDanhChiuTrachNhiem";
import MaterialForm from "@/components/MaterialForm";
import { chuongImpa, laTenBoPhan } from "@/lib/nhomImpa";
import { docDen } from "@/lib/viTriSauSua";
import { nhomCuaVatTu, type KetQuaPhanNhom } from "@/lib/phanNhomBanChat";
import MaterialRowActions from "@/components/MaterialRowActions";
import {
  VesselMaterialAddForm,
  VesselMaterialRemoveButton,
} from "@/components/VesselCatalogActions";
import VatTuMoiChoTauForm from "@/components/VatTuMoiChoTauForm";
import TimNhanhDanhMuc from "@/components/TimNhanhDanhMuc";
import KhungBang from "@/components/KhungBang";
import NutThuGonNhom from "@/components/NutThuGonNhom";
import {
  canManageVesselCatalog,
  chonDuocTau,
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Notice,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  Tr,
  TrNhom,
  buttonClass,
} from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Biểu tượng bộ phận theo `key` của lib/departments.ts — thay cho trường
 * `icon` (emoji) ở đó, để cùng bộ nét vẽ với phần còn lại của giao diện.
 */
const DEPT_ICON: Record<string, LucideIcon> = {
  DECK: Anchor,
  ENGINE: Cog,
  ELEC: Zap,
  SERVICE: UtensilsCrossed,
  SAFETY: LifeBuoy,
  OTHER: Package,
};

const LINK = "text-sm text-brand-700 hover:underline dark:text-brand-300";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    vessel?: string;
    q?: string;
    full?: string;
    rank?: string;
    /** Lọc một nhóm bộ phận: DECK · ENGINE · ELEC · SERVICE · SAFETY · OTHER (khóa của DEPARTMENTS). */
    bp?: string;
    /** Mặt hàng vừa sửa (id, nối bằng "-"): mở đúng trang chứa nó và tô sáng — lib/viTriSauSua.ts. */
    den?: string;
    /** Trang của từng bộ phận: trang_DECK=2, trang_ENGINE=3… (mỗi trang PER_DEPT_LIMIT dòng). */
    [trang: `trang_${string}`]: string | undefined;
  }>;
}) {
  const user = await requireScopedUser();
  const { t, tTuDo, tenChucDanh, tenBoPhan } = await layT();
  // Tên nhóm con theo chương IMPA (labels.impaChuong_<số>), null nếu không có mã IMPA.
  const tenNhomImpa = (impa: string | null | undefined) => {
    const ch = chuongImpa(impa);
    return ch ? tTuDo(`labels.impaChuong_${ch}`) : null;
  };
  const scope = vesselScopeDayDu(user);
  const canManageMaster = user.role === "ADMIN";
  // Xóa khỏi danh mục dùng chung: chỉ quản trị TẠI VĂN PHÒNG (bản trên tàu không
  // được xóa — đồng bộ không mang lệnh xóa, xem lib/banCai.ts).
  const xoaDuoc = canManageMaster && !(await laBanTau());
  const sp = await searchParams;
  const {
    type,
    vessel: vesselParam,
    q: qRaw,
    full,
    rank: rankRaw,
    bp: bpRaw,
  } = sp;
  // Lọc theo bộ phận = đúng các mục Boong · Máy · Điện · Sinh hoạt & Phục vụ · An toàn chung
  // mà bảng đang chia (nhomCuaVatTu) — cột "Giữ bởi" cũng suy từ chính nhóm đó, nên lọc "Máy"
  // thì mọi dòng ra đều do người ngành máy giữ, không có dòng nào tự mâu thuẫn.
  const boPhanLoc = DEPARTMENTS.some((d) => d.key === bpRaw) ? String(bpRaw) : "";
  // Vừa sửa xong (hộp Sửa / Sửa hàng loạt đưa tới đây): dòng đầu là chỗ cuộn tới (#vat-tu-<id>).
  const denIds = docDen(sp.den);
  const vuaSua = new Set(denIds);
  // Lọc theo chức danh giữ vật tư — dùng khi kiểm kê bàn giao ca: máy hai chỉ
  // cần thấy đúng phần mình ký nhận, không phải cuộn qua cả danh mục tàu.
  //
  // "toi" là lối tắt cho chính người đang đăng nhập: /materials?rank=toi luôn
  // đúng dù ai bấm, nên đặt được vào menu, vào thẻ trên Dashboard, hay gửi
  // đường dẫn cho nhau mà không phải sửa mã chức danh trong đó.
  const chucDanhCuaToi = chucDanhCuaNguoiDung(user);
  const rankRawStr = String(rankRaw ?? "");
  const rankFilter =
    rankRawStr === "toi"
      ? (chucDanhCuaToi ?? "")
      : CHUC_DANH[rankRawStr]
        ? rankRawStr
        : "";
  const q = String(qRaw ?? "").trim().toLowerCase();
  const showAll = full === "1";
  const filterType =
    type === "SPARE" ? "SPARE" : type === "STORE" ? "STORE" : "ALL";

  // Danh sách tàu người dùng được xem (để chọn) và bảng nhóm — hai truy vấn
  // độc lập nên chạy song song; trước đây nối đuôi nhau thành hai vòng chờ DB.
  const [vessels, categories] = await Promise.all([
    prisma.vessel.findMany({
      where: vesselIdWhere(scope),
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.category.findMany({ orderBy: { code: "asc" } }),
  ]);

  // Xác định tàu đang chọn.
  // - Người dùng bị giới hạn theo tàu (CREW/MASTER có tàu): khóa vào tàu của họ.
  // - Người toàn đội (ADMIN, MASTER không tàu): theo ?vessel=, hoặc "danh mục gốc".
  let selectedVesselId: number | null = null;
  if (!chonDuocTau(scope)) {
    selectedVesselId = scope.vesselId ?? null;
  } else if (vesselParam === "master" || vesselParam === undefined) {
    selectedVesselId = null;
  } else {
    const requested = Number(vesselParam);
    selectedVesselId =
      vessels.find((v) => v.id === requested)?.id ?? null;
  }
  const selectedVessel = selectedVesselId
    ? (vessels.find((v) => v.id === selectedVesselId) ?? null)
    : null;
  const isVesselMode = selectedVesselId !== null;

  const typeWhere = filterType === "ALL" ? {} : { materialType: filterType };
  const isSpareView = filterType === "SPARE";
  const tabs = [
    { key: "ALL", label: t("chung.tatCa") },
    { key: "STORE", label: tTuDo("labels.typeLong_STORE") },
    { key: "SPARE", label: tTuDo("labels.typeLong_SPARE") },
  ];
  const buildHref = (nextType: string, nextVessel: string | null) => {
    const params = new URLSearchParams();
    if (nextType !== "ALL") params.set("type", nextType);
    if (nextVessel) params.set("vessel", nextVessel);
    if (q) params.set("q", qRaw ?? "");
    if (showAll) params.set("full", "1");
    if (rankFilter) params.set("rank", rankFilter);
    if (boPhanLoc) params.set("bp", boPhanLoc);
    const qs = params.toString();
    return qs ? `/materials?${qs}` : "/materials";
  };
  const vesselKey = isVesselMode ? String(selectedVesselId) : "master";
  /** Đổi nhóm bộ phận đang lọc, giữ nguyên tàu / loại / chức danh / từ khóa; trang về 1. */
  const buildHrefBoPhan = (nextBp: string) => {
    const p = new URLSearchParams(buildHref(filterType, isVesselMode ? vesselKey : null).split("?")[1] ?? "");
    if (nextBp) p.set("bp", nextBp);
    else p.delete("bp");
    const qs = p.toString();
    return qs ? `/materials?${qs}` : "/materials";
  };
  // Đổi MỖI bộ lọc chức danh, giữ nguyên tàu / loại / từ khóa đang xem — đổi
  // một thứ mà mất mấy thứ kia là người dùng phải chọn lại từ đầu.
  const buildHrefRank = (nextRank: string) => {
    const params = new URLSearchParams();
    if (filterType !== "ALL") params.set("type", filterType);
    if (isVesselMode) params.set("vessel", vesselKey);
    if (q) params.set("q", qRaw ?? "");
    if (showAll) params.set("full", "1");
    if (nextRank) params.set("rank", nextRank);
    if (boPhanLoc) params.set("bp", boPhanLoc);
    const qs = params.toString();
    return qs ? `/materials?${qs}` : "/materials";
  };

  // Dữ liệu theo chế độ.
  let masterMaterials: Awaited<
    ReturnType<typeof prisma.material.findMany>
  > = [];
  let assignedMaterials: {
    id: number;
    material: Awaited<ReturnType<typeof prisma.material.findFirst>>;
  }[] = [];
  let availableToAdd: {
    id: number;
    code: string;
    nameVn: string;
    materialType: string;
  }[] = [];
  const canEditVessel =
    isVesselMode && canManageVesselCatalog(user, selectedVesselId!);

  if (isVesselMode) {
    // Ba truy vấn không phụ thuộc nhau → chạy song song. Người sửa được danh
    // mục tàu (thuyền trưởng / quản trị) từng phải chờ ba vòng DB nối đuôi.
    const [links, daGan, allActive] = await Promise.all([
      prisma.vesselMaterial.findMany({
        where: { vesselId: selectedVesselId!, material: typeWhere },
        // Không kéo kèm Category: tên nhóm lấy từ categoryNameById (kiểu dòng
        // không mang quan hệ nên không ai đọc m.category) — join thừa gấp đôi byte.
        include: { material: true },
        orderBy: { material: { code: "asc" } },
      }),
      canEditVessel
        ? prisma.vesselMaterial.findMany({
            where: { vesselId: selectedVesselId! },
            select: { materialId: true },
          })
        : null,
      canEditVessel
        ? prisma.material.findMany({
            where: { isActive: true },
            orderBy: [{ materialType: "asc" }, { code: "asc" }],
            select: {
              id: true,
              code: true,
              nameVn: true,
              materialType: true,
            },
          })
        : null,
    ]);
    assignedMaterials = links.map((l) => ({ id: l.id, material: l.material }));
    if (daGan && allActive) {
      const assignedIds = new Set(daGan.map((x) => x.materialId));
      availableToAdd = allActive.filter((m) => !assignedIds.has(m.id));
    }
  } else {
    masterMaterials = await prisma.material.findMany({
      where: typeWhere,
      orderBy: [{ materialType: "asc" }, { code: "asc" }],
    });
  }

  const allRows = isVesselMode
    ? assignedMaterials.map((a) => a.material!).filter(Boolean)
    : masterMaterials;
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const categoryCodeById = new Map(categories.map((c) => [c.id, c.code]));
  /** Mặt hàng → đầu vào của chucDanhChiuTrachNhiem — cột "Giữ bởi" và ô người giữ của form Sửa. */
  const monGiu = (m: (typeof allRows)[number]) => ({
    responsibleRank: m.responsibleRank,
    categoryCode: m.categoryId ? categoryCodeById.get(m.categoryId) : null,
    categoryName: m.categoryId ? categoryNameById.get(m.categoryId) : null,
    department: m.department,
    equipment: m.equipment,
    code: m.code,
    impa: m.impa,
    nameVn: m.nameVn,
    nameEn: m.nameEn,
    nhomQuanLy: m.nhomQuanLy,
    materialType: m.materialType,
  });
  /** Người giữ app tự suy nếu BỎ gán — để ô chọn của form Sửa ghi "Tự suy (hiện: …)". */
  const giuSuyRa = (m: (typeof allRows)[number]) => chucDanhChiuTrachNhiem({ ...monGiu(m), responsibleRank: null })?.chucDanh ?? null;

  // Lọc theo chức danh phụ trách — khớp ĐÚNG cột "Giữ bởi".
  //
  // Dùng chung một cách xác định người giữ với cột "Giữ bởi"
  // (lib/chucDanhChiuTrachNhiem): chọn "Máy ba" thì ra đúng phần Máy ba giữ,
  // không phải cả buồng máy. Cấp chỉ huy (thuyền trưởng, đại phó, máy trưởng)
  // thấy thêm phần cấp dưới giữ, để nút "Xem vật tư tôi quản lý" của họ không ra
  // danh sách trống.
  const theoChucDanh = rankFilter
    ? allRows.filter((m) =>
        laNguoiPhuTrach(rankFilter, {
          responsibleRank: m.responsibleRank,
          categoryCode: m.categoryId
            ? categoryCodeById.get(m.categoryId)
            : null,
          categoryName: m.categoryId
            ? categoryNameById.get(m.categoryId)
            : null,
          department: m.department,
          equipment: m.equipment,
          code: m.code,
          impa: m.impa,
          nameVn: m.nameVn,
          nameEn: m.nameEn,
          nhomQuanLy: m.nhomQuanLy,
          materialType: m.materialType,
        })
      )
    : allRows;
  const rowsTruocBoPhan = q
    ? theoChucDanh.filter((m) =>
        [
          m.nameVn,
          m.nameEn,
          m.code,
          m.impa,
          m.partNumber,
          m.manufacturer,
          m.equipment,
          // Nhóm con theo chương IMPA ("văn phòng phẩm", "hand tools"...).
          tenNhomImpa(m.impa),
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
    : theoChucDanh;

  // Nhóm theo BẢN CHẤT mặt hàng (lib/phanNhomBanChat.ts) — cùng hàm với cột
  // "Giữ bởi" và trang Tồn kho; quản trị ghim tay được (Sửa hàng loạt); người
  // giữ đã gán kéo hàng về bộ phận của người đó.
  const phanNhomById = new Map<number, KetQuaPhanNhom>();
  /** Số dòng mỗi nhóm bộ phận TRƯỚC khi lọc bộ phận — số trên các nút lọc. */
  const demTheoBoPhan = new Map<string, number>();
  for (const m of rowsTruocBoPhan) {
    const pn = nhomCuaVatTu({
      nameVn: m.nameVn,
      nameEn: m.nameEn,
      impa: m.impa,
      materialType: m.materialType,
      code: m.code,
      department: m.department,
      categoryName: m.categoryId ? categoryNameById.get(m.categoryId) : null,
      equipment: m.equipment,
      nhomQuanLy: m.nhomQuanLy,
      responsibleRank: m.responsibleRank,
    });
    phanNhomById.set(m.id, pn);
    demTheoBoPhan.set(pn.nhom, (demTheoBoPhan.get(pn.nhom) ?? 0) + 1);
  }
  const rows = boPhanLoc ? rowsTruocBoPhan.filter((m) => phanNhomById.get(m.id)?.nhom === boPhanLoc) : rowsTruocBoPhan;

  // Nhóm theo bộ phận tàu như form công ty: Boong → Máy → Điện → Phục vụ →
  // An toàn → Khác. Trong mỗi bộ phận: vật tư trước, phụ tùng sau theo thiết bị.
  type Row = (typeof rows)[number];
  // categoryNameById đã dựng ở trên (dùng cho bộ lọc chức danh). Dùng lại ở đây
  // để gom nhóm — kiểu của rows không mang quan hệ category nên không đọc thẳng
  // m.category được.
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));
  const byDept = new Map<string, Row[]>();
  for (const m of rows) {
    const key = phanNhomById.get(m.id)!.nhom;
    const list = byDept.get(key);
    if (list) list.push(m);
    else byDept.set(key, [m]);
  }
  // Thiết bị suy từ tên Nhóm (file kiểm kê ghi thiết bị ở cột Nhóm).
  // Trang này từng dựng hơn 20.000 phần tử DOM khi hiện hết 600 dòng — trình
  // duyệt ì hẳn. Mặc định mỗi bộ phận hiện một TRANG 40 dòng, chuyển trang bằng
  // « ‹ › » ở dòng đầu và dòng cuối bộ phận (?trang_DECK=2…); muốn xem hết thì bấm
  // "Xem tất cả".
  const PER_DEPT_LIMIT = 40;
  const trangCua = (key: string) => {
    const n = Number(sp[`trang_${key}`]);
    return Number.isInteger(n) && n >= 1 ? n : 1;
  };
  const deptGroups = DEPARTMENTS.map((d) => {
    const sorted = sortWithinDepartment(byDept.get(d.key) ?? [], (m) => ({
      materialType: m.materialType,
      equipment: m.equipment,
      categoryName: m.categoryId
        ? (categoryNameById.get(m.categoryId) ?? null)
        : null,
      nameVn: m.nameVn,
    }));
    // Đang TÌM thì hiện hết dòng khớp: cắt 40 dòng lúc này là giấu đúng thứ người
    // ta vừa gõ để tìm. Trang xin quá số trang (danh mục vừa ngắn lại) → trang cuối.
    const hetMot = showAll || Boolean(q);
    const soTrang = hetMot ? 1 : Math.max(1, Math.ceil(sorted.length / PER_DEPT_LIMIT));
    // Vừa sửa: mở trang chứa dòng cuộn tới (hoặc dòng vừa sửa đầu tiên của bộ phận này) — sửa
    // xong là thấy ngay mặt hàng ở chỗ mới, không phải lật trang tìm.
    const iDen = denIds.length ? sorted.findIndex((m) => m.id === denIds[0]) : -1;
    const iVuaSua = iDen >= 0 ? iDen : vuaSua.size ? sorted.findIndex((m) => vuaSua.has(m.id)) : -1;
    const trang = iVuaSua >= 0 && !hetMot ? Math.floor(iVuaSua / PER_DEPT_LIMIT) + 1 : Math.min(trangCua(d.key), soTrang);
    const tu = (trang - 1) * PER_DEPT_LIMIT;
    return {
      ...d,
      total: sorted.length,
      trang,
      soTrang,
      /** Vị trí (tính từ 0) của dòng đầu đang hiện trong bộ phận. */
      tu,
      rows: hetMot ? sorted : sorted.slice(tu, tu + PER_DEPT_LIMIT),
    };
  }).filter((d) => d.total > 0);
  /** Đường dẫn sang trang `n` của một bộ phận: giữ bộ lọc + trang đang xem của bộ phận khác, cuộn tới đúng bộ phận đó. */
  const hrefTrang = (key: string, n: number) => {
    const p = new URLSearchParams(buildHref(filterType, isVesselMode ? vesselKey : null).split("?")[1] ?? "");
    for (const d of deptGroups) if (d.key !== key && d.trang > 1) p.set(`trang_${d.key}`, String(d.trang));
    if (n > 1) p.set(`trang_${key}`, String(n));
    const qs = p.toString();
    return `/materials${qs ? `?${qs}` : ""}#bo-phan-${key}`;
  };
  const hiddenCount = deptGroups.reduce(
    (n, d) => n + (d.total - d.rows.length),
    0
  );
  // Số cột của bảng — dùng cho ô tiêu đề nhóm trải hết chiều ngang.
  // Số cột thật của bảng, để dòng gộp nhóm trải đủ chiều ngang: 9 cột cố định
  // (Mã · Mô tả · IMPA · Part No. · Maker · Nhóm · Giữ bởi · ĐVT · Critical)
  // cộng các cột chỉ hiện trong một số chế độ xem.
  const colCount =
    10 + // + cột ô tick chọn hàng loạt
    (isSpareView ? 1 : 0) +
    (filterType === "ALL" ? 1 : 0) +
    (!isVesselMode ? 1 : 0) +
    (((isVesselMode && canEditVessel) || (!isVesselMode && canManageMaster))
      ? 1
      : 0);

  const xemTatCaHref = (() => {
    const base = buildHref(filterType, isVesselMode ? vesselKey : null);
    return `${base}${base.includes("?") ? "&" : "?"}full=1`;
  })();

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("materials.tieuDe")}
        subtitle={
          isVesselMode
            ? t("materials.danhMucRiengCua", {
                tau: selectedVessel?.name ?? "",
              })
            : t("materials.danhMucGocMoTa")
        }
        action={
          <>
            {/* Xuất kiểm kê MLS-11-06 nằm ở module Tồn kho — đúng ngữ cảnh và có
                sẵn bộ lọc phạm vi. Trước đây nút này có ở 3 nơi cùng gọi một API. */}
            {isVesselMode && selectedVesselId && (
              <Link
                href={`/inventory?vessel=${selectedVesselId}&type=${filterType}`}
                className={buttonClass("secondary")}
              >
                <Warehouse className="size-4" />
                {t("materials.nutTonKhoKiemKe")}
                <ArrowRight className="size-4" />
              </Link>
            )}
            {["ADMIN", "MASTER"].includes(user.role) && (
              <Link href="/materials/import" className={buttonClass("primary")}>
                <Upload className="size-4" />
                {t("materials.nhapDanhMucTuFile")}
              </Link>
            )}
            {NGUOI_TAI_PHIEU_GIAO.includes(user.role) && (
              <Link href="/materials/phieu-giao" className={buttonClass("secondary")}>
                <FileText className="size-4" />
                {t("phieuGiao.nutSangTrangPhieuGiao")}
              </Link>
            )}
          </>
        }
      />

      {/* Thanh công cụ gộp: chọn tàu · lọc loại · chức danh · tìm kiếm. Trước
          đây là ba dải rời xếp dọc trông rối; gộp vào một khung có đường phân
          cách cho gọn và dễ đọc. */}
      <Card padded={false} className="divide-y divide-[var(--border-subtle)]">
        {/* Bộ chọn tàu */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {t("materials.xemTheo")}
          </span>
          {chonDuocTau(scope) && (
            <Link
              href={buildHref(filterType, null)}
              className={buttonClass(!isVesselMode ? "primary" : "secondary")}
            >
              {t("materials.danhMucGocToanDoi")}
            </Link>
          )}
          {scope.all ? (
            // next/form: đổi tàu / lọc / tìm chỉ tải phần nội dung (chuyển trang
            // phía client, khung chờ hiện ngay) thay vì tải lại cả trang như
            // <form method="get"> thường. Áp dụng cho cả ô tìm kiếm bên dưới.
            <Form key={vesselKey} action="/materials" className="flex items-center gap-2">
              {filterType !== "ALL" && (
                <input type="hidden" name="type" value={filterType} />
              )}
              {boPhanLoc && <input type="hidden" name="bp" value={boPhanLoc} />}
              <div className="w-60">
                <Select name="vessel" defaultValue={vesselKey}>
                  <option value="master">{t("materials.optDanhMucGoc")}</option>
                  {vessels.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} - {v.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" variant="secondary">
                {t("chung.chonTau")}
              </Button>
            </Form>
          ) : (
            <Badge tone="brand">
              {selectedVessel
                ? t("materials.tauLa", {
                    tau: `${selectedVessel.code} - ${selectedVessel.name}`,
                  })
                : t("materials.chuaDuocGanTau")}
            </Badge>
          )}
        </div>

        {/* Vật tư của chính người đang đăng nhập — thứ họ mở app ra để xem. */}
        {chucDanhCuaToi && (
          <div className="flex flex-wrap items-center gap-3 bg-brand-500/8 px-4 py-3">
            <span className="text-sm text-[var(--text-secondary)]">
              {t("materials.banLa")}{" "}
              <b className="text-[var(--text-primary)]">
                {tenChucDanh(chucDanhCuaToi)}
              </b>{" "}
              {t("materials.phanBanQuanLy")}
            </span>
            {rankFilter === chucDanhCuaToi ? (
              <>
                <Badge tone="brand" dot>
                  {t("materials.dangXemPhanCuaBan", { n: rows.length })}
                </Badge>
                <Link href={buildHrefRank("")} className={LINK}>
                  {t("chung.xemTatCa")}
                </Link>
              </>
            ) : (
              <Link
                href={buildHrefRank("toi")}
                className={buttonClass("primary", "sm")}
              >
                {t("materials.xemVatTuToiQuanLy")}
              </Link>
            )}
          </div>
        )}

        {/* Tab lọc loại + chức danh + tìm kiếm */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="flex overflow-hidden rounded-lg border border-[var(--border-subtle)] text-xs font-semibold">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={buildHref(tab.key, isVesselMode ? vesselKey : null)}
                aria-current={filterType === tab.key ? "page" : undefined}
                className={cn(
                  "px-3 py-1.5 transition",
                  filterType === tab.key
                    ? "bg-brand-700 text-white"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          {/* key: chuyển trang bằng liên kết (Xem mặt hàng tôi quản lý…) thì ô chọn
              uncontrolled vẫn giữ giá trị cũ — dựng lại theo chức danh đang lọc. */}
          <Form key={rankFilter} action="/materials" className="ml-auto flex flex-wrap items-center gap-2">
            {filterType !== "ALL" && (
              <input type="hidden" name="type" value={filterType} />
            )}
            {isVesselMode && (
              <input type="hidden" name="vessel" value={vesselKey} />
            )}
            {showAll && <input type="hidden" name="full" value="1" />}
            {boPhanLoc && <input type="hidden" name="bp" value={boPhanLoc} />}
            <div className="w-52">
              <Select name="rank" defaultValue={rankFilter}>
                <option value="">{t("materials.moiChucDanh")}</option>
                {/* Gom theo bộ phận: 15 chức danh xếp phẳng thì phải đọc hết cả
                    danh sách mới thấy người mình cần. */}
                {(Object.keys(BO_PHAN) as BoPhan[]).map((bp) => (
                  <optgroup key={bp} label={tenBoPhan(bp)}>
                    {Object.entries(CHUC_DANH)
                      .filter(([, cd]) => cd.boPhan === bp)
                      .map(([ma]) => (
                        <option key={ma} value={ma}>
                          {tenChucDanh(ma)} ({ma})
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
            </div>
            {/* Ô tìm nay nằm ở thanh tìm nhanh dính đầu bảng; ở đây chỉ giữ q để
                đổi chức danh không làm mất chuỗi đang tìm. */}
            {q && <input type="hidden" name="q" value={qRaw ?? ""} />}
            <Button
              type="submit"
              variant="primary"
              icon={<Filter className="size-4" />}
            >
              {t("chung.loc")}
            </Button>
          </Form>
        </div>

        {/* Lọc theo nhóm bộ phận — đúng các mục của bảng; số là số dòng mỗi nhóm
            theo các bộ lọc khác đang chọn (loại, chức danh, từ khóa). */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span
            className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]"
            title={t("materials.locBoPhanGoiY")}
          >
            {t("materials.boPhan")}
          </span>
          <nav aria-label={t("materials.boPhan")} className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "", ten: t("materials.moiBoPhan"), so: rowsTruocBoPhan.length },
              ...DEPARTMENTS.map((d) => ({
                key: d.key,
                ten: tTuDo(`labels.deptNgan_${d.key}`),
                so: demTheoBoPhan.get(d.key) ?? 0,
              })),
            ]
              // Nhóm không có dòng nào thì ẩn (trừ nhóm đang lọc — để còn bỏ lọc được).
              .filter((x) => x.key === "" || x.so > 0 || x.key === boPhanLoc)
              .map((x) => {
                const dangChon = boPhanLoc === x.key;
                return (
                  <Link
                    key={x.key || "tat-ca"}
                    href={buildHrefBoPhan(x.key)}
                    aria-current={dangChon ? "page" : undefined}
                    title={t("materials.locBoPhanGoiY")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
                      dangChon
                        ? "border-brand-700 bg-brand-700 text-white"
                        : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {x.ten}
                    <span className={cn("tabular font-medium", dangChon ? "text-white/80" : "text-[var(--text-muted)]")}>
                      {x.so}
                    </span>
                  </Link>
                );
              })}
          </nav>
        </div>
      </Card>

      {/* Vừa sửa mà mặt hàng ra ngoài bộ lọc đang chọn (từ khóa không còn khớp, đổi loại, "phần
          của tôi" không còn gồm nó…): báo và đưa tới chỗ của nó, không để nó "biến mất". */}
      {denIds.length > 0 && !rows.some((m) => vuaSua.has(m.id)) && (
        <Notice tone="info">
          {t("materials.vuaSuaNgoaiBoLoc")}{" "}
          <Link
            href={`/materials?${isVesselMode ? `vessel=${vesselKey}&` : ""}den=${denIds.join("-")}#vat-tu-${denIds[0]}`}
            className="font-medium underline"
          >
            {t("materials.xemMatHangVuaSua")}
          </Link>
        </Notice>
      )}

      {!isVesselMode && !scope.all ? (
        <Notice tone="warning">{t("materials.chuaGanTauKhongXem")}</Notice>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Cột trái: thêm mới (tùy chế độ) */}
          {isVesselMode
            ? canEditVessel && (
                <Card className="xl:col-span-3">
                  <CardHeader
                    icon={<Plus className="size-4" />}
                    title={t("materials.themVaoDanhMucTau", {
                      tau: selectedVessel?.name ?? "",
                    })}
                    subtitle={t("materials.vatTuLayTuGoc")}
                  />
                  <VesselMaterialAddForm
                    vesselId={selectedVesselId!}
                    available={availableToAdd}
                  />
                  {/* Món hàng chưa có trong danh mục gốc: khai ngay tại tàu,
                      gắn chức danh giữ — không phải nhờ quản trị tạo trước. */}
                  <VatTuMoiChoTauForm
                    vesselId={selectedVesselId!}
                    vesselName={selectedVessel?.name ?? ""}
                    categories={categories.map((c) => ({
                      id: c.id,
                      name: c.name,
                      code: c.code,
                    }))}
                    chucDanhMacDinh={chucDanhCuaToi}
                  />
                </Card>
              )
            : canManageMaster && (
                // Thu gọn mặc định: form thêm mặt hàng chỉ dùng thỉnh thoảng,
                // còn bảng danh mục gốc là thứ xem hằng ngày — nhường cả chiều
                // ngang cho bảng, bấm thanh này mới mở form.
                <details className="group surface rounded-xl border p-4 xl:col-span-3">
                  <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-700 dark:text-brand-400">
                      <Plus className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--text-primary)]">
                        {t("materials.themVaoDanhMucGoc")}
                      </span>
                      <span className="block text-xs text-[var(--text-muted)] group-open:hidden">
                        {t("materials.themGocBamDeMo")}
                      </span>
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-4 max-w-3xl">
                    <MaterialForm
                      categories={categories.map((c) => ({
                        id: c.id,
                        name: c.name,
                      }))}
                    />
                  </div>
                </details>
              )}

          {/* Bảng danh sách */}
          <Card className="xl:col-span-3">
            <CardHeader
              icon={<Boxes className="size-4" />}
              title={
                isVesselMode
                  ? t("materials.vatTuCuaTau", {
                      tau: selectedVessel?.name ?? "",
                      n: rows.length,
                    })
                  : t("materials.danhMucGocN", { n: rows.length })
              }
            />
            {/* Thanh nổi thao tác hàng loạt — chỉ hiện khi có dòng được tick.
                Ô tick là <input> thường do server vẽ; thành phần này lắng
                nghe chúng qua data-chon-* (xem components/ChonHangLoat.tsx). */}
            {rows.length > 0 && (
              <ChonHangLoat
                quyen={{
                  yeuCau: LAP_YEU_CAU.includes(user.role) && !scope.unassigned,
                  sua: canManageMaster,
                  xoa: xoaDuoc,
                  goKhoiTau: isVesselMode && canEditVessel,
                }}
                categories={categoryOptions}
                vesselId={selectedVesselId}
              />
            )}
            {/* Bảng dài theo trang như cũ; thanh nhỏ để phóng / thu chữ và xem toàn màn
                hình — thanh tìm nhanh đi cùng khung, ô đã tick giữ nguyên. */}
            <KhungBang
              ten="danh-muc"
              cuonTrang
              anThanh={rows.length === 0}
              tieuDe={
                isVesselMode
                  ? t("materials.vatTuCuaTau", { tau: selectedVessel?.name ?? "", n: rows.length })
                  : t("materials.danhMucGocN", { n: rows.length })
              }
              dau={
                <TimNhanhDanhMuc
                  nhom={deptGroups.map((d) => ({
                    key: d.key,
                    label: tTuDo(`labels.dept_${d.key}`),
                    total: d.total,
                    hienThi: d.rows.length,
                    tu: d.tu,
                  }))}
                  tongDong={rows.length}
                  dangHien={rows.length - hiddenCount}
                />
              }
            >
            {rows.length === 0 ? (
              <EmptyState
                icon={<Boxes className="size-5" />}
                title={
                  isVesselMode
                    ? t("materials.tauChuaCoVatTu")
                    : t("materials.chuaCoVatTu")
                }
              />
            ) : (
                <Table dense>
                  <thead className="sticky top-0 z-10 bg-[var(--surface-raised)]">
                    <tr>
                      <Th className="w-8">
                        <input
                          type="checkbox"
                          data-chon-tat-ca=""
                          aria-label={t("materials.chonTatCa")}
                          title={t("materials.chonTatCaGoiY")}
                          className="size-4 accent-brand-600"
                        />
                      </Th>
                      <Th>{t("chung.ma")}</Th>
                      <Th>
                        {isSpareView
                          ? t("materials.cotTenPhuTung")
                          : t("chung.moTa")}
                      </Th>
                      {isSpareView && <Th>{t("chung.thietBi")}</Th>}
                      <Th>IMPA</Th>
                      <Th>Part No.</Th>
                      <Th>Maker</Th>
                      <Th>{t("chung.nhom")}</Th>
                      <Th>{t("materials.cotGiuBoi")}</Th>
                      <Th>{t("chung.donVi")}</Th>
                      {filterType === "ALL" && <Th>{t("materials.loai")}</Th>}
                      <Th>Critical</Th>
                      {!isVesselMode && <Th>{t("chung.trangThai")}</Th>}
                      {((isVesselMode && canEditVessel) ||
                        (!isVesselMode && canManageMaster)) && (
                        <Th>{t("chung.thaoTac")}</Th>
                      )}
                    </tr>
                  </thead>
                    {deptGroups.map((dept) => {
                      // Trong bộ phận, chèn tiêu đề phụ mỗi khi đổi thiết bị
                      // (chỉ với phụ tùng) — VD Máy chính, Máy đèn.
                      let lastEquip: string | null = null;
                      const DeptIcon = DEPT_ICON[dept.key] ?? Package;
                      const nhanTrang = {
                        dau: t("materials.trangDau"),
                        truoc: t("materials.trangTruoc"),
                        sau: t("materials.trangSau"),
                        cuoi: t("materials.trangCuoi"),
                        trang: t("materials.trangN", { n: dept.trang, tong: dept.soTrang }),
                      };
                      return (
                        <tbody key={dept.key} id={`bo-phan-${dept.key}`} className="scroll-mt-36">
                          <TrNhom colSpan={colCount}>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                data-chon-nhom={dept.key}
                                aria-label={t("materials.chonNhom")}
                                title={t("materials.chonNhom")}
                                className="size-4 accent-brand-600"
                              />
                              <span className="inline-flex items-center gap-2">
                                <DeptIcon className="size-4 text-[var(--text-muted)]" />
                                {tTuDo(`labels.dept_${dept.key}`)}
                                <Badge tone={dept.rows.length < dept.total ? "warning" : "neutral"}>
                                  {dept.rows.length < dept.total ? `${dept.tu + 1}–${dept.tu + dept.rows.length}/${dept.total}` : dept.total}
                                </Badge>
                              </span>
                              {/* Ngay sau tên bộ phận, không đẩy sang mép phải: bảng rộng hơn
                                  màn hình thì mép phải dòng tiêu đề nằm khuất. */}
                              {dept.soTrang > 1 && (
                                <PhanTrangBoPhan
                                  trang={dept.trang}
                                  soTrang={dept.soTrang}
                                  href={(n) => hrefTrang(dept.key, n)}
                                  nhan={nhanTrang}
                                />
                              )}
                              <NutThuGonNhom />
                            </div>
                          </TrNhom>
                          {dept.rows.map((material) => {
                            const equip = equipmentOf({
                              materialType: material.materialType,
                              equipment: material.equipment,
                              categoryName: material.categoryId
                                ? (categoryNameById.get(material.categoryId) ??
                                  null)
                                : null,
                              nameVn: material.nameVn,
                            });
                            const showEquipHeader =
                              equip !== null && equip !== lastEquip;
                            if (equip !== null) lastEquip = equip;
                            return (
                              <Fragment key={material.id}>
                                {showEquipHeader && (
                                  <tr>
                                    <td
                                      colSpan={colCount}
                                      className="bg-[var(--surface-sunken)]/60 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]"
                                    >
                                      <Wrench className="mr-1 inline size-3" />
                                      {equip === THIET_BI_CHUA_RO
                                        ? t("materials.chuaRoThietBi")
                                        : equip}
                                    </td>
                                  </tr>
                                )}
                                <Tr
                                  id={vuaSua.has(material.id) ? `vat-tu-${material.id}` : undefined}
                                  className={cn(
                                    "transition-colors hover:bg-[var(--surface-sunken)]/50",
                                    !isVesselMode &&
                                      !material.isActive &&
                                      "opacity-60",
                                    // Vừa sửa: tô nền + vạch trái để thấy ngay mặt hàng ở chỗ mới; chừa
                                    // khoảng dưới thanh tìm dính khi trang cuộn tới (#vat-tu-<id>).
                                    vuaSua.has(material.id) &&
                                      "scroll-mt-48 bg-[var(--tone-brand-bg)] shadow-[inset_4px_0_0_var(--text-brand)]"
                                  )}
                                >
                                  <Td className="w-8">
                                    <input
                                      type="checkbox"
                                      data-chon-vat-tu={material.id}
                                      data-nhom={dept.key}
                                      data-loai={material.materialType === "SPARE" ? "SPARE" : "STORE"}
                                      data-ma={material.code}
                                      aria-label={t("materials.chonDong", { ma: material.code })}
                                      className="size-4 accent-brand-600"
                                    />
                                  </Td>
                                  <Td className="font-display text-xs tracking-wide whitespace-nowrap text-[var(--text-primary)]">
                                    {material.code}
                                    {vuaSua.has(material.id) && (
                                      <Badge tone="brand" className="ml-2 font-sans tracking-normal">
                                        {t("materials.vuaSua")}
                                      </Badge>
                                    )}
                                  </Td>
                                  <Td>
                                    <p>
                                      {material.nameVn}
                                      {isVesselMode && !material.isActive && (
                                        <Badge tone="muted" className="ml-2">
                                          {tTuDo("labels.active_false")}
                                        </Badge>
                                      )}
                                    </p>
                                    <p className="text-xs text-[var(--text-muted)]">
                                      {material.nameEn}
                                    </p>
                                  </Td>
                                  {isSpareView && <Td>{material.equipment}</Td>}
                                  <Td>{material.impa}</Td>
                                  <Td>{material.partNumber}</Td>
                                  <Td>{material.manufacturer}</Td>
                                  <Td>
                                    {(() => {
                                      // Nhóm CON, không lặp tên bộ phận: chương IMPA trước
                                      // (Dụng cụ cầm tay, Văn phòng phẩm, Bảo hộ...), phụ tùng
                                      // thì thiết bị; nhóm của file nhập chỉ hiện khi nó không
                                      // phải tên bộ phận ("Boong (Deck)") — hiện thành dòng phụ.
                                      const tenNhom = material.categoryId ? categoryNameById.get(material.categoryId) : null;
                                      const nhomFile = tenNhom && !laTenBoPhan(tenNhom) ? tenNhom : null;
                                      const nhomImpa = tenNhomImpa(material.impa);
                                      const chinh = nhomImpa ?? (material.materialType === "SPARE" && !isSpareView ? material.equipment : null) ?? nhomFile;
                                      const pnO = phanNhomById.get(material.id);
                                      const coGhiChu = pnO && (pnO.nguon === "ghim" || (pnO.nguon === "ban-chat" && pnO.nhom !== pnO.nhomCu));
                                      if (!chinh && !coGhiChu) return <span className="text-xs text-[var(--text-muted)]">—</span>;
                                      return (
                                        <>
                                          {chinh && <span className="text-sm">{chinh}</span>}
                                          {nhomFile && nhomFile !== chinh && (
                                            <span className="block text-xs text-[var(--text-muted)]">{nhomFile}</span>
                                          )}
                                          {(() => {
                                            const pn = phanNhomById.get(material.id);
                                            if (!pn) return null;
                                            if (pn.nguon === "ghim") return <span className="block text-xs text-[var(--text-brand)]">{t("materials.nhomDaGhim")}</span>;
                                            if (pn.nguon === "ban-chat" && pn.nhom !== pn.nhomCu && pn.banChat)
                                              return (
                                                <span className="block text-xs text-[var(--text-info)]" title={t("materials.chuyenNhomGoiY")}>
                                                  ↻ {t("materials.chuyenNhom", { lyDo: pn.banChat.lyDo })}
                                                </span>
                                              );
                                            return null;
                                          })()}
                                        </>
                                      );
                                    })()}
                                  </Td>
                                  <Td>
                                    {(() => {
                                      // Chức danh chịu trách nhiệm: ưu tiên cột đã gán, nếu
                                      // trống thì suy theo nhóm thiết bị / bộ phận nên MỌI
                                      // dòng đều có người giữ hiện ra, không còn "—".
                                      const tn = chucDanhChiuTrachNhiem(monGiu(material));
                                      if (!tn) {
                                        return (
                                          <span className="text-xs text-[var(--text-muted)]">
                                            —
                                          </span>
                                        );
                                      }
                                      const ten = tenChucDanh(tn.chucDanh);
                                      const suyRa = tn.nguon !== "gan";
                                      return (
                                        <Badge
                                          tone={suyRa ? "muted" : "brand"}
                                          title={
                                            suyRa
                                              ? tn.nguon === "thiet-bi"
                                                ? t("materials.suyRaTuThietBi")
                                                : tn.nguon === "ban-chat"
                                                  ? t("materials.suyRaTuBanChat")
                                                  : t("materials.suyRaTuBoPhan")
                                              : t("materials.daGanTrucTiep")
                                          }
                                        >
                                          {ten} ({tn.chucDanh})
                                          {suyRa && (
                                            <span className="opacity-60">•</span>
                                          )}
                                        </Badge>
                                      );
                                    })()}
                                  </Td>
                                  <Td>{material.uom}</Td>
                                  {filterType === "ALL" && (
                                    <Td>
                                      <Badge
                                        tone={
                                          material.materialType === "SPARE"
                                            ? "brand"
                                            : "neutral"
                                        }
                                      >
                                        {tTuDo(
                                          `labels.type_${
                                            material.materialType === "SPARE"
                                              ? "SPARE"
                                              : "STORE"
                                          }`
                                        )}
                                      </Badge>
                                    </Td>
                                  )}
                                  <Td>
                                    {material.isCritical ? (
                                      <Badge tone="danger">
                                        {tTuDo("labels.critical_true")}
                                      </Badge>
                                    ) : (
                                      <Badge tone="muted">
                                        {tTuDo("labels.critical_false")}
                                      </Badge>
                                    )}
                                  </Td>
                                  {!isVesselMode && (
                                    <Td>
                                      {material.isActive ? (
                                        <Badge tone="success" dot>
                                          {tTuDo("labels.active_true")}
                                        </Badge>
                                      ) : (
                                        <Badge tone="muted">
                                          {tTuDo("labels.active_false")}
                                        </Badge>
                                      )}
                                    </Td>
                                  )}
                                  {isVesselMode && canEditVessel && (
                                    <Td>
                                      <div className="flex flex-col items-start gap-1">
                                        {/* Sửa ở đây là sửa bản ghi dùng chung toàn đội,
                                            nên chỉ quản trị viên mới thấy nút này. */}
                                        {canManageMaster && (
                                          <MaterialRowActions
                                            material={{
                                              id: material.id,
                                              code: material.code,
                                              nameVn: material.nameVn,
                                              nameEn: material.nameEn,
                                              impa: material.impa,
                                              partNumber: material.partNumber,
                                              manufacturer: material.manufacturer,
                                              materialType: material.materialType,
                                              equipment: material.equipment,
                                              uom: material.uom,
                                              categoryId: material.categoryId,
                                              minStock: material.minStock,
                                              maxStock: material.maxStock,
                                              isCritical: material.isCritical,
                                              isActive: material.isActive,
                                              responsibleRank: material.responsibleRank,
                                            }}
                                            categories={categoryOptions}
                                            nguoiGiuSuyRa={giuSuyRa(material)}
                                            onlyEdit
                                          />
                                        )}
                                        <VesselMaterialRemoveButton
                                          vesselId={selectedVesselId!}
                                          materialId={material.id}
                                          code={material.code}
                                        />
                                      </div>
                                    </Td>
                                  )}
                                  {!isVesselMode && canManageMaster && (
                                    <Td>
                                      <MaterialRowActions
                                        material={{
                                          id: material.id,
                                          code: material.code,
                                          nameVn: material.nameVn,
                                          nameEn: material.nameEn,
                                          impa: material.impa,
                                          partNumber: material.partNumber,
                                          manufacturer: material.manufacturer,
                                          materialType: material.materialType,
                                          equipment: material.equipment,
                                          uom: material.uom,
                                          categoryId: material.categoryId,
                                          minStock: material.minStock,
                                          maxStock: material.maxStock,
                                          isCritical: material.isCritical,
                                          isActive: material.isActive,
                                          responsibleRank: material.responsibleRank,
                                        }}
                                        categories={categoryOptions}
                                        nguoiGiuSuyRa={giuSuyRa(material)}
                                        xoaDuoc={xoaDuoc}
                                      />
                                    </Td>
                                  )}
                                </Tr>
                              </Fragment>
                            );
                          })}
                          {/* Đọc hết trang này của bộ phận thì sang trang sau ngay tại đây,
                              không phải cuộn ngược lên dòng tiêu đề. */}
                          {dept.soTrang > 1 && (
                            <tr className="no-print">
                              <td colSpan={colCount} className="border-t border-[var(--border-subtle)] px-4 py-2">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className="text-xs text-[var(--text-muted)]">
                                    {t("materials.cuoiTrangBoPhan", {
                                      bp: tTuDo(`labels.dept_${dept.key}`),
                                      tu: dept.tu + 1,
                                      den: dept.tu + dept.rows.length,
                                      tong: dept.total,
                                    })}
                                  </span>
                                  <PhanTrangBoPhan
                                    trang={dept.trang}
                                    soTrang={dept.soTrang}
                                    href={(n) => hrefTrang(dept.key, n)}
                                    nhan={nhanTrang}
                                    coChu
                                  />
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      );
                    })}
                </Table>
            )}
            </KhungBang>
            {hiddenCount > 0 && (
              <Notice tone="info" className="mt-3">
                {t("materials.dangHienDauMoiBoPhan", { n: PER_DEPT_LIMIT })}{" "}
                <b>{t("materials.nDong", { n: hiddenCount })}</b>{" "}
                {t("materials.chuaHienGoiY")}{" "}
                <Link href={xemTatCaHref} className="font-medium underline">
                  {t("materials.xemTatCaNDong", { n: rows.length })}
                </Link>{" "}
                {t("materials.trangSeNangHon")}
              </Notice>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/**
 * Chuyển trang của MỘT bộ phận: « đầu · ‹ trước · Trang 2/8 · sau › · cuối ». Đứng ở dòng tiêu
 * đề bộ phận (nút chỉ có biểu tượng) và ở dòng cuối bộ phận (`coChu`: nút trước / sau ghi cả chữ —
 * đọc hết trang là bấm). Là liên kết thường (dựng ở máy chủ) — trang mở lại đúng đầu bộ phận (#neo).
 */
function PhanTrangBoPhan({
  trang,
  soTrang,
  href,
  nhan,
  coChu = false,
}: {
  trang: number;
  soTrang: number;
  href: (n: number) => string;
  nhan: { dau: string; truoc: string; sau: string; cuoi: string; trang: string };
  /** Nút trước / sau ghi cả chữ (dòng cuối bộ phận). */
  coChu?: boolean;
}) {
  const nut = (n: number, ten: string, Icon: LucideIcon, tat: boolean, chu?: "truoc" | "sau") => {
    const ghiChu = coChu && chu !== undefined;
    const noiDung = !ghiChu ? (
      <Icon className="size-4" />
    ) : chu === "truoc" ? (
      <>
        <Icon className="size-4" />
        {ten}
      </>
    ) : (
      <>
        {ten}
        <Icon className="size-4" />
      </>
    );
    const lop = cn(
      "inline-flex h-7 items-center justify-center gap-1 rounded-md",
      ghiChu ? "border border-[var(--border-subtle)] px-2" : "w-7"
    );
    return tat ? (
      <span aria-hidden="true" className={cn(lop, "text-[var(--text-muted)] opacity-40")}>
        {noiDung}
      </span>
    ) : (
      <Link
        href={href(n)}
        title={ten}
        aria-label={ten}
        className={cn(
          lop,
          "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
          // Dòng tiêu đề nền chìm → nhấn nổi; dòng cuối nền bảng → nhấn chìm.
          coChu ? "hover:bg-[var(--surface-sunken)]" : "hover:bg-[var(--surface-raised)]"
        )}
      >
        {noiDung}
      </Link>
    );
  };
  return (
    <nav aria-label={nhan.trang} className={cn("no-print inline-flex items-center text-xs font-medium", coChu ? "gap-1" : "gap-0.5")}>
      {nut(1, nhan.dau, ChevronsLeft, trang <= 1)}
      {nut(trang - 1, nhan.truoc, ChevronLeft, trang <= 1, "truoc")}
      <span className="tabular px-1.5 whitespace-nowrap text-[var(--text-secondary)]">{nhan.trang}</span>
      {nut(trang + 1, nhan.sau, ChevronRight, trang >= soTrang, "sau")}
      {nut(soTrang, nhan.cuoi, ChevronsRight, trang >= soTrang)}
    </nav>
  );
}
