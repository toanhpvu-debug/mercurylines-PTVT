"use client";

import { useNgonNgu } from "@/lib/i18n/client";

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { t } = useNgonNgu();
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-xl bg-white p-8 shadow-sm ring-1 ring-blue-100">
      <h2 className="mb-2 text-xl font-bold text-red-600">
        {t("login.loiTieuDe")}
      </h2>
      <p className="mb-4 text-slate-600">{t("login.loiNoiDung")}</p>
      <div className="flex gap-3">
        <button
          onClick={() => retry()}
          className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800"
        >
          {t("login.thuLai")}
        </button>
        <button
          onClick={() => window.history.back()}
          className="rounded border px-4 py-2 hover:bg-blue-50"
        >
          {t("chung.quayLai")}
        </button>
      </div>
    </div>
  );
}
