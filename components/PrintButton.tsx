"use client";

import { useNgonNgu } from "@/lib/i18n/client";

export default function PrintButton({ label }: { label?: string }) {
  const { t } = useNgonNgu();
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800"
    >
      {label ?? t("inventory.inBaoCao")}
    </button>
  );
}
