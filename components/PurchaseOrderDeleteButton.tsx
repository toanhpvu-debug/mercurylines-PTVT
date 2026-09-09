"use client";

import { startTransition, useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deletePurchaseOrder } from "@/app/actions";
import { Button } from "@/components/ui";
import { useNgonNgu } from "@/lib/i18n/client";

// Xóa đơn mua đã hủy. Chỉ hiện với quản trị viên và chỉ ở đơn ĐÃ HỦY —
// điều kiện được kiểm lại ở server nên nút này không phải lớp bảo vệ duy nhất.
export default function PurchaseOrderDeleteButton({
  id,
  poNo,
  size = "md",
  className,
}: {
  id: number;
  poNo: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(deletePurchaseOrder, {
    message: "",
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (
          !confirm(
            `${t("purchasing.xacNhanXoaDon", { ma: poNo })}\n\n${t("purchasing.xacNhanXoaDonLyDo")}`
          )
        )
          return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <Button
        variant="danger"
        size={size}
        icon={<Trash2 className="size-4" />}
        loading={pending}
        className={className}
        title={state.message || t("purchasing.tooltipXoaDon")}
      >
        {pending ? t("purchasing.dangXoa") : t("chung.xoa")}
      </Button>
      {state.message && !state.success && (
        <p className="mt-1 text-xs text-[var(--text-danger)]">{state.message}</p>
      )}
    </form>
  );
}
