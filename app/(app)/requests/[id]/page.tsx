import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  REQUEST_STATUS_BADGE,
  REQUEST_STATUS_LABEL,
} from "@/lib/requestStatus";
import { canDeleteRequest, requireScopedUser, vesselScope } from "@/lib/auth";
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

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  const canModerate = ["ADMIN", "MASTER"].includes(user.role);
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
  if (!scope.all && request.vesselId !== scope.vesselId) {
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
    item.material ? item.material.nameVn : (item.itemName ?? "(mới)");
  const lineDisplayCode = (item: Line) =>
    item.material ? item.material.code : "(mới)";
  const dateStr = (request.requiredDate ?? request.createdAt).toLocaleDateString(
    "vi-VN"
  );
  const canApprove = canModerate && request.status === "PENDING_MASTER";
  // Người lập (hoặc quản lý) trình yêu cầu nháp lên cấp duyệt.
  const canSubmit = request.status === "DRAFT";

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href="/requests" className="text-sm text-blue-700 hover:underline">
          ← Quay lại danh sách yêu cầu
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-1 text-sm font-medium ${
              REQUEST_STATUS_BADGE[request.status] ?? "bg-slate-100 text-slate-700"
            }`}
          >
            {REQUEST_STATUS_LABEL[request.status] ?? request.status}
          </span>
          {canDeleteRequest(user, request) && (
            <RequestDeleteButton
              id={request.id}
              requestNo={request.requestNo}
              returnTo="/requests"
            />
          )}
          <PrintButton label={`In ${formCode}`} />
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
            {request.purpose ? ` · Mục đích: ${request.purpose}` : ""}
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
            <p className="font-bold">Chief Officer / Chief Engineer</p>
            <p className="italic">Đại phó / Máy trưởng</p>
            <div className="mt-12" />
            {/* Điền sẵn tên người lập & người duyệt mà hệ thống đã ghi nhận,
                thay vì để ô ký trống trơn như bản in cũ. */}
            <p className="border-t border-slate-400 pt-1">
              {request.requestedBy}
            </p>
            <p className="text-[10px] text-slate-500">
              {request.submittedAt
                ? `Trình ngày ${request.submittedAt.toLocaleDateString("vi-VN")}`
                : " "}
            </p>
          </div>
          <div>
            <p className="font-bold">Captain</p>
            <p className="italic">Thuyền trưởng</p>
            <div className="mt-12" />
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
            <p className="font-bold">Tech. &amp; Pur Dept</p>
            <p className="italic">Phòng Kỹ Thuật - Vật Tư</p>
            <div className="mt-12" />
            <p className="border-t border-slate-400 pt-1">&nbsp;</p>
            <p className="text-[10px] text-slate-500">&nbsp;</p>
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

      {canSubmit && (
        <div className="no-print rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <h3 className="mb-1 text-lg font-semibold text-blue-950">
            Trình duyệt
          </h3>
          <p className="mb-3 text-sm text-slate-600">
            Yêu cầu đang là <b>Nháp</b> — vẫn sửa/xóa được và chưa ai duyệt
            được. Trình lên để chuyển sang <b>Chờ duyệt</b>.
          </p>
          <RequestStatusForm
            id={request.id}
            status="PENDING_MASTER"
            label="Trình duyệt"
            className="rounded bg-amber-500 px-5 py-2 text-white hover:bg-amber-600 disabled:opacity-50"
            returnTo={`/requests/${request.id}`}
          />
        </div>
      )}
      {request.status === "REJECTED" && request.rejectionReason && (
        <div className="no-print rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800">Yêu cầu bị từ chối</p>
          <p className="mt-1 text-sm text-red-700">
            {request.rejectionReason}
          </p>
          <p className="mt-1 text-xs text-red-600">
            {request.rejectedBy} ·{" "}
            {request.rejectedAt?.toLocaleString("vi-VN") ?? ""}
          </p>
        </div>
      )}
      {canApprove && (
        <div className="no-print rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <h3 className="mb-4 text-lg font-semibold">Duyệt yêu cầu</h3>
          <RequestApprovalForm
            requestId={request.id}
            items={request.items.map((item) => ({
              id: item.id,
              code: lineDisplayCode(item),
              name: lineShortName(item),
              quantity: item.quantity,
              rob: item.robSnapshot,
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
            label="Chuyển mua sắm (Purchasing)"
            className="rounded bg-blue-100 px-3 py-1 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
            returnTo={`/requests/${request.id}`}
          />
        </div>
      )}

      {/* Nhật ký phê duyệt — ai làm gì, lúc nào, vì sao */}
      <div className="no-print rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        <h3 className="mb-3 text-lg font-semibold text-blue-950">
          Nhật ký phê duyệt
        </h3>
        {request.events.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có mốc nào được ghi. Các yêu cầu lập trước khi bật nhật ký sẽ
            không có lịch sử.
          </p>
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
                      {REQUEST_STATUS_LABEL[ev.toStatus] ?? ev.toStatus}
                    </span>
                    {ev.fromStatus && (
                      <span className="ml-2 text-xs text-slate-500">
                        (từ{" "}
                        {REQUEST_STATUS_LABEL[ev.fromStatus] ?? ev.fromStatus})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-600">
                    {ev.actorName} · {ev.actorRole} ·{" "}
                    {ev.createdAt.toLocaleString("vi-VN")}
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
