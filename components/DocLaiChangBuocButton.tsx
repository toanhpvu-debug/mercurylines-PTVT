"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { docLaiChangBuocAi } from "@/app/chang-buoc-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Notice } from "@/components/ui";

/** Giao bộ đọc AI đọc lại file MLS-11-13 dạng PDF (chạy nền; trang tự làm mới). */
export default function DocLaiChangBuocButton({ id }: { id: number }) {
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
            const r = await docLaiChangBuocAi(id);
            if (!r.success) setLoi(r.message);
          })
        }
      >
        {t("changBuoc.docLaiAi")}
      </Button>
      {loi && <Notice tone="danger">{loi}</Notice>}
    </div>
  );
}
