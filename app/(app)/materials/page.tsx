import { Fragment } from "react";
import Form from "next/form";
import Link from "next/link";
import {
  Anchor,
  ArrowRight,
  Boxes,
  Cog,
  LifeBuoy,
  Package,
  Plus,
  Search,
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
  departmentOfMaterial,
  equipmentOf,
} from "@/lib/departments";
import {
  chucDanhChiuTrachNhiem,
  laNguoiPhuTrach,
} from "@/lib/chucDanhChiuTrachNhiem";
import MaterialForm from "@/components/MaterialForm";
import MaterialRowActions from "@/components/MaterialRowActions";
import {
  VesselMaterialAddForm,
  VesselMaterialRemoveButton,
} from "@/components/VesselCatalogActions";
import VatTuMoiChoTauForm from "@/components/VatTuMoiChoTauForm";
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
  Input,
  Notice,
  PageHeader,
  Select,
  Table,
  TableWrap,
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
  }>;
}) {
  const user = await requireScopedUser();
  const { t, tTuDo, tenChucDanh, tenBoPhan } = await layT();
  const scope = vesselScopeDayDu(user);
  const canManageMaster = user.role === "ADMIN";
  const {
    type,
    vessel: vesselParam,
    q: qRaw,
    full,
    rank: rankRaw,
  } = await searchParams;
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
    const qs = params.toString();
    return qs ? `/materials?${qs}` : "/materials";
  };
  const vesselKey = isVesselMode ? String(selectedVesselId) : "master";
  // Đổi MỖI bộ lọc chức danh, giữ nguyên tàu / loại / từ khóa đang xem — đổi
  // một thứ mà mất mấy thứ kia là người dùng phải chọn lại từ đầu.
  const buildHrefRank = (nextRank: string) => {
    const params = new URLSearchParams();
    if (filterType !== "ALL") params.set("type", filterType);
    if (isVesselMode) params.set("vessel", vesselKey);
    if (q) params.set("q", qRaw ?? "");
    if (showAll) params.set("full", "1");
    if (nextRank) params.set("rank", nextRank);
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
        include: { material: { include: { category: true } } },
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
      include: { category: true },
    });
  }

  const allRows = isVesselMode
    ? assignedMaterials.map((a) => a.material!).filter(Boolean)
    : masterMaterials;
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const categoryCodeById = new Map(categories.map((c) => [c.id, c.code]));

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
          materialType: m.materialType,
        })
      )
    : allRows;
  const rows = q
    ? theoChucDanh.filter((m) =>
        [
          m.nameVn,
          m.nameEn,
          m.code,
          m.impa,
          m.partNumber,
          m.manufacturer,
          m.equipment,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
    : theoChucDanh;

  // Nhóm theo bộ phận tàu như form công ty: Boong → Máy → Điện → Phục vụ →
  // An toàn → Khác. Trong mỗi bộ phận: vật tư trước, phụ tùng sau theo thiết bị.
  type Row = (typeof rows)[number];
  // categoryNameById đã dựng ở trên (dùng cho bộ lọc chức danh). Dùng lại ở đây
  // để gom nhóm — kiểu của rows không mang quan hệ category nên không đọc thẳng
  // m.category được.
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));
  const byDept = new Map<string, Row[]>();
  for (const m of rows) {
    const key = departmentOfMaterial(
      [
        m.categoryId ? categoryNameById.get(m.categoryId) : null,
        m.equipment,
        m.code,
      ],
      m.materialType,
      m.department
    );
    const list = byDept.get(key);
    if (list) list.push(m);
    else byDept.set(key, [m]);
  }
  // Thiết bị suy từ tên Nhóm (file kiểm kê ghi thiết bị ở cột Nhóm).
  // Trang này từng dựng hơn 20.000 phần tử DOM khi hiện hết 600 dòng — trình
  // duyệt ì hẳn. Mặc định cắt bớt mỗi bộ phận; muốn xem hết thì bấm "Xem tất cả".
  const PER_DEPT_LIMIT = 40;
  const deptGroups = DEPARTMENTS.map((d) => {
    const sorted = sortWithinDepartment(byDept.get(d.key) ?? [], (m) => ({
      materialType: m.materialType,
      equipment: m.equipment,
      categoryName: m.categoryId
        ? (categoryNameById.get(m.categoryId) ?? null)
        : null,
      nameVn: m.nameVn,
    }));
    return {
      ...d,
      total: sorted.length,
      rows: showAll ? sorted : sorted.slice(0, PER_DEPT_LIMIT),
    };
  }).filter((d) => d.total > 0);
  const hiddenCount = deptGroups.reduce(
    (n, d) => n + (d.total - d.rows.length),
    0
  );
  // Số cột của bảng — dùng cho ô tiêu đề nhóm trải hết chiều ngang.
  // Số cột thật của bảng, để dòng gộp nhóm trải đủ chiều ngang: 9 cột cố định
  // (Mã · Mô tả · IMPA · Part No. · Maker · Nhóm · Giữ bởi · ĐVT · Critical)
  // cộng các cột chỉ hiện trong một số chế độ xem.
  const colCount =
    9 +
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
            <Form action="/materials" className="flex items-center gap-2">
              {filterType !== "ALL" && (
                <input type="hidden" name="type" value={filterType} />
              )}
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
          <Form action="/materials" className="ml-auto flex flex-wrap items-center gap-2">
            {filterType !== "ALL" && (
              <input type="hidden" name="type" value={filterType} />
            )}
            {isVesselMode && (
              <input type="hidden" name="vessel" value={vesselKey} />
            )}
            {showAll && <input type="hidden" name="full" value="1" />}
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
            <div className="w-64">
              <Input
                name="q"
                defaultValue={qRaw ?? ""}
                placeholder={t("materials.timGoiY")}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              icon={<Search className="size-4" />}
            >
              {t("chung.tim")}
            </Button>
            {q && (
              <Link
                href={buildHref(filterType, isVesselMode ? vesselKey : null).replace(
                  /[?&]q=[^&]*/,
                  ""
                )}
                className="text-sm text-[var(--text-secondary)] hover:underline"
              >
                {t("chung.xoaTim")}
              </Link>
            )}
          </Form>
        </div>
      </Card>

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
                <Card>
                  <CardHeader
                    icon={<Plus className="size-4" />}
                    title={t("materials.themVaoDanhMucGoc")}
                  />
                  <MaterialForm
                    categories={categories.map((c) => ({
                      id: c.id,
                      name: c.name,
                    }))}
                  />
                </Card>
              )}

          {/* Bảng danh sách */}
          <Card
            className={
              isVesselMode || !canManageMaster
                ? "xl:col-span-3"
                : "xl:col-span-2"
            }
          >
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
              <TableWrap>
                <Table dense>
                  <thead>
                    <tr>
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
                  <tbody>
                    {deptGroups.map((dept) => {
                      // Trong bộ phận, chèn tiêu đề phụ mỗi khi đổi thiết bị
                      // (chỉ với phụ tùng) — VD Máy chính, Máy đèn.
                      let lastEquip: string | null = null;
                      const DeptIcon = DEPT_ICON[dept.key] ?? Package;
                      return (
                        <Fragment key={dept.key}>
                          <TrNhom colSpan={colCount}>
                            <span className="inline-flex items-center gap-2">
                              <DeptIcon className="size-4 text-[var(--text-muted)]" />
                              {tTuDo(`labels.dept_${dept.key}`)}
                              <Badge tone="neutral">{dept.rows.length}</Badge>
                            </span>
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
                                  className={cn(
                                    "transition-colors hover:bg-[var(--surface-sunken)]/50",
                                    !isVesselMode &&
                                      !material.isActive &&
                                      "opacity-60"
                                  )}
                                >
                                  <Td className="font-display text-xs tracking-wide whitespace-nowrap text-[var(--text-primary)]">
                                    {material.code}
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
                                    {"category" in material
                                      ? // @ts-expect-error category included
                                        material.category?.name
                                      : ""}
                                  </Td>
                                  <Td>
                                    {(() => {
                                      // Chức danh chịu trách nhiệm: ưu tiên cột đã gán, nếu
                                      // trống thì suy theo nhóm thiết bị / bộ phận nên MỌI
                                      // dòng đều có người giữ hiện ra, không còn "—".
                                      const tn = chucDanhChiuTrachNhiem({
                                        responsibleRank: material.responsibleRank,
                                        categoryCode: material.categoryId
                                          ? categoryCodeById.get(material.categoryId)
                                          : null,
                                        categoryName: material.categoryId
                                          ? categoryNameById.get(material.categoryId)
                                          : null,
                                        department: material.department,
                                        equipment: material.equipment,
                                        code: material.code,
                                        materialType: material.materialType,
                                      });
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
                                            }}
                                            categories={categoryOptions}
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
                                        }}
                                        categories={categoryOptions}
                                      />
                                    </Td>
                                  )}
                                </Tr>
                              </Fragment>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
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
