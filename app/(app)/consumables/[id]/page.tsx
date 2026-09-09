import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Boxes,
  ChevronRight,
  Droplets,
  FileText,
  Flame,
  FlaskConical,
  Fuel,
  Gauge,
  History,
  Send,
  ShieldAlert,
  TestTube,
  type LucideIcon,
} from "lucide-react";
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
  CATEGORY_VALUES,
  CONSUMABLE_CATEGORIES,
  GIOI_HAN_LUU_HUYNH,
  NGUONG_CANH_BAO_HAN_DUNG,
  kiemTraLuuHuynh,
  soNgayToi,
  type CanhBaoLuuHuynh,
} from "@/lib/consumables";
import { layT } from "@/lib/i18n/server";
import type { HamDichTuDo } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import {
  ConsumableMinForm,
  ConsumableMoveForm,
  ConsumableReceiptForm,
} from "@/components/ConsumableForms";
import ConsumableReceiptDeleteButton from "@/components/ConsumableReceiptDeleteButton";
import ConsumableRequestForm from "@/components/ConsumableRequestForm";
import VesselSwitcher from "@/components/VesselSwitcher";
import {
  Badge,
  Card,
  CardHeader,
  DataRow,
  EmptyState,
  Meter,
  Notice,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
  TrNhom,
  type Tone,
} from "@/components/ui";

// Băng tin hạn dùng nối mọi lô vào MỘT dòng chữ, nên phải có trần hiển thị:
// không có nó thì một tàu tồn nhiều lô quá hạn sẽ đẩy ra một dòng dài vô tận,
// người đọc cuộn qua rồi bỏ — cảnh báo dài quá hoá ra không cảnh báo được ai.
const SO_LO_HIEN_TREN_BANG_TIN = 10;

export const dynamic = "force-dynamic";

/** Biểu tượng nhóm — thay cho emoji `icon` trong lib/consumables.ts. */
const CATEGORY_ICON: Record<string, LucideIcon> = {
  FUEL: Fuel,
  LUBE: Droplets,
  CHEMICAL: FlaskConical,
};

/** Màu nhãn của nhóm — cùng một màu cho một nhóm ở mọi chỗ trên trang. */
const CATEGORY_TONE: Record<string, Tone> = {
  FUEL: "warning",
  LUBE: "brand",
  CHEMICAL: "info",
};

/** Ba mức của kiemTraLuuHuynh() → tone của nhãn (cùng bảng với form nhận). */
const TONE_LUU_HUYNH: Record<CanhBaoLuuHuynh["muc"], Tone> = {
  VUOT_TOAN_CAU: "danger",
  VUOT_ECA: "warning",
  DAT: "success",
};

/** Loại giao dịch → tone: nhận vào xanh, xuất ra vàng, tiêu thụ trung tính. */
const TONE_GIAO_DICH: Record<string, Tone> = {
  IN: "success",
  OUT: "warning",
  CONSUME: "neutral",
};

const LINK = "text-brand-700 hover:underline dark:text-brand-300";

/** Tiêu đề khung gập: cùng một dáng cho mọi <details> trên trang. */
const SUMMARY =
  "flex cursor-pointer select-none list-none flex-wrap items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] [&::-webkit-details-marker]:hidden";

/** Nút chọn nhóm — cùng dáng với dải chuyển tàu (components/VesselSwitcher). */
const TAB =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none";
const TAB_ON = "bg-brand-700 font-medium text-white";
const TAB_OFF =
  "bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]";

