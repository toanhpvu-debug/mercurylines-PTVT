import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { MercuryLogo } from "@/components/MercuryLogo";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0a1f44] via-[#0c2a5c] to-[#123c7a] p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl shadow-blue-950/40">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <MercuryLogo />
          </div>
          <p className="text-sm text-slate-500">
            Hệ thống quản lý vật tư đội tàu Mercury Lines
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
