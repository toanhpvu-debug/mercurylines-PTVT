import { Suspense } from "react";
import ChonNgonNgu from "@/components/ChonNgonNgu";
import LoginForm from "@/components/LoginForm";
import { MercuryLogo } from "@/components/MercuryLogo";
import { layT } from "@/lib/i18n/server";

export default async function LoginPage() {
  const { t } = await layT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0a1f44] via-[#0c2a5c] to-[#123c7a] p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl shadow-blue-950/40">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <MercuryLogo />
          </div>
          <p className="text-sm text-slate-500">{t("chung.moTaApp")}</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        {/* Đổi ngôn ngữ được ngay từ trước khi đăng nhập — thuyền viên nước
            ngoài không phải đoán chữ Việt để tìm nút đăng nhập. */}
        <div className="mt-6 flex justify-center">
          <Suspense>
            <ChonNgonNgu />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
