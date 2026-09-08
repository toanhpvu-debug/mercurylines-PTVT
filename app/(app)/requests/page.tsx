import Form from "next/form";
import Link from "next/link";
import {
  Check,
  ClipboardList,
  Filter,
  Printer,
  Send,
  ShoppingCart,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { REQUEST_STATUS_LABEL } from "@/lib/requestStatus";
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
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  Select,
  TONE_YEU_CAU,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
  buttonClass,
  type Tone,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const LINK = "text-brand-700 hover:underline dark:text-brand-300";

/** Mức ưu tiên → tone nhãn: khẩn đỏ, cao vàng, thường xám, thấp mờ. */
const TONE_UU_TIEN: Record<string, Tone> = {
  URGENT: "danger",
  HIGH: "warning",
  NORMAL: "neutral",
  LOW: "muted",
};

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
  const dangLoc = Boolean(vesselFilter || statusFilter);
  return (
    <div className="space-y-5">
      <PageHeader
        title={t("requests.tieuDe")}
        subtitle={scope.all ? t("requests.moTaDoi") : t("requests.moTaTau")}
      />
      {scope.unassigned ? (
        <Notice tone="warning">{t("requests.chuaGanTau")}</Notice>
      ) : (
        <RequestForm
          vessels={vessels}
          materials={materials}
          defaultVesselId={scope.vesselId ?? undefined}
          nguoiLap={{ name: user.name, role: user.role }}
        />
      )}
      <Card>
        <CardHeader
          icon={<ClipboardList className="size-4" />}
          title={t("requests.danhSach", { n: requests.length })}
          action={
            /* next/form: bấm "Lọc" chỉ tải phần nội dung (chuyển trang phía
               client, hiện khung chờ ngay) thay vì tải lại cả trang như
               <form method="get"> thường. */
            <Form action="/requests" className="flex flex-wrap items-end gap-2">
              {chonDuocTau(scope) && (
                <Field label={t("chung.tau")} className="w-52">
                  <Select
                    name="vessel"
                    defaultValue={vesselFilter ? String(vesselFilter) : ""}
                  >
                    <option value="">{t("chung.tatCaTau")}</option>
                    {vessels.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} — {v.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label={t("chung.trangThai")} className="w-48">
                <Select name="status" defaultValue={statusFilter}>
                  <option value="">{t("requests.moiTrangThai")}</option>
                  {Object.keys(REQUEST_STATUS_LABEL).map((value) => (
                    <option key={value} value={value}>
                      {tTuDo(`labels.reqStatus_${value}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                type="submit"
                variant="primary"
                icon={<Filter className="size-4" />}
              >
                {t("chung.loc")}
              </Button>
              {dangLoc && (
                <Link
                  href="/requests"
                  className="py-2 text-sm text-[var(--text-secondary)] hover:underline"
                >
                  {t("chung.boLoc")}
                </Link>
              )}
            </Form>
          }
        />
        {requests.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title={t("requests.chuaCoYeuCau")}
            action={
              dangLoc ? (
                <Link href="/requests" className={buttonClass("secondary", "sm")}>
                  {t("chung.boLoc")}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("requests.cotSoYeuCau")}</Th>
                  <Th>{t("requests.cotLoai")}</Th>
                  <Th>{t("chung.tau")}</Th>
                  <Th>{t("requests.nguoiYeuCau")}</Th>
                  <Th>{t("requests.cotLapLuc")}</Th>
                  <Th>{t("requests.cotBoPhan")}</Th>
                  <Th>{t("requests.cotUuTien")}</Th>
                  <Th>{t("requests.cotNoiDung")}</Th>
                  <Th>{t("chung.trangThai")}</Th>
                  <Th>{t("chung.thaoTac")}</Th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <Tr
                    key={request.id}
                    className="align-top transition-colors hover:bg-[var(--surface-sunken)]/50"
                  >
                    <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                      <Link href={`/requests/${request.id}`} className={LINK}>
                        {request.requestNo}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={request.kind === "SPARE" ? "brand" : "neutral"}>
                        {tTuDo(
                          `labels.type_${request.kind === "SPARE" ? "SPARE" : "STORE"}`
                        )}
                      </Badge>
                    </Td>
                    <Td>
                      <Link href={`/vessels/${request.vesselId}`} className={LINK}>
                        {request.vessel.name}
                      </Link>
                    </Td>
                    <Td>
                      {request.requestedBy}
                      {request.requestedByRole && (
                        <span className="block text-xs text-[var(--text-muted)]">
                          {tTuDo(`labels.role_${request.requestedByRole}`)}
                        </span>
                      )}
                    </Td>
                    {/* Đến phút, không chỉ ngày: hai yêu cầu cùng ngày phải phân
                        biệt được cái nào lập trước. */}
                    <Td className="tabular whitespace-nowrap text-[var(--text-secondary)]">
                      {ngayGio(request.createdAt)}
                    </Td>
                    <Td>{tTuDo(`labels.reqDept_${request.department}`)}</Td>
                    <Td>
                      <Badge tone={TONE_UU_TIEN[request.priority] ?? "neutral"}>
                        {tTuDo(`labels.priority_${request.priority}`)}
                      </Badge>
                    </Td>
                    <Td>
                      {request.items.map((item) => (
                        <p key={item.id} className="whitespace-nowrap">
                          {item.material ? (
                            <span className="font-display text-xs tracking-wide">
                              {item.material.code}
                            </span>
                          ) : (
                            `${item.itemName ?? t("requests.moi")} ${t("requests.moi")}`
                          )}{" "}
                          <span className="tabular text-[var(--text-secondary)]">
                            x {item.quantity}
                          </span>
                        </p>
                      ))}
                    </Td>
                    <Td>
                      <Badge tone={TONE_YEU_CAU[request.status] ?? "neutral"} dot>
                        {tTuDo(`labels.reqStatus_${request.status}`)}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex w-36 flex-col gap-1.5">
                        <Link
                          href={`/requests/${request.id}`}
                          className={buttonClass("secondary", "sm")}
                        >
                          <Printer className="size-4" />
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
                              variant="primary"
                              size="sm"
                              icon={<Send className="size-4" />}
                              className="w-full"
                            />
                          )}
                        {/* Chỉ hiện nút Duyệt cho người ĐANG GIỮ bước duyệt —
                            máy trưởng không thấy nút trên yêu cầu boong, văn
                            phòng không thấy trên yêu cầu tàu chưa duyệt. */}
                        {capDuyetChoPhep(user, request) && (
                          <Link
                            href={`/requests/${request.id}`}
                            className={buttonClass("primary", "sm")}
                          >
                            <Check className="size-4" />
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
                            variant="primary"
                            size="sm"
                            icon={<ShoppingCart className="size-4" />}
                            className="w-full"
                          />
                        )}
                        {canDeleteRequest(user, request) && (
                          <RequestDeleteButton
                            id={request.id}
                            requestNo={request.requestNo}
                            returnTo="/requests"
                            size="sm"
                            className="w-full"
                          />
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
