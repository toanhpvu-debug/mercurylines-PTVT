"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteConsumableReceipt } from "@/app/consumable-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button } from "@/components/ui";

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
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(deleteConsumableReceipt, {
    message: "",
  });
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(t("consumables.xacNhanXoaPhieu", { so: docNo }))) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        size="sm"
        variant="danger"
        loading={pending}
        icon={<Trash2 className="size-4" />}
      >
        {t("chung.xoa")}
      </Button>
      {state.message && !state.success && (
        <span className="mt-1 block text-xs text-[var(--text-danger)]">
          {state.message}
        </span>
      )}
    </form>
  );
}
