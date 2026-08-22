import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselScope } from "@/lib/auth";
import {
  ROLE_LABEL,
  boPhanCuaChucDanh,
  nguoiDuyetCapTau,
  nhomNhienLieuChoPhep,
  nhomXinCapChoPhep,
  trinhThangLenCongTy,
} from "@/lib/roles";
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  CATEGORY_VALUES,
  CONSUMABLE_CATEGORIES,
  CONSUMER_LABEL,
  GIOI_HAN_LUU_HUYNH,
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
import ConsumableRequestForm from "@/components/ConsumableRequestForm";
import VesselSwitcher from "@/components/VesselSwitcher";

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
  // Quyền XIN CẤP rộng hơn quyền ghi: sĩ quan máy xin được dầu nhưng không ghi
  // được phiếu bunker. Không tách thì hoặc Máy 3 ghi được BDN, hoặc Máy 3 không
  // xin được dầu — cả hai đều sai.
  const nhomXinDuoc = nhomXinCapChoPhep(user, vesselId);
  const coTheXinCap = nhomXinDuoc.length > 0;

  // Tách hẳn ba nhóm: dầu đốt, dầu nhờn và hóa chất là ba nghiệp vụ khác nhau,
  // do người khác nhau phụ trách và có chứng từ khác nhau. Xem lẫn cả ba trong
  // một danh sách thì máy trưởng phải lọc mắt qua hóa chất tẩy rửa mới thấy
  // được lô dầu của mình.
  const { nhom: nhomRaw } = await searchParams;
  const nhomChon =
    nhomRaw && CATEGORY_VALUES.includes(nhomRaw) ? nhomRaw : null;
  const hopNhom = (c: string) => nhomChon === null || c === nhomChon;

  // Mốc 30 ngày cho phần tổng hợp tiêu thụ. Số ghi ở cột "nơi tiêu thụ" của
  // từng giao dịch chỉ có ích khi được cộng lại theo M/E · A/E · nồi hơi —
  // trước đây ghi vào rồi không tổng hợp ở đâu cả.
  const moc30Ngay = new Date();
  moc30Ngay.setDate(moc30Ngay.getDate() - 30);

  const [products, stocks, receipts, transactions, tieuThu30] = await Promise.all([
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
    prisma.consumableTransaction.groupBy({
      by: ["productId", "consumer"],
      where: { vesselId, type: "CONSUME", occurredAt: { gte: moc30Ngay } },
      _sum: { quantity: true },
    }),
  ]);

  /**
   * Tốc độ tiêu thụ mỗi ngày của một mặt hàng, tính trên 30 ngày gần nhất.
   *
   * Đây là con số biến định mức tĩnh thành cảnh báo có nghĩa: "còn 320 MT" tự
   * nó không nói được gì, "còn 320 MT, dùng hết trong 103 ngày" thì nói được.
   * Chưa có tiêu thụ nào thì trả 0 — không suy diễn từ dữ liệu không có.
   */
  const tieuThuMoiNgay = (productId: number) => {
    let tong = 0;
    for (const g of tieuThu30) {
      if (g.productId === productId) tong += Number(g._sum.quantity ?? 0);
    }
    return tong / 30;
  };

  /** Số ngày còn dùng được theo tốc độ hiện tại; null khi chưa có tiêu thụ. */
  const soNgayConDung = (productId: number, ton: number) => {
    const moiNgay = tieuThuMoiNgay(productId);
    if (moiNgay <= 0) return null;
    return Math.floor(ton / moiNgay);
  };

  /** Dưới ngưỡng này thì coi là sắp hết, không cần chờ chạm định mức. */
  const NGUONG_NGAY_SAP_HET = 30;

  const optionsChoNhom = products
    .filter((p) => nhomGhiDuoc.includes(p.category) && hopNhom(p.category))
    .map((p) => ({
      id: p.id,
      label: `${CATEGORY_ICON[p.category] ?? ""} ${nhanMatHang(p)}`,
      uom: p.uom,
      category: p.category,
      shelfLifeMonths: p.shelfLifeMonths,
    }));

  // Dòng cho bảng xin cấp: mọi mặt hàng thuộc nhóm người này phụ trách, kèm tồn
  // và định mức của tàu. Mặt hàng chưa từng nhận thì chưa có bản ghi tồn nên coi
  // như 0 — vẫn phải xin được, đó chính là lúc cần xin nhất.
  const dongXinCap = products
    .filter((p) => nhomXinDuoc.includes(p.category) && hopNhom(p.category))
    .map((p) => {
      const st = stocks.find((x) => x.productId === p.id);
      return {
        productId: p.id,
        label: nhanMatHang(p),
        uom: p.uom,
        category: p.category,
        ton: st?.quantity ?? 0,
        minQty: st?.minQty ?? 0,
        moiNgay: tieuThuMoiNgay(p.id),
      };
    });
  // Ai ký ở cấp tàu cho yêu cầu do NGƯỜI NÀY lập. Thuyền trưởng / quản trị thì
  // không còn ai trên mình nên đi thẳng lên công ty.
  const nguoiDuyetCuaToi = trinhThangLenCongTy(user.role)
    ? null
    : (ROLE_LABEL[
        nguoiDuyetCapTau(boPhanCuaChucDanh(user.role) ?? "ENGINE")
      ] ?? null);

  // Cảnh báo gom một chỗ: dưới định mức, lô sắp/đã hết hạn, mẫu dầu hết hạn giữ.
  // Cảnh báo phải theo ĐÚNG TAB đang xem: đứng ở tab Dầu nhờn mà vẫn hiện hạn
  // dùng của hóa chất thì tab chẳng còn nghĩa gì.
  const duoiDinhMuc = stocks.filter(
    (s) =>
      hopNhom(s.product.category) && s.minQty > 0 && s.quantity < s.minQty
  );
  const loHetHan = receipts
    .filter((r) => hopNhom(r.product.category) && r.expiryDate)
    .map((r) => ({ r, con: soNgayToi(r.expiryDate)! }))
    .filter((x) => x.con <= NGUONG_CANH_BAO_HAN_DUNG)
    .sort((a, b) => a.con - b.con);
  // Sắp hết theo TỐC ĐỘ THẬT, không chỉ theo định mức tĩnh. Một mặt hàng vẫn
  // trên định mức nhưng tiêu thụ nhanh thì vẫn hết trước khi kịp mua.
  const sapHetTheoTocDo = stocks
    .filter((s) => hopNhom(s.product.category))
    .map((s) => ({ s, ngay: soNgayConDung(s.productId, s.quantity) }))
    .filter((x) => x.ngay !== null && x.ngay < NGUONG_NGAY_SAP_HET)
    .sort((a, b) => a.ngay! - b.ngay!);

  const mauHetHanGiu = receipts
    .filter(
      (r) =>
        hopNhom(r.product.category) &&
        r.sampleKeepUntil &&
        soNgayToi(r.sampleKeepUntil)! < 0
    )
    .slice(0, 10);

  // ── Tổng hợp riêng cho từng nhóm ──────────────────────────────────────────
  const theoId = new Map(products.map((p) => [p.id, p]));

  /** Tồn cộng theo chủng loại trong một nhóm (HFO/VLSFO/… hay CYL/SYS/…). */
  const tonTheoChungLoai = (category: string) => {
    const gom = new Map<string, { tong: number; uom: string; soMat: number }>();
    for (const st of stocks) {
      if (st.product.category !== category) continue;
      const cu = gom.get(st.product.grade);
      if (cu) {
        cu.tong += st.quantity;
        cu.soMat += 1;
      } else {
        gom.set(st.product.grade, {
          tong: st.quantity,
          uom: st.product.uom,
          soMat: 1,
        });
      }
    }
    return [...gom.entries()].sort((a, b) => b[1].tong - a[1].tong);
  };

  /** Tiêu thụ 30 ngày cộng theo nơi tiêu thụ, trong một nhóm. */
  const tieuThuTheoNoi = (category: string) => {
    const gom = new Map<string, { tong: number; uom: string }>();
    for (const g of tieuThu30) {
      const p = theoId.get(g.productId);
      if (!p || p.category !== category) continue;
      const noi = g.consumer ?? "OTHER";
      const cu = gom.get(noi);
      const them = Number(g._sum.quantity ?? 0);
      if (cu) cu.tong += them;
      else gom.set(noi, { tong: them, uom: p.uom });
    }
    return [...gom.entries()].sort((a, b) => b[1].tong - a[1].tong);
  };

  /**
   * Tồn dầu đốt chia theo giới hạn lưu huỳnh MARPOL.
   *
   * Tính theo lưu huỳnh DANH NGHĨA khai ở danh mục, không theo từng lô: dầu
   * nhiều lô nằm chung két nên không quy được tồn về đúng lô nào. Mặt hàng
   * chưa khai lưu huỳnh thì xếp riêng — không đoán là đạt.
   */
  const tonTheoLuuHuynh = () => {
    let dungEca = 0;
    let ngoaiEca = 0;
    let chuaKhai = 0;
    let uom = "MT";
    for (const st of stocks) {
      if (st.product.category !== "FUEL") continue;
      uom = st.product.uom;
      const s = st.product.sulphurMax;
      if (s === null) chuaKhai += st.quantity;
      else if (s <= GIOI_HAN_LUU_HUYNH.ECA) dungEca += st.quantity;
      else ngoaiEca += st.quantity;
    }
    return { dungEca, ngoaiEca, chuaKhai, uom };
  };

  const mauDangGiu = receipts
    .filter(
      (r) => r.sampleKeepUntil && soNgayToi(r.sampleKeepUntil)! >= 0
    )
    .slice(0, 15);

  const hoaChatNguyHiem = products.filter(
    (p) => p.category === "CHEMICAL" && (p.hazardClass || p.msdsNote)
  );

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

      {/* Giữ nguyên tab nhóm đang xem khi nhảy sang tàu khác — đang so tồn dầu
          giữa các tàu mà mỗi lần bấm lại về "Tất cả" thì phải chọn lại. */}
      <VesselSwitcher
        hienTai={vesselId}
        duongDan={(id) =>
          nhomChon ? `/consumables/${id}?nhom=${nhomChon}` : `/consumables/${id}`
        }
      />

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
        sapHetTheoTocDo.length > 0 ||
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
          {sapHetTheoTocDo.length > 0 && (
            <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">
              <b>Sắp hết theo tốc độ tiêu thụ 30 ngày qua:</b>{" "}
              {sapHetTheoTocDo
                .map(
                  ({ s, ngay }) =>
                    `${s.product.name} còn ${ngay} ngày (${s.quantity} ${s.product.uom})`
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

      {/* ── Tóm tắt theo nhóm ────────────────────────────────────────── */}
      {CONSUMABLE_CATEGORIES.filter((c) => hopNhom(c.value)).map((c) => {
        const ton = tonTheoChungLoai(c.value);
        const tt = tieuThuTheoNoi(c.value);
        if (ton.length === 0 && tt.length === 0) return null;
        return (
          <section key={`tt-${c.value}`} className="space-y-3">
            <h3 className="text-xl font-semibold text-blue-950">
              {c.icon} {c.label} — tổng hợp
            </h3>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
                <h4 className="mb-2 text-sm font-semibold text-slate-700">
                  Tồn theo chủng loại
                </h4>
                {ton.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có tồn.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {ton.map(([grade, v]) => (
                      <li key={grade} className="flex justify-between gap-3">
                        <span className="text-slate-700">
                          {GRADE_LABEL[grade] ?? grade}
                          <span className="text-slate-400">
                            {" "}
                            · {v.soMat} mặt hàng
                          </span>
                        </span>
                        <span className="font-semibold text-blue-950">
                          {Math.round(v.tong * 1000) / 1000} {v.uom}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Dầu đốt: câu hỏi quan trọng nhất trước khi vào vùng ECA là
                    "còn bao nhiêu dầu dùng được trong ECA". */}
                {c.value === "FUEL" &&
                  (() => {
                    const lh = tonTheoLuuHuynh();
                    const tong = lh.dungEca + lh.ngoaiEca + lh.chuaKhai;
                    if (tong === 0) return null;
                    return (
                      <div className="mt-3 border-t pt-3 text-sm">
                        <p className="mb-1 font-semibold text-slate-700">
                          Theo giới hạn lưu huỳnh (MARPOL VI Reg 14)
                        </p>
                        <p className="text-emerald-700">
                          Dùng được trong ECA (≤{GIOI_HAN_LUU_HUYNH.ECA}%):{" "}
                          <b>
                            {Math.round(lh.dungEca * 1000) / 1000} {lh.uom}
                          </b>
                        </p>
                        <p className="text-amber-800">
                          Chỉ ngoài ECA (&gt;{GIOI_HAN_LUU_HUYNH.ECA}%):{" "}
                          <b>
                            {Math.round(lh.ngoaiEca * 1000) / 1000} {lh.uom}
                          </b>
                        </p>
                        {lh.chuaKhai > 0 && (
                          <p className="text-slate-500">
                            Chưa khai lưu huỳnh ở danh mục:{" "}
                            <b>
                              {Math.round(lh.chuaKhai * 1000) / 1000} {lh.uom}
                            </b>{" "}
                            — chưa xếp được vào nhóm nào.
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                          Tính theo lưu huỳnh danh nghĩa khai ở danh mục, không
                          theo từng lô: nhiều lô nằm chung két nên không quy tồn
                          về đúng lô được.
                        </p>
                      </div>
                    );
                  })()}
              </div>

              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
                <h4 className="mb-2 text-sm font-semibold text-slate-700">
                  Tiêu thụ 30 ngày gần nhất — theo nơi tiêu thụ
                </h4>
                {tt.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Chưa ghi tiêu thụ nào trong 30 ngày.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {tt.map(([noi, v]) => (
                      <li key={noi} className="flex justify-between gap-3">
                        <span className="text-slate-700">
                          {CONSUMER_LABEL[noi] ?? noi}
                        </span>
                        <span className="font-semibold text-blue-950">
                          {Math.round(v.tong * 1000) / 1000} {v.uom}
                        </span>
                      </li>
                    ))}
                    <li className="flex justify-between gap-3 border-t pt-1">
                      <span className="font-medium text-slate-700">Tổng</span>
                      <span className="font-bold text-blue-950">
                        {Math.round(
                          tt.reduce((a, [, v]) => a + v.tong, 0) * 1000
                        ) / 1000}{" "}
                        {tt[0][1].uom}
                      </span>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </section>
        );
      })}

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
                      <th className="p-2 text-right">Dùng/ngày</th>
                      <th className="p-2 text-right">Còn dùng được</th>
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
                          <td className="p-2 text-right text-slate-600">
                            {(() => {
                              const md = tieuThuMoiNgay(s.productId);
                              return md > 0 ? Math.round(md * 100) / 100 : "—";
                            })()}
                          </td>
                          <td className="p-2 text-right">
                            {(() => {
                              const ng = soNgayConDung(s.productId, s.quantity);
                              if (ng === null)
                                return (
                                  <span className="text-slate-400">
                                    chưa có tiêu thụ
                                  </span>
                                );
                              return (
                                <span
                                  className={
                                    ng < NGUONG_NGAY_SAP_HET
                                      ? "font-semibold text-orange-700"
                                      : "text-slate-700"
                                  }
                                >
                                  {ng} ngày
                                </span>
                              );
                            })()}
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

      {/* ── Yêu cầu cấp ──────────────────────────────────────────────── */}
      {coTheXinCap && (
        <section className="space-y-3">
          <h3 className="text-xl font-semibold text-blue-950">
            Yêu cầu cấp — gửi lên phê duyệt
          </h3>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
            <ConsumableRequestForm
              vesselId={vesselId}
              lines={dongXinCap}
              nguoiDuyet={nguoiDuyetCuaToi}
            />
          </div>
        </section>
      )}

      {/* ── Mẫu dầu đang giữ (chỉ có nghĩa với dầu đốt) ──────────────── */}
      {hopNhom("FUEL") && mauDangGiu.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xl font-semibold text-blue-950">
            Mẫu dầu đang giữ trên tàu
          </h3>
          <div className="overflow-x-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
            <p className="mb-2 text-sm text-slate-600">
              MARPOL Annex VI Reg 18.8.1 — mẫu đại diện phải giữ tới khi dùng hết
              lô và ít nhất 12 tháng kể từ ngày giao. Kiểm tra của cảng (PSC) hỏi
              là phải đưa ra được ngay.
            </p>
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">Số BDN</th>
                  <th className="p-2">Ngày giao</th>
                  <th className="p-2">Mặt hàng</th>
                  <th className="p-2">Số niêm</th>
                  <th className="p-2">Giữ tới</th>
                  <th className="p-2 text-right">Còn</th>
                </tr>
              </thead>
              <tbody>
                {mauDangGiu.map((r) => {
                  const con = soNgayToi(r.sampleKeepUntil)!;
                  return (
                    <tr key={r.id} className="border-b">
                      <td className="p-2 font-medium">{r.docNo}</td>
                      <td className="p-2 whitespace-nowrap">
                        {ngay(r.receivedAt)}
                      </td>
                      <td className="p-2">{r.product.name}</td>
                      <td className="p-2 font-mono text-xs">
                        {r.sampleSealNo ?? (
                          <span className="text-amber-700">chưa ghi số niêm</span>
                        )}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {ngay(r.sampleKeepUntil!)}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap text-slate-600">
                        {con} ngày
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── An toàn hóa chất ─────────────────────────────────────────── */}
      {hopNhom("CHEMICAL") && hoaChatNguyHiem.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xl font-semibold text-blue-950">
            An toàn hóa chất
          </h3>
          <div className="overflow-x-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">Mã</th>
                  <th className="p-2">Hóa chất</th>
                  <th className="p-2">Phân loại nguy hiểm</th>
                  <th className="p-2">Hạn dùng</th>
                  <th className="p-2">Ghi chú an toàn / nơi lưu MSDS</th>
                </tr>
              </thead>
              <tbody>
                {hoaChatNguyHiem.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-2 font-mono text-xs">{p.code}</td>
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">
                      {p.hazardClass ? (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
                          {p.hazardClass}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-2 text-slate-600">
                      {p.shelfLifeMonths
                        ? `${p.shelfLifeMonths} tháng kể từ ngày nhận`
                        : "—"}
                    </td>
                    <td className="p-2 text-slate-600">{p.msdsNote ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        Trên tàu này bạn <b>ghi nghiệp vụ</b> được:{" "}
        {nhomGhiDuoc.length
          ? nhomGhiDuoc.map((c) => CATEGORY_LABEL[c]).join(" · ")
          : "không nhóm nào"}
        . <b>Xin cấp</b> được:{" "}
        {nhomXinDuoc.length
          ? nhomXinDuoc.map((c) => CATEGORY_LABEL[c]).join(" · ")
          : "không nhóm nào"}
        .
      </p>
    </div>
  );
}
