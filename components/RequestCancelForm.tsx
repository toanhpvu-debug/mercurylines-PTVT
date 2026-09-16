"use client";

import { useActionState } from "react";
import { Ban } from "lucide-react";
import { updateRequestStatus } from "@/app/actions";
import { Button } from "@/components/ui";
import { useNgonNgu } from "@/lib/i18n/client";

/**
 * Hủy một yêu cầu vật tư — giữ lại chứng từ, chỉ đổi trạng thái sang "Đã hủy".
 *
 * Tách khỏi RequestStatusForm dùng chung vì hủy là thao tác KHÔNG lùi lại được
 * (bảng REQUEST_ALLOWED_FROM không có đường nào đi ra khỏi CANCELLED), nên nó
 * cần một câu hỏi xác nhận trước khi gửi — đúng như nút Xóa. Các bước chuyển
 * khác đều đi tiếp được nên không cần.
 *
 * Đây mới là việc nên làm với yêu cầu đã duyệt hoặc đã chuyển mua sắm: xóa thì
 * mất luôn nhật ký ai duyệt lúc nào, còn hủy thì tờ chứng từ vẫn nằm trong sổ
 * với lý do rõ ràng.
 */
export default function RequestCancelForm({
  id,
  requestNo,
  returnTo,
  size = "md",
  className,
}: {
  id: number;
  requestNo: string;
  returnTo?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(updateRequestStatus, {
    message: "",
  });
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(t("requests.xacNhanHuy", { ma: requestNo }))) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value="CANCELLED" />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <Button
        variant="secondary"
        size={size}
        icon={<Ban className="size-4" />}
        loading={pending}
        className={className}
      >
        {pending ? t("requests.dangHuy") : t("requests.nutHuyYeuCau")}
      </Button>
      {state.message && (
        <p className="mt-1 text-xs text-[var(--text-danger)]">{state.message}</p>
      )}
    </form>
  );
}
