import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PurchaseOrderDeleteButton from "@/components/PurchaseOrderDeleteButton";
import {
  requireScopedUser,
  vesselScopeDayDu,
  vesselWhere,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const poStatusLabels: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Nháp", className: "bg-slate-100 text-slate-600" },
  SENT: { label: "Đã gửi NCC", className: "bg-blue-100 text-blue-700" },
  CONFIRMED: { label: "NCC xác nhận", className: "bg-indigo-100 text-indigo-700" },
  PARTIALLY_RECEIVED: {
    label: "Nhận một phần",
    className: "bg-amber-100 text-amber-700",
  },
  RECEIVED: { label: "Đã nhận đủ", className: "bg-green-100 text-green-700" },
  CLOSED: { label: "Hoàn tất", className: "bg-green-200 text-green-800" },
  CANCELLED: { label: "Đã hủy", className: "bg-red-100 text-red-700" },
};

export default async function PurchasingPage() {
  const user = await requireScopedUser();
  const scope = vesselScopeDayDu(user);
  const canManage = ["ADMIN", "MASTER"].includes(user.role);
  // Xóa chứng từ mua sắm chỉ dành cho quản trị viên.
  const canDeletePo = user.role === "ADMIN";

  const [pendingRequests, purchaseOrders] = await Promise.all([
    prisma.materialRequest.findMany({
      where: { ...vesselWhere(scope), status: "IN_PROCUREMENT" },
      orderBy: { createdAt: "asc" },
      include: {
        vessel: { select: { id: true, code: true, name: true } },
        items: true,
      },
    }),
    prisma.purchaseOrder.findMany({
      where: vesselWhere(scope),
      orderBy: { createdAt: "desc" },
      include: {
        supplier: { select: { name: true } },
        vessel: { select: { id: true, code: true, name: true } },
        items: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-blue-950">Mua sắm (Purchasing)</h2>
          <p className="text-slate-600">
            Quy trình từ yêu cầu đã duyệt → đơn mua hàng → nhận hàng → hoàn tất
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Link
              href="/purchasing/direct"
              className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800"
            >
              + Tạo IFQ/PO trực tiếp (KT-VT)
            </Link>
          )}
          <Link
            href="/purchasing/forms"
            className="rounded border px-4 py-2 text-sm hover:bg-blue-50"
          >
            Mẫu biểu theo tàu
          </Link>
          <Link
            href="/purchasing/suppliers"
            className="rounded border px-4 py-2 text-sm hover:bg-blue-50"
          >
            Nhà cung cấp
          </Link>
          {canManage && (
            <Link
              href="/purchasing/new"
              className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800"
            >
              + Tạo đơn mua
            </Link>
          )}
        </div>
      </div>

      {scope.unassigned ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          Bạn chưa được gán tàu phụ trách nên chưa xem được mua sắm. Vui lòng
          liên hệ quản trị viên.
        </div>
      ) : (
        <>
          {/* Bước 1: yêu cầu đã duyệt, chờ lập đơn mua */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <h3 className="mb-1 text-lg font-semibold">
              Yêu cầu chờ mua sắm ({pendingRequests.length})
            </h3>
            <p className="mb-4 text-sm text-slate-500">
              Yêu cầu đã duyệt và chuyển sang mua sắm — chọn để lập đơn mua hàng.
            </p>
            {pendingRequests.length === 0 ? (
              <p className="text-slate-600">
                Không có yêu cầu nào đang chờ mua sắm.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border text-sm">
                  <thead>
                    <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                      <th className="p-2">Số yêu cầu</th>
                      <th className="p-2">Loại</th>
                      <th className="p-2">Tàu</th>
                      <th className="p-2">Người yêu cầu</th>
                      <th className="p-2">Số dòng</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map((req) => (
                      <tr key={req.id} className="border-b">
                        <td className="p-2 font-medium">
                          <Link
                            href={`/requests/${req.id}`}
                            className="text-blue-700 hover:underline"
                          >
                            {req.requestNo}
                          </Link>
                        </td>
                        <td className="p-2">
                          {req.kind === "SPARE" ? "Phụ tùng" : "Vật tư"}
                        </td>
                        <td className="p-2">{req.vessel.name}</td>
                        <td className="p-2">{req.requestedBy}</td>
                        <td className="p-2">{req.items.length}</td>
                        <td className="p-2">
                          {canManage && (
                            <Link
                              href={`/purchasing/new?vessel=${req.vessel.id}`}
                              className="rounded bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200"
                            >
                              Lập đơn mua
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Danh sách đơn mua hàng */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <h3 className="mb-4 text-lg font-semibold">
              Đơn mua hàng ({purchaseOrders.length})
            </h3>
            {purchaseOrders.length === 0 ? (
              <p className="text-slate-600">Chưa có đơn mua nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border text-sm">
                  <thead>
                    <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                      <th className="p-2">Số PO</th>
                      <th className="p-2">Nhà cung cấp</th>
                      <th className="p-2">Tàu</th>
                      <th className="p-2">Trạng thái</th>
                      <th className="p-2">Số dòng</th>
                      <th className="p-2">Tiến độ nhận</th>
                      <th className="p-2">Giá trị</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.map((po) => {
                      const total = po.items.reduce(
                        (s, it) => s + it.quantity * it.unitPrice,
                        0
                      );
                      const ordered = po.items.reduce(
                        (s, it) => s + it.quantity,
                        0
                      );
                      const received = po.items.reduce(
                        (s, it) => s + it.quantityReceived,
                        0
                      );
                      const st =
                        poStatusLabels[po.status] ?? {
                          label: po.status,
                          className: "bg-slate-100",
                        };
                      return (
                        <tr key={po.id} className="border-b">
                          <td className="p-2 font-medium">
                            <Link
                              href={`/purchasing/${po.id}`}
                              className="text-blue-700 hover:underline"
                            >
                              {po.poNo}
                            </Link>
                          </td>
                          <td className="p-2">{po.supplier.name}</td>
                          <td className="p-2">{po.vessel.code}</td>
                          <td className="p-2">
                            <span
                              className={`rounded px-2 py-1 text-xs ${st.className}`}
                            >
                              {st.label}
                            </span>
                          </td>
                          <td className="p-2">{po.items.length}</td>
                          <td className="p-2">
                            {received} / {ordered}
                          </td>
                          <td className="p-2">
                            {total
                              ? `${total.toLocaleString("vi-VN")} ${po.currency}`
                              : "—"}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-3">
                              <Link
                                href={`/purchasing/${po.id}`}
                                className="text-blue-700 hover:underline"
                              >
                                Xem
                              </Link>
                              {/* Đơn đã hủy là rác trong danh sách — cho quản
                                  trị viên dọn. Điều kiện kiểm lại ở server. */}
                              {canDeletePo && po.status === "CANCELLED" && (
                                <PurchaseOrderDeleteButton
                                  id={po.id}
                                  poNo={po.poNo}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
