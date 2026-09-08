import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { REQUEST_STATUS_BADGE } from "@/lib/requestStatus";
import {
  canDeleteRequest,
  capDuyetChoPhep,
  requireScopedUser,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import {
  LAP_YEU_CAU,
  ROLE_LABEL,
  ROLE_LABEL_EN,
  SI_QUAN,
  nguoiDuyetCapTau,
} from "@/lib/roles";
import type { KhoaDich } from "@/lib/i18n";
import { layT } from "@/lib/i18n/server";
import PrintButton from "@/components/PrintButton";
import RequestStatusForm from "@/components/RequestStatusForm";
import RequestApprovalForm from "@/components/RequestApprovalForm";
import RequestDeleteButton from "@/components/RequestDeleteButton";
import RequestRejectForm from "@/components/RequestRejectForm";

export const dynamic = "force-dynamic";


const deptLabels: Record<string, string> = {
  ENGINE: "Máy (Engine)",
  DECK: "Boong (Deck)",
  ELECTRICAL: "Điện (Electrical)",
  GENERAL: "Phục vụ / Chung",
};

/**
 * Vì sao người đang xem không được duyệt — cùng phân nhánh với
 * viSaoKhongDuyetDuoc() ở lib/roles, nhưng trả về KHÓA từ điển để câu giải
 * thích đổi theo ngôn ngữ đang chọn.
 */
function khoaViSaoKhongDuyet(role: string): KhoaDich {
  if (SI_QUAN.includes(role)) return "requests.viSaoSiQuan";
  if (role === "CHIEF_ENGINEER") return "requests.viSaoMayTruong";
  if (role === "TECH_MANAGER") return "requests.viSaoQuanLyKyThuat";
  return "chung.khongCoQuyen";
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireScopedUser();
  const { t, tTuDo, ngayGio } = await layT();
  const scope = vesselScopeDayDu(user);
  const canModerate = ["ADMIN", "MASTER", "TECH_MANAGER"].includes(user.role);
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }
  const request = await prisma.materialRequest.findUnique({
    where: { id },
    include: {
      vessel: true,
      items: { include: { material: true }, orderBy: { id: "asc" } },
      events: { orderBy: { id: "asc" } },
    },
  });
  if (!request) {
    notFound();
  }
  if (!trongPhamVi(scope, request.vesselId)) {
    notFound();
  }
  const isSpare = request.kind === "SPARE";
  const formCode = isSpare ? "MLS-11-05A" : "MLS-11-05B";
  // Hiển thị dòng: dùng vật tư có sẵn nếu có, ngược lại dùng dữ liệu nhập tay (vật tư mới).
  type Line = (typeof request.items)[number];
  const lineName = (item: Line) =>
    item.material
      ? item.material.nameVn +
        (item.material.nameEn ? ` (${item.material.nameEn})` : "")
      : (item.itemName ?? "") + " (mới)";
  const lineCode = (item: Line) =>
    item.material
      ? isSpare
        ? (item.material.partNumber ?? "")
        : (item.material.impa ?? "")
      : (item.itemCode ?? "");
  const lineUom = (item: Line) =>
    item.material ? item.material.uom : (item.itemUom ?? "");
  const lineEquipment = (item: Line) =>
    item.material ? (item.material.equipment ?? "") : "";
  const lineShortName = (item: Line) =>
    item.material ? item.material.nameVn : (item.itemName ?? t("requests.moi"));
  const lineDisplayCode = (item: Line) =>
    item.material ? item.material.code : t("requests.moi");
  const dateStr = (request.requiredDate ?? request.createdAt).toLocaleDateString(
    "vi-VN"
  );
  // Cấp duyệt mà NGƯỜI ĐANG XEM được phép làm ngay bây giờ (null = không phải
  // lượt của họ). Cùng một hàm với server action nên nút bấm và quyền thật
  // không thể lệch nhau.
  const capDuyet = capDuyetChoPhep(user, request);
  const dangChoDuyet =
    request.status === "PENDING_MASTER" || request.status === "PENDING_OFFICE";
  const nguoiPhaiDuyet =
    request.status === "PENDING_MASTER"
      ? t("requests.nguoiDuyetTau", {
          ai: tTuDo(`labels.role_${nguoiDuyetCapTau(request.department)}`),
        })
      : request.status === "PENDING_OFFICE"
        ? tTuDo("labels.role_TECH_MANAGER")
        : "";
  // Người lập (hoặc quản lý) trình yêu cầu nháp lên cấp duyệt; bị từ chối thì
  // sửa xong trình lại được.
  const canSubmit =
    (request.status === "DRAFT" || request.status === "REJECTED") &&
    LAP_YEU_CAU.includes(user.role);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href="/requests" className="text-sm text-blue-700 hover:underline">
          {t("requests.quayLaiDanhSach")}
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-1 text-sm font-medium ${
              REQUEST_STATUS_BADGE[request.status] ?? "bg-slate-100 text-slate-700"
            }`}
          >
            {tTuDo(`labels.reqStatus_${request.status}`)}
          </span>
          {canDeleteRequest(user, request) && (
            <RequestDeleteButton
              id={request.id}
              requestNo={request.requestNo}
              returnTo="/requests"
            />
          )}
          <PrintButton label={`${t("chung.in")} ${formCode}`} />
        </div>
      </div>

      <div className="print-area rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100 print:rounded-none print:p-0 print:shadow-none">
        <table className="w-full border-2 border-black text-sm">
          <tbody>
            <tr>
              <td className="w-40 border border-black p-2 align-middle">
                <p className="text-lg font-black italic">Mercury Lines</p>
              </td>
              <td className="border border-black p-2 text-center">
                <p className="font-bold">MERCURY LINES COMPANY LIMITED</p>
                <p className="font-bold">
                  {isSpare
                    ? "REQUISITION FOR SPARE PARTS / YÊU CẦU PHỤ TÙNG"
                    : "REQUISITION FOR STORES / YÊU CẦU VẬT TƯ"}
                </p>
                <p className="text-xs italic">
                  Phù hợp: Bộ luật ISM 5.2, 6.1.3, 10.1
                </p>
              </td>
              <td className="w-44 border border-black p-2 text-xs">
                <p>{formCode}</p>
                <p>Ngày ban hành: 10/01/2024</p>
                <p>Soát xét: 0</p>
                <p>Trang: 1 of 1</p>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-3 grid grid-cols-2 gap-1 text-sm">
          <p>
            <span className="font-semibold">M/V (Tàu):</span>{" "}
            {request.vessel.name}
          </p>
          <p>
            <span className="font-semibold">Date (Ngày):</span> {dateStr}
          </p>
          <p>
            <span className="font-semibold">Dept. (Bộ phận):</span>{" "}
            {deptLabels[request.department] ?? request.department}
          </p>
          <p>
            <span className="font-semibold">Req. No. (Số y/cầu):</span>{" "}
            {request.requestNo}
          </p>
          {isSpare && (
            <>
              <p>
                <span className="font-semibold">Equipment (Thiết bị):</span>{" "}
                {request.equipment || "—"}
              </p>
              <p>
                <span className="font-semibold">Maker (Hãng SX):</span>{" "}
                {request.maker || "—"}
              </p>
              <p>
                <span className="font-semibold">Serial/Engine No.:</span>{" "}
                {request.serialNo || "—"}
              </p>
            </>
          )}
          <p className="col-span-2">
            <span className="font-semibold">Người yêu cầu:</span>{" "}
            {request.requestedBy}
            {request.requestedByRole
              ? ` · ${ROLE_LABEL[request.requestedByRole] ?? request.requestedByRole}`
              : ""}
            {request.purpose ? ` · Mục đích: ${request.purpose}` : ""}
          </p>
          {/* Thời điểm lập ghi đến PHÚT, không chỉ ngày: hai yêu cầu cùng ngày
              cần phân biệt được cái nào trước, nhất là khi tranh chấp tồn kho. */}
          <p className="col-span-2">
            <span className="font-semibold">Lập lúc:</span>{" "}
            {request.createdAt.toLocaleString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {request.submittedAt
              ? ` · Trình duyệt lúc ${request.submittedAt.toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : ""}
          </p>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-2 border-black text-xs">
            <thead>
              <tr className="text-center">
                <th className="border border-black p-1">
                  S.No
                  <br />
                  Stt
                </th>
                <th className="border border-black p-1">
                  {isSpare ? "NAME OF PART / Tên phụ tùng" : "Description / Mô tả"}
                </th>
                {isSpare && (
                  <th className="border border-black p-1">ITEM / Hạng mục</th>
                )}
                <th className="border border-black p-1">
                  {isSpare ? "PART NO. / Số phụ tùng" : "IMPA Code / Mã IMPA"}
                </th>
                <th className="border border-black p-1">
                  UNIT
                  <br />
                  Đơn vị
                </th>
                <th className="border border-black p-1">
                  ROB
                  <br />
                  S.L Tồn
                </th>
                <th className="border border-black p-1">
                  REQ
                  <br />
                  S.L Yêu cầu
                </th>
                <th className="border border-black p-1">
                  APP
                  <br />
                  S.L Duyệt
                </th>
                <th className="border border-black p-1">
                  REM
                  <br />
                  Ghi chú
                </th>
              </tr>
            </thead>
            <tbody>
              {request.items.map((item, index) => (
                <tr key={item.id} className="text-center">
                  <td className="border border-black p-1">{index + 1}</td>
                  <td className="border border-black p-1 text-left">
                    {lineName(item)}
                  </td>
                  {isSpare && (
                    <td className="border border-black p-1 text-left">
                      {lineEquipment(item)}
                    </td>
                  )}
                  <td className="border border-black p-1">{lineCode(item)}</td>
                  <td className="border border-black p-1">{lineUom(item)}</td>
                  <td className="border border-black p-1">
                    {item.robSnapshot}
                  </td>
                  <td className="border border-black p-1">{item.quantity}</td>
                  <td className="border border-black p-1">
                    {request.status === "DRAFT" ||
                    request.status === "PENDING_MASTER"
                      ? ""
                      : item.approvedQuantity}
                  </td>
                  <td className="border border-black p-1 text-left">
                    {item.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            {/* Ô ký của người lập: ghi đúng chức danh trong tài khoản thay vì
                luôn in cứng "Đại phó / Máy trưởng" như bản cũ. */}
            <p className="font-bold">
              {request.requestedByRole
                ? (ROLE_LABEL_EN[request.requestedByRole] ??
                  "Chief Officer / Chief Engineer")
                : "Chief Officer / Chief Engineer"}
            </p>
            <p className="italic">
              {request.requestedByRole
                ? (ROLE_LABEL[request.requestedByRole] ?? "Đại phó / Máy trưởng")
                : "Đại phó / Máy trưởng"}
            </p>
            <div className="mt-12" />
            {/* Điền sẵn tên người lập & người duyệt mà hệ thống đã ghi nhận,
                thay vì để ô ký trống trơn như bản in cũ. */}
            <p className="border-t border-slate-400 pt-1">
              {request.requestedBy}
            </p>
            <p className="text-[10px] text-slate-500">
              {request.submittedAt
                ? `Trình ${request.submittedAt.toLocaleString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : " "}
            </p>
          </div>
          <div>
            <p className="font-bold">Captain</p>
            <p className="italic">Thuyền trưởng</p>
            <div className="mt-12" />
            {/* Ô ký cấp TÀU: điền người thực sự duyệt trên tàu — có thể là
                máy trưởng với yêu cầu buồng máy, nên ghi rõ chức danh. */}
            <p className="border-t border-slate-400 pt-1">
              {request.shipApprovedBy ?? " "}
            </p>
            <p className="text-[10px] text-slate-500">
              {request.shipApprovedAt
                ? `${
                    request.shipApprovedRole === "CHIEF_ENGINEER"
                      ? "Máy trưởng · "
                      : ""
                  }Duyệt ngày ${request.shipApprovedAt.toLocaleDateString("vi-VN")}`
                : " "}
            </p>
          </div>
          <div>
            <p className="font-bold">Tech. &amp; Pur Dept</p>
            <p className="italic">Phòng Kỹ Thuật - Vật Tư</p>
            <div className="mt-12" />
            {/* Ô ký cấp CÔNG TY: quản lý kỹ thuật duyệt sau khi tàu đã duyệt. */}
            <p className="border-t border-slate-400 pt-1">
              {request.approvedBy ?? " "}
            </p>
            <p className="text-[10px] text-slate-500">
              {request.approvedAt
                ? `Duyệt ngày ${request.approvedAt.toLocaleDateString("vi-VN")}`
                : " "}
            </p>
          </div>
          <div>
            <p className="font-bold">Vice Director</p>
            <p className="italic">Phó Giám Đốc</p>
            <div className="mt-12" />
            <p className="border-t border-slate-400 pt-1">&nbsp;</p>
            <p className="text-[10px] text-slate-500">&nbsp;</p>
          </div>
        </div>
      </div>

      {/* Đường đi phê duyệt — nhìn là biết đang ở đâu và còn ai phải ký */}
      <div className="no-print rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <h3 className="mb-3 text-lg font-semibold text-blue-950">
          {t("requests.tienDoDuyet")}
        </h3>
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            {
              ten: t("requests.buocTrinh"),
              ai: request.submittedBy,
              luc: request.submittedAt,
              vaiTro: null as string | null,
              xong: !!request.submittedAt,
            },
            {
              ten: t("requests.buocTauDuyet"),
              ai: request.shipApprovedBy,
              luc: request.shipApprovedAt,
              vaiTro: request.shipApprovedRole as string | null,
              xong: !!request.shipApprovedAt,
            },
            {
              ten: t("requests.buocCongTyDuyet"),
              ai: request.approvedBy,
              luc: request.approvedAt,
              vaiTro: null as string | null,
              xong: !!request.approvedAt,
            },
          ].map((buoc, i) => (
            <li
              key={buoc.ten}
              className={`rounded-lg border p-3 text-sm ` + (
                buoc.xong
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-200 bg-slate-50"
              )}
            >
              <p className="flex items-center gap-2 font-medium text-slate-800">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs text-white ` + (
                    buoc.xong ? "bg-emerald-600" : "bg-slate-400"
                  )}
                >
                  {buoc.xong ? "✓" : i + 1}
                </span>
                {buoc.ten}
              </p>
              <p className="mt-1 text-slate-600">
                {buoc.xong ? (
                  <>
                    {buoc.ai}
                    {buoc.vaiTro
                      ? ` · ${tTuDo(`labels.role_${buoc.vaiTro}`)}`
                      : ""}
                    <br />
                    <span className="text-xs text-slate-500">
                      {buoc.luc ? ngayGio(buoc.luc) : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400">{t("requests.chuaXong")}</span>
                )}
              </p>
            </li>
          ))}
        </ol>
        {dangChoDuyet && (
          <p className="mt-3 text-sm text-slate-600">
            {t("requests.dangChoDuyetBoi")} <b>{nguoiPhaiDuyet}</b>.
            {!capDuyet && (
              <span className="ml-1 text-slate-500">
                {t(khoaViSaoKhongDuyet(user.role))}
              </span>
            )}
          </p>
        )}
      </div>

      {canSubmit && (
        <div className="no-print rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <h3 className="mb-1 text-lg font-semibold text-blue-950">
            {request.status === "REJECTED"
              ? t("requests.nutTrinhLai")
              : t("requests.nutTrinh")}
          </h3>
          <p className="mb-3 text-sm text-slate-600">
            {request.status === "REJECTED" ? (
              <>
                {t("requests.trinhLaiMoTa")}{" "}
                <b>
                  {tTuDo(
                    `labels.role_${nguoiDuyetCapTau(request.department)}`
                  )}
                </b>
                .
              </>
            ) : (
              <>
                {t("requests.nhapTruoc")} <b>{tTuDo("labels.reqStatus_DRAFT")}</b>{" "}
                {t("requests.nhapGiua")}{" "}
                <b>{tTuDo("labels.reqStatus_PENDING_MASTER")}</b>
                {t("requests.nhapCuoi")}{" "}
                <b>
                  {tTuDo(
                    `labels.role_${nguoiDuyetCapTau(request.department)}`
                  )}
                </b>
                .
              </>
            )}
          </p>
          <RequestStatusForm
            id={request.id}
            status="PENDING_MASTER"
            label={
              request.status === "REJECTED"
                ? t("requests.nutTrinhLai")
                : t("requests.nutTrinh")
            }
            className="rounded bg-amber-500 px-5 py-2 text-white hover:bg-amber-600 disabled:opacity-50"
            returnTo={`/requests/${request.id}`}
          />
        </div>
      )}
      {request.status === "REJECTED" && request.rejectionReason && (
        <div className="no-print rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800">
            {t("requests.yeuCauBiTuChoi")}
          </p>
          <p className="mt-1 text-sm text-red-700">
            {request.rejectionReason}
          </p>
          <p className="mt-1 text-xs text-red-600">
            {request.rejectedBy} ·{" "}
            {request.rejectedAt ? ngayGio(request.rejectedAt) : ""}
          </p>
        </div>
      )}
      {capDuyet && (
        <div className="no-print rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <h3 className="mb-1 text-lg font-semibold">
            {capDuyet === "TAU"
              ? t("requests.duyetCapTau")
              : t("requests.duyetCapCongTy")}
          </h3>
          <p className="mb-4 text-sm text-slate-600">
            {capDuyet === "TAU"
              ? t("requests.duyetCapTauMoTa")
              : t("requests.duyetCapCongTyMoTa")}
          </p>
          <RequestApprovalForm
            requestId={request.id}
            capDuyet={capDuyet}
            items={request.items.map((item) => ({
              id: item.id,
              code: lineDisplayCode(item),
              name: lineShortName(item),
              quantity: item.quantity,
              rob: item.robSnapshot,
              tauDuyet: item.approvedQuantity,
            }))}
          />
          <div className="mt-4 border-t pt-4">
            <RequestRejectForm
              id={request.id}
              returnTo={`/requests/${request.id}`}
            />
          </div>
        </div>
      )}
      {canModerate && request.status === "APPROVED" && (
        <div className="no-print rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <RequestStatusForm
            id={request.id}
            status="IN_PROCUREMENT"
            label={t("requests.nutChuyenMuaSam")}
            className="rounded bg-blue-100 px-3 py-1 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
            returnTo={`/requests/${request.id}`}
          />
        </div>
      )}

      {/* Nhật ký phê duyệt — ai làm gì, lúc nào, vì sao */}
      <div className="no-print rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <h3 className="mb-3 text-lg font-semibold text-blue-950">
          {t("requests.nhatKyDuyet")}
        </h3>
        {request.events.length === 0 ? (
          <p className="text-sm text-slate-500">{t("requests.chuaCoMoc")}</p>
        ) : (
          <ol className="space-y-3">
            {request.events.map((ev) => (
              <li key={ev.id} className="flex gap-3">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                <div className="min-w-0">
                  <p className="text-sm">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        REQUEST_STATUS_BADGE[ev.toStatus] ??
                        "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {tTuDo(`labels.reqStatus_${ev.toStatus}`)}
                    </span>
                    {ev.fromStatus && (
                      <span className="ml-2 text-xs text-slate-500">
                        ({t("requests.tuTrangThai")}{" "}
                        {tTuDo(`labels.reqStatus_${ev.fromStatus}`)})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-600">
                    {ev.actorName} · {ev.actorRole} · {ngayGio(ev.createdAt)}
                  </p>
                  {ev.note && (
                    <p className="mt-0.5 text-sm text-slate-700">{ev.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
