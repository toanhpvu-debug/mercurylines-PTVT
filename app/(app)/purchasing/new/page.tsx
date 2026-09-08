import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  chonDuocTau,
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import CreatePurchaseOrderForm from "@/components/CreatePurchaseOrderForm";
import { layT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

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
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-blue-950">
          {t("purchasing.tieuDeTaoDon")}
        </h2>
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          {t("chung.chuaGanTau")}
        </div>
      </div>
    );
  }

  // Chưa chọn tàu (người toàn đội) → hiện danh sách tàu để chọn.
  if (!selectedVesselId) {
    return (
      <div className="space-y-4">
        <Link
          href="/purchasing"
          className="text-sm text-blue-700 hover:underline"
        >
          {t("purchasing.quayLaiMuaSam")}
        </Link>
        <h2 className="text-2xl font-bold text-blue-950">
          {t("purchasing.taoDonChonTau")}
        </h2>
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
          {/* next/form: chọn tàu xong chuyển trang phía client (không tải lại
              cả trang); `required` vẫn chặn gửi khi chưa chọn. */}
          <Form action="/purchasing/new" className="flex items-center gap-2">
            <select
              name="vessel"
              className="rounded border p-2"
              defaultValue=""
              required
            >
              <option value="">{t("purchasing.phChonTauMuaSam")}</option>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} - {v.name}
                </option>
              ))}
            </select>
            <button className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800">
              {t("chung.tiepTuc")}
            </button>
          </Form>
        </div>
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
    <div className="space-y-4">
      <Link href="/purchasing" className="text-sm text-blue-700 hover:underline">
        {t("purchasing.quayLaiMuaSam")}
      </Link>
      <div>
        <h2 className="text-2xl font-bold text-blue-950">
          {t("purchasing.tieuDeTaoDon")} — {selectedVessel.code}{" "}
          {selectedVessel.name}
        </h2>
        <p className="text-slate-600">{t("purchasing.moTaTaoDon")}</p>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
        {suppliers.length === 0 ? (
          <p className="text-amber-700">
            {t("purchasing.chuaCoNcc")}{" "}
            <Link
              href="/purchasing/suppliers"
              className="text-blue-700 hover:underline"
            >
              {t("purchasing.themNcc")}
            </Link>{" "}
            {t("purchasing.truoc")}
          </p>
        ) : pendingLines.length === 0 ? (
          <p className="text-slate-600">{t("purchasing.khongCoDongCho")}</p>
        ) : (
          <CreatePurchaseOrderForm
            vesselId={selectedVesselId}
            suppliers={suppliers}
            lines={pendingLines}
            defaultDate={defaultDate}
          />
        )}
      </div>
    </div>
  );
}
