import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ChevronRight,
  ClipboardList,
  Droplets,
  History,
  Layers,
  Paintbrush,
  Plus,
  Printer,
  Ruler,
  Send,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  coQuanLySon,
  requireScopedUser,
  trongPhamVi,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import { LAP_YEU_CAU } from "@/lib/roles";
import { layT } from "@/lib/i18n/server";
import { PAINT_TYPE_LABEL } from "@/lib/paintTypes";
import { cn } from "@/lib/cn";
import {
  PaintAreaAddForm,
  PaintAreaCard,
} from "@/components/PaintAreaManager";
import { PaintStockMoveForm } from "@/components/PaintStockForm";
import { PaintJobDeleteButton, PaintJobForm } from "@/components/PaintJobForm";
import PaintSchemeCopyForm from "@/components/PaintSchemeCopyForm";
import TaiPhieuSon from "@/components/TaiPhieuSon";
import ThaoTacTonSon, {
  NutXoaGiaoDichSon,
  ThongBaoTonSon,
} from "@/components/ThaoTacTonSon";
import VesselSwitcher from "@/components/VesselSwitcher";
import NhanDangTenSon from "@/components/NhanDangTenSon";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Meter,
  Notice,
  PageHeader,
  Stat,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
  buttonClass,
  type Tone,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const TYPE_LABEL = PAINT_TYPE_LABEL;

/** Tiêu đề khung gập: cùng một dáng cho mọi <details> trên trang. */
const SUMMARY =
  "flex cursor-pointer select-none list-none flex-wrap items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] [&::-webkit-details-marker]:hidden";

/** Màu thanh tồn thấp theo mức thiếu: càng thiếu càng đỏ (cùng Tồn kho). */
function toneThieu(pct: number): Tone {
  return pct < 40 ? "danger" : pct < 75 ? "warning" : "info";
}

function productLabel(
  p: {
    name: string;
    maker: string | null;
    paintType: string;
    colorName: string | null;
  },
  tenLoaiSon: (ma: string) => string
) {
  const bits = [p.name];
  if (p.maker) bits.push(p.maker);
  bits.push(tenLoaiSon(p.paintType));
  if (p.colorName) bits.push(p.colorName);
  return bits.join(" · ");
}

