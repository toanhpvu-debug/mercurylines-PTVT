import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  ClipboardList,
  Download,
  FileText,
  Pencil,
  Printer,
  Trash2,
  Warehouse,
} from "lucide-react";
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
import { cn } from "@/lib/cn";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
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

// Chỉ giữ TONE ở đây; nhãn trạng thái lấy từ từ điển (labels.vesselStatus_* cho
// ACTIVE/INACTIVE, vessels.trangThaiBaoDuong cho MAINTENANCE).
const TONE_TRANG_THAI: Record<string, Tone> = {
  ACTIVE: "success",
  MAINTENANCE: "warning",
  INACTIVE: "muted",
};

/** Mức ưu tiên → tone nhãn — cùng bảng với trang Yêu cầu vật tư. */
const TONE_UU_TIEN: Record<string, Tone> = {
  URGENT: "danger",
  HIGH: "warning",
  NORMAL: "neutral",
  LOW: "muted",
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
  const toneTT = TONE_TRANG_THAI[vessel.status] ?? "neutral";
  const nhanTT =
    vessel.status === "MAINTENANCE"
      ? t("vessels.trangThaiBaoDuong")
      : vessel.status in TONE_TRANG_THAI
        ? tTuDo(`labels.vesselStatus_${vessel.status}`)
        : vessel.status;
  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/vessels"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeft className="size-4" />
          {t("vessels.quayLaiDoiTau")}
        </Link>
        <PageHeader
          title={
            <>
              <span className="font-display tracking-wide">{vessel.code}</span>
              {" — "}
              {vessel.name}
            </>
          }
          subtitle={
            <>
              IMO:{" "}
              <span className="font-display text-xs tracking-wide">
                {vessel.imo || "—"}
              </span>{" "}
              · {t("vessels.nhanCo")}: {vessel.flag || "—"} ·{" "}
              {t("vessels.nhanLoai")}: {vessel.vesselType || "—"} ·{" "}
              {t("vessels.nKho", { n: vessel.warehouses.length })}
            </>
          }
          action={
            <Badge tone={toneTT} dot>
              {nhanTT}
            </Badge>
          }
        />
      </div>

      <VesselSwitcher hienTai={vessel.id} duongDan={(id) => `/vessels/${id}`} />

      <Card>
        <CardHeader
          icon={<FileText className="size-4" />}
          title={t("vessels.baoCaoNhanh")}
          action={
            <Link href="/documents" className={buttonClass("secondary", "sm")}>
              {t("vessels.taiLenXemTatCa")}
              <ArrowRight className="size-4" />
            </Link>
          }
        />
        {documents.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title={t("vessels.chuaCoBaoCaoTau")}
            action={
              <Link href="/documents" className={buttonClass("secondary", "sm")}>
                {t("vessels.taiBaoCaoLen")}
              </Link>
            }
          />
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("vessels.cotNgayTai")}</Th>
                  <Th>{t("vessels.cotLoai")}</Th>
                  <Th>{t("vessels.cotKy")}</Th>
                  <Th>{t("vessels.cotTieuDeFile")}</Th>
                  <Th>{t("vessels.cotCoFile")}</Th>
                  <Th>{t("vessels.cotNguoiTai")}</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <Tr
                    key={doc.id}
                    className="align-top transition-colors hover:bg-[var(--surface-sunken)]/50"
                  >
                    <Td className="tabular whitespace-nowrap text-[var(--text-secondary)]">
                      {ngay(doc.createdAt)}
                    </Td>
                    <Td className="whitespace-nowrap">{doc.reportType}</Td>
                    <Td className="whitespace-nowrap">{doc.period}</Td>
                    <Td>
                      <p className="font-medium">{doc.title}</p>
                      {doc.title !== doc.fileName && (
                        <p className="text-xs text-[var(--text-muted)]">
                          {doc.fileName}
                        </p>
                      )}
                    </Td>
                    <Td className="tabular whitespace-nowrap text-[var(--text-secondary)]">
                      {doc.size >= 1024 * 1024
                        ? `${(doc.size / (1024 * 1024)).toFixed(1)} MB`
                        : `${Math.max(1, Math.round(doc.size / 1024))} KB`}
                    </Td>
                    <Td>{doc.uploadedBy.name}</Td>
                    <Td>
                      <a
                        href={`/api/documents/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonClass("secondary", "sm")}
                      >
                        <Download className="size-4" />
                        {t("vessels.xemTaiFile")}
                      </a>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {canManage && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              icon={<Pencil className="size-4" />}
              title={t("vessels.suaThongTinTau")}
            />
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
          </Card>
          <Card>
            <CardHeader
              icon={<Trash2 className="size-4" />}
              title={t("vessels.xoaTau")}
              subtitle={t("vessels.luuYXoaTau")}
            />
            <VesselDeleteButton
              id={vessel.id}
              name={vessel.name}
              requestCount={requests.length}
            />
          </Card>
        </div>
      )}

      <Card>
        <CardHeader
          icon={<Warehouse className="size-4" />}
          title={t("vessels.khoTrenTau")}
        />
        {vessel.warehouses.length === 0 ? (
          <EmptyState
            icon={<Warehouse className="size-5" />}
            title={t("vessels.chuaCoKho")}
          />
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("vessels.cotMaKho")}</Th>
                  <Th>{t("vessels.cotTenKho")}</Th>
                  <Th>{t("vessels.cotLoai")}</Th>
                </tr>
              </thead>
              <tbody>
                {vessel.warehouses.map((warehouse) => (
                  <Tr
                    key={warehouse.id}
                    className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                  >
                    <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                      {warehouse.code}
                    </Td>
                    <Td className="font-medium">{warehouse.name}</Td>
                    <Td className="text-[var(--text-secondary)]">
                      {warehouse.warehouseType}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={<Boxes className="size-4" />}
          title={t("vessels.tonKhoCuaTau", { ten: vessel.name })}
          action={
            /* Nhập/xuất và xuất kiểm kê làm ở module Tồn kho — ở đây chỉ xem. */
            <Link
              href={`/inventory?vessel=${vessel.id}`}
              className={buttonClass("secondary", "sm")}
            >
              {t("vessels.nhapXuatKiemKe")}
              <ArrowRight className="size-4" />
            </Link>
          }
        />
        {tongTonKho === 0 ? (
          <EmptyState
            icon={<Boxes className="size-5" />}
            title={t("vessels.chuaCoTonKho")}
          />
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("chung.kho")}</Th>
                  <Th>{t("vessels.cotMaVatTu")}</Th>
                  <Th>{t("vessels.cotTenVatTu")}</Th>
                  <Th>{t("chung.donVi")}</Th>
                  <Th align="right">{t("vessels.cotTon")}</Th>
                  <Th align="right">{t("vessels.cotGiu")}</Th>
                  <Th align="right">{t("vessels.cotKhaDung")}</Th>
                </tr>
              </thead>
              <tbody>
                {inventories.map((inventory) => {
                  const available =
                    inventory.quantity - inventory.reservedQuantity;
                  return (
                    <Tr
                      key={inventory.id}
                      className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                    >
                      <Td className="text-[var(--text-secondary)]">
                        {inventory.warehouse.name}
                      </Td>
                      <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                        {inventory.material.code}
                      </Td>
                      <Td>{inventory.material.nameVn}</Td>
                      <Td>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {inventory.material.uom}
                        </span>
                      </Td>
                      <Td align="right">{inventory.quantity}</Td>
                      <Td align="right">
                        <span className="text-[var(--text-muted)]">
                          {inventory.reservedQuantity}
                        </span>
                      </Td>
                      <Td align="right">
                        <span
                          className={cn(
                            "font-semibold",
                            available <= inventory.material.minStock
                              ? "text-[var(--text-danger)]"
                              : "text-[var(--text-success)]"
                          )}
                        >
                          {available}
                        </span>
                      </Td>
                    </Tr>
                  );
                })}
                {tongTonKho > inventories.length && (
                  <tr>
                    <Td
                      colSpan={7}
                      className="bg-[var(--surface-sunken)]/60 text-xs"
                    >
                      <span className="text-[var(--text-muted)]">
                        {t("vessels.dangHienTruoc", { n: inventories.length })}{" "}
                        <b className="text-[var(--text-primary)]">{tongTonKho}</b>{" "}
                        {t("vessels.dangHienSau")}
                      </span>{" "}
                      <Link
                        href={`/inventory?vessel=${vessel.id}`}
                        className={LINK}
                      >
                        {t("vessels.xemDayDuTonKho")}
                      </Link>
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={<ClipboardList className="size-4" />}
          title={t("vessels.yeuCauCuaTau", { ten: vessel.name })}
          action={
            /* Tạo, duyệt, xóa yêu cầu làm ở module Yêu cầu vật tư. */
            <Link
              href={`/requests?vessel=${vessel.id}`}
              className={buttonClass("secondary", "sm")}
            >
              {t("vessels.taoDuyetYeuCau")}
              <ArrowRight className="size-4" />
            </Link>
          }
        />
        {requests.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title={t("vessels.chuaCoYeuCau")}
          />
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("vessels.cotSoHieuYeuCau")}</Th>
                  <Th>{t("vessels.cotLoai")}</Th>
                  <Th>{t("vessels.cotNguoiYeuCau")}</Th>
                  <Th>{t("vessels.cotBoPhan")}</Th>
                  <Th>{t("vessels.cotUuTien")}</Th>
                  <Th>{t("vessels.cotNoiDung")}</Th>
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
                        {tTuDo(`labels.type_${request.kind}`)}
                      </Badge>
                    </Td>
                    <Td>{request.requestedBy}</Td>
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
                            `${item.itemName ?? t("vessels.vatTuMoi")} ${t(
                              "vessels.vatTuMoi"
                            )}`
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
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/requests/${request.id}`}
                          className={buttonClass("secondary", "sm")}
                        >
                          <Printer className="size-4" />
                          {t("vessels.xemIn")}
                        </Link>
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
