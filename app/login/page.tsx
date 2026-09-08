import { cookies } from "next/headers";
import { Suspense } from "react";
import ChonNgonNgu from "@/components/ChonNgonNgu";
import DoiChuDe from "@/components/DoiChuDe";
import LoginForm from "@/components/LoginForm";
import { LogoLockup } from "@/components/MercuryLogo";
import { COOKIE_CHU_DE, docChuDe } from "@/lib/chuDe";
import { layT } from "@/lib/i18n/server";

export default async function LoginPage() {
  const [{ t }, kho] = await Promise.all([layT(), cookies()]);
  const chuDe = docChuDe(kho.get(COOKIE_CHU_DE)?.value);
  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <div className="app-motif" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoLockup height={44} />
          <p className="text-sm text-[var(--text-secondary)]">{t("chung.moTaApp")}</p>
        </div>
        <div className="surface rounded-2xl border p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            {t("login.dangNhap")}
          </h1>
          <p className="mt-1 mb-5 text-sm text-[var(--text-secondary)]">
            {t("login.moTaDangNhap")}
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        {/* Đổi ngôn ngữ / chế độ được ngay từ trước khi đăng nhập — thuyền viên
            nước ngoài không phải đoán chữ Việt để tìm nút đăng nhập. */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <Suspense>
            <ChonNgonNgu />
          </Suspense>
          <DoiChuDe
            banDau={chuDe}
            nhan={{ sang: t("menu.cheDoSang"), toi: t("menu.cheDoToi") }}
          />
        </div>
      </div>
    </div>
  );
}
