import { requireScopedUser } from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import QuetQr from "@/components/QuetQr";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * /quet — quét nhãn QR dán trên mặt hàng bằng camera, ghi nhập/xuất/đếm tại chỗ.
 * Phần camera, giải mã và bảng ghi nằm trong components/QuetQr.tsx (client).
 *
 * Bố cục theo máy:
 *   - ĐIỆN THOẠI (dưới lg): camera là thứ đầu tiên, sát mép trên ngay dưới thanh
 *     tiêu đề của app và tràn hết chiều ngang. Không có tiêu đề trang, không có
 *     khung thẻ — hai thứ đó đẩy khung hình xuống nửa dưới màn hình, người cầm
 *     máy phải giơ cao hoặc cuộn mới thấy mình đang ngắm vào đâu. Lề âm bù lại
 *     phần đệm của <main>.
 *   - MÁY TÍNH (lg trở lên): có tiêu đề, camera nằm trong thẻ như các trang khác.
 */
export default async function QuetPage() {
  await requireScopedUser();
  const { t } = await layT();
  return (
    <div className="mx-auto max-w-xl lg:space-y-5">
      <div className="hidden lg:block">
        <PageHeader title={t("qr.quetTieuDe")} subtitle={t("qr.quetMoTa")} />
      </div>
      <div className="-mx-4 -mt-6 sm:-mx-6 lg:mx-0 lg:mt-0 lg:rounded-xl lg:border lg:border-[var(--border-subtle)] lg:bg-[var(--surface-raised)] lg:p-5 lg:shadow-sm">
        <QuetQr />
      </div>
    </div>
  );
}
