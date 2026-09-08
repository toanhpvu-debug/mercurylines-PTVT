import { Fragment } from "react";
import Form from "next/form";
import Link from "next/link";
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
import {
  canManageVesselCatalog,
  chonDuocTau,
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

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
    { key: "ALL", label: "Tất cả" },
    { key: "STORE", label: "Vật tư (Store)" },
    { key: "SPARE", label: "Phụ tùng (Spare)" },
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-blue-950">Danh mục vật tư & phụ tùng</h2>
          <p className="text-slate-600">
            {isVesselMode
              ? `Danh mục riêng của ${selectedVessel?.name}`
              : "Danh mục gốc toàn đội (định nghĩa chung)"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Xuất kiểm kê MLS-11-06 nằm ở module Tồn kho — đúng ngữ cảnh và có
              sẵn bộ lọc phạm vi. Trước đây nút này có ở 3 nơi cùng gọi một API. */}
          {isVesselMode && selectedVesselId && (
            <Link
              href={`/inventory?vessel=${selectedVesselId}&type=${filterType}`}
              className="rounded border border-blue-200 bg-white px-4 py-2 text-sm text-blue-950 hover:bg-blue-50"
            >
              Tồn kho &amp; xuất kiểm kê →
            </Link>
          )}
          {["ADMIN", "MASTER"].includes(user.role) && (
            <Link
              href="/materials/import"
              className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800"
            >
              ⬆ Nhập danh mục từ file
            </Link>
          )}
        </div>
      </div>

      {/* Thanh công cụ gộp: chọn tàu · lọc loại · chức danh · tìm kiếm. Trước
          đây là ba dải rời xếp dọc trông rối; gộp vào một khung có đường phân
          cách cho gọn và dễ đọc. */}
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Bộ chọn tàu */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Xem theo
        </span>
        {chonDuocTau(scope) && (
          <Link
            href={buildHref(filterType, null)}
            className={`rounded px-3 py-1 text-sm ${
              !isVesselMode
                ? "bg-blue-700 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Danh mục gốc (toàn đội)
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
            <select
              name="vessel"
              defaultValue={vesselKey}
              className="rounded border p-2 text-sm"
            >
              <option value="master">— Danh mục gốc —</option>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} - {v.name}
                </option>
              ))}
            </select>
            <button className="rounded border px-3 py-1 text-sm hover:bg-blue-50">
              Chọn tàu
            </button>
          </Form>
        ) : (
          <span className="rounded bg-blue-700 px-3 py-1 text-sm text-white">
            {selectedVessel
              ? `Tàu: ${selectedVessel.code} - ${selectedVessel.name}`
              : "Chưa được gán tàu"}
          </span>
        )}
      </div>

      {/* Vật tư của chính người đang đăng nhập — thứ họ mở app ra để xem. */}
      {chucDanhCuaToi && (
        <div className="flex flex-wrap items-center gap-3 bg-blue-50/40 px-4 py-3">
          <span className="text-sm text-slate-700">
            Bạn là <b>{CHUC_DANH[chucDanhCuaToi].ten}</b> — phần vật tư &amp; phụ
            tùng bạn quản lý:
          </span>
          {rankFilter === chucDanhCuaToi ? (
            <>
              <span className="rounded bg-blue-700 px-3 py-1 text-sm text-white">
                Đang xem phần của bạn ({rows.length} mặt hàng)
              </span>
              <Link
                href={buildHrefRank("")}
                className="text-sm text-blue-700 hover:underline"
              >
                Xem tất cả
              </Link>
            </>
          ) : (
            <Link
              href={buildHrefRank("toi")}
              className="rounded bg-blue-700 px-3 py-1 text-sm text-white hover:bg-blue-800"
            >
              Xem vật tư tôi quản lý
            </Link>
          )}
        </div>
      )}

      {/* Tab lọc loại + chức danh + tìm kiếm */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={buildHref(tab.key, isVesselMode ? vesselKey : null)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                filterType === tab.key
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <Form action="/materials" className="ml-auto flex items-center gap-2">
          {filterType !== "ALL" && (
            <input type="hidden" name="type" value={filterType} />
          )}
          {isVesselMode && (
            <input type="hidden" name="vessel" value={vesselKey} />
          )}
          {showAll && <input type="hidden" name="full" value="1" />}
          <select
            name="rank"
            defaultValue={rankFilter}
            className="rounded border p-1.5 text-sm"
          >
            <option value="">Mọi chức danh</option>
            {/* Gom theo bộ phận: 15 chức danh xếp phẳng thì phải đọc hết cả
                danh sách mới thấy người mình cần. */}
            {(Object.keys(BO_PHAN) as BoPhan[]).map((bp) => (
              <optgroup key={bp} label={BO_PHAN[bp].ten}>
                {Object.entries(CHUC_DANH)
                  .filter(([, cd]) => cd.boPhan === bp)
                  .map(([ma, cd]) => (
                    <option key={ma} value={ma}>
                      {cd.ten} ({ma})
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <input
            name="q"
            defaultValue={qRaw ?? ""}
            placeholder="Tìm tên, mã, IMPA, Part No, hãng..."
            className="w-64 rounded border p-1.5 text-sm"
          />
          <button className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800">
            Tìm
          </button>
          {q && (
            <Link
              href={buildHref(filterType, isVesselMode ? vesselKey : null).replace(
                /[?&]q=[^&]*/,
                ""
              )}
              className="text-sm text-slate-600 hover:underline"
            >
              Xóa tìm
            </Link>
          )}
        </Form>
      </div>
      </div>

      {!isVesselMode && !scope.all ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          Bạn chưa được gán tàu phụ trách nên chưa xem được danh mục. Vui lòng
          liên hệ quản trị viên.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Cột trái: thêm mới (tùy chế độ) */}
          {isVesselMode
            ? canEditVessel && (
                <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 xl:col-span-3">
                  <h3 className="mb-3 text-lg font-semibold">
                    Thêm vật tư vào danh mục {selectedVessel?.name}
                  </h3>
                  <VesselMaterialAddForm
                    vesselId={selectedVesselId!}
                    available={availableToAdd}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Vật tư lấy từ danh mục gốc toàn đội. Cần vật tư mới hoàn
                    toàn?{" "}
                    {canManageMaster ? (
                      <Link
                        href={buildHref(filterType, null)}
                        className="text-blue-700 hover:underline"
                      >
                        Tạo trong Danh mục gốc
                      </Link>
                    ) : (
                      "Liên hệ quản trị viên tạo trong Danh mục gốc."
                    )}
                  </p>
                </div>
              )
            : canManageMaster && (
                <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <h3 className="mb-4 text-lg font-semibold">
                    Thêm vật tư / phụ tùng (danh mục gốc)
                  </h3>
                  <MaterialForm
                    categories={categories.map((c) => ({
                      id: c.id,
                      name: c.name,
                    }))}
                  />
                </div>
              )}

          {/* Bảng danh sách */}
          <div
            className={`rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 ${
              isVesselMode || !canManageMaster
                ? "xl:col-span-3"
                : "xl:col-span-2"
            }`}
          >
            <h3 className="mb-4 text-lg font-semibold">
              {isVesselMode
                ? `Vật tư của ${selectedVessel?.name} (${rows.length})`
                : `Danh mục gốc (${rows.length})`}
            </h3>
            {rows.length === 0 ? (
              <p className="text-slate-600">
                {isVesselMode
                  ? "Tàu chưa có vật tư nào trong danh mục."
                  : "Chưa có vật tư nào."}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2.5">Mã</th>
                      <th className="px-3 py-2.5">
                        {isSpareView ? "Tên phụ tùng" : "Mô tả"}
                      </th>
                      {isSpareView && <th className="px-3 py-2.5">Thiết bị</th>}
                      <th className="px-3 py-2.5">IMPA</th>
                      <th className="px-3 py-2.5">Part No.</th>
                      <th className="px-3 py-2.5">Maker</th>
                      <th className="px-3 py-2.5">Nhóm</th>
                      <th className="px-3 py-2.5">Giữ bởi</th>
                      <th className="px-3 py-2.5">ĐVT</th>
                      {filterType === "ALL" && (
                        <th className="px-3 py-2.5">Loại</th>
                      )}
                      <th className="px-3 py-2.5">Critical</th>
                      {!isVesselMode && (
                        <th className="px-3 py-2.5">Trạng thái</th>
                      )}
                      {((isVesselMode && canEditVessel) ||
                        (!isVesselMode && canManageMaster)) && (
                        <th className="px-3 py-2.5">Thao tác</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {deptGroups.map((dept) => {
                      // Trong bộ phận, chèn tiêu đề phụ mỗi khi đổi thiết bị
                      // (chỉ với phụ tùng) — VD Máy chính, Máy đèn.
                      let lastEquip: string | null = null;
                      return (
                        <Fragment key={dept.key}>
                          <tr className="border-y border-slate-200 bg-slate-100/80">
                            <td
                              colSpan={colCount}
                              className="px-3 py-2 text-sm font-semibold text-slate-700"
                            >
                              <span className="mr-1.5">{dept.icon}</span>
                              {dept.label}
                              <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                                {dept.rows.length}
                              </span>
                            </td>
                          </tr>
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
                                  <tr className="bg-slate-50/70">
                                    <td
                                      colSpan={colCount}
                                      className="py-1.5 pl-8 text-xs font-medium uppercase tracking-wide text-slate-500"
                                    >
                                      🔧 {equip}
                                    </td>
                                  </tr>
                                )}
                                {(
                      <tr
                        key={material.id}
                        className={`border-b border-slate-100 transition-colors hover:bg-blue-50/40 ${
                          !isVesselMode && !material.isActive
                            ? "bg-slate-50 text-slate-400"
                            : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-[13px] font-medium text-slate-800">
                          {material.code}
                        </td>
                        <td className="px-3 py-2">
                          <p>
                            {material.nameVn}
                            {isVesselMode && !material.isActive && (
                              <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                                Ngừng dùng
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            {material.nameEn}
                          </p>
                        </td>
                        {isSpareView && (
                          <td className="px-3 py-2">{material.equipment}</td>
                        )}
                        <td className="px-3 py-2">{material.impa}</td>
                        <td className="px-3 py-2">{material.partNumber}</td>
                        <td className="px-3 py-2">{material.manufacturer}</td>
                        <td className="px-3 py-2">
                          {"category" in material
                            ? // @ts-expect-error category included
                              material.category?.name
                            : ""}
                        </td>
                        <td className="px-3 py-2">
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
                                <span className="text-xs text-slate-400">—</span>
                              );
                            }
                            const ten = CHUC_DANH[tn.chucDanh]?.ten ?? tn.chucDanh;
                            const suyRa = tn.nguon !== "gan";
                            return (
                              <span
                                className={`rounded px-1.5 py-0.5 text-xs ${
                                  suyRa
                                    ? "bg-slate-50 text-slate-500 ring-1 ring-slate-200"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                                title={
                                  suyRa
                                    ? `Suy theo ${
                                        tn.nguon === "thiet-bi"
                                          ? "nhóm thiết bị"
                                          : "bộ phận"
                                      } — chạy gan-ma-vat-tu.cmd để gán cố định`
                                    : "Đã gán trực tiếp"
                                }
                              >
                                {ten} ({tn.chucDanh})
                                {suyRa && (
                                  <span className="ml-1 text-slate-400">•</span>
                                )}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2">{material.uom}</td>
                        {filterType === "ALL" && (
                          <td className="px-3 py-2">
                            <span
                              className={`rounded px-2 py-1 text-xs ${
                                material.materialType === "SPARE"
                                  ? "bg-indigo-100 text-indigo-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {material.materialType === "SPARE"
                                ? "Phụ tùng"
                                : "Vật tư"}
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-2">
                          {material.isCritical ? (
                            <span className="rounded bg-red-100 px-2 py-1 text-red-700">
                              Critical
                            </span>
                          ) : (
                            <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">
                              Normal
                            </span>
                          )}
                        </td>
                        {!isVesselMode && (
                          <td className="px-3 py-2">
                            {material.isActive ? (
                              <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                                Đang dùng
                              </span>
                            ) : (
                              <span className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-600">
                                Ngừng dùng
                              </span>
                            )}
                          </td>
                        )}
                        {isVesselMode && canEditVessel && (
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1">
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
                          </td>
                        )}
                        {!isVesselMode && canManageMaster && (
                          <td className="px-3 py-2">
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
                          </td>
                        )}
                      </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {hiddenCount > 0 && (
              <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-sm">
                Đang hiện {PER_DEPT_LIMIT} dòng đầu mỗi bộ phận — còn{" "}
                <b>{hiddenCount} dòng</b> chưa hiện. Dùng ô tìm kiếm để lọc cho
                nhanh, hoặc{" "}
                <Link
                  href={`${buildHref(
                    filterType,
                    isVesselMode ? vesselKey : null
                  )}${
                    buildHref(filterType, isVesselMode ? vesselKey : null).includes(
                      "?"
                    )
                      ? "&"
                      : "?"
                  }full=1`}
                  className="font-medium text-blue-700 hover:underline"
                >
                  xem tất cả {rows.length} dòng
                </Link>{" "}
                (trang sẽ nặng hơn).
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
