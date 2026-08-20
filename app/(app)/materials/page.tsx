import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MaterialForm from "@/components/MaterialForm";
import MaterialRowActions from "@/components/MaterialRowActions";
import {
  VesselMaterialAddForm,
  VesselMaterialRemoveButton,
} from "@/components/VesselCatalogActions";
import {
  canManageVesselCatalog,
  requireScopedUser,
  vesselIdWhere,
  vesselScope,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; vessel?: string }>;
}) {
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  const canManageMaster = user.role === "ADMIN";
  const { type, vessel: vesselParam } = await searchParams;
  const filterType =
    type === "SPARE" ? "SPARE" : type === "STORE" ? "STORE" : "ALL";

  // Danh sách tàu người dùng được xem (để chọn).
  const vessels = await prisma.vessel.findMany({
    where: vesselIdWhere(scope),
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  // Xác định tàu đang chọn.
  // - Người dùng bị giới hạn theo tàu (CREW/MASTER có tàu): khóa vào tàu của họ.
  // - Người toàn đội (ADMIN, MASTER không tàu): theo ?vessel=, hoặc "danh mục gốc".
  let selectedVesselId: number | null = null;
  if (!scope.all) {
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

  const categories = await prisma.category.findMany({
    orderBy: { code: "asc" },
  });

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
    const qs = params.toString();
    return qs ? `/materials?${qs}` : "/materials";
  };
  const vesselKey = isVesselMode ? String(selectedVesselId) : "master";

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
    const links = await prisma.vesselMaterial.findMany({
      where: { vesselId: selectedVesselId!, material: typeWhere },
      include: { material: { include: { category: true } } },
      orderBy: { material: { code: "asc" } },
    });
    assignedMaterials = links.map((l) => ({ id: l.id, material: l.material }));
    if (canEditVessel) {
      const assignedIds = new Set(
        (
          await prisma.vesselMaterial.findMany({
            where: { vesselId: selectedVesselId! },
            select: { materialId: true },
          })
        ).map((x) => x.materialId)
      );
      const allActive = await prisma.material.findMany({
        where: { isActive: true },
        orderBy: [{ materialType: "asc" }, { code: "asc" }],
        select: {
          id: true,
          code: true,
          nameVn: true,
          materialType: true,
        },
      });
      availableToAdd = allActive.filter((m) => !assignedIds.has(m.id));
    }
  } else {
    masterMaterials = await prisma.material.findMany({
      where: typeWhere,
      orderBy: [{ materialType: "asc" }, { code: "asc" }],
      include: { category: true },
    });
  }

  const rows = isVesselMode
    ? assignedMaterials.map((a) => a.material!).filter(Boolean)
    : masterMaterials;

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
          {isVesselMode && selectedVesselId && (
            <a
              href={`/api/export/inventory?vessel=${selectedVesselId}&type=${filterType}`}
              className="rounded border border-blue-200 bg-white px-4 py-2 text-sm text-blue-950 hover:bg-blue-50"
            >
              ⬇ Xuất kiểm kê MLS-11-06
            </a>
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

      {/* Bộ chọn tàu */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">Xem theo:</span>
        {scope.all && (
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
          <form method="get" className="flex items-center gap-2">
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
          </form>
        ) : (
          <span className="rounded bg-blue-700 px-3 py-1 text-sm text-white">
            {selectedVessel
              ? `Tàu: ${selectedVessel.code} - ${selectedVessel.name}`
              : "Chưa được gán tàu"}
          </span>
        )}
      </div>

      {/* Tab lọc loại */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={buildHref(tab.key, isVesselMode ? vesselKey : null)}
            className={`rounded px-3 py-1 text-sm ${
              filterType === tab.key
                ? "bg-blue-700 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </Link>
        ))}
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
                <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 xl:col-span-3">
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
                <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
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
            className={`rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 ${
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
              <div className="overflow-x-auto">
                <table className="w-full border text-sm">
                  <thead>
                    <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                      <th className="p-2">Mã</th>
                      <th className="p-2">
                        {isSpareView ? "Tên phụ tùng" : "Mô tả"}
                      </th>
                      {isSpareView && <th className="p-2">Thiết bị</th>}
                      <th className="p-2">IMPA</th>
                      <th className="p-2">Part No.</th>
                      <th className="p-2">Maker</th>
                      <th className="p-2">Nhóm</th>
                      <th className="p-2">ĐVT</th>
                      {filterType === "ALL" && <th className="p-2">Loại</th>}
                      <th className="p-2">Critical</th>
                      {!isVesselMode && (
                        <th className="p-2">Trạng thái</th>
                      )}
                      {((isVesselMode && canEditVessel) ||
                        (!isVesselMode && canManageMaster)) && (
                        <th className="p-2">Thao tác</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((material) => (
                      <tr
                        key={material.id}
                        className={`border-b ${
                          !isVesselMode && !material.isActive
                            ? "bg-slate-50 text-slate-400"
                            : ""
                        }`}
                      >
                        <td className="p-2 font-medium">{material.code}</td>
                        <td className="p-2">
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
                          <td className="p-2">{material.equipment}</td>
                        )}
                        <td className="p-2">{material.impa}</td>
                        <td className="p-2">{material.partNumber}</td>
                        <td className="p-2">{material.manufacturer}</td>
                        <td className="p-2">
                          {"category" in material
                            ? // @ts-expect-error category included
                              material.category?.name
                            : ""}
                        </td>
                        <td className="p-2">{material.uom}</td>
                        {filterType === "ALL" && (
                          <td className="p-2">
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
                        <td className="p-2">
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
                          <td className="p-2">
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
                          <td className="p-2">
                            <VesselMaterialRemoveButton
                              vesselId={selectedVesselId!}
                              materialId={material.id}
                              code={material.code}
                            />
                          </td>
                        )}
                        {!isVesselMode && canManageMaster && (
                          <td className="p-2">
                            <MaterialRowActions
                              id={material.id}
                              code={material.code}
                              isActive={material.isActive}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
