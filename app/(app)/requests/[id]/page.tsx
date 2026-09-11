import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ClipboardCheck,
  History,
  ListChecks,
  Send,
  ShoppingCart,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
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
  khoaViSaoKhongDuyet,
  nguoiDuyetCapTau,
} from "@/lib/roles";
import { layT } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";
import PrintButton from "@/components/PrintButton";
import RequestStatusForm from "@/components/RequestStatusForm";
import RequestApprovalForm from "@/components/RequestApprovalForm";
import RequestDeleteButton from "@/components/RequestDeleteButton";
import RequestRejectForm from "@/components/RequestRejectForm";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Notice,
  PageHeader,
  TONE_YEU_CAU,
} from "@/components/ui";

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
  // Bước đang chờ trong dải tiến độ: nháp → chờ trình; chờ tàu → bước tàu; chờ
  // công ty → bước công ty. Đã duyệt xong / bị từ chối thì không tô bước nào.
  const buocHienTai =
    request.status === "DRAFT"
      ? 0
      : request.status === "PENDING_MASTER"
        ? 1
        : request.status === "PENDING_OFFICE"
          ? 2
          : -1;
  const cacBuoc = [
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
  ];

  return (
    <div className="space-y-5">
      <div className="no-print">
        <Link
          href="/requests"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeft className="size-4" />
          {t("requests.quayLaiDanhSach")}
        </Link>
        <PageHeader
          title={
            <span className="font-display tracking-wide">{request.requestNo}</span>
          }
          subtitle={
            <>
              {request.vessel.name} ·{" "}
              {tTuDo(`labels.type_${isSpare ? "SPARE" : "STORE"}`)} ·{" "}
              <span className="font-display text-xs tracking-wide">{formCode}</span>
            </>
          }
          action={
            <>
              <Badge tone={TONE_YEU_CAU[request.status] ?? "neutral"} dot>
                {tTuDo(`labels.reqStatus_${request.status}`)}
              </Badge>
              {canDeleteRequest(user, request) && (
                <RequestDeleteButton
                  id={request.id}
                  requestNo={request.requestNo}
                  returnTo="/requests"
                />
              )}
              <PrintButton label={`${t("chung.in")} ${formCode}`} />
            </>
          }
        />
      </div>

      <div className="print-area surface rounded-xl border p-6 shadow-sm print:rounded-none print:p-0 print:shadow-none print:border-0">
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
            <p className="text-xs text-slate-500">
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
            <p className="text-xs text-slate-500">
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
            <p className="text-xs text-slate-500">
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
            <p className="text-xs text-slate-500">&nbsp;</p>
          </div>
        </div>
      </div>

      {/* Đường đi phê duyệt — nhìn là biết đang ở đâu và còn ai phải ký */}
      <Card className="no-print">
        <CardHeader
          icon={<ListChecks className="size-4" />}
          title={t("requests.tienDoDuyet")}
        />
        <ol className="flex flex-wrap items-center gap-2">
          {cacBuoc.map((buoc, i) => {
            const hienTai = i === buocHienTai;
            return (
              <li key={buoc.ten} className="flex items-center gap-2">
                {i > 0 && (
                  <ChevronRight className="hidden size-4 shrink-0 text-[var(--text-muted)] sm:block" />
                )}
                <div
                  aria-current={hienTai ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                    hienTai
                      ? "bg-brand-700 text-white"
                      : "bg-[var(--surface-sunken)] text-[var(--text-primary)]"
                  )}
                >
                  {buoc.xong ? (
                    <Badge tone="success" dot>
                      <Check className="size-3" />
                    </Badge>
                  ) : (
                    <span
                      className={cn(
                        "tabular grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                        hienTai
                          ? "bg-brand-900 text-white"
                          : "bg-[var(--surface-raised)] text-[var(--text-muted)]"
                      )}
                    >
                      {i + 1}
                    </span>
                  )}
                  <div>
                    <p className="font-medium">{buoc.ten}</p>
                    <p
                      className={cn(
                        "text-xs",
                        hienTai ? "text-white/80" : "text-[var(--text-secondary)]"
                      )}
                    >
                      {buoc.xong ? (
                        <>
                          {buoc.ai}
                          {buoc.vaiTro
                            ? ` · ${tTuDo(`labels.role_${buoc.vaiTro}`)}`
                            : ""}
                          {buoc.luc ? ` · ${ngayGio(buoc.luc)}` : ""}
                        </>
                      ) : (
                        t("requests.chuaXong")
                      )}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {dangChoDuyet && (
          <Notice tone="info" className="mt-4">
            {t("requests.dangChoDuyetBoi")} <b>{nguoiPhaiDuyet}</b>.
            {!capDuyet && (
              <span className="ml-1 opacity-80">
                {t(khoaViSaoKhongDuyet(user.role))}
              </span>
            )}
          </Notice>
        )}
      </Card>

      {canSubmit && (
        <Card className="no-print">
          <CardHeader
            icon={<Send className="size-4" />}
            title={
              request.status === "REJECTED"
                ? t("requests.nutTrinhLai")
                : t("requests.nutTrinh")
            }
            subtitle={
              request.status === "REJECTED" ? (
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
              )
            }
          />
          <RequestStatusForm
            id={request.id}
            status="PENDING_MASTER"
            label={
              request.status === "REJECTED"
                ? t("requests.nutTrinhLai")
                : t("requests.nutTrinh")
            }
            variant="primary"
            icon={<Send className="size-4" />}
            returnTo={`/requests/${request.id}`}
          />
        </Card>
      )}
      {request.status === "REJECTED" && request.rejectionReason && (
        <Notice tone="danger" className="no-print">
          <p className="font-semibold">{t("requests.yeuCauBiTuChoi")}</p>
          <p className="mt-1">{request.rejectionReason}</p>
          <p className="mt-1 text-xs opacity-80">
            {request.rejectedBy} ·{" "}
            {request.rejectedAt ? ngayGio(request.rejectedAt) : ""}
          </p>
        </Notice>
      )}
      {capDuyet && (
        <Card className="no-print">
          <CardHeader
            icon={<ClipboardCheck className="size-4" />}
            title={
              capDuyet === "TAU"
                ? t("requests.duyetCapTau")
                : t("requests.duyetCapCongTy")
            }
            subtitle={
              capDuyet === "TAU"
                ? t("requests.duyetCapTauMoTa")
                : t("requests.duyetCapCongTyMoTa")
            }
          />
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
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <RequestRejectForm
              id={request.id}
              returnTo={`/requests/${request.id}`}
            />
          </div>
        </Card>
      )}
      {canModerate && request.status === "APPROVED" && (
        <Card className="no-print">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--text-secondary)]">
              {t("requests.chuyenMuaSamMoTa")}
            </p>
            <RequestStatusForm
              id={request.id}
              status="IN_PROCUREMENT"
              label={t("requests.nutChuyenMuaSam")}
              variant="primary"
              icon={<ShoppingCart className="size-4" />}
              returnTo={`/requests/${request.id}`}
            />
          </div>
        </Card>
      )}

      {/* Nhật ký phê duyệt — ai làm gì, lúc nào, vì sao */}
      <Card className="no-print">
        <CardHeader
          icon={<History className="size-4" />}
          title={t("requests.nhatKyDuyet")}
        />
        {request.events.length === 0 ? (
          <EmptyState
            icon={<History className="size-5" />}
            title={t("requests.chuaCoMocNgan")}
            hint={t("requests.chuaCoMoc")}
          />
        ) : (
          <ol className="space-y-3">
            {request.events.map((ev) => (
              <li key={ev.id} className="flex gap-3">
                <div className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={TONE_YEU_CAU[ev.toStatus] ?? "neutral"} dot>
                      {tTuDo(`labels.reqStatus_${ev.toStatus}`)}
                    </Badge>
                    {ev.fromStatus && (
                      <span className="text-xs text-[var(--text-muted)]">
                        ({t("requests.tuTrangThai")}{" "}
                        {tTuDo(`labels.reqStatus_${ev.fromStatus}`)})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {ev.actorName} · {ev.actorRole} · {ngayGio(ev.createdAt)}
                  </p>
                  {ev.note && (
                    <p className="mt-0.5 text-sm text-[var(--text-primary)]">
                      {ev.note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
