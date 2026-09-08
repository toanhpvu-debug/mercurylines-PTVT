import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireScopedUser,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import {
  XIN_CAP_NHIEN_LIEU,
  boPhanCuaChucDanh,
  danhTinhHieuLuc,
  nguoiDuyetCapTau,
  nhomNhienLieuChoPhep,
  nhomXinCapChoPhep,
  trinhThangLenCongTy,
} from "@/lib/roles";
import {
  CATEGORY_ICON,
  CATEGORY_VALUES,
  CONSUMABLE_CATEGORIES,
  GIOI_HAN_LUU_HUYNH,
  NGUONG_CANH_BAO_HAN_DUNG,
  kiemTraLuuHuynh,
  soNgayToi,
} from "@/lib/consumables";
import { layT } from "@/lib/i18n/server";
import type { HamDichTuDo } from "@/lib/i18n";
import {
  ConsumableMinForm,
  ConsumableMoveForm,
  ConsumableReceiptForm,
} from "@/components/ConsumableForms";
import ConsumableReceiptDeleteButton from "@/components/ConsumableReceiptDeleteButton";
import ConsumableRequestForm from "@/components/ConsumableRequestForm";
import VesselSwitcher from "@/components/VesselSwitcher";

// Băng tin hạn dùng nối mọi lô vào MỘT dòng chữ, nên phải có trần hiển thị:
// không có nó thì một tàu tồn nhiều lô quá hạn sẽ đẩy ra một dòng dài vô tận,
// người đọc cuộn qua rồi bỏ — cảnh báo dài quá hoá ra không cảnh báo được ai.
const SO_LO_HIEN_TREN_BANG_TIN = 10;

export const dynamic = "force-dynamic";

function nhanMatHang(
  p: {
    name: string;
    maker: string | null;
    grade: string;
  },
  tTuDo: HamDichTuDo
) {
  const bits = [p.name];
  if (p.maker) bits.push(p.maker);
  bits.push(tTuDo(`consumables.loai_${p.grade}`));
  return bits.join(" · ");
}

