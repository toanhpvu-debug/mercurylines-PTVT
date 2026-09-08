import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  coQuanLySon,
  requireScopedUser,
  trongPhamVi,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import { LAP_YEU_CAU, nguoiDuyetCapTau, boPhanCuaChucDanh } from "@/lib/roles";
import { layT } from "@/lib/i18n/server";
import { PAINT_TYPE_LABEL } from "@/lib/paintTypes";
import {
  PaintAreaAddForm,
  PaintAreaCard,
} from "@/components/PaintAreaManager";
import { PaintStockMinForm, PaintStockMoveForm } from "@/components/PaintStockForm";
import { PaintJobDeleteButton, PaintJobForm } from "@/components/PaintJobForm";
import PaintSchemeCopyForm from "@/components/PaintSchemeCopyForm";
import PaintRequestForm from "@/components/PaintRequestForm";
import PaintStockBulkForm from "@/components/PaintStockBulkForm";
import PrintButton from "@/components/PrintButton";
import VesselSwitcher from "@/components/VesselSwitcher";

export const dynamic = "force-dynamic";

const TYPE_LABEL = PAINT_TYPE_LABEL;

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
  // Dòng cho bảng xin cấp sơn: mọi loại sơn đang dùng, kèm tồn và định mức của
  // tàu này. Loại chưa từng nhập chưa có bản ghi tồn nên coi như tồn 0 — vẫn
  // phải xin được, đó chính là lúc cần xin nhất.
  const yeuCauLines = products.map((p) => {
    const st = stocks.find((s) => s.productId === p.id);
    return {
      productId: p.id,
      label: productLabel(p, tenLoaiSon),
      uom: p.uom,
      ton: st?.quantity ?? 0,
      minQty: st?.minQty ?? 0,
    };
  });
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
    if (tx.type !== "OUT" || tx.occurredAt < since) continue;
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link href="/paint" className="text-sm text-blue-700 hover:underline">
            ← {t("paint.quayLaiQuanLySon")}
          </Link>
          <h2 className="text-2xl font-bold text-blue-950">
            {t("paint.tieuDeSonTau", { ten: vessel.name })}
          </h2>
          <p className="text-slate-600">
            {vessel.code}
            {vessel.imo ? ` · IMO ${vessel.imo}` : ""} ·{" "}
            {t("paint.nKhuVuc", { n: areas.length })} ·{" "}
            {t("paint.nLanThiCongGanDay", { n: jobs.length })}
          </p>
        </div>
        <PrintButton />
      </div>

      {lowStocks.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
          <p className="font-semibold">
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
        </div>
      )}

      <div className="no-print">
        <VesselSwitcher
          hienTai={vesselId}
          duongDan={(id) => `/paint/${id}`}
        />
      </div>

      {/* ── Sơ đồ sơn ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-blue-950">
            {t("paint.soDoSon")}
          </h3>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-3">
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
        </div>
        {areas.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm ring-1 ring-blue-100">
            {t("paint.chuaCoKhuVuc")}
            {canEdit && ` ${t("paint.goiYThemKhuVuc")}`}
          </div>
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
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-blue-950">
              {t("paint.duTruSon")}
            </h3>
            {shortfallCount > 0 && (
              <span className="rounded bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                {t("paint.nLoaiCanMuaThem", { n: shortfallCount })}
              </span>
            )}
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
            <p className="mb-3 text-sm text-slate-600">
              {t("paint.duTruMoTa")}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-blue-900 text-left text-white">
                  <tr>
                    <th className="p-2">{t("paint.son")}</th>
                    <th className="p-2">{t("paint.cotDungChoKhuVuc")}</th>
                    <th className="p-2 text-right">{t("paint.cotCan")}</th>
                    <th className="p-2 text-right">{t("paint.cotDangCo")}</th>
                    <th className="p-2 text-right">
                      {t("paint.cotCanMuaThem")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {plan.map((p) => (
                    <tr
                      key={p.productId}
                      className={p.shortfall > 0 ? "bg-amber-50" : ""}
                    >
                      <td className="p-2">{p.name}</td>
                      <td className="p-2 text-slate-600">
                        {p.areas.join("; ")}
                      </td>
                      <td className="p-2 text-right">
                        {so(p.required)} {p.uom}
                      </td>
                      <td className="p-2 text-right">
                        {so(p.onHand)} {p.uom}
                      </td>
                      <td className="p-2 text-right font-semibold">
                        {p.shortfall > 0 ? (
                          <span className="text-amber-800">
                            {so(p.shortfall)} {p.uom}
                          </span>
                        ) : (
                          <span className="text-emerald-700">
                            {t("paint.du")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {unmeasurable > 0 && (
              <p className="mt-2 text-sm text-amber-700">
                ⚠ {t("paint.nLopChuaTinhDuoc", { n: unmeasurable })}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── Tồn sơn ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-xl font-semibold text-blue-950">
          {t("paint.tonSonTrenTau")}
        </h3>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
          {stocks.length === 0 ? (
            <p className="text-sm text-slate-500">{t("paint.chuaCoSon")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-blue-900 text-left text-white">
                  <tr>
                    <th className="p-2">{t("paint.son")}</th>
                    <th className="p-2">{t("paint.cotLoai")}</th>
                    <th className="p-2">{t("paint.cotMau")}</th>
                    <th className="p-2 text-right">{t("paint.cotConLai")}</th>
                    <th className="p-2 text-right">{t("paint.cotToiThieu")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {stocks.map((s) => {
                    const low = s.minQty > 0 && s.quantity < s.minQty;
                    return (
                      <tr key={s.id} className={low ? "bg-red-50" : ""}>
                        <td className="p-2">
                          {s.product.name}
                          {s.product.maker ? (
                            <span className="text-slate-500">
                              {" "}
                              · {s.product.maker}
                            </span>
                          ) : null}
                          {low && (
                            <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                              {t("paint.badgeThieu")}
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {tenLoaiSon(s.product.paintType)}
                        </td>
                        <td className="p-2">
                          {[s.product.colorName, s.product.colorCode]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </td>
                        <td className="p-2 text-right font-semibold">
                          {s.quantity} {s.product.uom}
                        </td>
                        <td className="p-2 text-right">
                          {canEdit ? (
                            <div className="flex justify-end print:hidden">
                              <PaintStockMinForm
                                vesselId={vesselId}
                                productId={s.productId}
                                minQty={s.minQty}
                              />
                            </div>
                          ) : (
                            s.minQty || "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mở sẵn: nhập/xuất sơn là việc làm hằng ngày, gập lại thì phải bấm
            thêm một lần mỗi lần dùng và dễ tưởng là không có chức năng. */}
        {canEdit && (
          <details
            open
            className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100 print:hidden"
          >
            <summary className="cursor-pointer font-semibold text-blue-950">
              {t("paint.nhapXuatSon")}
            </summary>
            <div className="mt-3 space-y-6">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-700">
                  {t("paint.tungDong")}
                </h4>
                <PaintStockMoveForm
                  vesselId={vesselId}
                  products={productOptions.map((p) => ({
                    id: p.id,
                    label: p.label,
                    uom: p.uom,
                  }))}
                />
              </div>
              <div className="border-t pt-4">
                <h4 className="mb-2 text-sm font-semibold text-slate-700">
                  {t("paint.hangLoatExcel")}
                </h4>
                <PaintStockBulkForm vesselId={vesselId} />
              </div>
            </div>
          </details>
        )}

        {canRequest && (
          <details className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100 print:hidden">
            <summary className="cursor-pointer font-semibold text-blue-950">
              {t("paint.yeuCauCapSon")}
              {duoiDinhMuc > 0 && (
                <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {t("paint.nLoaiDuoiDinhMuc", { n: duoiDinhMuc })}
                </span>
              )}
            </summary>
            <div className="mt-3 space-y-3">
              <p className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                {t("paint.luongDuyetTruoc")}{" "}
                <b>{tTuDo(`labels.role_${user.role}`)}</b>{" "}
                {t("paint.luongDuyetBoPhan", {
                  bp:
                    boPhanCuaChucDanh(user.role) === "ENGINE"
                      ? t("labels.reqDept_ENGINE")
                      : t("labels.reqDept_DECK"),
                })}{" "}
                {t("paint.luongDuyetGiua")}{" "}
                <b>
                  {tTuDo(
                    `labels.role_${nguoiDuyetCapTau(
                      boPhanCuaChucDanh(user.role) ?? "DECK"
                    )}`
                  )}
                </b>{" "}
                {t("paint.luongDuyetCapTau")}{" "}
                <b>{t("labels.role_TECH_MANAGER")}</b>{" "}
                {t("paint.luongDuyetCapCongTy")}
              </p>
              <PaintRequestForm
                vesselId={vesselId}
                lines={yeuCauLines}
              />
            </div>
          </details>
        )}
      </section>

      {/* ── Nhật ký thi công ──────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-blue-950">
            {t("paint.nhatKyThiCong")}
          </h3>
          {totalPaintedM2 > 0 && (
            <p className="text-sm text-slate-600">
              {t("paint.tongDaSon")}{" "}
              <b>{t("paint.nM2", { n: so(totalPaintedM2) })}</b>
            </p>
          )}
        </div>

        {canEdit && (
          <details className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100 print:hidden">
            <summary className="cursor-pointer font-semibold text-blue-950">
              + {t("paint.ghiLanThiCong")}
            </summary>
            <div className="mt-3">
              <PaintJobForm
                vesselId={vesselId}
                defaultDate={defaultDate}
                areas={areas.map((a) => ({ id: a.id, label: a.name }))}
                products={stockOptions}
              />
            </div>
          </details>
        )}

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("paint.chuaCoThiCong")}
            </p>
          ) : (
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="sticky top-0 bg-blue-900 text-left text-white">
                  <tr>
                    <th className="p-2">{t("chung.ngay")}</th>
                    <th className="p-2">{t("paint.khuVuc")}</th>
                    <th className="p-2 text-right">m²</th>
                    <th className="p-2 text-right">{t("paint.cotSoLopNgan")}</th>
                    <th className="p-2">{t("paint.cotSonDaDung")}</th>
                    <th className="p-2">{t("paint.cotDieuKien")}</th>
                    <th className="p-2">{t("chung.nguoiThucHien")}</th>
                    {canEdit && <th className="p-2 print:hidden"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td className="p-2 whitespace-nowrap">
                        {ngay(j.jobDate)}
                      </td>
                      <td className="p-2">{j.area?.name ?? "—"}</td>
                      <td className="p-2 text-right">{j.paintedM2 || "—"}</td>
                      <td className="p-2 text-right">{j.coats}</td>
                      <td className="p-2">
                        {j.lines.length === 0
                          ? "—"
                          : j.lines
                              .map(
                                (l) =>
                                  `${l.product.name} ${l.quantity}${l.product.uom}`
                              )
                              .join("; ")}
                      </td>
                      <td className="p-2 text-slate-600">
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
                      </td>
                      <td className="p-2">{j.performedBy ?? "—"}</td>
                      {canEdit && (
                        <td className="p-2 text-right print:hidden">
                          <PaintJobDeleteButton
                            vesselId={vesselId}
                            jobId={j.id}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── Tiêu thụ 12 tháng ─────────────────────────────────────────── */}
      {consumptionRows.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xl font-semibold text-blue-950">
            {t("paint.tieuThu12Thang")}
          </h3>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-blue-50 text-left text-blue-900">
                  <tr>
                    <th className="p-2">{t("paint.son")}</th>
                    <th className="p-2 text-right">{t("paint.cotDaDung")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {consumptionRows.map((c) => (
                    <tr key={c.name}>
                      <td className="p-2">{c.name}</td>
                      <td className="p-2 text-right font-semibold">
                        {so(c.qty)} {c.uom}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {t("paint.ghiChuTieuThu")}
            </p>
          </div>
        </section>
      )}

      {/* ── Lịch sử nhập xuất ─────────────────────────────────────────── */}
      <section className="space-y-3 print:hidden">
        <h3 className="text-xl font-semibold text-blue-950">
          {t("paint.lichSuNhapXuat")}
        </h3>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("paint.chuaCoGiaoDich")}
            </p>
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="sticky top-0 bg-blue-50 text-left text-blue-900">
                  <tr>
                    <th className="p-2">{t("paint.thoiDiem")}</th>
                    <th className="p-2">{t("paint.cotLoai")}</th>
                    <th className="p-2">{t("paint.son")}</th>
                    <th className="p-2 text-right">{t("paint.cotSL")}</th>
                    <th className="p-2">{t("chung.nguoiThucHien")}</th>
                    <th className="p-2">{t("chung.ghiChu")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="p-2 whitespace-nowrap">
                        {ngayGio(tx.occurredAt)}
                      </td>
                      <td className="p-2">
                        <span
                          className={
                            tx.type === "IN"
                              ? "text-emerald-700"
                              : "text-amber-700"
                          }
                        >
                          {tx.type === "IN"
                            ? t("paint.giaoDichNhan")
                            : t("paint.giaoDichXuat")}
                        </span>
                      </td>
                      <td className="p-2">{tx.product.name}</td>
                      <td className="p-2 text-right">
                        {tx.type === "IN" ? "+" : "−"}
                        {tx.quantity} {tx.product.uom}
                      </td>
                      <td className="p-2">{tx.performedBy ?? "—"}</td>
                      <td className="p-2 text-slate-600">{tx.note ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
