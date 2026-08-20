import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canDeleteRequest, requireScopedUser, vesselScope } from "@/lib/auth";
import PrintButton from "@/components/PrintButton";
import RequestStatusForm from "@/components/RequestStatusForm";
import RequestApprovalForm from "@/components/RequestApprovalForm";
import RequestDeleteButton from "@/components/RequestDeleteButton";

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
  const canApprove =
    canModerate &&
    (request.status === "DRAFT" || request.status === "PENDING_MASTER");

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href="/requests" className="text-sm text-blue-700 hover:underline">
          ← Quay lại danh sách yêu cầu
        </Link>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-2 py-1 text-sm">
            {request.status}
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
          </div>
          <div>
            <p className="font-bold">Captain</p>
            <p className="italic">Thuyền trưởng</p>
            <div className="mt-12" />
          </div>
          <div>
            <p className="font-bold">Tech. &amp; Pur Dept</p>
            <p className="italic">Phòng Kỹ Thuật - Vật Tư</p>
            <div className="mt-12" />
          </div>
          <div>
            <p className="font-bold">Vice Director</p>
            <p className="italic">Phó Giám Đốc</p>
            <div className="mt-12" />
          </div>
        </div>
      </div>

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
            <RequestStatusForm
              id={request.id}
              status="REJECTED"
              label="Từ chối yêu cầu"
              className="rounded bg-red-100 px-3 py-1 text-red-700 hover:bg-red-200 disabled:opacity-50"
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
    </div>
  );
}
