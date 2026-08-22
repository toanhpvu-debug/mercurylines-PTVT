"use client";

import { useActionState } from "react";
import { deleteConsumableReceipt } from "@/app/consumable-actions";

/**
 * Xóa một phiếu nhận. Server hoàn lại đúng lượng đã cộng vào tồn, nên nút này
 * hỏi lại rõ ràng — xóa phiếu là đổi cả số tồn chứ không chỉ mất một dòng.
 */
export default function ConsumableReceiptDeleteButton({
  id,
  docNo,
}: {
  id: number;
  docNo: string;
}) {
  const [state, action, pending] = useActionState(deleteConsumableReceipt, {
    message: "",
  });
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            `Xóa phiếu ${docNo}? Số lượng của phiếu này sẽ được trừ lại khỏi tồn.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        disabled={pending}
        className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        {pending ? "..." : "Xóa"}
      </button>
      {state.message && !state.success && (
        <span className="block text-xs text-red-600">{state.message}</span>
      )}
    </form>
  );
}
