import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftRight, Boxes, QrCode, Search, Warehouse } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselScopeDayDu, vesselWhere } from "@/lib/auth";
import { VAN_HANH_TAU, danhTinhHieuLuc } from "@/lib/roles";
import { ghiNhatKyNguoiDung } from "@/lib/audit";
import { layT } from "@/lib/i18n/server";
import { docMaTuQr } from "@/lib/qr";
import { duongDanTheKho } from "@/lib/theKho";
import InventoryForm from "@/components/InventoryForm";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * /qr/<mã> — đích đến của mọi nhãn QR.
 *
 * Camera điện thoại mở địa chỉ này (qua cửa đăng nhập nếu cần), màn Quét mã
 * trong app cũng chuyển tới đây. Việc của trang: từ MÃ VẬT TƯ trên nhãn tìm ra
 * đúng THẺ KHO mà người quét cần:
 *   - mặt hàng có đúng một dòng tồn trong phạm vi tàu của người quét → chuyển
 *     thẳng sang thẻ kho, không hỏi gì (đây là đường đi 9 trên 10 lần quét);
 *   - có ở nhiều kho → cho chọn kho;
 *   - chưa có dòng tồn nào → cho ghi phiếu nhập đầu tiên ngay tại đây;
 *   - không tìm thấy mã → nói rõ, kèm đường tìm trong danh mục.
 * Mỗi lần mở là một lần "quét", ghi vào nhật ký để biết ai đã cầm nhãn nào lúc nào.
 */
export default async function QrPage({ params }: { params: Promise<{ ma: string }> }) {
  const user = await requireScopedUser();
  const { t, so } = await layT();
  const scope = vesselScopeDayDu(user);
  const maTho = decodeURIComponent((await params).ma);
  const ma = docMaTuQr(maTho);

  const material = ma
    ? await prisma.material.findFirst({
        where: { code: { equals: ma, mode: "insensitive" } },
        include: { category: { select: { name: true } } },
      })
    : null;

  await ghiNhatKyNguoiDung(user, {
    action: "quet-qr",
    path: `/qr/${encodeURIComponent(maTho.slice(0, 64))}`,
    vesselId: null,
    detail: material
      ? `Quét mã ${material.code} — ${material.nameVn}`
      : `Quét mã "${maTho.slice(0, 64)}" — không có trong danh mục`,
  });

  if (!material) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <PageHeader title={t("qr.matHangTieuDe")} />
        <Card>
          <EmptyState
            icon={<QrCode className="size-8" />}
            title={t("qr.khongTimThayMa", { ma: ma ?? maTho.slice(0, 64) })}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href={`/materials?q=${encodeURIComponent(ma ?? "")}`} className={buttonClass("primary")}>
                  <Search className="size-4" />
                  {t("qr.timTrongDanhMuc")}
                </Link>
                <Link href="/quet" className={buttonClass("secondary")}>
                  <QrCode className="size-4" />
                  {t("qr.nutQuetLai")}
                </Link>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  const [ton, khoCuaToi] = await Promise.all([
    prisma.inventory.findMany({
      where: { materialId: material.id, ...vesselWhere(scope) },
      select: {
        quantity: true,
        reservedQuantity: true,
        warehouseId: true,
        warehouse: { select: { id: true, code: true, name: true } },
        vessel: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ vesselId: "asc" }, { warehouseId: "asc" }],
    }),
    prisma.warehouse.findMany({
      where: vesselWhere(scope),
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  // Đúng một dòng tồn: đi thẳng, không bắt bấm thêm.
  if (ton.length === 1) {
    redirect(duongDanTheKho(material.id, ton[0].warehouseId));
  }

  const canTransact = danhTinhHieuLuc(user).some((d) => VAN_HANH_TAU.includes(d.role));
  const maPhu = material.materialType === "SPARE" ? material.partNumber : material.impa;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-baseline gap-2">
            <span className="font-display text-xl tracking-wide">{material.code}</span>
            <span>— {material.nameVn}</span>
          </span>
        }
        subtitle={[
          maPhu ? `${material.materialType === "SPARE" ? "Part No." : "IMPA"} ${maPhu}` : null,
          material.category?.name,
          `${t("chung.donVi")}: ${material.uom}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <Link href="/quet" className={buttonClass("secondary")}>
            <QrCode className="size-4" />
            {t("qr.nutQuetLai")}
          </Link>
        }
      />

      {ton.length > 1 && (
        <Card>
          <CardHeader icon={<Warehouse className="size-4" />} title={t("qr.chonKho", { n: ton.length })} />
          <div className="space-y-2">
            {ton.map((d) => (
              <Link
                key={`${d.vessel.id}-${d.warehouse.id}`}
                href={duongDanTheKho(material.id, d.warehouse.id)}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-3 transition hover:bg-[var(--surface-sunken)]"
              >
                <span>
                  <span className="font-display text-xs tracking-wide text-[var(--text-muted)]">{d.vessel.code}</span>{" "}
                  <span className="font-medium">{d.warehouse.code}</span>
                  <span className="text-[var(--text-secondary)]"> — {d.warehouse.name}</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <Badge tone={d.quantity - d.reservedQuantity <= material.minStock ? "danger" : "success"} dot>
                    {t("qr.tonHienTai")}: {so(d.quantity)} {material.uom}
                  </Badge>
                  <span className={buttonClass("primary", "sm")}>{t("qr.moTheKho")}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {ton.length === 0 && (
        <Card>
          <CardHeader icon={<Boxes className="size-4" />} title={t("qr.nhapDauTien")} subtitle={t("qr.chuaCoTon")} />
          {scope.unassigned ? (
            <Notice tone="warning">{t("chung.chuaGanTau")}</Notice>
          ) : khoCuaToi.length === 0 ? (
            <Notice tone="warning">{t("qr.chuaCoKho")}</Notice>
          ) : !canTransact ? (
            <Notice tone="info">{t("qr.ngoaiPhamVi")}</Notice>
          ) : (
            <>
              <p className="mb-3 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <ArrowLeftRight className="size-4" /> {t("inventory.ghiChoMatHangNayMoTa")}
              </p>
              <InventoryForm
                materials={[{ id: material.id, code: material.code, nameVn: material.nameVn }]}
                warehouses={khoCuaToi}
                returnTo={`/qr/${encodeURIComponent(material.code)}`}
              />
            </>
          )}
        </Card>
      )}
    </div>
  );
}
