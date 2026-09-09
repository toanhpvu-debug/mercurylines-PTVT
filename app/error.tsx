"use client";

import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { LogoLockup } from "@/components/MercuryLogo";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Card } from "@/components/ui";

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { t } = useNgonNgu();
  return (
    /* Ranh giới lỗi nằm NGOÀI vỏ ứng dụng — dựng lại dáng trang đăng nhập:
       một thẻ ở giữa nền có họa tiết vòng cung. */
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <div className="app-motif" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoLockup height={44} />
        </div>
        <Card className="text-center">
          <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]">
            <AlertTriangle className="size-5" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            {t("login.loiTieuDe")}
          </h1>
          <p className="mt-1 mb-5 text-sm text-[var(--text-secondary)]">
            {t("login.loiNoiDung")}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              variant="primary"
              onClick={() => retry()}
              icon={<RotateCcw className="size-4" />}
            >
              {t("login.thuLai")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.history.back()}
              icon={<ArrowLeft className="size-4" />}
            >
              {t("chung.quayLai")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