export default async function PaintVesselPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireScopedUser();
  const { t, tTuDo, ngay, ngayGio, so } = await layT();
  // Nhãn loại sơn lấy theo ngôn ngữ; mã lạ (dữ liệu cũ) thì hiện nguyên mã.
  const tenLoaiSon = (ma: string) =>
    ma in TYPE_LABEL ? tTuDo(`paint.loaiSon_${ma}`) : ma;
  const scope = vesselScopeDayDu(user);
  const { id } = await params;
  const vesselId = Number(id);
  if (!Number.isInteger(vesselId) || vesselId <= 0) notFound();
  // Người bị giới hạn tàu không xem được tàu khác kể cả gõ thẳng URL.
  if (!trongPhamVi(scope, vesselId)) notFound();

  const vessel = await prisma.vessel.findUnique({ where: { id: vesselId } });
  if (!vessel) notFound();
  // Quyền phần sơn tách riêng khỏi quyền danh mục vật tư: đại phó quản kho sơn
  // của tàu mình nhưng không vì thế mà sửa được danh mục vật tư.
  const canEdit = coQuanLySon(user, vesselId);
  // Chép sơ đồ sơn giữa các tàu là việc toàn đội, giữ ở thuyền trưởng/quản trị.
  const canCopyScheme = ["ADMIN", "MASTER"].includes(user.role);
  const canRequest = canEdit && LAP_YEU_CAU.includes(user.role);

  // Phiếu giao sơn đã tải (chờ nhập trước, rồi mới nhất) và bộ đọc AI có sẵn chưa.
  const [phieuSon, coAi] = canEdit
    ? await Promise.all([
        prisma.sonPhieuTep.findMany({
          where: { vesselId },
          orderBy: [{ trangThai: "asc" }, { createdAt: "desc" }],
          take: 10,
          select: { id: true, loai: true, fileName: true, soPhieu: true, trangThai: true, createdAt: true, aiDangDocTu: true },
        }),
        import("@/lib/cauHinhAi").then(async (m) => Boolean(await m.layCauHinhAi())),
      ])
    : [[], false];
  const [areas, products, stocks, jobs, transactions] = await Promise.all([
    prisma.paintArea.findMany({
      where: { vesselId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        layers: {
          orderBy: [{ layerNo: "asc" }, { id: "asc" }],
          include: { product: true },
        },
      },
    }),
    prisma.paintProduct.findMany({
      where: { isActive: true },
      orderBy: [{ paintType: "asc" }, { name: "asc" }],
    }),
    prisma.paintStock.findMany({
      where: { vesselId },
      include: { product: true },
      orderBy: { product: { name: "asc" } },
    }),
    prisma.paintJob.findMany({
      where: { vesselId },
      orderBy: [{ jobDate: "desc" }, { id: "desc" }],
      take: 50,
      include: { area: true, lines: { include: { product: true } } },
    }),
    prisma.paintTransaction.findMany({
      where: { vesselId },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 40,
      include: { product: true },
    }),
  ]);

  // Tàu khác đã có sơ đồ — nguồn để sao chép. Chỉ lấy trong phạm vi người dùng.
  const copySources = canEdit
    ? await prisma.vessel.findMany({
        where: scope.all
          ? { id: { not: vesselId } }
          : { AND: [vesselIdWhere(scope), { id: { not: vesselId } }] },
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          _count: { select: { paintAreas: true } },
        },
      })
    : [];

  // Sửa / gỡ sơn đã nhập: loại nào đang dùng ở tàu khác (đổi tên/hãng/màu là đổi
  // cho cả tàu đó — chỉ thuyền trưởng/quản trị), loại nào đã thi công trên tàu này
  // (không xóa hẳn được). Chỉ hỏi khi người xem sửa được.
  const idsSon = stocks.map((s) => s.productId);
  const [dungTauKhac, thiCongTheoSon] =
    canEdit && idsSon.length
      ? await Promise.all([
          Promise.all([
            prisma.paintStock.findMany({
              where: { productId: { in: idsSon }, vesselId: { not: vesselId } },
              select: { productId: true },
              distinct: ["productId"],
            }),
            prisma.paintTransaction.findMany({
              where: { productId: { in: idsSon }, vesselId: { not: vesselId } },
              select: { productId: true },
              distinct: ["productId"],
            }),
            prisma.paintSchemeLayer.findMany({
              where: { productId: { in: idsSon }, area: { vesselId: { not: vesselId } } },
              select: { productId: true },
              distinct: ["productId"],
            }),
            prisma.materialRequestItem.findMany({
              where: { paintProductId: { in: idsSon }, request: { vesselId: { not: vesselId } } },
              select: { paintProductId: true },
              distinct: ["paintProductId"],
            }),
          ]).then(
            ([a, b, c, d]) =>
              new Set<number>([
                ...[...a, ...b, ...c].map((x) => x.productId),
                ...d.map((x) => x.paintProductId ?? 0),
              ])
          ),
          prisma.paintJobLine
            .groupBy({
              by: ["productId"],
              where: { productId: { in: idsSon }, job: { vesselId } },
              _count: { _all: true },
            })
            .then((r) => new Map(r.map((x) => [x.productId, x._count._all]))),
        ])
      : [new Set<number>(), new Map<number, number>()];
  const toanDoiSon = ["ADMIN", "MASTER"].includes(user.role);

  const productOptions = products.map((p) => ({
    id: p.id,
    label: productLabel(p, tenLoaiSon),
    coverage: p.coverage,
    dftPerCoat: p.dftPerCoat,
    uom: p.uom,
  }));
  const stockOptions = stocks
    .filter((s) => s.quantity > 0)
    .map((s) => ({
      id: s.productId,
      label: productLabel(s.product, tenLoaiSon),
      uom: s.product.uom,
      onHand: s.quantity,
    }));
  const lowStocks = stocks.filter((s) => s.minQty > 0 && s.quantity < s.minQty);
  const duoiDinhMuc = lowStocks.length;
  const totalPaintedM2 = jobs.reduce((sum, j) => sum + j.paintedM2, 0);
  const defaultDate = new Date().toISOString().slice(0, 10);

  // Dự trù sơn: gộp lượng cần của MỌI khu vực theo từng loại sơn, đối chiếu với tồn.
  // Khu vực chưa nhập diện tích hoặc sơn chưa khai độ phủ thì không tính được —
  // đếm riêng để nói rõ con số dự trù còn thiếu căn cứ, thay vì đoán bừa.
  const stockByProduct = new Map(stocks.map((s) => [s.productId, s]));
  const demand = new Map<
    number,
    { name: string; uom: string; required: number; areas: string[] }
  >();
  let unmeasurable = 0;
  for (const area of areas) {
    for (const layer of area.layers) {
      const litres =
        area.areaM2 && layer.product.coverage
          ? (area.areaM2 * layer.coats) / layer.product.coverage
          : null;
      if (litres === null) {
        unmeasurable += 1;
        continue;
      }
      const cur = demand.get(layer.productId) ?? {
        name: layer.product.name,
        uom: layer.product.uom,
        required: 0,
        areas: [],
      };
      cur.required += litres;
      if (!cur.areas.includes(area.name)) cur.areas.push(area.name);
      demand.set(layer.productId, cur);
    }
  }
  const plan = [...demand.entries()]
    .map(([productId, d]) => {
      const onHand = stockByProduct.get(productId)?.quantity ?? 0;
      return {
        productId,
        ...d,
        required: Math.round(d.required * 10) / 10,
        onHand,
        shortfall: Math.max(0, Math.round((d.required - onHand) * 10) / 10),
      };
    })
    .sort((a, b) => b.shortfall - a.shortfall);
  const shortfallCount = plan.filter((p) => p.shortfall > 0).length;

  // Tiêu thụ sơn 12 tháng gần nhất (theo giao dịch xuất đã tải về ở trên).
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const consumption = new Map<
    number,
    { name: string; uom: string; qty: number }
  >();
  for (const tx of transactions) {
    // Dòng điều chỉnh (sửa số đã nhập, gỡ khỏi danh sách) không phải sơn đã dùng.
    if (tx.type !== "OUT" || tx.dieuChinh || tx.occurredAt < since) continue;
    const cur = consumption.get(tx.productId) ?? {
      name: tx.product.name,
      uom: tx.product.uom,
      qty: 0,
    };
    cur.qty += tx.quantity;
    consumption.set(tx.productId, cur);
  }
  const consumptionRows = [...consumption.values()].sort(
    (a, b) => b.qty - a.qty
  );

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <Link
          href="/paint"
          className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeft className="size-4" />
          {t("paint.quayLaiQuanLySon")}
        </Link>
        <PageHeader
          title={t("paint.tieuDeSonTau", { ten: vessel.name })}
          subtitle={
            <>
              <span className="font-display text-xs tracking-wide">
                {vessel.code}
              </span>
              {vessel.imo ? ` · IMO ${vessel.imo}` : ""} ·{" "}
              {t("paint.nKhuVuc", { n: areas.length })} ·{" "}
              {t("paint.nLanThiCongGanDay", { n: jobs.length })}
            </>
          }
          action={
            <Link
              href={`/paint/${vesselId}/bao-cao`}
              className={buttonClass("primary")}
            >
              <Printer className="size-4" />
              {t("paint.bcNutIn")}
            </Link>
          }
        />
      </div>

      {lowStocks.length > 0 && (
        <Notice tone="danger">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 shrink-0" />
            {t("paint.nLoaiDuoiToiThieu", { n: lowStocks.length })}
          </p>
          <ul className="mt-1 list-inside list-disc text-sm">
            {lowStocks.map((s) => (
              <li key={s.id}>
                {t("paint.dongDuoiToiThieu", {
                  ten: s.product.name,
                  con: s.quantity,
                  dv: s.product.uom,
                  min: s.minQty,
                })}
              </li>
            ))}
          </ul>
        </Notice>
      )}

      <div className="no-print">
        <VesselSwitcher
          hienTai={vesselId}
          duongDan={(id) => `/paint/${id}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          icon={<Layers className="size-4" />}
          label={t("paint.cotKhuVuc")}
          value={areas.length}
          tone="brand"
        />
        <Stat
          icon={<Droplets className="size-4" />}
          label={t("paint.cotLoaiCoTon")}
          value={stocks.filter((s) => s.quantity > 0).length}
        />
        <Stat
          icon={<AlertTriangle className="size-4" />}
          label={t("paint.sonDuoiDinhMuc")}
          value={duoiDinhMuc}
          tone={duoiDinhMuc > 0 ? "danger" : "success"}
        />
        <Stat
          icon={<Paintbrush className="size-4" />}
          label={t("paint.cotLanThiCong")}
          value={jobs.length}
          sub={
            totalPaintedM2 > 0
              ? t("paint.nM2", { n: so(totalPaintedM2) })
              : undefined
          }
        />
      </div>

      {/* ── Sơ đồ sơn ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <Card>
          <CardHeader
            icon={<Layers className="size-4" />}
            title={t("paint.soDoSon")}
            subtitle={t("paint.nKhuVuc", { n: areas.length })}
          />
          {canEdit && (
            <div className="flex flex-wrap items-start gap-3 print:hidden">
              {canCopyScheme && (
                <PaintSchemeCopyForm
                  vesselId={vesselId}
                  sources={copySources.map((v) => ({
                    id: v.id,
                    label: `${v.code} — ${v.name}`,
                    areaCount: v._count.paintAreas,
                  }))}
                />
              )}
              <PaintAreaAddForm vesselId={vesselId} />
            </div>
          )}
        </Card>
        {areas.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Layers className="size-5" />}
              title={t("paint.chuaCoKhuVuc")}
              hint={canEdit ? t("paint.goiYThemKhuVuc") : undefined}
            />
          </Card>
        ) : (
          areas.map((a) => (
            <PaintAreaCard
              key={a.id}
              vesselId={vesselId}
              canEdit={canEdit}
              products={productOptions}
              area={{
                id: a.id,
                name: a.name,
                areaM2: a.areaM2,
                sortOrder: a.sortOrder,
                notes: a.notes,
              }}
              layers={a.layers.map((l) => ({
                id: l.id,
                layerNo: l.layerNo,
                coats: l.coats,
                dft: l.dft,
                notes: l.notes,
                productId: l.productId,
                productLabel: productLabel(l.product, tenLoaiSon),
                coverage: l.product.coverage,
                uom: l.product.uom,
              }))}
            />
          ))
        )}
      </section>

      {/* ── Dự trù sơn ────────────────────────────────────────────────── */}
      {plan.length > 0 && (
        <Card>
          <CardHeader
            icon={<Ruler className="size-4" />}
            title={t("paint.duTruSon")}
            subtitle={t("paint.duTruMoTa")}
            action={
              shortfallCount > 0 && (
                <Badge tone="warning">
                  {t("paint.nLoaiCanMuaThem", { n: shortfallCount })}
                </Badge>
              )
            }
          />
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("paint.son")}</Th>
                  <Th>{t("paint.cotDungChoKhuVuc")}</Th>
                  <Th align="right">{t("paint.cotCan")}</Th>
                  <Th align="right">{t("paint.cotDangCo")}</Th>
                  <Th align="right">{t("paint.cotCanMuaThem")}</Th>
                </tr>
              </thead>
              <tbody>
                {plan.map((p) => (
                  <Tr
                    key={p.productId}
                    className={
                      p.shortfall > 0
                        ? "bg-[var(--surface-sunken)]/60"
                        : undefined
                    }
                  >
                    <Td>{p.name}</Td>
                    <Td>
                      <span className="text-[var(--text-secondary)]">
                        {p.areas.join("; ")}
                      </span>
                    </Td>
                    <Td align="right">
                      {so(p.required)} {p.uom}
                    </Td>
                    <Td align="right">
                      {so(p.onHand)} {p.uom}
                    </Td>
                    <Td align="right" className="font-semibold">
                      {p.shortfall > 0 ? (
                        <span className="text-[var(--text-warning)]">
                          {so(p.shortfall)} {p.uom}
                        </span>
                      ) : (
                        <span className="text-[var(--text-success)]">
                          {t("paint.du")}
                        </span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          {unmeasurable > 0 && (
            <Notice tone="warning" className="mt-3 flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{t("paint.nLopChuaTinhDuoc", { n: unmeasurable })}</span>
            </Notice>
          )}
        </Card>
      )}

      {/* ── Tồn sơn ───────────────────────────────────────────────────── */}
      <section id="ton-son" className="scroll-mt-20 space-y-4">
        <Card>
          <CardHeader
            icon={<Droplets className="size-4" />}
            title={t("paint.tonSonTrenTau")}
            subtitle={canEdit && stocks.length > 0 ? t("paint.tsGoiYBang") : undefined}
            action={
              canEdit && stocks.length > 0 ? (
                <NhanDangTenSon
                  vesselId={vesselId}
                  ds={stocks.map((s) => ({
                    productId: s.productId,
                    name: s.product.name,
                    maker: s.product.maker,
                    paintType: s.product.paintType,
                    colorName: s.product.colorName,
                    colorCode: s.product.colorCode,
                    packSize: s.product.packSize,
                    uom: s.product.uom,
                    suaDuoc: toanDoiSon || !dungTauKhac.has(s.productId),
                  }))}
                />
              ) : undefined
            }
          />
          {canEdit && <ThongBaoTonSon kenh="ton" />}
          {stocks.length === 0 ? (
            <EmptyState
              icon={<Droplets className="size-5" />}
              title={t("paint.chuaCoSon")}
            />
          ) : (
            <TableWrap>
              <Table dense xuongDong={canEdit}>
                <thead>
                  <tr>
                    <Th>{t("paint.son")}</Th>
                    <Th>{t("paint.cotLoai")}</Th>
                    <Th>{t("paint.cotMau")}</Th>
                    <Th align="right">{t("paint.cotConLai")}</Th>
                    <Th align="right">{t("paint.cotToiThieu")}</Th>
                    {canEdit && (
                      <Th align="right" className="print:hidden">
                        {t("chung.thaoTac")}
                      </Th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((s) => {
                    const low = s.minQty > 0 && s.quantity < s.minQty;
                    const pct =
                      s.minQty > 0
                        ? Math.max(
                            0,
                            Math.min(
                              100,
                              Math.round((s.quantity / s.minQty) * 100)
                            )
                          )
                        : 0;
                    return (
                      <Tr
                        key={s.id}
                        className={
                          low ? "bg-[var(--surface-sunken)]/60" : undefined
                        }
                      >
                        <Td>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span>{s.product.name}</span>
                            {s.product.maker && (
                              <span className="text-[var(--text-muted)]">
                                · {s.product.maker}
                              </span>
                            )}
                            {low && (
                              <Badge tone="danger">
                                {t("paint.badgeThieu")}
                              </Badge>
                            )}
                          </div>
                        </Td>
                        <Td>
                          {/* Nhãn hệ sơn dài ("Chống ăn mòn (Anti-corrosive)") được xuống dòng — để
                              nguyên một dòng thì bảng tràn ngang và cột Thao tác khuất ở màn 1366px. */}
                          <Badge tone="neutral" className="whitespace-normal">
                            {tenLoaiSon(s.product.paintType)}
                          </Badge>
                        </Td>
                        <Td>
                          {[s.product.colorName, s.product.colorCode]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </Td>
                        <Td align="right">
                          <span
                            className={cn(
                              "font-semibold whitespace-nowrap",
                              low
                                ? "text-[var(--text-danger)]"
                                : "text-[var(--text-primary)]"
                            )}
                          >
                            {s.quantity} {s.product.uom}
                          </span>
                          {/* Đơn vị là thùng / lon: ghi kèm dung tích một thùng (nhận từ phiếu giao). */}
                          {s.product.packSize > 0 && !/^(l|lt|ltr|lit|lít|litre|liter)s?$/i.test(s.product.uom.trim()) && (
                            <span className="block text-xs whitespace-nowrap text-[var(--text-muted)]">
                              × {so(s.product.packSize)} L
                            </span>
                          )}
                          {low && (
                            <div className="mt-1 ml-auto w-16">
                              <Meter value={pct} tone={toneThieu(pct)} />
                            </div>
                          )}
                        </Td>
                        {/* Sửa tồn tối thiểu ở nút Sửa của dòng (cùng chỗ sửa số đang có). */}
                        <Td align="right">
                          <span className="whitespace-nowrap text-[var(--text-muted)]">
                            {s.minQty ? `${s.minQty} ${s.product.uom}` : "—"}
                          </span>
                        </Td>
                        {canEdit && (
                          <Td align="right" className="print:hidden">
                            <ThaoTacTonSon
                              dong={{
                                vesselId,
                                productId: s.productId,
                                ten: s.product.name,
                                hang: s.product.maker,
                                loai: s.product.paintType,
                                mau: s.product.colorName,
                                maMau: s.product.colorCode,
                                dvt: s.product.uom,
                                dungTich: s.product.packSize,
                                soLuong: s.quantity,
                                minQty: s.minQty,
                                suaSanPham:
                                  toanDoiSon || !dungTauKhac.has(s.productId),
                                dungChung: dungTauKhac.has(s.productId),
                                soThiCong: thiCongTheoSon.get(s.productId) ?? 0,
                              }}
                            />
                          </Td>
                        )}
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        {/* Mở sẵn: nhập/xuất sơn là việc làm hằng ngày, gập lại thì phải bấm
            thêm một lần mỗi lần dùng và dễ tưởng là không có chức năng. */}
        {canEdit && (
          <Card padded={false} className="print:hidden">
            <details open className="group">
              <summary className={SUMMARY}>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 text-[var(--text-muted)] transition-transform group-open:rotate-90"
                />
                <ArrowLeftRight className="size-4 text-[var(--text-muted)]" />
                {t("paint.nhapXuatSon")}
              </summary>
              <div className="space-y-6 border-t border-[var(--border-subtle)] px-4 py-4">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                    {t("paint.tungDong")}
                  </h3>
                  <PaintStockMoveForm
                    vesselId={vesselId}
                    products={productOptions.map((p) => ({
                      id: p.id,
                      label: p.label,
                      uom: p.uom,
                    }))}
                  />
                </div>
                <div className="border-t border-[var(--border-subtle)] pt-4">
                  <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                    {t("paint.pgTieuDe")}
                  </h3>
                  <TaiPhieuSon vesselId={vesselId} coAi={coAi} />
                  {phieuSon.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        {t("paint.pgGanDay", { n: phieuSon.length })}
                      </p>
                      <ul className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] text-sm">
                        {phieuSon.map((p) => (
                          <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                            {p.loai === "BAO_CAO_TON" && <Badge tone="info">{t("paint.pgNhanBaoCaoTon")}</Badge>}
                            <Link href={`/paint/${vesselId}/nhan/${p.id}`} className="font-medium text-[var(--text-brand)] hover:underline">
                              {p.soPhieu || p.fileName}
                            </Link>
                            <span className="text-xs text-[var(--text-muted)]">{ngayGio(p.createdAt)}</span>
                            <Badge
                              tone={p.trangThai === "DA_AP_DUNG" ? "success" : p.aiDangDocTu ? "info" : "warning"}
                              className="ml-auto"
                            >
                              {p.trangThai === "DA_AP_DUNG"
                                ? t("paint.pgDaNhapNhan")
                                : p.aiDangDocTu
                                  ? t("paint.pgAiDangDocNgan")
                                  : t("paint.pgChoXuLy")}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </details>
          </Card>
        )}

        {canRequest && (
          <Card className="print:hidden">
            <CardHeader
              icon={<Send className="size-4" />}
              title={t("paint.yeuCauCapSon")}
              subtitle={t("paint.ycMoTa")}
              action={
                <Link href={`/paint/${vesselId}/yeu-cau`} className={buttonClass("primary")}>
                  <Send className="size-4" />
                  {t("paint.ycNutLap")}
                </Link>
              }
            />
            {duoiDinhMuc > 0 && (
              <Badge tone="warning">
                {t("paint.nLoaiDuoiDinhMuc", { n: duoiDinhMuc })}
              </Badge>
            )}
          </Card>
        )}
      </section>

      {/* ── Nhật ký thi công ──────────────────────────────────────────── */}
      <section className="space-y-4">
        {canEdit && (
          <Card padded={false} className="print:hidden">
            <details className="group">
              <summary className={SUMMARY}>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 text-[var(--text-muted)] transition-transform group-open:rotate-90"
                />
                <Plus className="size-4 text-[var(--text-muted)]" />
                {t("paint.ghiLanThiCong")}
              </summary>
              <div className="border-t border-[var(--border-subtle)] px-4 py-4">
                <PaintJobForm
                  vesselId={vesselId}
                  defaultDate={defaultDate}
                  areas={areas.map((a) => ({ id: a.id, label: a.name }))}
                  products={stockOptions}
                />
              </div>
            </details>
          </Card>
        )}

        <Card>
          <CardHeader
            icon={<Paintbrush className="size-4" />}
            title={t("paint.nhatKyThiCong")}
            subtitle={
              totalPaintedM2 > 0 ? (
                <>
                  {t("paint.tongDaSon")}{" "}
                  <b className="text-[var(--text-primary)]">
                    {t("paint.nM2", { n: so(totalPaintedM2) })}
                  </b>
                </>
              ) : undefined
            }
          />
          {jobs.length === 0 ? (
            <EmptyState
              icon={<Paintbrush className="size-5" />}
              title={t("paint.chuaCoThiCong")}
            />
          ) : (
            <div className="max-h-[28rem] overflow-auto rounded-xl border border-[var(--border-subtle)]">
              <Table dense>
                <thead className="sticky top-0 z-10 bg-[var(--surface-raised)]">
                  <tr>
                    <Th>{t("chung.ngay")}</Th>
                    <Th>{t("paint.khuVuc")}</Th>
                    <Th align="right">m²</Th>
                    <Th align="right">{t("paint.cotSoLopNgan")}</Th>
                    <Th>{t("paint.cotSonDaDung")}</Th>
                    <Th>{t("paint.cotDieuKien")}</Th>
                    <Th>{t("chung.nguoiThucHien")}</Th>
                    {canEdit && <Th className="print:hidden"></Th>}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <Tr key={j.id}>
                      <Td className="whitespace-nowrap">{ngay(j.jobDate)}</Td>
                      <Td>{j.area?.name ?? "—"}</Td>
                      <Td align="right">{j.paintedM2 || "—"}</Td>
                      <Td align="right">
                        <Badge tone="muted">{j.coats}</Badge>
                      </Td>
                      <Td>
                        {j.lines.length === 0
                          ? "—"
                          : j.lines
                              .map(
                                (l) =>
                                  `${l.product.name} ${l.quantity}${l.product.uom}`
                              )
                              .join("; ")}
                      </Td>
                      <Td>
                        <span className="text-[var(--text-secondary)]">
                          {[
                            j.weather,
                            j.airTemp !== null
                              ? t("paint.dkKhongKhi", { n: j.airTemp })
                              : null,
                            j.humidity !== null
                              ? t("paint.dkDoAm", { n: j.humidity })
                              : null,
                            j.surfaceTemp !== null
                              ? t("paint.dkBeMat", { n: j.surfaceTemp })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </Td>
                      <Td>{j.performedBy ?? "—"}</Td>
                      {canEdit && (
                        <Td align="right" className="print:hidden">
                          <div className="flex justify-end">
                            <PaintJobDeleteButton
                              vesselId={vesselId}
                              jobId={j.id}
                            />
                          </div>
                        </Td>
                      )}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      </section>

      {/* ── Tiêu thụ 12 tháng ─────────────────────────────────────────── */}
      {consumptionRows.length > 0 && (
        <Card>
          <CardHeader
            icon={<ClipboardList className="size-4" />}
            title={t("paint.tieuThu12Thang")}
            subtitle={t("paint.ghiChuTieuThu")}
          />
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("paint.son")}</Th>
                  <Th align="right">{t("paint.cotDaDung")}</Th>
                </tr>
              </thead>
              <tbody>
                {consumptionRows.map((c) => (
                  <Tr key={c.name}>
                    <Td>{c.name}</Td>
                    <Td align="right" className="font-semibold">
                      {so(c.qty)} {c.uom}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}

      {/* ── Lịch sử nhập xuất ─────────────────────────────────────────── */}
      <Card className="print:hidden">
        <CardHeader
          icon={<History className="size-4" />}
          title={t("paint.lichSuNhapXuat")}
          subtitle={canEdit && transactions.length > 0 ? t("paint.gdGoiY") : undefined}
        />
        {canEdit && <ThongBaoTonSon kenh="lich-su" />}
        {transactions.length === 0 ? (
          <EmptyState
            icon={<History className="size-5" />}
            title={t("paint.chuaCoGiaoDich")}
          />
        ) : (
          <div className="max-h-80 overflow-auto rounded-xl border border-[var(--border-subtle)]">
            <Table dense>
              <thead className="sticky top-0 z-10 bg-[var(--surface-raised)]">
                <tr>
                  <Th>{t("paint.thoiDiem")}</Th>
                  <Th>{t("paint.cotLoai")}</Th>
                  <Th>{t("paint.son")}</Th>
                  <Th align="right">{t("paint.cotSL")}</Th>
                  <Th>{t("chung.nguoiThucHien")}</Th>
                  <Th>{t("chung.ghiChu")}</Th>
                  {canEdit && <Th className="print:hidden"></Th>}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <Tr key={tx.id}>
                    <Td className="whitespace-nowrap">
                      {ngayGio(tx.occurredAt)}
                    </Td>
                    <Td>
                      {tx.dieuChinh ? (
                        <Badge tone="info">{t("paint.gdDieuChinh")}</Badge>
                      ) : (
                        <Badge tone={tx.type === "IN" ? "success" : "warning"}>
                          {tx.type === "IN"
                            ? t("paint.giaoDichNhan")
                            : t("paint.giaoDichXuat")}
                        </Badge>
                      )}
                    </Td>
                    <Td>{tx.product.name}</Td>
                    <Td align="right">
                      {tx.type === "IN" ? "+" : "−"}
                      {tx.quantity} {tx.product.uom}
                    </Td>
                    <Td>{tx.performedBy ?? "—"}</Td>
                    <Td>
                      <span className="text-[var(--text-secondary)]">
                        {tx.note ?? ""}
                      </span>
                    </Td>
                    {canEdit && (
                      <Td align="right" className="whitespace-nowrap print:hidden">
                        {tx.jobId !== null ? (
                          <span className="text-xs text-[var(--text-muted)]">
                            {t("paint.gdTheoThiCong")}
                          </span>
                        ) : tx.phieuSonId !== null ? (
                          <Link
                            href={`/paint/${vesselId}/nhan/${tx.phieuSonId}`}
                            className="text-xs text-[var(--text-brand)] hover:underline"
                          >
                            {t("paint.gdPhieuGiao")}
                          </Link>
                        ) : (
                          <NutXoaGiaoDichSon
                            vesselId={vesselId}
                            giaoDich={{
                              id: tx.id,
                              ten: tx.product.name,
                              type: tx.type,
                              soLuong: tx.quantity,
                              dvt: tx.product.uom,
                              luc: ngayGio(tx.occurredAt),
                              note: tx.note,
                            }}
                          />
                        )}
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
