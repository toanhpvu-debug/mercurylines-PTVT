import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PurchaseOrderDeleteButton from "@/components/PurchaseOrderDeleteButton";
import {
  requireScopedUser,
  vesselScopeDayDu,
  vesselWhere,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

// Chỉ còn màu của huy hiệu trạng thái — chữ lấy từ labels.poStatus_*.
const poStatusClass: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SENT: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-indigo-100 text-indigo-700",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-700",
  RECEIVED: "bg-green-100 text-green-700",
  CLOSED: "bg-green-200 text-green-800",
  CANCELLED: "bg-red-100 text-red-700",
};

export default async function PurchasingPage() {
  const user = await requireScopedUser();
  const { t, tTuDo, so } = await layT();
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
          <h2 className="text-2xl font-bold text-blue-950">
            {t("purchasing.tieuDe")}
          </h2>
          <p className="text-slate-600">{t("purchasing.moTa")}</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Link
              href="/purchasing/direct"
              className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800"
            >
              {t("purchasing.nutTaoTrucTiep")}
            </Link>
          )}
          <Link
            href="/purchasing/forms"
            className="rounded border px-4 py-2 text-sm hover:bg-blue-50"
          >
            {t("purchasing.nutMauBieu")}
          </Link>
          <Link
            href="/purchasing/suppliers"
            className="rounded border px-4 py-2 text-sm hover:bg-blue-50"
          >
            {t("purchasing.nhaCungCap")}
          </Link>
          {canManage && (
            <Link
              href="/purchasing/new"
              className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800"
            >
              {t("purchasing.nutTaoDon")}
            </Link>
          )}
        </div>
      </div>

      {scope.unassigned ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          {t("purchasing.chuaGanTau")}
        </div>
      ) : (
        <>
          {/* Bước 1: yêu cầu đã duyệt, chờ lập đơn mua */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <h3 className="mb-1 text-lg font-semibold">
              {t("purchasing.yeuCauChoMuaSam", { n: pendingRequests.length })}
            </h3>
            <p className="mb-4 text-sm text-slate-500">
              {t("purchasing.yeuCauChoMuaSamMoTa")}
            </p>
            {pendingRequests.length === 0 ? (
              <p className="text-slate-600">
                {t("purchasing.khongCoYeuCauCho")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border text-sm">
                  <thead>
                    <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                      <th className="p-2">{t("purchasing.cotSoYeuCau")}</th>
                      <th className="p-2">{t("purchasing.cotLoai")}</th>
                      <th className="p-2">{t("chung.tau")}</th>
                      <th className="p-2">{t("purchasing.nguoiYeuCau")}</th>
                      <th className="p-2">{t("purchasing.cotSoDong")}</th>
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
                          {tTuDo(
                            `labels.type_${req.kind === "SPARE" ? "SPARE" : "STORE"}`
                          )}
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
                              {t("purchasing.nutLapDon")}
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
              {t("purchasing.danhSachDon", { n: purchaseOrders.length })}
            </h3>
            {purchaseOrders.length === 0 ? (
              <p className="text-slate-600">{t("purchasing.chuaCoDonMua")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border text-sm">
                  <thead>
                    <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                      <th className="p-2">{t("purchasing.cotSoPo")}</th>
                      <th className="p-2">{t("purchasing.nhaCungCap")}</th>
                      <th className="p-2">{t("chung.tau")}</th>
                      <th className="p-2">{t("chung.trangThai")}</th>
                      <th className="p-2">{t("purchasing.cotSoDong")}</th>
                      <th className="p-2">{t("purchasing.cotTienDoNhan")}</th>
                      <th className="p-2">{t("purchasing.cotGiaTri")}</th>
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
                      const stClass =
                        poStatusClass[po.status] ?? "bg-slate-100";
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
                              className={`rounded px-2 py-1 text-xs ${stClass}`}
                            >
                              {tTuDo(`labels.poStatus_${po.status}`)}
                            </span>
                          </td>
                          <td className="p-2">{po.items.length}</td>
                          <td className="p-2">
                            {received} / {ordered}
                          </td>
                          <td className="p-2">
                            {total ? `${so(total)} ${po.currency}` : "—"}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-3">
                              <Link
                                href={`/purchasing/${po.id}`}
                                className="text-blue-700 hover:underline"
                              >
                                {t("purchasing.nutXem")}
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
