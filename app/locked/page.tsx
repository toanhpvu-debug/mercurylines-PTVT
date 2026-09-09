import { redirect } from "next/navigation";
import { Lock, LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { LogoLockup } from "@/components/MercuryLogo";
import { layT } from "@/lib/i18n/server";
import { Button, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LockedPage() {
  const user = await getCurrentUser();
  if (user && user.isActive) {
    redirect("/dashboard");
  }
  const { t } = await layT();
  return (
    /* Trang đứng NGOÀI vỏ ứng dụng (không thanh bên, không thanh trên) — cùng
       dáng với trang đăng nhập: một thẻ ở giữa nền có họa tiết vòng cung. */
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <div className="app-motif" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoLockup height={44} />
        </div>
        <Card className="text-center">
          <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]">
            <Lock className="size-5" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            {t("login.biKhoaTieuDe")}
          </h1>
          <p className="mt-1 mb-5 text-sm text-[var(--text-secondary)]">
            {t("login.biKhoaNoiDung")}
          </p>
          <form action={logout}>
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              icon={<LogOut className="size-4" />}
            >
              {t("menu.dangXuat")}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
