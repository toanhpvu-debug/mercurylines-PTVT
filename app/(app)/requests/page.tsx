import Form from "next/form";
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
  capDuyetChoPhep,
  chonDuocTau,
  danhTinhHieuLuc,
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
  vesselWhere,
} from "@/lib/auth";
import { CHI_HUY_TAU, DUYET_CONG_TY, LAP_YEU_CAU } from "@/lib/roles";
import { layT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";


export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ vessel?: string; status?: string }>;
}) {
  const user = await requireScopedUser();
  const { t, tTuDo, ngayGio } = await layT();
  const scope = vesselScopeDayDu(user);
  // CHI_HUY_TAU ∪ DUYET_CONG_TY — đúng danh sách updateRequestStatus nhận.
  // Liệt kê tay ở đây từng bỏ sót máy trưởng, làm họ không thấy nút duyệt.
  const canModerate = danhTinhHieuLuc(user).some(
    (d) => CHI_HUY_TAU.includes(d.role) || DUYET_CONG_TY.includes(d.role)
  );
  const canSubmit = LAP_YEU_CAU.includes(user.role);
  const params = await searchParams;
  // Lọc theo tàu (link từ trang hồ sơ tàu) và theo trạng thái.
  const vesselFilter = Number(params.vessel) || 0;
  const statusFilter =
    params.status && REQUEST_STATUS_LABEL[params.status] ? params.status : "";
  const [requests, vessels, materials] = await Promise.all([
    prisma.materialRequest.findMany({
      where: {
        ...vesselWhere(scope),
        ...(vesselFilter ? { vesselId: vesselFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        vessel: true,
        items: {
          // Danh sách chỉ hiện đúng item.material.code; kéo cả bản ghi vật tư
          // (15 cột) cho MỖI dòng của MỖI yêu cầu là tải thừa lớn dần theo số
          // yêu cầu × số dòng. Chỉ lấy mã.
          include: {
            material: { select: { code: true } },
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
        <h2 className="text-2xl font-bold text-blue-950">{t("requests.tieuDe")}</h2>
        <p className="text-slate-600">
          {scope.all ? t("requests.moTaDoi") : t("requests.moTaTau")}
        </p>
      </div>
      {scope.unassigned ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          {t("requests.chuaGanTau")}
        </div>
      ) : (
        <RequestForm
          vessels={vessels}
          materials={materials}
          defaultVesselId={scope.vesselId ?? undefined}
          nguoiLap={{ name: user.name, role: user.role }}
        />
      )}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">
            {t("requests.danhSach", { n: requests.length })}
          </h3>
          {/* next/form: bấm "Lọc" chỉ tải phần nội dung (chuyển trang phía
              client, hiện khung chờ ngay) thay vì tải lại cả trang như
              <form method="get"> thường. */}
          <Form action="/requests" className="flex flex-wrap items-center gap-2">
            {chonDuocTau(scope) && (
              <select
                name="vessel"
                defaultValue={vesselFilter ? String(vesselFilter) : ""}
                className="rounded border p-1.5 text-sm"
              >
                <option value="">{t("chung.tatCaTau")}</option>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} — {v.name}
                  </option>
                ))}
              </select>
            )}
            <select
              name="status"
              defaultValue={statusFilter}
              className="rounded border p-1.5 text-sm"
            >
              <option value="">{t("requests.moiTrangThai")}</option>
              {Object.keys(REQUEST_STATUS_LABEL).map((value) => (
                <option key={value} value={value}>
                  {tTuDo(`labels.reqStatus_${value}`)}
                </option>
              ))}
            </select>
            <button className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800">
              {t("chung.loc")}
            </button>
            {(vesselFilter || statusFilter) && (
              <Link
                href="/requests"
                className="text-sm text-slate-600 hover:underline"
              >
                {t("chung.boLoc")}
              </Link>
            )}
          </Form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                <th className="p-2">{t("requests.cotSoYeuCau")}</th>
                <th className="p-2">{t("requests.cotLoai")}</th>
                <th className="p-2">{t("chung.tau")}</th>
                <th className="p-2">{t("requests.nguoiYeuCau")}</th>
                <th className="p-2">{t("requests.cotLapLuc")}</th>
                <th className="p-2">{t("requests.cotBoPhan")}</th>
                <th className="p-2">{t("requests.cotUuTien")}</th>
                <th className="p-2">{t("requests.cotNoiDung")}</th>
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
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        request.kind === "SPARE"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {tTuDo(
                        `labels.type_${request.kind === "SPARE" ? "SPARE" : "STORE"}`
                      )}
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
                  <td className="p-2">
                    {request.requestedBy}
                    {request.requestedByRole && (
                      <span className="block text-xs text-slate-500">
                        {tTuDo(`labels.role_${request.requestedByRole}`)}
                      </span>
                    )}
                  </td>
                  {/* Đến phút, không chỉ ngày: hai yêu cầu cùng ngày phải phân
                      biệt được cái nào lập trước. */}
                  <td className="p-2 whitespace-nowrap text-slate-600">
                    {ngayGio(request.createdAt)}
                  </td>
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
                          : `${item.itemName ?? t("requests.moi")} ${t("requests.moi")}`}{" "}
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
                      {tTuDo(`labels.reqStatus_${request.status}`)}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/requests/${request.id}`}
                        className="rounded bg-slate-100 px-3 py-1 text-center text-slate-700 hover:bg-slate-200"
                      >
                        {t("requests.nutXemIn")}
                      </Link>
                      {canSubmit &&
                        (request.status === "DRAFT" ||
                          request.status === "REJECTED") && (
                          <RequestStatusForm
                            id={request.id}
                            status="PENDING_MASTER"
                            label={
                              request.status === "REJECTED"
                                ? t("requests.nutTrinhLai")
                                : t("requests.nutTrinh")
                            }
                            className="w-full rounded bg-amber-100 px-3 py-1 text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                          />
                        )}
                      {/* Chỉ hiện nút Duyệt cho người ĐANG GIỮ bước duyệt —
                          máy trưởng không thấy nút trên yêu cầu boong, văn
                          phòng không thấy trên yêu cầu tàu chưa duyệt. */}
                      {capDuyetChoPhep(user, request) && (
                        <Link
                          href={`/requests/${request.id}`}
                          className="rounded bg-green-100 px-3 py-1 text-center text-green-700 hover:bg-green-200"
                        >
                          {capDuyetChoPhep(user, request) === "TAU"
                            ? t("requests.nutTauDuyet")
                            : t("requests.nutCongTyDuyet")}
                        </Link>
                      )}
                      {canModerate && request.status === "APPROVED" && (
                        <RequestStatusForm
                          id={request.id}
                          status="IN_PROCUREMENT"
                          label={t("requests.nutChuyenMuaSam")}
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
