"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { useNgonNgu } from "@/lib/i18n/client";

export default function PrintButton({ label }: { label?: string }) {
  const { t } = useNgonNgu();
  return (
    <Button
      type="button"
      variant="secondary"
      icon={<Printer className="size-4" />}
      onClick={() => window.print()}
      className="no-print"
    >
      {label ?? t("inventory.inBaoCao")}
    </Button>
  );
}
