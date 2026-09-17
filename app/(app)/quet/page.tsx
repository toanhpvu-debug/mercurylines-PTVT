import { QrCode } from "lucide-react";
import { requireScopedUser } from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import QuetQr from "@/components/QuetQr";
import { Card, CardHeader, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * /quet — quét nhãn QR dán trên mặt hàng bằng camera, mở thẳng thẻ kho.
 * Phần camera và giải mã nằm trong components/QuetQr.tsx (client).
 */
export default async function QuetPage() {
  await requireScopedUser();
  const { t } = await layT();
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title={t("qr.quetTieuDe")} subtitle={t("qr.quetMoTa")} />
      <Card>
        <CardHeader icon={<QrCode className="size-4" />} title={t("qr.quetTieuDe")} />
        <QuetQr />
      </Card>
    </div>
  );
}
