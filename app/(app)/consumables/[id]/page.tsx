import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselScope } from "@/lib/auth";
import { nhomNhienLieuChoPhep } from "@/lib/roles";
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  CATEGORY_VALUES,
  CONSUMABLE_CATEGORIES,
  CONSUMER_LABEL,
  GRADE_LABEL,
  NGUONG_CANH_BAO_HAN_DUNG,
  TRANSACTION_LABEL,
  kiemTraLuuHuynh,
  soNgayToi,
} from "@/lib/consumables";
import {
  ConsumableMinForm,
  ConsumableMoveForm,
  ConsumableReceiptForm,
} from "@/components/ConsumableForms";
import ConsumableReceiptDeleteButton from "@/components/ConsumableReceiptDeleteButton";

export const dynamic = "force-dynamic";

function nhanMatHang(p: {
  name: string;
  maker: string | null;
  grade: string;
}) {
  const bits = [p.name];
  if (p.maker) bits.push(p.maker);
  bits.push(GRADE_LABEL[p.grade] ?? p.grade);
  return bits.join(" · ");
}

const ngay = (d: Date) => d.toLocaleDateString("vi-VN");
const gio = (d: Date) =>
  d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function ConsumableVesselPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nhom?: string }>;
}) {
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  const { id } = await params;
  const vesselId = Number(id);
  if (!Number.isInteger(vesselId) || vesselId <= 0) notFound();
  if (!scope.all && scope.vesselId !== vesselId) notFound();

  const vessel = await prisma.vessel.findUnique({ where: { id: vesselId } });
  if (!vessel) notFound();

  // Nhóm nào người này được GHI. Đại phó vào xem được cả trang nhưng chỉ ghi
  // được hóa chất; ô chọn mặt hàng ở các form chỉ hiện nhóm đó.
  const nhomGhiDuoc = nhomNhienLieuChoPhep(user, vesselId);
  const coTheGhi = nhomGhiDuoc.length > 0;

  // Tách hẳn ba nhóm: dầu đốt, dầu nhờn và hóa chất là ba nghiệp vụ khác nhau,
  // do người khác nhau phụ trách và có chứng từ khác nhau. Xem lẫn cả ba trong
  // một danh sách thì máy trưởng phải lọc mắt qua hóa chất tẩy rửa mới thấy
  // được lô dầu của mình.
  const { nhom: nhomRaw } = await searchParams;
  const nhomChon =
    nhomRaw && CATEGORY_VALUES.includes(nhomRaw) ? nhomRaw : null;
  const hopNhom = (c: string) => nhomChon === null || c === nhomChon;

  const [products, stocks, receipts, transactions] = await Promise.all([
    prisma.consumableProduct.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { grade: "asc" }, { name: "asc" }],
    }),
    prisma.consumableStock.findMany({
      where: { vesselId },
      include: { product: true },
    }),
    prisma.consumableReceipt.findMany({
      where: { vesselId },
      include: { product: true },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      take: 50,
    }),
    prisma.consumableTransaction.findMany({
      where: { vesselId },
      include: { product: true },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 40,
    }),
  ]);

  const optionsChoNhom = products
    .filter((p) => nhomGhiDuoc.includes(p.category) && hopNhom(p.category))
    .map((p) => ({
      id: p.id,
      label: `${CATEGORY_ICON[p.category] ?? ""} ${nhanMatHang(p)}`,
      uom: p.uom,
      category: p.category,
      shelfLifeMonths: p.shelfLifeMonths,
    }));

  // Cảnh báo gom một chỗ: dưới định mức, lô sắp/đã hết hạn, mẫu dầu hết hạn giữ.
  const duoiDinhMuc = stocks.filter(
    (s) => s.minQty > 0 && s.quantity < s.minQty
  );
  const loHetHan = receipts
    .filter((r) => r.expiryDate)
    .map((r) => ({ r, con: soNgayToi(r.expiryDate)! }))
    .filter((x) => x.con <= NGUONG_CANH_BAO_HAN_DUNG)
    .sort((a, b) => a.con - b.con);
  const mauHetHanGiu = receipts
    .filter((r) => r.sampleKeepUntil && soNgayToi(r.sampleKeepUntil)! < 0)
    .slice(0, 10);

  const theoNhom = CONSUMABLE_CATEGORIES.filter((c) => hopNhom(c.value)).map((c) => ({
    ...c,
    stocks: stocks
      .filter((s) => s.product.category === c.value)
      .sort((a, b) => a.product.name.localeCompare(b.product.name, "vi")),
  })).filter((c) => c.stocks.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/consumables"
            className="text-sm text-blue-700 hover:underline"
          >
            ← Quay lại tổng quan
          </Link>
          <h2 className="text-2xl font-bold text-blue-950">
            {vessel.code} — {vessel.name}
          </h2>
          <p className="text-slate-600">
            Dầu đốt · Dầu nhờn · Hóa chất — tồn, phiếu nhận và tiêu thụ
          </p>
        </div>
        {!coTheGhi && (
          <p className="rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-600">
            Bạn xem được số liệu nhưng không ghi được giao dịch nhóm nào ở tàu này.
          </p>
        )}
      </div>

      {/* ── Tách nhóm ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/consumables/${vesselId}`}
          className={`rounded px-3 py-1.5 text-sm ${
            nhomChon === null
              ? "bg-blue-700 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Tất cả
        </Link>
        {CONSUMABLE_CATEGORIES.map((c) => {
          const ghiDuoc = nhomGhiDuoc.includes(c.value);
          return (
            <Link
              key={c.value}
              href={`/consumables/${vesselId}?nhom=${c.value}`}
              className={`rounded px-3 py-1.5 text-sm ${
                nhomChon === c.value
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {c.icon} {c.label}
              {!ghiDuoc && (
                <span className="ml-1 text-xs opacity-70">(chỉ xem)</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* ── Cảnh báo ─────────────────────────────────────────────────── */}
      {(duoiDinhMuc.length > 0 ||
        loHetHan.length > 0 ||
        mauHetHanGiu.length > 0) && (
        <div className="space-y-2">
          {duoiDinhMuc.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <b>{duoiDinhMuc.length} mặt hàng dưới định mức:</b>{" "}
              {duoiDinhMuc
                .map(
                  (s) =>
                    `${s.product.name} (${s.quantity}/${s.minQty} ${s.product.uom})`
                )
                .join(" · ")}
            </div>
          )}
          {loHetHan.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              <b>Hạn dùng:</b>{" "}
              {loHetHan
                .map(
                  ({ r, con }) =>
                    `${r.product.name} (lô ${r.docNo}) ${
                      con < 0 ? `QUÁ HẠN ${-con} ngày` : `còn ${con} ngày`
                    }`
                )
                .join(" · ")}
            </div>
          )}
          {mauHetHanGiu.length > 0 && (
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
              <b>Mẫu dầu đã qua mốc giữ 12 tháng</b> (MARPOL VI 18.8.1) — bỏ được
              nếu lô đã dùng hết:{" "}
              {mauHetHanGiu
                .map((r) => `${r.docNo}${r.sampleSealNo ? ` (niêm ${r.sampleSealNo})` : ""}`)
                .join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* ── Tồn theo nhóm ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-xl font-semibold text-blue-950">Tồn trên tàu</h3>
        {theoNhom.length === 0 ? (
          <p className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-blue-100">
            Chưa có số liệu. Ghi phiếu nhận đầu tiên ở phần bên dưới.
          </p>
        ) : (
          theoNhom.map((nhom) => (
            <div
              key={nhom.value}
              className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100"
            >
              <h4 className="mb-2 font-semibold text-blue-950">
                {nhom.icon} {nhom.label}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full border text-sm">
                  <thead>
                    <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                      <th className="p-2">Mã</th>
                      <th className="p-2">Mặt hàng</th>
                      <th className="p-2">Chủng loại</th>
                      <th className="p-2 text-right">Tồn</th>
                      <th className="p-2 text-right">Định mức</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nhom.stocks.map((s) => {
                      const thieu = s.minQty > 0 && s.quantity < s.minQty;
                      return (
                        <tr key={s.id} className="border-b">
                          <td className="p-2 font-mono text-xs">
                            {s.product.code}
                          </td>
                          <td className="p-2">
                            {s.product.name}
                            {s.product.maker && (
                              <span className="text-slate-500">
                                {" "}
                                · {s.product.maker}
                              </span>
                            )}
                            {thieu && (
                              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                                THIẾU
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-slate-600">
                            {GRADE_LABEL[s.product.grade] ?? s.product.grade}
                          </td>
                          <td className="p-2 text-right font-semibold">
                            {s.quantity} {s.product.uom}
                          </td>
                          <td className="p-2 text-right">
                            {nhomGhiDuoc.includes(s.product.category) ? (
                              <div className="flex justify-end">
                                <ConsumableMinForm
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
            </div>
          ))
        )}
      </section>

      {/* ── Ghi phiếu nhận ───────────────────────────────────────────── */}
      {coTheGhi && (
        <section className="space-y-3">
          <h3 className="text-xl font-semibold text-blue-950">
            Ghi phiếu nhận (BDN / phiếu giao hàng)
          </h3>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
            <ConsumableReceiptForm
              vesselId={vesselId}
              products={optionsChoNhom}
            />
          </div>
        </section>
      )}

      {/* ── Tiêu thụ / xuất ──────────────────────────────────────────── */}
      {coTheGhi && (
        <section className="space-y-3">
          <h3 className="text-xl font-semibold text-blue-950">
            Ghi tiêu thụ / xuất
          </h3>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
            <ConsumableMoveForm vesselId={vesselId} products={optionsChoNhom} />
          </div>
        </section>
      )}

      {/* ── Lịch sử phiếu nhận ───────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-xl font-semibold text-blue-950">
          Phiếu nhận gần đây
        </h3>
        <div className="overflow-x-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
          {receipts.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có phiếu nào.</p>
          ) : (
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">Số chứng từ</th>
                  <th className="p-2">Ngày</th>
                  <th className="p-2">Mặt hàng</th>
                  <th className="p-2 text-right">Số lượng</th>
                  <th className="p-2">Cảng / NCC</th>
                  <th className="p-2">Đặc tính</th>
                  <th className="p-2">Mẫu · hạn dùng</th>
                  <th className="p-2">Bản gốc</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {receipts.filter((r) => hopNhom(r.product.category)).map((r) => {
                  const cb = kiemTraLuuHuynh(r.sulphur);
                  const conHan = soNgayToi(r.expiryDate);
                  return (
                    <tr key={r.id} className="border-b align-top">
                      <td className="p-2 font-medium">{r.docNo}</td>
                      <td className="p-2 whitespace-nowrap">
                        {ngay(r.receivedAt)}
                      </td>
                      <td className="p-2">
                        {CATEGORY_ICON[r.product.category]} {r.product.name}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {r.quantity} {r.product.uom}
                      </td>
                      <td className="p-2 text-slate-600">
                        {[r.port, r.supplier].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="p-2 text-xs text-slate-600">
                        {r.sulphur !== null && (
                          <span
                            className={
                              cb?.muc === "VUOT_TOAN_CAU"
                                ? "font-semibold text-red-700"
                                : cb?.muc === "VUOT_ECA"
                                  ? "font-semibold text-amber-700"
                                  : "text-emerald-700"
                            }
                          >
                            S {r.sulphur}%
                          </span>
                        )}
                        {r.density !== null && <> · ρ {r.density}</>}
                        {r.viscosity !== null && <> · {r.viscosity} cSt</>}
                        {r.bnValue !== null && <> · TBN {r.bnValue}</>}
                        {r.sulphur === null &&
                          r.density === null &&
                          r.viscosity === null &&
                          r.bnValue === null &&
                          "—"}
                      </td>
                      <td className="p-2 text-xs text-slate-600">
                        {r.sampleKeepUntil && (
                          <>
                            Mẫu tới {ngay(r.sampleKeepUntil)}
                            {r.sampleSealNo ? ` · niêm ${r.sampleSealNo}` : ""}
                          </>
                        )}
                        {r.expiryDate && (
                          <span
                            className={
                              conHan !== null && conHan <= NGUONG_CANH_BAO_HAN_DUNG
                                ? "font-semibold text-red-700"
                                : ""
                            }
                          >
                            {r.sampleKeepUntil ? <br /> : null}
                            HD {ngay(r.expiryDate)}
                          </span>
                        )}
                        {!r.sampleKeepUntil && !r.expiryDate && "—"}
                      </td>
                      <td className="p-2 text-xs">
                        {r.attachStored ? (
                          <a
                            href={`/api/consumable-receipts/${r.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-700 hover:underline"
                            title={r.attachName ?? ""}
                          >
                            📎 Xem bản gốc
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {nhomGhiDuoc.includes(r.product.category) && (
                          <ConsumableReceiptDeleteButton
                            id={r.id}
                            docNo={r.docNo}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Nhật ký giao dịch ────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-xl font-semibold text-blue-950">
          Nhật ký giao dịch gần đây
        </h3>
        <div className="overflow-x-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có giao dịch nào.</p>
          ) : (
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">Thời điểm</th>
                  <th className="p-2">Loại</th>
                  <th className="p-2">Mặt hàng</th>
                  <th className="p-2">Nơi tiêu thụ</th>
                  <th className="p-2 text-right">Số lượng</th>
                  <th className="p-2">Người ghi</th>
                  <th className="p-2">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {transactions.filter((t) => hopNhom(t.product.category)).map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="p-2 whitespace-nowrap">{gio(t.occurredAt)}</td>
                    <td className="p-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          t.type === "IN"
                            ? "bg-emerald-100 text-emerald-800"
                            : t.type === "CONSUME"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {TRANSACTION_LABEL[t.type] ?? t.type}
                      </span>
                    </td>
                    <td className="p-2">{t.product.name}</td>
                    <td className="p-2 text-slate-600">
                      {t.consumer ? (CONSUMER_LABEL[t.consumer] ?? t.consumer) : "—"}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {t.type === "IN" ? "+" : "−"}
                      {t.quantity} {t.product.uom}
                    </td>
                    <td className="p-2 text-slate-600">{t.performedBy ?? "—"}</td>
                    <td className="p-2 text-slate-600">{t.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Nhóm bạn được ghi trên tàu này:{" "}
        {nhomGhiDuoc.length
          ? nhomGhiDuoc.map((c) => CATEGORY_LABEL[c]).join(" · ")
          : "không có"}
        .
      </p>
    </div>
  );
}
