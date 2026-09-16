"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteMaterialRequest } from "@/app/actions";
import { Button } from "@/components/ui";
import { useNgonNgu } from "@/lib/i18n/client";

export default function RequestDeleteButton({
  id,
  requestNo,
  returnTo,
  size = "md",
  className,
  soDongDonMua = 0,
}: {
  id: number;
  requestNo: string;
  returnTo?: string;
  size?: "sm" | "md";
  className?: string;
  /**
   * Số dòng đơn mua đang hiệu lực trỏ vào yêu cầu này. Khác 0 thì xóa sẽ cắt
   * đứt đường lần từ đơn mua về yêu cầu gốc (khóa ngoại đặt ON DELETE SET NULL),
   * nên câu hỏi xác nhận phải nói thẳng ra thay vì hỏi chung chung "chắc chưa".
   */
  soDongDonMua?: number;
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(deleteMaterialRequest, {
    message: "",
  });
  const vuongDonMua = soDongDonMua > 0;
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const hoi = vuongDonMua
          ? t("requests.xacNhanXoaKemDonMua", {
              ma: requestNo,
              so: String(soDongDonMua),
            })
          : t("requests.xacNhanXoa", { ma: requestNo });
        if (!window.confirm(hoi)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      {vuongDonMua && (
        <input type="hidden" name="goLienKetDonMua" value="1" />
      )}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <Button
        variant="danger"
        size={size}
        icon={<Trash2 className="size-4" />}
        loading={pending}
        className={className}
      >
        {pending ? t("requests.dangXoa") : t("chung.xoa")}
      </Button>
      {state.message && (
        <p className="mt-1 text-xs text-[var(--text-danger)]">{state.message}</p>
      )}
    </form>
  );
}
