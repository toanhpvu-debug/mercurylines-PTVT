import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  coQuanLySon,
  requireScopedUser,
  vesselScope,
} from "@/lib/auth";
import { LAP_YEU_CAU, ROLE_LABEL, nguoiDuyetCapTau, boPhanCuaChucDanh } from "@/lib/roles";
import { PAINT_TYPE_LABEL } from "@/lib/paintTypes";
import {
  PaintAreaAddForm,
  PaintAreaCard,
} from "@/components/PaintAreaManager";
import { PaintStockMinForm, PaintStockMoveForm } from "@/components/PaintStockForm";
import { PaintJobDeleteButton, PaintJobForm } from "@/components/PaintJobForm";
import PaintSchemeCopyForm from "@/components/PaintSchemeCopyForm";
import PaintRequestForm from "@/components/PaintRequestForm";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const TYPE_LABEL = PAINT_TYPE_LABEL;

function productLabel(p: {
  name: string;
  maker: string | null;
  paintType: string;
  colorName: string | null;
}) {
  const bits = [p.name];
  if (p.maker) bits.push(p.maker);
  bits.push(TYPE_LABEL[p.paintType] ?? p.paintType);
  if (p.colorName) bits.push(p.colorName);
  return bits.join(" · ");
}

export default async function PaintVesselPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  const { id } = await params;
  const vesselId = Number(id);
  if (!Number.isInteger(vesselId) || vesselId <= 0) notFound();
  // Người bị giới hạn tàu không xem được tàu khác kể cả gõ thẳng URL.
  if (!scope.all && scope.vesselId !== vesselId) notFound();

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
        where: scope.all ? { id: { not: vesselId } } : { id: -1 },
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
    label: productLabel(p),
    coverage: p.coverage,
    dftPerCoat: p.dftPerCoat,
    uom: p.uom,
  }));
  const stockOptions = stocks
    .filter((s) => s.quantity > 0)
    .map((s) => ({
      id: s.productId,
      label: productLabel(s.product),
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
      label: productLabel(p),
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
  for (const t of transactions) {
    if (t.type !== "OUT" || t.occurredAt < since) continue;
    const cur = consumption.get(t.productId) ?? {
      name: t.product.name,
      uom: t.product.uom,
      qty: 0,
    };
    cur.qty += t.quantity;
    consumption.set(t.productId, cur);
  }
  const consumptionRows = [...consumption.values()].sort(
    (a, b) => b.qty - a.qty
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link href="/paint" className="text-sm text-blue-700 hover:underline">
            ← Quay lại quản lý sơn
          </Link>
          <h2 className="text-2xl font-bold text-blue-950">
            Sơn — {vessel.name}
          </h2>
          <p className="text-slate-600">
            {vessel.code}
            {vessel.imo ? ` · IMO ${vessel.imo}` : ""} · {areas.length} khu vực ·{" "}
            {jobs.length} lần thi công gần đây
          </p>
        </div>
        <PrintButton />
      </div>

      {lowStocks.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
          <p className="font-semibold">
            {lowStocks.length} loại sơn dưới định mức tối thiểu
          </p>
          <ul className="mt-1 list-inside list-disc text-sm">
            {lowStocks.map((s) => (
              <li key={s.id}>
                {s.product.name}: còn {s.quantity} {s.product.uom} / tối thiểu{" "}
                {s.minQty} {s.product.uom}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Sơ đồ sơn ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-blue-950">
            Sơ đồ sơn theo khu vực
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
            Chưa khai báo khu vực sơn nào cho tàu này.
            {canEdit && " Bấm “+ Thêm khu vực sơn” để bắt đầu."}
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
                productLabel: productLabel(l.product),
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
              Dự trù sơn theo sơ đồ
            </h3>
            {shortfallCount > 0 && (
              <span className="rounded bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                {shortfallCount} loại cần mua thêm
              </span>
            )}
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
            <p className="mb-3 text-sm text-slate-600">
              Lượng cần để sơn trọn sơ đồ của tất cả khu vực đã khai báo, đối
              chiếu với sơn đang có trên tàu.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-blue-900 text-left text-white">
                  <tr>
                    <th className="p-2">Sơn</th>
                    <th className="p-2">Dùng cho khu vực</th>
                    <th className="p-2 text-right">Cần</th>
                    <th className="p-2 text-right">Đang có</th>
                    <th className="p-2 text-right">Cần mua thêm</th>
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
                        {p.required.toLocaleString("vi-VN")} {p.uom}
                      </td>
                      <td className="p-2 text-right">
                        {p.onHand.toLocaleString("vi-VN")} {p.uom}
                      </td>
                      <td className="p-2 text-right font-semibold">
                        {p.shortfall > 0 ? (
                          <span className="text-amber-800">
                            {p.shortfall.toLocaleString("vi-VN")} {p.uom}
                          </span>
                        ) : (
                          <span className="text-emerald-700">đủ</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {unmeasurable > 0 && (
              <p className="mt-2 text-sm text-amber-700">
                ⚠ {unmeasurable} lớp chưa tính được vì khu vực thiếu diện tích
                m² hoặc loại sơn chưa khai độ phủ (m²/lít). Con số dự trù ở trên
                chưa gồm các lớp đó.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── Tồn sơn ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-xl font-semibold text-blue-950">Tồn sơn trên tàu</h3>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
          {stocks.length === 0 ? (
            <p className="text-sm text-slate-500">
              Chưa có sơn nào trên tàu.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-blue-900 text-left text-white">
                  <tr>
                    <th className="p-2">Sơn</th>
                    <th className="p-2">Loại</th>
                    <th className="p-2">Màu</th>
                    <th className="p-2 text-right">Còn lại</th>
                    <th className="p-2 text-right">Tối thiểu</th>
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
                              THIẾU
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {TYPE_LABEL[s.product.paintType] ?? s.product.paintType}
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

        {canEdit && (
          <details className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100 print:hidden">
            <summary className="cursor-pointer font-semibold text-blue-950">
              Nhập / xuất sơn
            </summary>
            <div className="mt-3">
              <PaintStockMoveForm
                vesselId={vesselId}
                products={productOptions.map((p) => ({
                  id: p.id,
                  label: p.label,
                  uom: p.uom,
                }))}
              />
            </div>
          </details>
        )}

        {canRequest && (
          <details className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100 print:hidden">
            <summary className="cursor-pointer font-semibold text-blue-950">
              Yêu cầu cấp sơn — gửi lên phê duyệt
              {duoiDinhMuc > 0 && (
                <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {duoiDinhMuc} loại dưới định mức
                </span>
              )}
            </summary>
            <div className="mt-3 space-y-3">
              <p className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                Bạn lập với chức danh <b>{ROLE_LABEL[user.role] ?? user.role}</b>{" "}
                (bộ phận{" "}
                {boPhanCuaChucDanh(user.role) === "ENGINE" ? "Máy" : "Boong"}).
                Yêu cầu sẽ về bàn{" "}
                <b>
                  {ROLE_LABEL[
                    nguoiDuyetCapTau(boPhanCuaChucDanh(user.role) ?? "DECK")
                  ]}
                </b>{" "}
                duyệt cấp tàu, rồi chuyển tiếp lên{" "}
                <b>{ROLE_LABEL.TECH_MANAGER}</b> duyệt cấp công ty.
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
            Nhật ký thi công sơn
          </h3>
          {totalPaintedM2 > 0 && (
            <p className="text-sm text-slate-600">
              Tổng đã sơn (50 lần gần nhất):{" "}
              <b>{totalPaintedM2.toLocaleString("vi-VN")} m²</b>
            </p>
          )}
        </div>

        {canEdit && (
          <details className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100 print:hidden">
            <summary className="cursor-pointer font-semibold text-blue-950">
              + Ghi một lần thi công
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
            <p className="text-sm text-slate-500">Chưa có lần thi công nào.</p>
          ) : (
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="sticky top-0 bg-blue-900 text-left text-white">
                  <tr>
                    <th className="p-2">Ngày</th>
                    <th className="p-2">Khu vực</th>
                    <th className="p-2 text-right">m²</th>
                    <th className="p-2 text-right">Lớp</th>
                    <th className="p-2">Sơn đã dùng</th>
                    <th className="p-2">Điều kiện</th>
                    <th className="p-2">Người thực hiện</th>
                    {canEdit && <th className="p-2 print:hidden"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td className="p-2 whitespace-nowrap">
                        {j.jobDate.toLocaleDateString("vi-VN")}
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
                          j.airTemp !== null ? `KK ${j.airTemp}°C` : null,
                          j.humidity !== null ? `Ẩm ${j.humidity}%` : null,
                          j.surfaceTemp !== null
                            ? `BM ${j.surfaceTemp}°C`
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
            Tiêu thụ sơn 12 tháng gần nhất
          </h3>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-blue-50 text-left text-blue-900">
                  <tr>
                    <th className="p-2">Sơn</th>
                    <th className="p-2 text-right">Đã dùng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {consumptionRows.map((c) => (
                    <tr key={c.name}>
                      <td className="p-2">{c.name}</td>
                      <td className="p-2 text-right font-semibold">
                        {c.qty.toLocaleString("vi-VN")} {c.uom}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Tính từ 40 giao dịch xuất gần nhất — gồm cả sơn trừ tự động khi ghi
              nhật ký thi công.
            </p>
          </div>
        </section>
      )}

      {/* ── Lịch sử nhập xuất ─────────────────────────────────────────── */}
      <section className="space-y-3 print:hidden">
        <h3 className="text-xl font-semibold text-blue-950">
          Lịch sử nhập / xuất sơn
        </h3>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có giao dịch nào.</p>
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="sticky top-0 bg-blue-50 text-left text-blue-900">
                  <tr>
                    <th className="p-2">Thời điểm</th>
                    <th className="p-2">Loại</th>
                    <th className="p-2">Sơn</th>
                    <th className="p-2 text-right">SL</th>
                    <th className="p-2">Người thực hiện</th>
                    <th className="p-2">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="p-2 whitespace-nowrap">
                        {t.occurredAt.toLocaleDateString("vi-VN")}{" "}
                        {t.occurredAt.toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-2">
                        <span
                          className={
                            t.type === "IN"
                              ? "text-emerald-700"
                              : "text-amber-700"
                          }
                        >
                          {t.type === "IN" ? "↓ Nhận" : "↑ Xuất"}
                        </span>
                      </td>
                      <td className="p-2">{t.product.name}</td>
                      <td className="p-2 text-right">
                        {t.type === "IN" ? "+" : "−"}
                        {t.quantity} {t.product.uom}
                      </td>
                      <td className="p-2">{t.performedBy ?? "—"}</td>
                      <td className="p-2 text-slate-600">{t.note ?? ""}</td>
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
