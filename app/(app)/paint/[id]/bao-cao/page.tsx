import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { coQuanLySon, requireScopedUser, trongPhamVi, vesselScopeDayDu } from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { QUY_LA_MA, docKyQuy, dongBaoCaoQuy, mocQuy, moTaSonIn, quyCua, soIn, tinhTonQuy } from "@/lib/tonSon";
import BaoCaoSonSua from "@/components/BaoCaoSonSua";
import { Button, Notice, PageHeader, Select } from "@/components/ui";

export const dynamic = "force-dynamic";

/** dd/mm/yyyy theo giờ Việt Nam (máy chủ chạy giờ UTC). */
const ngayVn = (d: Date) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

/**
 * Báo cáo lượng sơn tồn của tàu theo QUÝ, in đúng mẫu công ty MLS-11-14 (bản Word
 * "BC LUONG SON TON"): Tồn đầu kỳ · Nhận · Tiêu thụ trong kỳ · Tồn cuối kỳ tính
 * từ lịch sử nhập / xuất (lib/tonSon.ts → tinhTonQuy). Người lập sửa / bỏ / thêm
 * dòng ngay trên tờ in trước khi in (components/BaoCaoSonSua.tsx); số liệu thật
 * sửa ở bảng Tồn sơn của trang tàu.
 */
export default async function BaoCaoSonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireScopedUser();
  const { t } = await layT();
  const { id } = await params;
  const vesselId = Number(id);
  if (!Number.isInteger(vesselId) || vesselId <= 0) notFound();
  if (!trongPhamVi(vesselScopeDayDu(user), vesselId)) notFound();
  const sp = await searchParams;
  const bayGio = new Date();
  const ky = docKyQuy(sp.nam, sp.quy, bayGio);
  const { batDau, ketThuc } = mocQuy(ky);
  const [vessel, ton, giaoDich, gdDauTien] = await Promise.all([
    prisma.vessel.findUnique({ where: { id: vesselId }, select: { id: true, code: true, name: true } }),
    prisma.paintStock.findMany({ where: { vesselId }, select: { productId: true, quantity: true } }),
    // Chỉ cần các dòng từ đầu quý trở đi: tồn cuối kỳ suy ngược từ tồn hiện tại.
    prisma.paintTransaction.findMany({
      where: { vesselId, occurredAt: { gte: batDau } },
      select: { productId: true, type: true, quantity: true, dieuChinh: true, occurredAt: true },
    }),
    prisma.paintTransaction.findFirst({ where: { vesselId }, orderBy: { occurredAt: "asc" }, select: { occurredAt: true } }),
  ]);
  if (!vessel) notFound();

  const soLieu = tinhTonQuy(new Map(ton.map((s) => [s.productId, s.quantity])), giaoDich, { batDau, ketThuc });
  const sanPham = await prisma.paintProduct.findMany({
    where: { id: { in: soLieu.map((s) => s.productId) } },
    select: { id: true, name: true, maker: true, colorCode: true, colorName: true, uom: true, packSize: true },
  });
  const dong = dongBaoCaoQuy(soLieu, sanPham);
  const theoId = new Map(sanPham.map((p) => [p.id, p]));
  const dieuChinh = soLieu
    .filter((s) => s.dieuChinh !== 0 && theoId.has(s.productId))
    .map((s) => {
      const p = theoId.get(s.productId)!;
      return { ten: moTaSonIn(p), so: `${s.dieuChinh > 0 ? "+" : ""}${soIn(s.dieuChinh)}`, dv: p.uom, vao: s.dieuChinhVao };
    });

  const hienTai = quyCua(bayGio);
  const dangDienRa = ky.nam === hienTai.nam && ky.quy === hienTai.quy;
  const namDau = Math.min(hienTai.nam, Math.max(2020, quyCua(gdDauTien?.occurredAt ?? bayGio).nam - 1));
  const cacNam = Array.from({ length: hienTai.nam - namDau + 1 }, (_, i) => hienTai.nam - i);
  const tenQuy = `${QUY_LA_MA[ky.quy - 1]}/${ky.nam}`;
  const cuoiQuy = new Date(ketThuc.getTime() - 1);

  return (
    <div className="space-y-4">
      <div className="no-print space-y-3">
        <Link href={`/paint/${vesselId}`} className="inline-block text-sm text-[var(--text-brand)] hover:underline">
          ← {t("paint.pgQuayLai", { tau: vessel.name })}
        </Link>
        <PageHeader title={t("paint.bcTieuDe")} subtitle={t("paint.bcMoTa", { tau: `${vessel.code} ${vessel.name}`, quy: tenQuy, n: dong.length })} />
        {/* Chọn quý: biểu mẫu GET thường — không cần JavaScript, địa chỉ trang giữ đúng quý đang xem. */}
        <form className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[var(--text-muted)]">{t("paint.bcQuy")}</span>
            <Select name="quy" defaultValue={String(ky.quy)} className="w-24">
              {QUY_LA_MA.map((q, i) => (
                <option key={q} value={i + 1}>
                  {q}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[var(--text-muted)]">{t("paint.bcNam")}</span>
            <Select name="nam" defaultValue={String(ky.nam)} className="w-28">
              {cacNam.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" size="sm">
            {t("paint.bcXemQuy")}
          </Button>
          <p className="basis-full text-xs text-[var(--text-muted)] sm:basis-auto">
            {t(dangDienRa ? "paint.bcKyDangDienRa" : "paint.bcKy", { tu: ngayVn(batDau), den: ngayVn(cuoiQuy) })}
          </p>
        </form>
        {dieuChinh.length > 0 && (
          <Notice tone="info">
            <p>{t("paint.bcCoDieuChinh", { n: dieuChinh.length })}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {dieuChinh.map((d, i) => (
                <li key={i}>
                  {d.ten}: {d.so} {d.dv} →{" "}
                  {t(d.vao === "nhan" ? "paint.bcDieuChinhVaoNhan" : d.vao === "ca-hai" ? "paint.bcDieuChinhVaoCaHai" : "paint.bcDieuChinhVaoTonDau")}
                </li>
              ))}
            </ul>
          </Notice>
        )}
      </div>
      <BaoCaoSonSua
        key={`${ky.nam}-${ky.quy}`}
        khoaLuu={`bao-cao-son-mls1114:${vesselId}:${ky.nam}-${ky.quy}`}
        vesselId={vesselId}
        coSuaTon={coQuanLySon(user, vesselId)}
        dauGoc={{ tenTau: vessel.name, quy: QUY_LA_MA[ky.quy - 1], nam: String(ky.nam) }}
        dongGoc={dong}
      />
    </div>
  );
}
