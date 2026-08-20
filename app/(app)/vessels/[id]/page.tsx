import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canDeleteRequest, requireScopedUser, vesselScope } from "@/lib/auth";
import VesselEditForm from "@/components/VesselEditForm";
import VesselDeleteButton from "@/components/VesselDeleteButton";
import InventoryForm from "@/components/InventoryForm";
import RequestForm from "@/components/RequestForm";
import RequestStatusForm from "@/components/RequestStatusForm";
import RequestDeleteButton from "@/components/RequestDeleteButton";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Hoạt động", className: "bg-green-100 text-green-700" },
  MAINTENANCE: {
    label: "Bảo dưỡng",
    className: "bg-yellow-100 text-yellow-700",
  },
  INACTIVE: { label: "Ngừng khai thác", className: "bg-slate-200 text-slate-600" },
};

export default async function VesselDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  const canManage = user.role === "ADMIN";
  const canTransact = ["ADMIN", "MASTER"].includes(user.role);
  const canModerate = canTransact;

  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }
  if (!scope.all && id !== scope.vesselId) {
    notFound();
  }
  const vessel = await prisma.vessel.findUnique({
    where: { id },
    include: {
      warehouses: { orderBy: { code: "asc" } },
    },
  });
  if (!vessel) {
    notFound();
  }
  const [inventories, materials, requests, documents] = await Promise.all([
    prisma.inventory.findMany({
      where: { vesselId: id },
      orderBy: [{ warehouseId: "asc" }, { materialId: "asc" }],
      include: {
        warehouse: true,
        material: true,
      },
    }),
    prisma.material.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    }),
    prisma.materialRequest.findMany({
      where: { vesselId: id },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            material: true,
          },
        },
      },
    }),
    prisma.reportDocument.findMany({
      where: { vesselId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        uploadedBy: { select: { name: true } },
      },
    }),
  ]);
  const status = statusLabels[vessel.status] ?? {
    label: vessel.status,
    className: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="space-y-6">
      <div>
        <Link href="/vessels" className="text-sm text-blue-700 hover:underline">
          ← Quay lại đội tàu
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold text-blue-950">
            {vessel.code} — {vessel.name}
          </h2>
          <span className={`rounded px-2 py-1 text-sm ${status.className}`}>
            {status.label}
          </span>
        </div>
        <p className="text-slate-600">
          IMO: {vessel.imo || "—"} · Cờ: {vessel.flag || "—"} · Loại:{" "}
          {vessel.vesselType || "—"} · {vessel.warehouses.length} kho
        </p>
        <a
          href={`/api/export/inventory?vessel=${vessel.id}`}
          className="mt-2 inline-block rounded border border-blue-200 bg-white px-3 py-1.5 text-sm text-blue-950 hover:bg-blue-50"
        >
          ⬇ Xuất kiểm kê vật tư (MLS-11-06)
        </a>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Báo cáo từ tàu — xem nhanh
          </h3>
          <Link
            href="/documents"
            className="text-sm text-blue-700 hover:underline"
          >
            Tải lên / xem tất cả →
          </Link>
        </div>
        {documents.length === 0 ? (
          <p className="text-slate-600">
            Tàu chưa có báo cáo nào được tải lên.{" "}
            <Link href="/documents" className="text-blue-700 hover:underline">
              Tải báo cáo lên
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">Ngày tải</th>
                  <th className="p-2">Loại</th>
                  <th className="p-2">Kỳ</th>
                  <th className="p-2">Tiêu đề / File</th>
                  <th className="p-2">Cỡ</th>
                  <th className="p-2">Người tải</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b align-top">
                    <td className="p-2 whitespace-nowrap">
                      {doc.createdAt.toLocaleDateString("vi-VN")}
                    </td>
                    <td className="p-2 whitespace-nowrap">{doc.reportType}</td>
                    <td className="p-2 whitespace-nowrap">{doc.period}</td>
                    <td className="p-2">
                      <p className="font-medium">{doc.title}</p>
                      {doc.title !== doc.fileName && (
                        <p className="text-xs text-slate-500">{doc.fileName}</p>
                      )}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {doc.size >= 1024 * 1024
                        ? `${(doc.size / (1024 * 1024)).toFixed(1)} MB`
                        : `${Math.max(1, Math.round(doc.size / 1024))} KB`}
                    </td>
                    <td className="p-2">{doc.uploadedBy.name}</td>
                    <td className="p-2">
                      <a
                        href={`/api/documents/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                      >
                        Xem / Tải
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canManage && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 xl:col-span-2">
            <h3 className="mb-4 text-lg font-semibold">Chỉnh sửa thông tin tàu</h3>
            <VesselEditForm
              vessel={{
                id: vessel.id,
                code: vessel.code,
                name: vessel.name,
                imo: vessel.imo,
                flag: vessel.flag,
                vesselType: vessel.vesselType,
                status: vessel.status,
              }}
            />
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <h3 className="mb-4 text-lg font-semibold">Xóa tàu</h3>
            <p className="mb-4 text-sm text-slate-600">
              Chỉ xóa được khi tàu chưa có yêu cầu vật tư và không còn người
              dùng được gán phụ trách. Kho và tồn kho của tàu sẽ bị xóa theo.
            </p>
            <VesselDeleteButton
              id={vessel.id}
              name={vessel.name}
              requestCount={requests.length}
            />
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <h3 className="mb-4 text-lg font-semibold">Kho trên tàu</h3>
        {vessel.warehouses.length === 0 ? (
          <p className="text-slate-600">Tàu chưa có kho nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">Mã kho</th>
                  <th className="p-2">Tên kho</th>
                  <th className="p-2">Loại</th>
                </tr>
              </thead>
              <tbody>
                {vessel.warehouses.map((warehouse) => (
                  <tr key={warehouse.id} className="border-b">
                    <td className="p-2 font-medium">{warehouse.code}</td>
                    <td className="p-2">{warehouse.name}</td>
                    <td className="p-2">{warehouse.warehouseType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <h3 className="mb-4 text-lg font-semibold">
          Tồn kho của {vessel.name}
        </h3>
        {canTransact && vessel.warehouses.length > 0 && (
          <div className="mb-4 rounded border p-4">
            <p className="mb-3 text-sm font-medium text-slate-600">
              Nhập / xuất kho cho tàu này
            </p>
            <InventoryForm
              materials={materials.map((material) => ({
                id: material.id,
                code: material.code,
                nameVn: material.nameVn,
              }))}
              warehouses={vessel.warehouses.map((warehouse) => ({
                id: warehouse.id,
                code: warehouse.code,
                name: warehouse.name,
              }))}
              returnTo={`/vessels/${vessel.id}`}
            />
          </div>
        )}
        {inventories.length === 0 ? (
          <p className="text-slate-600">Chưa có tồn kho.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">Kho</th>
                  <th className="p-2">Mã VT</th>
                  <th className="p-2">Tên vật tư</th>
                  <th className="p-2">ĐVT</th>
                  <th className="p-2">Tồn</th>
                  <th className="p-2">Giữ</th>
                  <th className="p-2">Khả dụng</th>
                </tr>
              </thead>
              <tbody>
                {inventories.map((inventory) => {
                  const available =
                    inventory.quantity - inventory.reservedQuantity;
                  return (
                    <tr key={inventory.id} className="border-b">
                      <td className="p-2">{inventory.warehouse.name}</td>
                      <td className="p-2">{inventory.material.code}</td>
                      <td className="p-2">{inventory.material.nameVn}</td>
                      <td className="p-2">{inventory.material.uom}</td>
                      <td className="p-2">{inventory.quantity}</td>
                      <td className="p-2">{inventory.reservedQuantity}</td>
                      <td
                        className={`p-2 font-medium ${
                          available <= inventory.material.minStock
                            ? "text-red-600"
                            : "text-green-700"
                        }`}
                      >
                        {available}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <h3 className="mb-4 text-lg font-semibold">
          Yêu cầu vật tư của {vessel.name}
        </h3>
        <div className="mb-6">
          <RequestForm
            vessels={[{ id: vessel.id, code: vessel.code, name: vessel.name }]}
            materials={materials.map((material) => ({
              id: material.id,
              code: material.code,
              nameVn: material.nameVn,
              uom: material.uom,
              materialType: material.materialType,
              partNumber: material.partNumber,
              equipment: material.equipment,
            }))}
            defaultVesselId={vessel.id}
          />
        </div>
        {requests.length === 0 ? (
          <p className="text-slate-600">Chưa có yêu cầu vật tư nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">Số yêu cầu</th>
                  <th className="p-2">Loại</th>
                  <th className="p-2">Người yêu cầu</th>
                  <th className="p-2">Bộ phận</th>
                  <th className="p-2">Ưu tiên</th>
                  <th className="p-2">Nội dung</th>
                  <th className="p-2">Trạng thái</th>
                  <th className="p-2">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-b align-top">
                    <td className="p-2 font-medium">
                      <Link
                        href={`/requests/${request.id}`}
                        className="text-blue-700 hover:underline"
                      >
                        {request.requestNo}
                      </Link>
                    </td>
                    <td className="p-2">
                      {request.kind === "SPARE" ? "Phụ tùng" : "Vật tư"}
                    </td>
                    <td className="p-2">{request.requestedBy}</td>
                    <td className="p-2">{request.department}</td>
                    <td className="p-2">{request.priority}</td>
                    <td className="p-2">
                      {request.items.map((item) => (
                        <p key={item.id}>
                          {item.material
                            ? item.material.code
                            : `${item.itemName ?? "(mới)"} (mới)`}{" "}
                          x {item.quantity}
                        </p>
                      ))}
                    </td>
                    <td className="p-2">
                      <span className="rounded bg-slate-100 px-2 py-1">
                        {request.status}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/requests/${request.id}`}
                          className="rounded bg-slate-100 px-3 py-1 text-center text-slate-700 hover:bg-slate-200"
                        >
                          Xem / In
                        </Link>
                        {canModerate &&
                          request.status === "PENDING_MASTER" && (
                            <Link
                              href={`/requests/${request.id}`}
                              className="rounded bg-green-100 px-3 py-1 text-center text-green-700 hover:bg-green-200"
                            >
                              Duyệt
                            </Link>
                          )}
                        {canModerate && request.status === "APPROVED" && (
                          <RequestStatusForm
                            id={request.id}
                            status="IN_PROCUREMENT"
                            label="Chuyển mua sắm"
                            className="rounded bg-blue-100 px-3 py-1 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                            returnTo={`/vessels/${vessel.id}`}
                          />
                        )}
                        {canDeleteRequest(user, request) && (
                          <RequestDeleteButton
                            id={request.id}
                            requestNo={request.requestNo}
                            returnTo={`/vessels/${vessel.id}`}
                            className="rounded bg-red-100 px-3 py-1 text-center text-red-700 hover:bg-red-200 disabled:opacity-50"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
