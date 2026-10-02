"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { docLaiBaoGiaAi } from "@/app/bao-gia-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Notice } from "@/components/ui";

/** Giao bộ đọc AI đọc lại báo giá PDF (chạy nền; trang tự làm mới). */
export default function DocLaiBaoGiaButton({ id }: { id: number }) {
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
            const r = await docLaiBaoGiaAi(id);
            if (!r.success) setLoi(r.message);
          })
        }
      >
        {t("purchasing.docLaiBaoGiaAi")}
      </Button>
      {loi && <Notice tone="danger">{loi}</Notice>}
    </div>
  );
}