export default async function ConsumableVesselPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nhom?: string }>;
}) {
  const user = await requireScopedUser();
  const { t, tTuDo, ngay, ngayGio } = await layT();
  const scope = vesselScopeDayDu(user);
  const { id } = await params;
  const vesselId = Number(id);
  if (!Number.isInteger(vesselId) || vesselId <= 0) notFound();
  if (!trongPhamVi(scope, vesselId)) notFound();

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

  // Ai được bấm "Xem bản gốc" (BDN scan) trong bảng lịch sử phiếu nhận.
  //
  // Phải soi ĐÚNG cổng của GET /api/consumable-receipts/[id]/file, không hơn
  // không kém. Trang này chỉ đòi trongPhamVi() nên phó 2, phó 3 và thủy thủ vào
  // xem được; trước đây link hiện vô điều kiện theo r.attachStored nên họ bấm
  // vào là mở tab mới hiện JSON 401 — tệ hơn nữa là thông điệp cũ nói "chưa
  // đăng nhập" khiến họ tưởng phiên hết hạn.
  //
  // Không dùng nhomXinDuoc ở đây: danh sách đó suy từ XIN_CAP_NHIEN_LIEU, mà
  // route còn cho thêm TECH_MANAGER — quản lý kỹ thuật ở bờ chính là người có
  // nghiệp vụ đối chiếu bunker với bản gốc, giấu link của họ là lệch ngược lại.
  // Phần phạm vi tàu không cần hỏi lại: xuống được tới đây nghĩa là trongPhamVi
  // ở đầu hàm đã đúng, mà đó cũng là điều kiện route xét.
  const coXemBanGoc = danhTinhHieuLuc(user).some(
    (d) => XIN_CAP_NHIEN_LIEU.includes(d.role) || d.role === "TECH_MANAGER"
  );

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

  // Cảnh báo hạn dùng và mẫu dầu KHÔNG được suy từ mảng receipts bên dưới: mảng
  // đó lấy 50 phiếu MỚI NHẤT cho bảng lịch sử, mà lô sắp hết hạn và mẫu tới hạn
  // hủy luôn là những lô CŨ NHẤT — đúng nhóm bị take:50 cắt đi trước tiên. Hệ
  // quả cũ: trang tổng /consumables đếm 8 lô sắp hết hạn, mở trang chi tiết
  // đúng tàu đó thì khối cảnh báo trống trơn.
  const hanCanhBao = new Date();
  hanCanhBao.setDate(hanCanhBao.getDate() + NGUONG_CANH_BAO_HAN_DUNG);
  const bayGio = new Date();

  const [
    products,
    stocks,
    receipts,
    transactions,
    tieuThu30,
    loSapHetHan,
    mauQuaHanLuu,
    mauConLuu,
  ] = await Promise.all([
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
    // lte đã tự loại NULL nên không cần thêm not: null.
    // Sắp GIẢM dần chứ không tăng: trong số các lô đã dưới ngưỡng cảnh báo, 50 lô
    // có hạn MUỘN nhất mới là nhóm cần hành động. Sắp tăng dần thì một tàu chạy
    // vài năm có hàng chục lô quá hạn từ lâu sẽ nuốt sạch cửa sổ 50, và mấy lô
    // sắp hết hạn — đúng thứ cần cảnh báo — bị cắt sạch chứ không phải ngẫu nhiên.
    prisma.consumableReceipt.findMany({
      where: { vesselId, expiryDate: { lte: hanCanhBao } },
      include: { product: true },
      orderBy: { expiryDate: "desc" },
      take: 50,
    }),
    prisma.consumableReceipt.findMany({
      where: { vesselId, sampleKeepUntil: { lt: bayGio } },
      include: { product: true },
      orderBy: { sampleKeepUntil: "asc" },
      take: 10,
    }),
    prisma.consumableReceipt.findMany({
      where: { vesselId, sampleKeepUntil: { gte: bayGio } },
      include: { product: true },
      orderBy: { sampleKeepUntil: "asc" },
      take: 15,
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
      label: `${CATEGORY_ICON[p.category] ?? ""} ${nhanMatHang(p, tTuDo)}`,
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
        label: nhanMatHang(p, tTuDo),
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
    : tTuDo(
        `labels.role_${nguoiDuyetCapTau(boPhanCuaChucDanh(user.role) ?? "ENGINE")}`
      );

  // Cảnh báo gom một chỗ: dưới định mức, lô sắp/đã hết hạn, mẫu dầu hết hạn giữ.
  // Cảnh báo phải theo ĐÚNG TAB đang xem: đứng ở tab Dầu nhờn mà vẫn hiện hạn
  // dùng của hóa chất thì tab chẳng còn nghĩa gì.
  const duoiDinhMuc = stocks.filter(
    (s) =>
      hopNhom(s.product.category) && s.minQty > 0 && s.quantity < s.minQty
  );
  // Tính lại `con` bằng soNgayToi để không lệch một ngày so với mốc hanCanhBao
  // (soNgayToi làm tròn lên), và vẫn lọc lại theo ngưỡng cho chắc.
  const loHetHan = loSapHetHan
    .filter((r) => hopNhom(r.product.category))
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

  const mauHetHanGiu = mauQuaHanLuu.filter((r) =>
    hopNhom(r.product.category)
  );

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

  const mauDangGiu = mauConLuu.filter((r) => hopNhom(r.product.category));

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
            ← {t("consumables.quayLaiTongQuan")}
          </Link>
          <h2 className="text-2xl font-bold text-blue-950">
            {vessel.code} — {vessel.name}
          </h2>
          <p className="text-slate-600">{t("consumables.moTaTau")}</p>
        </div>
        {!coTheGhi && (
          <p className="rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-600">
            {t("consumables.chiXemKhongGhi")}
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
          {t("chung.tatCa")}
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
              {c.icon} {tTuDo(`consumables.nhom_${c.value}`)}
              {!ghiDuoc && (
                <span className="ml-1 text-xs opacity-70">
                  {t("consumables.chiXemNgoac")}
                </span>
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
              <b>
                {t("consumables.canhBaoDuoiDinhMuc", {
                  n: duoiDinhMuc.length,
                })}
              </b>{" "}
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
              <b>{t("consumables.canhBaoSapHet")}</b>{" "}
              {sapHetTheoTocDo
                .map(({ s, ngay: conNgay }) =>
                  t("consumables.dongSapHet", {
                    ten: s.product.name,
                    n: conNgay ?? 0,
                    sl: s.quantity,
                    dv: s.product.uom,
                  })
                )
                .join(" · ")}
            </div>
          )}
          {loHetHan.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              <b>{t("consumables.nhanHanDung")}</b>{" "}
              {loHetHan
                .slice(0, SO_LO_HIEN_TREN_BANG_TIN)
                .map(({ r, con }) =>
                  t("consumables.dongLoHetHan", {
                    ten: r.product.name,
                    so: r.docNo,
                    tinhTrang:
                      con < 0
                        ? t("consumables.quaHanNNgay", { n: -con })
                        : t("consumables.conNNgay", { n: con }),
                  })
                )
                .join(" · ")}
              {loHetHan.length > SO_LO_HIEN_TREN_BANG_TIN &&
                ` · ${t("consumables.vaNLoKhac", {
                  n: loHetHan.length - SO_LO_HIEN_TREN_BANG_TIN,
                })}`}
            </div>
          )}
          {mauHetHanGiu.length > 0 && (
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
              <b>{t("consumables.mauQuaMocDam")}</b>{" "}
              {t("consumables.mauQuaMocSau")}{" "}
              {mauHetHanGiu
                .map(
                  (r) =>
                    `${r.docNo}${
                      r.sampleSealNo
                        ? ` (${t("consumables.niemSo", {
                            so: r.sampleSealNo,
                          })})`
                        : ""
                    }`
                )
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
              {c.icon} {tTuDo(`consumables.nhom_${c.value}`)} —{" "}
              {t("consumables.tongHop")}
            </h3>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
                <h4 className="mb-2 text-sm font-semibold text-slate-700">
                  {t("consumables.tonTheoChungLoai")}
                </h4>
                {ton.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    {t("consumables.chuaCoTon")}
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {ton.map(([grade, v]) => (
                      <li key={grade} className="flex justify-between gap-3">
                        <span className="text-slate-700">
                          {tTuDo(`consumables.loai_${grade}`)}
                          <span className="text-slate-400">
                            {" "}
                            · {t("consumables.nMatHang", { n: v.soMat })}
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
                          {t("consumables.theoGioiHanLuuHuynh")}
                        </p>
                        <p className="text-emerald-700">
                          {t("consumables.dungTrongEca", {
                            s: GIOI_HAN_LUU_HUYNH.ECA,
                          })}{" "}
                          <b>
                            {Math.round(lh.dungEca * 1000) / 1000} {lh.uom}
                          </b>
                        </p>
                        <p className="text-amber-800">
                          {t("consumables.chiNgoaiEca", {
                            s: GIOI_HAN_LUU_HUYNH.ECA,
                          })}{" "}
                          <b>
                            {Math.round(lh.ngoaiEca * 1000) / 1000} {lh.uom}
                          </b>
                        </p>
                        {lh.chuaKhai > 0 && (
                          <p className="text-slate-500">
                            {t("consumables.chuaKhaiLuuHuynh")}{" "}
                            <b>
                              {Math.round(lh.chuaKhai * 1000) / 1000} {lh.uom}
                            </b>{" "}
                            {t("consumables.chuaXepNhom")}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                          {t("consumables.ghiChuLuuHuynhDanhNghia")}
                        </p>
                      </div>
                    );
                  })()}
              </div>

              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
                <h4 className="mb-2 text-sm font-semibold text-slate-700">
                  {t("consumables.tieuThu30Ngay")}
                </h4>
                {tt.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    {t("consumables.chuaCoTieuThu30")}
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {tt.map(([noi, v]) => (
                      <li key={noi} className="flex justify-between gap-3">
                        <span className="text-slate-700">
                          {tTuDo(`consumables.noiTieuThu_${noi}`)}
                        </span>
                        <span className="font-semibold text-blue-950">
                          {Math.round(v.tong * 1000) / 1000} {v.uom}
                        </span>
                      </li>
                    ))}
                    <li className="flex justify-between gap-3 border-t pt-1">
                      <span className="font-medium text-slate-700">
                        {t("consumables.tong")}
                      </span>
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
        <h3 className="text-xl font-semibold text-blue-950">
          {t("consumables.tonTrenTau")}
        </h3>
        {theoNhom.length === 0 ? (
          <p className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-blue-100">
            {t("consumables.chuaCoSoLieu")}
          </p>
        ) : (
          theoNhom.map((nhom) => (
            <div
              key={nhom.value}
              className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100"
            >
              <h4 className="mb-2 font-semibold text-blue-950">
                {nhom.icon} {tTuDo(`consumables.nhom_${nhom.value}`)}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full border text-sm">
                  <thead>
                    <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                      <th className="p-2">{t("chung.ma")}</th>
                      <th className="p-2">{t("consumables.matHang")}</th>
                      <th className="p-2">{t("consumables.chungLoai")}</th>
                      <th className="p-2 text-right">{t("consumables.ton")}</th>
                      <th className="p-2 text-right">
                        {t("consumables.dungMoiNgay")}
                      </th>
                      <th className="p-2 text-right">
                        {t("consumables.conDungDuoc")}
                      </th>
                      <th className="p-2 text-right">
                        {t("consumables.dinhMuc")}
                      </th>
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
                                {t("consumables.badgeThieu")}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-slate-600">
                            {tTuDo(`consumables.loai_${s.product.grade}`)}
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
                                    {t("consumables.chuaCoTieuThu")}
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
                                  {t("consumables.nNgay", { n: ng })}
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
            {t("consumables.tieuDeGhiPhieu")}
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
            {t("consumables.tieuDeGhiTieuThu")}
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
            {t("consumables.tieuDeXinCap")}
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
            {t("consumables.tieuDeMauDau")}
          </h3>
          <div className="overflow-x-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
            <p className="mb-2 text-sm text-slate-600">
              {t("consumables.moTaMauDau")}
            </p>
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">{t("consumables.soBdn")}</th>
                  <th className="p-2">{t("consumables.cotNgayGiao")}</th>
                  <th className="p-2">{t("consumables.matHang")}</th>
                  <th className="p-2">{t("consumables.cotSoNiem")}</th>
                  <th className="p-2">{t("consumables.cotGiuToi")}</th>
                  <th className="p-2 text-right">{t("consumables.cotCon")}</th>
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
                          <span className="text-amber-700">
                            {t("consumables.chuaGhiSoNiem")}
                          </span>
                        )}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {ngay(r.sampleKeepUntil!)}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap text-slate-600">
                        {t("consumables.nNgay", { n: con })}
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
            {t("consumables.tieuDeAnToanHoaChat")}
          </h3>
          <div className="overflow-x-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">{t("chung.ma")}</th>
                  <th className="p-2">{t("consumables.cotHoaChat")}</th>
                  <th className="p-2">
                    {t("consumables.cotPhanLoaiNguyHiem")}
                  </th>
                  <th className="p-2">{t("consumables.cotHanDung")}</th>
                  <th className="p-2">{t("consumables.ghiChuAnToan")}</th>
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
                        ? t("consumables.nThangTuNgayNhan", {
                            n: p.shelfLifeMonths,
                          })
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
          {t("consumables.tieuDePhieuGanDay")}
        </h3>
        <div className="overflow-x-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
          {receipts.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("consumables.chuaCoPhieu")}
            </p>
          ) : (
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">{t("consumables.cotSoChungTu")}</th>
                  <th className="p-2">{t("chung.ngay")}</th>
                  <th className="p-2">{t("consumables.matHang")}</th>
                  <th className="p-2 text-right">{t("chung.soLuong")}</th>
                  <th className="p-2">{t("consumables.cotCangNcc")}</th>
                  <th className="p-2">{t("consumables.cotDacTinh")}</th>
                  <th className="p-2">{t("consumables.cotMauHanDung")}</th>
                  <th className="p-2">{t("consumables.cotBanGoc")}</th>
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
                            {t("consumables.mauToi", {
                              ngay: ngay(r.sampleKeepUntil),
                            })}
                            {r.sampleSealNo
                              ? ` · ${t("consumables.niemSo", {
                                  so: r.sampleSealNo,
                                })}`
                              : ""}
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
                            {t("consumables.hanDungNgan", {
                              ngay: ngay(r.expiryDate),
                            })}
                          </span>
                        )}
                        {!r.sampleKeepUntil && !r.expiryDate && "—"}
                      </td>
                      <td className="p-2 text-xs">
                        {r.attachStored && coXemBanGoc ? (
                          <a
                            href={`/api/consumable-receipts/${r.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-700 hover:underline"
                            title={r.attachName ?? ""}
                          >
                            {t("consumables.xemBanGoc")}
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
          {t("consumables.tieuDeNhatKy")}
        </h3>
        <div className="overflow-x-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("consumables.chuaCoGiaoDich")}
            </p>
          ) : (
            <table className="w-full border text-sm">
              <thead>
                <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                  <th className="p-2">{t("consumables.cotThoiDiem")}</th>
                  <th className="p-2">{t("consumables.cotLoai")}</th>
                  <th className="p-2">{t("consumables.matHang")}</th>
                  <th className="p-2">{t("consumables.noiTieuThu")}</th>
                  <th className="p-2 text-right">{t("chung.soLuong")}</th>
                  <th className="p-2">{t("consumables.cotNguoiGhi")}</th>
                  <th className="p-2">{t("chung.ghiChu")}</th>
                </tr>
              </thead>
              <tbody>
                {transactions
                  .filter((tx) => hopNhom(tx.product.category))
                  .map((tx) => (
                  <tr key={tx.id} className="border-b">
                    <td className="p-2 whitespace-nowrap">
                      {ngayGio(tx.occurredAt)}
                    </td>
                    <td className="p-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          tx.type === "IN"
                            ? "bg-emerald-100 text-emerald-800"
                            : tx.type === "CONSUME"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {tTuDo(`consumables.giaoDich_${tx.type}`)}
                      </span>
                    </td>
                    <td className="p-2">{tx.product.name}</td>
                    <td className="p-2 text-slate-600">
                      {tx.consumer
                        ? tTuDo(`consumables.noiTieuThu_${tx.consumer}`)
                        : "—"}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {tx.type === "IN" ? "+" : "−"}
                      {tx.quantity} {tx.product.uom}
                    </td>
                    <td className="p-2 text-slate-600">
                      {tx.performedBy ?? "—"}
                    </td>
                    <td className="p-2 text-slate-600">{tx.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <p className="text-xs text-slate-500">
        {t("consumables.quyenTrenTauTruoc")}{" "}
        <b>{t("consumables.quyenGhiDam")}</b> {t("consumables.quyenGhiSau")}{" "}
        {nhomGhiDuoc.length
          ? nhomGhiDuoc
              .map((c) => tTuDo(`consumables.nhom_${c}`))
              .join(" · ")
          : t("consumables.khongNhomNao")}
        . <b>{t("consumables.quyenXinDam")}</b>{" "}
        {t("consumables.quyenXinSau")}{" "}
        {nhomXinDuoc.length
          ? nhomXinDuoc
              .map((c) => tTuDo(`consumables.nhom_${c}`))
              .join(" · ")
          : t("consumables.khongNhomNao")}
        .
      </p>
    </div>
  );
}
