import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  REQUEST_STATUS_BADGE,
  REQUEST_STATUS_LABEL,
} from "@/lib/requestStatus";
import RequestForm from "@/components/RequestForm";
import RequestStatusForm from "@/components/RequestStatusForm";
import RequestDeleteButton from "@/components/RequestDeleteButton";
import {
  canDeleteRequest,
  requireScopedUser,
  vesselIdWhere,
  vesselScope,
  vesselWhere,
} from "@/lib/auth";

export const dynamic = "force-dynamic";


export default async function RequestsPage() {
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  const canModerate = ["ADMIN", "MASTER"].includes(user.role);
  const [requests, vessels, materials] = await Promise.all([
    prisma.materialRequest.findMany({
      where: vesselWhere(scope),
      orderBy: { createdAt: "desc" },
      include: {
        vessel: true,
        items: {
          include: {
            material: true,
          },
        },
      },
    }),
    prisma.vessel.findMany({
      where: vesselIdWhere(scope),
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
      },
    }),
    prisma.material.findMany({
      where: { isActive: true },
      orderBy: [{ materialType: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        nameVn: true,
        uom: true,
        materialType: true,
        partNumber: true,
        equipment: true,
      },
    }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-blue-950">Yêu cầu vật tư & phụ tùng</h2>
        <p className="text-slate-600">
          {scope.all
            ? "Tạo yêu cầu theo mẫu MLS-11-05B (vật tư) / MLS-11-05A (phụ tùng), duyệt và in"
            : "Yêu cầu vật tư / phụ tùng của tàu bạn phụ trách"}
        </p>
      </div>
      {scope.unassigned ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          Bạn chưa được gán tàu phụ trách nên chưa tạo được yêu cầu vật tư. Vui
          lòng liên hệ quản trị viên.
        </div>
      ) : (
        <RequestForm
          vessels={vessels}
          materials={materials}
          defaultVesselId={scope.vesselId ?? undefined}
        />
      )}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <h3 className="mb-4 text-lg font-semibold">Danh sách yêu cầu</h3>
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                <th className="p-2">Số yêu cầu</th>
                <th className="p-2">Loại</th>
                <th className="p-2">Tàu</th>
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
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        request.kind === "SPARE"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {request.kind === "SPARE" ? "Phụ tùng" : "Vật tư"}
                    </span>
                  </td>
                  <td className="p-2">
                    <Link
                      href={`/vessels/${request.vesselId}`}
                      className="text-blue-700 hover:underline"
                    >
                      {request.vessel.name}
                    </Link>
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
                    <span
                      className={`rounded px-2 py-1 font-medium ${
                        REQUEST_STATUS_BADGE[request.status] ??
                        "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {REQUEST_STATUS_LABEL[request.status] ?? request.status}
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
                      {request.status === "DRAFT" && (
                        <RequestStatusForm
                          id={request.id}
                          status="PENDING_MASTER"
                          label="Trình duyệt"
                          className="w-full rounded bg-amber-100 px-3 py-1 text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                        />
                      )}
                      {canModerate && request.status === "PENDING_MASTER" && (
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
                        />
                      )}
                      {canDeleteRequest(user, request) && (
                        <RequestDeleteButton
                          id={request.id}
                          requestNo={request.requestNo}
                          returnTo="/requests"
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
      </div>
    </div>
  );
}
