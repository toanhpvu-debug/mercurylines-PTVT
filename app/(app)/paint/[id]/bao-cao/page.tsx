import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { coQuanLySon, requireScopedUser, trongPhamVi, vesselScopeDayDu } from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { dongBaoCaoTuTon } from "@/lib/tonSon";
import BaoCaoSonSua from "@/components/BaoCaoSonSua";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Ngày hôm nay theo giờ Việt Nam (máy chủ chạy giờ UTC — gần nửa đêm thì lệch một ngày). */
const homNay = () =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

/**
 * Báo cáo sơn của tàu in theo mẫu công ty MLS-11-05: R.O.B = tồn sơn trên tàu.
 * Người lập sửa / bỏ / thêm dòng và điền số yêu cầu ngay trên tờ in trước khi in
 * (components/BaoCaoSonSua.tsx); số liệu thật sửa ở bảng Tồn sơn của trang tàu.
 */
export default async function BaoCaoSonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireScopedUser();
  const { t } = await layT();
  const { id } = await params;
  const vesselId = Number(id);
  if (!Number.isInteger(vesselId) || vesselId <= 0) notFound();
  if (!trongPhamVi(vesselScopeDayDu(user), vesselId)) notFound();
  const [vessel, ton] = await Promise.all([
    prisma.vessel.findUnique({ where: { id: vesselId }, select: { id: true, code: true, name: true } }),
    prisma.paintStock.findMany({
      where: { vesselId },
      orderBy: { product: { name: "asc" } },
      select: {
        productId: true,
        quantity: true,
        minQty: true,
        product: { select: { name: true, maker: true, colorCode: true, colorName: true, uom: true } },
      },
    }),
  ]);
  if (!vessel) notFound();

  return (
    <div className="space-y-4">
      <div className="no-print">
        <Link href={`/paint/${vesselId}`} className="mb-3 inline-block text-sm text-[var(--text-brand)] hover:underline">
          ← {t("paint.pgQuayLai", { tau: vessel.name })}
        </Link>
        <PageHeader title={t("paint.bcTieuDe")} subtitle={t("paint.bcMoTa", { tau: `${vessel.code} ${vessel.name}`, n: ton.length })} />
      </div>
      <BaoCaoSonSua
        khoaLuu={`bao-cao-son-mls1105:${vesselId}`}
        vesselId={vesselId}
        coSuaTon={coQuanLySon(user, vesselId)}
        dauGoc={{ tenTau: vessel.name, ngay: homNay(), boPhan: "BOONG", soYeuCau: "", trang: "" }}
        dongGoc={dongBaoCaoTuTon(ton)}
      />
    </div>
  );
}
