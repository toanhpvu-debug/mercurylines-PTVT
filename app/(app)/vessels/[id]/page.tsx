import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import VesselEditForm from "@/components/VesselEditForm";
import VesselDeleteButton from "@/components/VesselDeleteButton";
import VesselSwitcher from "@/components/VesselSwitcher";
import { layT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

// Chỉ giữ MÀU ở đây; nhãn trạng thái lấy từ từ điển (labels.vesselStatus_* cho
// ACTIVE/INACTIVE, vessels.trangThaiBaoDuong cho MAINTENANCE).
const mauTrangThai: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  MAINTENANCE: "bg-yellow-100 text-yellow-700",
  INACTIVE: "bg-slate-200 text-slate-600",
};

export default async function VesselDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireScopedUser();
  const { t, tTuDo, ngay } = await layT();
  const scope = vesselScopeDayDu(user);
  const canManage = user.role === "ADMIN";

  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }
  if (!trongPhamVi(scope, id)) {
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
  // Bảng tồn kho ở đây chỉ để liếc nhanh: một tàu có vài trăm mặt hàng, dựng
  // hết ra thì trang hồ sơ tàu nặng gấp đôi mà vẫn không ai đọc hết. Muốn xem
  // đầy đủ, tìm kiếm hay lọc thì đã có trang Tồn kho ngay bên cạnh.
  const GIOI_HAN_TON_KHO = 50;
  const [inventories, tongTonKho, requests, documents] = await Promise.all([
    prisma.inventory.findMany({
      where: { vesselId: id },
      orderBy: [{ warehouseId: "asc" }, { materialId: "asc" }],
      take: GIOI_HAN_TON_KHO,
      include: {
        warehouse: true,
        material: true,
      },
    }),
    prisma.inventory.count({ where: { vesselId: id } }),
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
  const mauTT = mauTrangThai[vessel.status] ?? "bg-slate-100 text-slate-600";
  const nhanTT =
    vessel.status === "MAINTENANCE"
      ? t("vessels.trangThaiBaoDuong")
      : vessel.status in mauTrangThai
        ? tTuDo(`labels.vesselStatus_${vessel.status}`)
        : vessel.status;
  return (
    <div className="space-y-6">
      <div>
        <Link href="/vessels" className="text-sm text-blue-700 hover:underline">
          ← {t("vessels.quayLaiDoiTau")}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold text-blue-950">
            {vessel.code} — {vessel.name}
          </h2>
          <span className={`rounded px-2 py-1 text-sm ${mauTT}`}>{nhanTT}</span>
        </div>
        <p className="text-slate-600">
          IMO: {vessel.imo || "—"} · {t("vessels.nhanCo")}:{" "}
          {vessel.flag || "—"} · {t("vessels.nhanLoai")}:{" "}
          {vessel.vesselType || "—"} ·{" "}
          {t("vessels.nKho", { n: vessel.warehouses.length })}
        </p>
      </div>

      <VesselSwitcher hienTai={vessel.id} duongDan={(id) => `/vessels/${id}`} />

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("vessels.baoCaoNhanh")}</h3>
          <Link
            href="/documents"
            className="text-sm text-blue-700 hover:underline"
          >
            {t("vessels.taiLenXemTatCa")}
          </Link>
        </div>
        {documents.length === 0 ? (
          <p className="text-slate-600">
            {t("vessels.chuaCoBaoCaoTau")}{" "}
            <Link href="/documents" className="text-blue-700 hover:underline">
              {t("vessels.taiBaoCaoLen")}
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">{t("vessels.cotNgayTai")}</th>
                  <th className="p-2">{t("vessels.cotLoai")}</th>
                  <th className="p-2">{t("vessels.cotKy")}</th>
                  <th className="p-2">{t("vessels.cotTieuDeFile")}</th>
                  <th className="p-2">{t("vessels.cotCoFile")}</th>
                  <th className="p-2">{t("vessels.cotNguoiTai")}</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b align-top">
                    <td className="p-2 whitespace-nowrap">
                      {ngay(doc.createdAt)}
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
                        {t("vessels.xemTaiFile")}
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
            <h3 className="mb-4 text-lg font-semibold">
              {t("vessels.suaThongTinTau")}
            </h3>
            <VesselEditForm
              vessel={{
                id: vessel.id,
                code: vessel.code,
                name: vessel.name,
                imo: vessel.imo,
                flag: vessel.flag,
                vesselType: vessel.vesselType,
                status: vessel.status,
                mainEngineGroup: vessel.mainEngineGroup,
                mainEngineModel: vessel.mainEngineModel,
              }}
            />
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <h3 className="mb-4 text-lg font-semibold">
              {t("vessels.xoaTau")}
            </h3>
            <p className="mb-4 text-sm text-slate-600">
              {t("vessels.luuYXoaTau")}
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
        <h3 className="mb-4 text-lg font-semibold">
          {t("vessels.khoTrenTau")}
        </h3>
        {vessel.warehouses.length === 0 ? (
          <p className="text-slate-600">{t("vessels.chuaCoKho")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">{t("vessels.cotMaKho")}</th>
                  <th className="p-2">{t("vessels.cotTenKho")}</th>
                  <th className="p-2">{t("vessels.cotLoai")}</th>
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">
            {t("vessels.tonKhoCuaTau", { ten: vessel.name })}
          </h3>
          {/* Nhập/xuất và xuất kiểm kê làm ở module Tồn kho — ở đây chỉ xem. */}
          <Link
            href={`/inventory?vessel=${vessel.id}`}
            className="rounded border border-blue-200 bg-white px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-50"
          >
            {t("vessels.nhapXuatKiemKe")}
          </Link>
        </div>
        {tongTonKho === 0 ? (
          <p className="text-slate-600">{t("vessels.chuaCoTonKho")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">{t("chung.kho")}</th>
                  <th className="p-2">{t("vessels.cotMaVatTu")}</th>
                  <th className="p-2">{t("vessels.cotTenVatTu")}</th>
                  <th className="p-2">{t("chung.donVi")}</th>
                  <th className="p-2">{t("vessels.cotTon")}</th>
                  <th className="p-2">{t("vessels.cotGiu")}</th>
                  <th className="p-2">{t("vessels.cotKhaDung")}</th>
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
                {tongTonKho > inventories.length && (
                  <tr className="border-b bg-slate-50/60">
                    <td colSpan={7} className="p-2 text-xs text-slate-500">
                      {t("vessels.dangHienTruoc", { n: inventories.length })}{" "}
                      <b>{tongTonKho}</b> {t("vessels.dangHienSau")}{" "}
                      <Link
                        href={`/inventory?vessel=${vessel.id}`}
                        className="text-blue-700 hover:underline"
                      >
                        {t("vessels.xemDayDuTonKho")}
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">
            {t("vessels.yeuCauCuaTau", { ten: vessel.name })}
          </h3>
          {/* Tạo, duyệt, xóa yêu cầu làm ở module Yêu cầu vật tư. */}
          <Link
            href={`/requests?vessel=${vessel.id}`}
            className="rounded border border-blue-200 bg-white px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-50"
          >
            {t("vessels.taoDuyetYeuCau")}
          </Link>
        </div>
        {requests.length === 0 ? (
          <p className="text-slate-600">{t("vessels.chuaCoYeuCau")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">{t("vessels.cotSoHieuYeuCau")}</th>
                  <th className="p-2">{t("vessels.cotLoai")}</th>
                  <th className="p-2">{t("vessels.cotNguoiYeuCau")}</th>
                  <th className="p-2">{t("vessels.cotBoPhan")}</th>
                  <th className="p-2">{t("vessels.cotUuTien")}</th>
                  <th className="p-2">{t("vessels.cotNoiDung")}</th>
                  <th className="p-2">{t("chung.trangThai")}</th>
                  <th className="p-2">{t("chung.thaoTac")}</th>
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
                      {tTuDo(`labels.type_${request.kind}`)}
                    </td>
                    <td className="p-2">{request.requestedBy}</td>
                    <td className="p-2">
                      {tTuDo(`labels.reqDept_${request.department}`)}
                    </td>
                    <td className="p-2">
                      {tTuDo(`labels.priority_${request.priority}`)}
                    </td>
                    <td className="p-2">
                      {request.items.map((item) => (
                        <p key={item.id}>
                          {item.material
                            ? item.material.code
                            : `${item.itemName ?? t("vessels.vatTuMoi")} ${t(
                                "vessels.vatTuMoi"
                              )}`}{" "}
                          x {item.quantity}
                        </p>
                      ))}
                    </td>
                    <td className="p-2">
                      <span className="rounded bg-slate-100 px-2 py-1">
                        {tTuDo(`labels.reqStatus_${request.status}`)}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/requests/${request.id}`}
                          className="rounded bg-slate-100 px-3 py-1 text-center text-slate-700 hover:bg-slate-200"
                        >
                          {t("vessels.xemIn")}
                        </Link>
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
