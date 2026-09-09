import Link from "next/link";
import {
  Building2,
  ClipboardList,
  Eye,
  FilePlus,
  FileText,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import PurchaseOrderDeleteButton from "@/components/PurchaseOrderDeleteButton";
import {
  requireScopedUser,
  vesselScopeDayDu,
  vesselWhere,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Meter,
  Notice,
  PageHeader,
  TONE_DON_MUA,
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

/** Tiến độ nhận hàng → tone thanh: nhận đủ xanh, một phần vàng, chưa nhận mờ. */
function toneNhan(received: number, ordered: number): Tone {
  if (ordered > 0 && received >= ordered) return "success";
  if (received > 0) return "warning";
  return "muted";
}

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
    <div className="space-y-5">
      <PageHeader
        title={t("purchasing.tieuDe")}
        subtitle={t("purchasing.moTa")}
        action={
          <>
            {canManage && (
              <Link
                href="/purchasing/direct"
                className={buttonClass("secondary")}
              >
                <FilePlus className="size-4" />
                {t("purchasing.nutTaoTrucTiep")}
              </Link>
            )}
            <Link href="/purchasing/forms" className={buttonClass("secondary")}>
              <FileText className="size-4" />
              {t("purchasing.nutMauBieu")}
            </Link>
            <Link
              href="/purchasing/suppliers"
              className={buttonClass("secondary")}
            >
              <Building2 className="size-4" />
              {t("purchasing.nhaCungCap")}
            </Link>
            {canManage && (
              <Link href="/purchasing/new" className={buttonClass("primary")}>
                <Plus className="size-4" />
                {t("purchasing.nutTaoDon")}
              </Link>
            )}
          </>
        }
      />

      {scope.unassigned ? (
        <Notice tone="warning">{t("purchasing.chuaGanTau")}</Notice>
      ) : (
        <>
          {/* Bước 1: yêu cầu đã duyệt, chờ lập đơn mua */}
          <Card>
            <CardHeader
              icon={<ClipboardList className="size-4" />}
              title={t("purchasing.yeuCauChoMuaSam", {
                n: pendingRequests.length,
              })}
              subtitle={t("purchasing.yeuCauChoMuaSamMoTa")}
            />
            {pendingRequests.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="size-5" />}
                title={t("purchasing.khongCoYeuCauCho")}
              />
            ) : (
              <TableWrap>
                <Table dense>
                  <thead>
                    <tr>
                      <Th>{t("purchasing.cotSoYeuCau")}</Th>
                      <Th>{t("purchasing.cotLoai")}</Th>
                      <Th>{t("chung.tau")}</Th>
                      <Th>{t("purchasing.nguoiYeuCau")}</Th>
                      <Th align="right">{t("purchasing.cotSoDong")}</Th>
                      <Th>{t("chung.thaoTac")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map((req) => (
                      <Tr
                        key={req.id}
                        className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                      >
                        <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                          <Link href={`/requests/${req.id}`} className={LINK}>
                            {req.requestNo}
                          </Link>
                        </Td>
                        <Td>
                          <Badge
                            tone={req.kind === "SPARE" ? "brand" : "neutral"}
                          >
                            {tTuDo(
                              `labels.type_${req.kind === "SPARE" ? "SPARE" : "STORE"}`
                            )}
                          </Badge>
                        </Td>
                        <Td>
                          <Link
                            href={`/vessels/${req.vessel.id}`}
                            className={LINK}
                          >
                            {req.vessel.name}
                          </Link>
                        </Td>
                        <Td>{req.requestedBy}</Td>
                        <Td align="right">{req.items.length}</Td>
                        <Td>
                          {canManage && (
                            <Link
                              href={`/purchasing/new?vessel=${req.vessel.id}`}
                              className={buttonClass("secondary", "sm")}
                            >
                              <ShoppingCart className="size-4" />
                              {t("purchasing.nutLapDon")}
                            </Link>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>

          {/* Danh sách đơn mua hàng */}
          <Card>
            <CardHeader
              icon={<ShoppingCart className="size-4" />}
              title={t("purchasing.danhSachDon", { n: purchaseOrders.length })}
            />
            {purchaseOrders.length === 0 ? (
              <EmptyState
                icon={<ShoppingCart className="size-5" />}
                title={t("purchasing.chuaCoDonMua")}
              />
            ) : (
              <TableWrap>
                <Table dense>
                  <thead>
                    <tr>
                      <Th>{t("purchasing.cotSoPo")}</Th>
                      <Th>{t("purchasing.nhaCungCap")}</Th>
                      <Th>{t("chung.tau")}</Th>
                      <Th>{t("chung.trangThai")}</Th>
                      <Th align="right">{t("purchasing.cotSoDong")}</Th>
                      <Th>{t("purchasing.cotTienDoNhan")}</Th>
                      <Th align="right">{t("purchasing.cotGiaTri")}</Th>
                      <Th>{t("chung.thaoTac")}</Th>
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
                      return (
                        <Tr
                          key={po.id}
                          className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                        >
                          <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                            <Link
                              href={`/purchasing/${po.id}`}
                              className={LINK}
                            >
                              {po.poNo}
                            </Link>
                          </Td>
                          <Td>{po.supplier.name}</Td>
                          <Td>
                            <Link
                              href={`/vessels/${po.vessel.id}`}
                              className={LINK}
                              title={po.vessel.name}
                            >
                              <span className="font-display text-xs tracking-wide">
                                {po.vessel.code}
                              </span>
                            </Link>
                          </Td>
                          <Td>
                            <Badge
                              tone={TONE_DON_MUA[po.status] ?? "neutral"}
                              dot
                            >
                              {tTuDo(`labels.poStatus_${po.status}`)}
                            </Badge>
                          </Td>
                          <Td align="right">{po.items.length}</Td>
                          <Td>
                            <div className="w-28">
                              <p className="tabular text-xs text-[var(--text-secondary)]">
                                {received} / {ordered}
                              </p>
                              <Meter
                                value={received}
                                max={ordered}
                                tone={toneNhan(received, ordered)}
                                className="mt-1"
                              />
                            </div>
                          </Td>
                          <Td align="right" className="whitespace-nowrap">
                            {total ? `${so(total)} ${po.currency}` : "—"}
                          </Td>
                          <Td>
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/purchasing/${po.id}`}
                                className={buttonClass("secondary", "sm")}
                              >
                                <Eye className="size-4" />
                                {t("purchasing.nutXem")}
                              </Link>
                              {/* Đơn đã hủy là rác trong danh sách — cho quản
                                  trị viên dọn. Điều kiện kiểm lại ở server. */}
                              {canDeletePo && po.status === "CANCELLED" && (
                                <PurchaseOrderDeleteButton
                                  id={po.id}
                                  poNo={po.poNo}
                                  size="sm"
                                />
                              )}
                            </div>
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
