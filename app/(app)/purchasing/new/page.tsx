import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  chonDuocTau,
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import CreatePurchaseOrderForm from "@/components/CreatePurchaseOrderForm";
import { layT } from "@/lib/i18n/server";
import {
  Button,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  Select,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const BACK_LINK =
  "mb-3 inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline dark:text-brand-300";

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ vessel?: string }>;
}) {
  const user = await requireScopedUser();
  const { t } = await layT();
  const scope = vesselScopeDayDu(user);
  if (!["ADMIN", "MASTER"].includes(user.role)) {
    redirect("/purchasing");
  }

  const vessels = await prisma.vessel.findMany({
    where: vesselIdWhere(scope),
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  const { vessel: vesselParam } = await searchParams;
  let selectedVesselId: number | null = null;
  if (!chonDuocTau(scope)) {
    selectedVesselId = scope.vesselId ?? null;
  } else if (vesselParam) {
    const req = Number(vesselParam);
    selectedVesselId = vessels.find((v) => v.id === req)?.id ?? null;
  }

  if (scope.unassigned) {
    return (
      <div className="space-y-5">
        <PageHeader title={t("purchasing.tieuDeTaoDon")} />
        <Notice tone="warning">{t("chung.chuaGanTau")}</Notice>
      </div>
    );
  }

  // Chưa chọn tàu (người toàn đội) → hiện danh sách tàu để chọn.
  if (!selectedVesselId) {
    return (
      <div className="space-y-5">
        <div>
          <Link href="/purchasing" className={BACK_LINK}>
            <ArrowLeft className="size-4" />
            {t("purchasing.quayLaiMuaSam")}
          </Link>
          <PageHeader title={t("purchasing.taoDonChonTau")} />
        </div>
        <Card>
          {/* next/form: chọn tàu xong chuyển trang phía client (không tải lại
              cả trang); `required` vẫn chặn gửi khi chưa chọn. */}
          <Form
            action="/purchasing/new"
            className="flex flex-wrap items-center gap-2"
          >
            <div className="w-72">
              <Select
                name="vessel"
                defaultValue=""
                required
                title={t("chung.tau")}
              >
                <option value="">{t("purchasing.phChonTauMuaSam")}</option>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} - {v.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="submit"
              variant="primary"
              icon={<ArrowRight className="size-4" />}
            >
              {t("chung.tiepTuc")}
            </Button>
          </Form>
        </Card>
      </div>
    );
  }

  const selectedVessel = vessels.find((v) => v.id === selectedVesselId)!;
  const [suppliers, requests] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.materialRequest.findMany({
      // Gồm cả "giao một phần" để phần hàng còn thiếu lập được đơn bổ sung;
      // dòng đã đặt đủ tự ẩn nhờ bộ lọc remaining > 0 bên dưới.
      where: {
        vesselId: selectedVesselId,
        status: { in: ["IN_PROCUREMENT", "PARTIALLY_DELIVERED"] },
      },
      orderBy: { createdAt: "asc" },
      include: {
        items: {
          include: {
            material: true,
            // Không tính SL của các PO đã hủy để dòng có thể mua lại.
            poItems: { where: { po: { status: { not: "CANCELLED" } } } },
          },
        },
      },
    }),
  ]);

  // Tính SL còn cần mua cho từng dòng: (SL duyệt) - (đã đặt trong PO).
  const pendingLines = requests.flatMap((req) =>
    req.items
      .map((it) => {
        const approved =
          it.approvedQuantity > 0 ? it.approvedQuantity : it.quantity;
        const ordered = it.poItems.reduce((s, p) => s + p.quantity, 0);
        const remaining = Math.max(0, approved - ordered);
        return {
          id: it.id,
          requestNo: req.requestNo,
          kind: req.kind,
          description: it.material ? it.material.nameVn : (it.itemName ?? "—"),
          partNo: it.material
            ? (it.material.partNumber ?? it.material.impa ?? null)
            : (it.itemCode ?? null),
          uom: it.material ? it.material.uom : (it.itemUom ?? "PCS"),
          remaining,
        };
      })
      .filter((l) => l.remaining > 0)
  );

  const defaultDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/purchasing" className={BACK_LINK}>
          <ArrowLeft className="size-4" />
          {t("purchasing.quayLaiMuaSam")}
        </Link>
        <PageHeader
          title={
            <>
              {t("purchasing.tieuDeTaoDon")} —{" "}
              <span className="font-display text-lg tracking-wide">
                {selectedVessel.code}
              </span>{" "}
              {selectedVessel.name}
            </>
          }
          subtitle={t("purchasing.moTaTaoDon")}
        />
      </div>
      <Card>
        {suppliers.length === 0 ? (
          <Notice tone="warning">
            {t("purchasing.chuaCoNcc")}{" "}
            <Link
              href="/purchasing/suppliers"
              className="font-medium underline"
            >
              {t("purchasing.themNcc")}
            </Link>{" "}
            {t("purchasing.truoc")}
          </Notice>
        ) : pendingLines.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="size-5" />}
            title={t("purchasing.khongCoDongCho")}
          />
        ) : (
          <CreatePurchaseOrderForm
            vesselId={selectedVesselId}
            suppliers={suppliers}
            lines={pendingLines}
            defaultDate={defaultDate}
          />
        )}
      </Card>
    </div>
  );
}