/** Màu thanh tồn / định mức: càng thiếu càng đỏ (cùng trang Tồn kho). */
function toneThieu(pct: number): Tone {
  return pct < 40 ? "danger" : pct < 75 ? "warning" : "info";
}

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
      label: nhanMatHang(p, tTuDo),
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
    <div className="space-y-5">
      <div>
        <Link
          href="/consumables"
          className={`mb-3 inline-flex items-center gap-1.5 text-sm ${LINK}`}
        >
          <ArrowLeft className="size-4" />
          {t("consumables.quayLaiTongQuan")}
        </Link>
        <PageHeader
          title={
            <>
              <span className="font-display tracking-wide">{vessel.code}</span>{" "}
              — {vessel.name}
            </>
          }
          subtitle={t("consumables.moTaTau")}
        />
      </div>

      {!coTheGhi && (
        <Notice tone="info">{t("consumables.chiXemKhongGhi")}</Notice>
      )}

      {/* Giữ nguyên tab nhóm đang xem khi nhảy sang tàu khác — đang so tồn dầu
          giữa các tàu mà mỗi lần bấm lại về "Tất cả" thì phải chọn lại. */}
      <VesselSwitcher
        hienTai={vesselId}
        duongDan={(id) =>
          nhomChon ? `/consumables/${id}?nhom=${nhomChon}` : `/consumables/${id}`
        }
      />

      {/* ── Tách nhóm ────────────────────────────────────────────────── */}
      <Card
        padded={false}
        className="flex flex-wrap items-center gap-2 px-3 py-2.5"
      >
        <Link
          href={`/consumables/${vesselId}`}
          aria-current={nhomChon === null ? "page" : undefined}
          className={cn(TAB, nhomChon === null ? TAB_ON : TAB_OFF)}
        >
          {t("chung.tatCa")}
        </Link>
        {CONSUMABLE_CATEGORIES.map((c) => {
          const ghiDuoc = nhomGhiDuoc.includes(c.value);
          const Icon = CATEGORY_ICON[c.value];
          return (
            <Link
              key={c.value}
              href={`/consumables/${vesselId}?nhom=${c.value}`}
              aria-current={nhomChon === c.value ? "page" : undefined}
              className={cn(TAB, nhomChon === c.value ? TAB_ON : TAB_OFF)}
            >
              {Icon && <Icon className="size-4 shrink-0" />}
              {tTuDo(`consumables.nhom_${c.value}`)}
              {!ghiDuoc && (
                <span className="ml-1 text-xs opacity-70">
                  {t("consumables.chiXemNgoac")}
                </span>
              )}
            </Link>
          );
        })}
      </Card>

      {/* ── Cảnh báo ─────────────────────────────────────────────────── */}
      {(duoiDinhMuc.length > 0 ||
        sapHetTheoTocDo.length > 0 ||
        loHetHan.length > 0 ||
        mauHetHanGiu.length > 0) && (
        <div className="space-y-2">
          {duoiDinhMuc.length > 0 && (
            <Notice tone="danger">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
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
                </p>
              </div>
            </Notice>
          )}
          {sapHetTheoTocDo.length > 0 && (
            <Notice tone="warning">
              <div className="flex items-start gap-2">
                <Gauge className="mt-0.5 size-4 shrink-0" />
                <p>
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
                </p>
              </div>
            </Notice>
          )}
          {loHetHan.length > 0 && (
            <Notice tone="danger">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
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
                </p>
              </div>
            </Notice>
          )}
          {mauHetHanGiu.length > 0 && (
            <Notice tone="neutral">
              <div className="flex items-start gap-2">
                <TestTube className="mt-0.5 size-4 shrink-0" />
                <p>
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
                </p>
              </div>
            </Notice>
          )}
        </div>
      )}

      {/* ── Tóm tắt theo nhóm ────────────────────────────────────────── */}
      {CONSUMABLE_CATEGORIES.filter((c) => hopNhom(c.value)).map((c) => {
        const ton = tonTheoChungLoai(c.value);
        const tt = tieuThuTheoNoi(c.value);
        if (ton.length === 0 && tt.length === 0) return null;
        const Icon = CATEGORY_ICON[c.value];
        const nhanNhom = `${tTuDo(`consumables.nhom_${c.value}`)} — ${t(
          "consumables.tongHop"
        )}`;
        return (
          <div key={`tt-${c.value}`} className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                icon={Icon && <Icon className="size-4" />}
                title={t("consumables.tonTheoChungLoai")}
                subtitle={nhanNhom}
              />
              {ton.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  {t("consumables.chuaCoTon")}
                </p>
              ) : (
                <dl className="divide-y divide-[var(--border-subtle)]">
                  {ton.map(([grade, v]) => (
                    <DataRow
                      key={grade}
                      label={
                        <>
                          {tTuDo(`consumables.loai_${grade}`)}
                          <span className="text-[var(--text-muted)]">
                            {" "}
                            · {t("consumables.nMatHang", { n: v.soMat })}
                          </span>
                        </>
                      }
                      value={
                        <span className="tabular">
                          {Math.round(v.tong * 1000) / 1000} {v.uom}
                        </span>
                      }
                    />
                  ))}
                </dl>
              )}

              {/* Dầu đốt: câu hỏi quan trọng nhất trước khi vào vùng ECA là
                  "còn bao nhiêu dầu dùng được trong ECA". */}
              {c.value === "FUEL" &&
                (() => {
                  const lh = tonTheoLuuHuynh();
                  const tong = lh.dungEca + lh.ngoaiEca + lh.chuaKhai;
                  if (tong === 0) return null;
                  return (
                    <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
                      <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
                        {t("consumables.theoGioiHanLuuHuynh")}
                      </p>
                      <dl>
                        <DataRow
                          label={t("consumables.dungTrongEca", {
                            s: GIOI_HAN_LUU_HUYNH.ECA,
                          })}
                          value={
                            <Badge tone="success">
                              <span className="tabular">
                                {Math.round(lh.dungEca * 1000) / 1000} {lh.uom}
                              </span>
                            </Badge>
                          }
                        />
                        <DataRow
                          label={t("consumables.chiNgoaiEca", {
                            s: GIOI_HAN_LUU_HUYNH.ECA,
                          })}
                          value={
                            <Badge tone="warning">
                              <span className="tabular">
                                {Math.round(lh.ngoaiEca * 1000) / 1000} {lh.uom}
                              </span>
                            </Badge>
                          }
                        />
                        {lh.chuaKhai > 0 && (
                          <DataRow
                            label={
                              <>
                                {t("consumables.chuaKhaiLuuHuynh")}{" "}
                                <span className="text-[var(--text-muted)]">
                                  {t("consumables.chuaXepNhom")}
                                </span>
                              </>
                            }
                            value={
                              <Badge tone="muted">
                                <span className="tabular">
                                  {Math.round(lh.chuaKhai * 1000) / 1000}{" "}
                                  {lh.uom}
                                </span>
                              </Badge>
                            }
                          />
                        )}
                      </dl>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        {t("consumables.ghiChuLuuHuynhDanhNghia")}
                      </p>
                    </div>
                  );
                })()}
            </Card>

            <Card>
              <CardHeader
                icon={<Flame className="size-4" />}
                title={t("consumables.tieuThu30Ngay")}
                subtitle={nhanNhom}
              />
              {tt.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  {t("consumables.chuaCoTieuThu30")}
                </p>
              ) : (
                <dl className="divide-y divide-[var(--border-subtle)]">
                  {tt.map(([noi, v]) => (
                    <DataRow
                      key={noi}
                      label={tTuDo(`consumables.noiTieuThu_${noi}`)}
                      value={
                        <span className="tabular">
                          {Math.round(v.tong * 1000) / 1000} {v.uom}
                        </span>
                      }
                    />
                  ))}
                  <div className="border-t border-[var(--border-subtle)]">
                    <DataRow
                      label={
                        <span className="font-medium text-[var(--text-primary)]">
                          {t("consumables.tong")}
                        </span>
                      }
                      value={
                        <span className="tabular font-semibold">
                          {Math.round(
                            tt.reduce((a, [, v]) => a + v.tong, 0) * 1000
                          ) / 1000}{" "}
                          {tt[0][1].uom}
                        </span>
                      }
                    />
                  </div>
                </dl>
              )}
            </Card>
          </div>
        );
      })}

      {/* ── Tồn theo nhóm ────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          icon={<Boxes className="size-4" />}
          title={t("consumables.tonTrenTau")}
        />
        {theoNhom.length === 0 ? (
          <EmptyState
            icon={<Boxes className="size-5" />}
            title={t("consumables.chuaCoSoLieu")}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("chung.ma")}</Th>
                  <Th>{t("consumables.matHang")}</Th>
                  <Th>{t("consumables.chungLoai")}</Th>
                  <Th align="right">{t("consumables.ton")}</Th>
                  <Th align="right">{t("consumables.dungMoiNgay")}</Th>
                  <Th align="right">{t("consumables.conDungDuoc")}</Th>
                  <Th align="right">{t("consumables.dinhMuc")}</Th>
                </tr>
              </thead>
              <tbody>
                {theoNhom.map((nhom) => {
                  const Icon = CATEGORY_ICON[nhom.value];
                  return (
                    <Fragment key={nhom.value}>
                      <TrNhom colSpan={7}>
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {Icon && (
                            <Icon className="size-4 text-[var(--text-muted)]" />
                          )}
                          {tTuDo(`consumables.nhom_${nhom.value}`)}
                          <Badge tone={CATEGORY_TONE[nhom.value] ?? "neutral"}>
                            {t("consumables.nMatHang", {
                              n: nhom.stocks.length,
                            })}
                          </Badge>
                        </span>
                      </TrNhom>
                      {nhom.stocks.map((s) => {
                        const thieu = s.minQty > 0 && s.quantity < s.minQty;
                        // Tỷ lệ tồn / định mức cho thanh mức thiếu (chỉ vẽ ở
                        // dòng thiếu, như trang Tồn kho).
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
                            className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                          >
                            <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                              {s.product.code}
                            </Td>
                            <Td>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span>{s.product.name}</span>
                                {s.product.maker && (
                                  <span className="text-[var(--text-muted)]">
                                    · {s.product.maker}
                                  </span>
                                )}
                                {thieu && (
                                  <Badge tone="danger">
                                    {t("consumables.badgeThieu")}
                                  </Badge>
                                )}
                              </div>
                            </Td>
                            <Td>
                              <span className="text-[var(--text-secondary)]">
                                {tTuDo(`consumables.loai_${s.product.grade}`)}
                              </span>
                            </Td>
                            <Td align="right">
                              <span
                                className={cn(
                                  "font-semibold",
                                  thieu && "text-[var(--text-danger)]"
                                )}
                              >
                                {s.quantity} {s.product.uom}
                              </span>
                              {thieu && (
                                <div className="mt-1 ml-auto w-16">
                                  <Meter value={pct} tone={toneThieu(pct)} />
                                </div>
                              )}
                            </Td>
                            <Td align="right">
                              <span className="text-[var(--text-secondary)]">
                                {(() => {
                                  const md = tieuThuMoiNgay(s.productId);
                                  return md > 0
                                    ? Math.round(md * 100) / 100
                                    : "—";
                                })()}
                              </span>
                            </Td>
                            <Td align="right">
                              {(() => {
                                const ng = soNgayConDung(
                                  s.productId,
                                  s.quantity
                                );
                                if (ng === null)
                                  return (
                                    <span className="text-[var(--text-muted)]">
                                      {t("consumables.chuaCoTieuThu")}
                                    </span>
                                  );
                                return (
                                  <span
                                    className={
                                      ng < NGUONG_NGAY_SAP_HET
                                        ? "font-semibold text-[var(--text-warning)]"
                                        : "text-[var(--text-secondary)]"
                                    }
                                  >
                                    {t("consumables.nNgay", { n: ng })}
                                  </span>
                                );
                              })()}
                            </Td>
                            <Td align="right">
                              {nhomGhiDuoc.includes(s.product.category) ? (
                                <div className="flex justify-end">
                                  <ConsumableMinForm
                                    vesselId={vesselId}
                                    productId={s.productId}
                                    minQty={s.minQty}
                                  />
                                </div>
                              ) : (
                                <span className="text-[var(--text-muted)]">
                                  {s.minQty || "—"}
                                </span>
                              )}
                            </Td>
                          </Tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      {/* ── Ghi phiếu nhận ───────────────────────────────────────────── */}
      {coTheGhi && (
        <Card padded={false}>
          <details className="group" open>
            <summary className={SUMMARY}>
              <ChevronRight
                aria-hidden="true"
                className="size-4 text-[var(--text-muted)] transition-transform group-open:rotate-90"
              />
              <ArrowDownToLine className="size-4 text-[var(--text-muted)]" />
              {t("consumables.tieuDeGhiPhieu")}
            </summary>
            <div className="border-t border-[var(--border-subtle)] px-4 py-4">
              <ConsumableReceiptForm
                vesselId={vesselId}
                products={optionsChoNhom}
              />
            </div>
          </details>
        </Card>
      )}

      {/* ── Tiêu thụ / xuất ──────────────────────────────────────────── */}
      {coTheGhi && (
        <Card padded={false}>
          <details className="group" open>
            <summary className={SUMMARY}>
              <ChevronRight
                aria-hidden="true"
                className="size-4 text-[var(--text-muted)] transition-transform group-open:rotate-90"
              />
              <ArrowUpFromLine className="size-4 text-[var(--text-muted)]" />
              {t("consumables.tieuDeGhiTieuThu")}
            </summary>
            <div className="border-t border-[var(--border-subtle)] px-4 py-4">
              <ConsumableMoveForm
                vesselId={vesselId}
                products={optionsChoNhom}
              />
            </div>
          </details>
        </Card>
      )}

      {/* ── Yêu cầu cấp ──────────────────────────────────────────────── */}
      {coTheXinCap && (
        <Card padded={false}>
          <details className="group">
            <summary className={SUMMARY}>
              <ChevronRight
                aria-hidden="true"
                className="size-4 text-[var(--text-muted)] transition-transform group-open:rotate-90"
              />
              <Send className="size-4 text-[var(--text-muted)]" />
              {t("consumables.tieuDeXinCap")}
            </summary>
            <div className="border-t border-[var(--border-subtle)] px-4 py-4">
              <ConsumableRequestForm
                vesselId={vesselId}
                lines={dongXinCap}
                nguoiDuyet={nguoiDuyetCuaToi}
              />
            </div>
          </details>
        </Card>
      )}

      {/* ── Mẫu dầu đang giữ (chỉ có nghĩa với dầu đốt) ──────────────── */}
      {hopNhom("FUEL") && mauDangGiu.length > 0 && (
        <Card padded={false}>
          <details className="group">
            <summary className={SUMMARY}>
              <ChevronRight
                aria-hidden="true"
                className="size-4 text-[var(--text-muted)] transition-transform group-open:rotate-90"
              />
              <TestTube className="size-4 text-[var(--text-muted)]" />
              {t("consumables.tieuDeMauDau")}
              <span className="text-xs font-normal text-[var(--text-muted)]">
                ({mauDangGiu.length})
              </span>
            </summary>
            <div className="border-t border-[var(--border-subtle)] px-4 py-4">
              <p className="mb-3 text-xs text-[var(--text-secondary)]">
                {t("consumables.moTaMauDau")}
              </p>
              <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                <Table dense>
                  <thead>
                    <tr>
                      <Th>{t("consumables.soBdn")}</Th>
                      <Th>{t("consumables.cotNgayGiao")}</Th>
                      <Th>{t("consumables.matHang")}</Th>
                      <Th>{t("consumables.cotSoNiem")}</Th>
                      <Th>{t("consumables.cotGiuToi")}</Th>
                      <Th align="right">{t("consumables.cotCon")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {mauDangGiu.map((r) => {
                      const con = soNgayToi(r.sampleKeepUntil)!;
                      return (
                        <Tr
                          key={r.id}
                          className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                        >
                          <Td className="font-medium whitespace-nowrap">
                            {r.docNo}
                          </Td>
                          <Td className="whitespace-nowrap">
                            {ngay(r.receivedAt)}
                          </Td>
                          <Td>{r.product.name}</Td>
                          <Td className="font-display text-xs tracking-wide">
                            {r.sampleSealNo ?? (
                              <span className="text-[var(--text-warning)]">
                                {t("consumables.chuaGhiSoNiem")}
                              </span>
                            )}
                          </Td>
                          <Td className="whitespace-nowrap">
                            {ngay(r.sampleKeepUntil!)}
                          </Td>
                          <Td align="right" className="whitespace-nowrap">
                            <span className="text-[var(--text-secondary)]">
                              {t("consumables.nNgay", { n: con })}
                            </span>
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </div>
          </details>
        </Card>
      )}

      {/* ── An toàn hóa chất ─────────────────────────────────────────── */}
      {hopNhom("CHEMICAL") && hoaChatNguyHiem.length > 0 && (
        <Card padded={false}>
          <details className="group">
            <summary className={SUMMARY}>
              <ChevronRight
                aria-hidden="true"
                className="size-4 text-[var(--text-muted)] transition-transform group-open:rotate-90"
              />
              <ShieldAlert className="size-4 text-[var(--text-muted)]" />
              {t("consumables.tieuDeAnToanHoaChat")}
              <span className="text-xs font-normal text-[var(--text-muted)]">
                ({hoaChatNguyHiem.length})
              </span>
            </summary>
            <div className="border-t border-[var(--border-subtle)] px-4 py-4">
              <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                <Table dense>
                  <thead>
                    <tr>
                      <Th>{t("chung.ma")}</Th>
                      <Th>{t("consumables.cotHoaChat")}</Th>
                      <Th>{t("consumables.cotPhanLoaiNguyHiem")}</Th>
                      <Th>{t("consumables.cotHanDung")}</Th>
                      <Th>{t("consumables.ghiChuAnToan")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoaChatNguyHiem.map((p) => (
                      <Tr
                        key={p.id}
                        className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                      >
                        <Td className="font-display text-xs tracking-wide whitespace-nowrap">
                          {p.code}
                        </Td>
                        <Td>{p.name}</Td>
                        <Td>
                          {p.hazardClass ? (
                            <Badge tone="danger">{p.hazardClass}</Badge>
                          ) : (
                            <span className="text-[var(--text-muted)]">—</span>
                          )}
                        </Td>
                        <Td>
                          <span className="text-[var(--text-secondary)]">
                            {p.shelfLifeMonths
                              ? t("consumables.nThangTuNgayNhan", {
                                  n: p.shelfLifeMonths,
                                })
                              : "—"}
                          </span>
                        </Td>
                        <Td>
                          <span className="text-[var(--text-secondary)]">
                            {p.msdsNote ?? "—"}
                          </span>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          </details>
        </Card>
      )}

      {/* ── Lịch sử phiếu nhận ───────────────────────────────────────── */}
      <Card padded={false}>
        <details className="group" open>
          <summary className={SUMMARY}>
            <ChevronRight
              aria-hidden="true"
              className="size-4 text-[var(--text-muted)] transition-transform group-open:rotate-90"
            />
            <FileText className="size-4 text-[var(--text-muted)]" />
            {t("consumables.tieuDePhieuGanDay")}
          </summary>
          <div className="border-t border-[var(--border-subtle)] px-4 py-4">
            {receipts.length === 0 ? (
              <EmptyState
                icon={<FileText className="size-5" />}
                title={t("consumables.chuaCoPhieu")}
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                <Table dense>
                  <thead>
                    <tr>
                      <Th>{t("consumables.cotSoChungTu")}</Th>
                      <Th>{t("chung.ngay")}</Th>
                      <Th>{t("consumables.matHang")}</Th>
                      <Th align="right">{t("chung.soLuong")}</Th>
                      <Th>{t("consumables.cotCangNcc")}</Th>
                      <Th>{t("consumables.cotDacTinh")}</Th>
                      <Th>{t("consumables.cotMauHanDung")}</Th>
                      <Th>{t("consumables.cotBanGoc")}</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {receipts
                      .filter((r) => hopNhom(r.product.category))
                      .map((r) => {
                        const cb = kiemTraLuuHuynh(r.sulphur);
                        const conHan = soNgayToi(r.expiryDate);
                        const Icon = CATEGORY_ICON[r.product.category];
                        return (
                          <Tr
                            key={r.id}
                            className="align-top transition-colors hover:bg-[var(--surface-sunken)]/50"
                          >
                            <Td className="font-medium whitespace-nowrap">
                              {r.docNo}
                            </Td>
                            <Td className="whitespace-nowrap">
                              {ngay(r.receivedAt)}
                            </Td>
                            <Td>
                              <span className="inline-flex items-center gap-1.5">
                                {Icon && (
                                  <Icon className="size-4 shrink-0 text-[var(--text-muted)]" />
                                )}
                                {r.product.name}
                              </span>
                            </Td>
                            <Td align="right" className="whitespace-nowrap">
                              {r.quantity} {r.product.uom}
                            </Td>
                            <Td>
                              <span className="text-[var(--text-secondary)]">
                                {[r.port, r.supplier]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </span>
                            </Td>
                            <Td className="text-xs">
                              <span className="inline-flex flex-wrap items-center gap-1.5 text-[var(--text-secondary)]">
                                {r.sulphur !== null && cb && (
                                  <Badge
                                    tone={TONE_LUU_HUYNH[cb.muc]}
                                    title={tTuDo(
                                      `consumables.luuHuynh_${cb.muc}`,
                                      { s: r.sulphur }
                                    )}
                                  >
                                    <span className="tabular">
                                      S {r.sulphur}%
                                    </span>
                                  </Badge>
                                )}
                                {r.density !== null && (
                                  <span className="tabular">ρ {r.density}</span>
                                )}
                                {r.viscosity !== null && (
                                  <span className="tabular">
                                    {r.viscosity} cSt
                                  </span>
                                )}
                                {r.bnValue !== null && (
                                  <span className="tabular">
                                    TBN {r.bnValue}
                                  </span>
                                )}
                                {r.sulphur === null &&
                                  r.density === null &&
                                  r.viscosity === null &&
                                  r.bnValue === null &&
                                  "—"}
                              </span>
                            </Td>
                            <Td className="text-xs">
                              <span className="text-[var(--text-secondary)]">
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
                                      conHan !== null &&
                                      conHan <= NGUONG_CANH_BAO_HAN_DUNG
                                        ? "font-semibold text-[var(--text-danger)]"
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
                              </span>
                            </Td>
                            <Td className="text-xs">
                              {r.attachStored && coXemBanGoc ? (
                                <a
                                  href={`/api/consumable-receipts/${r.id}/file`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`inline-flex items-center gap-1 ${LINK}`}
                                  title={r.attachName ?? ""}
                                >
                                  <FileText className="size-3.5" />
                                  {t("consumables.xemBanGoc")}
                                </a>
                              ) : (
                                <span className="text-[var(--text-muted)]">
                                  —
                                </span>
                              )}
                            </Td>
                            <Td align="right">
                              {nhomGhiDuoc.includes(r.product.category) && (
                                <div className="flex justify-end">
                                  <ConsumableReceiptDeleteButton
                                    id={r.id}
                                    docNo={r.docNo}
                                  />
                                </div>
                              )}
                            </Td>
                          </Tr>
                        );
                      })}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </details>
      </Card>

      {/* ── Nhật ký giao dịch ────────────────────────────────────────── */}
      <Card padded={false}>
        <details className="group">
          <summary className={SUMMARY}>
            <ChevronRight
              aria-hidden="true"
              className="size-4 text-[var(--text-muted)] transition-transform group-open:rotate-90"
            />
            <History className="size-4 text-[var(--text-muted)]" />
            {t("consumables.tieuDeNhatKy")}
          </summary>
          <div className="border-t border-[var(--border-subtle)] px-4 py-4">
            {transactions.length === 0 ? (
              <EmptyState
                icon={<History className="size-5" />}
                title={t("consumables.chuaCoGiaoDich")}
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                <Table dense>
                  <thead>
                    <tr>
                      <Th>{t("consumables.cotThoiDiem")}</Th>
                      <Th>{t("consumables.cotLoai")}</Th>
                      <Th>{t("consumables.matHang")}</Th>
                      <Th>{t("consumables.noiTieuThu")}</Th>
                      <Th align="right">{t("chung.soLuong")}</Th>
                      <Th>{t("consumables.cotNguoiGhi")}</Th>
                      <Th>{t("chung.ghiChu")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions
                      .filter((tx) => hopNhom(tx.product.category))
                      .map((tx) => (
                        <Tr
                          key={tx.id}
                          className="transition-colors hover:bg-[var(--surface-sunken)]/50"
                        >
                          <Td className="whitespace-nowrap">
                            {ngayGio(tx.occurredAt)}
                          </Td>
                          <Td>
                            <Badge tone={TONE_GIAO_DICH[tx.type] ?? "neutral"}>
                              {tTuDo(`consumables.giaoDich_${tx.type}`)}
                            </Badge>
                          </Td>
                          <Td>{tx.product.name}</Td>
                          <Td>
                            <span className="text-[var(--text-secondary)]">
                              {tx.consumer
                                ? tTuDo(
                                    `consumables.noiTieuThu_${tx.consumer}`
                                  )
                                : "—"}
                            </span>
                          </Td>
                          <Td align="right" className="whitespace-nowrap">
                            <span
                              className={cn(
                                "font-semibold",
                                tx.type === "IN"
                                  ? "text-[var(--text-success)]"
                                  : "text-[var(--text-warning)]"
                              )}
                            >
                              {tx.type === "IN" ? "+" : "−"}
                              {tx.quantity} {tx.product.uom}
                            </span>
                          </Td>
                          <Td>
                            <span className="text-[var(--text-secondary)]">
                              {tx.performedBy ?? "—"}
                            </span>
                          </Td>
                          <Td>
                            <span className="text-[var(--text-secondary)]">
                              {tx.note ?? "—"}
                            </span>
                          </Td>
                        </Tr>
                      ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </details>
      </Card>

      <p className="text-xs text-[var(--text-muted)]">
        {t("consumables.quyenTrenTauTruoc")}{" "}
        <b className="text-[var(--text-primary)]">
          {t("consumables.quyenGhiDam")}
        </b>{" "}
        {t("consumables.quyenGhiSau")}{" "}
        {nhomGhiDuoc.length
          ? nhomGhiDuoc
              .map((c) => tTuDo(`consumables.nhom_${c}`))
              .join(" · ")
          : t("consumables.khongNhomNao")}
        .{" "}
        <b className="text-[var(--text-primary)]">
          {t("consumables.quyenXinDam")}
        </b>{" "}
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
