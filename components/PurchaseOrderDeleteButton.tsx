"use client";

import { startTransition, useActionState } from "react";
import { deletePurchaseOrder } from "@/app/actions";

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
  const [state, action, pending] = useActionState(deletePurchaseOrder, {
    message: "",
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (
          !confirm(
            `Xóa vĩnh viễn đơn mua ${poNo}?\n\nĐơn này đã hủy và chưa nhận hàng nên xóa không ảnh hưởng tồn kho. Thao tác không hoàn tác được.`
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
        title={state.message || "Xóa vĩnh viễn đơn mua đã hủy"}
      >
        {pending ? "Đang xóa..." : "Xóa"}
      </button>
      {state.message && !state.success && (
        <p className="mt-1 text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}
