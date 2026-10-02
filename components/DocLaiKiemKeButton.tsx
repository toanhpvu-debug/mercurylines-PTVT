"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { docLaiKiemKe } from "@/app/kiem-ke-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Notice } from "@/components/ui";

/** Giao bộ đọc AI đọc lại bản scan kiểm kê (chạy nền; trang tự làm mới). */
export default function DocLaiKiemKeButton({ id }: { id: number }) {
  const { t } = useNgonNgu();
  const [loi, setLoi] = useState("");
  const [dang, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        loading={dang}
        icon={<Sparkles className="size-4" />}
        onClick={() =>
          startTransition(async () => {
            const r = await docLaiKiemKe(id);
            if (!r.success) setLoi(r.message);
          })
        }
      >
        {t("kiemKe.docLaiAi")}
      </Button>
      {loi && <Notice tone="danger">{loi}</Notice>}
    </div>
  );
}
