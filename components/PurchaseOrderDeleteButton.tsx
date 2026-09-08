"use client";

import { startTransition, useActionState } from "react";
import { deletePurchaseOrder } from "@/app/actions";
import { useNgonNgu } from "@/lib/i18n/client";

// Xóa đơn mua đã hủy. Chỉ hiện với quản trị viên và chỉ ở đơn ĐÃ HỦY —
// điều kiện được kiểm lại ở server nên nút này không phải lớp bảo vệ duy nhất.
export default function PurchaseOrderDeleteButton({
  id,
  poNo,
  className,
}: {
  id: number;
  poNo: string;
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
      <button
        disabled={pending}
        className={
          className ??
          "text-sm text-red-600 hover:underline disabled:opacity-50"
        }
        title={state.message || t("purchasing.tooltipXoaDon")}
      >
        {pending ? t("purchasing.dangXoa") : t("chung.xoa")}
      </button>
      {state.message && !state.success && (
        <p className="mt-1 text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}
