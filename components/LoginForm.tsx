"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/app/actions";

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.6" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, pending] = useActionState(login, {
    message: "",
  });
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="mb-1 block text-sm text-slate-600">Email</label>
        <input
          name="email"
          type="email"
          placeholder="admin@example.com"
          className="w-full rounded border p-2"
          defaultValue={state.email ?? ""}
          required
          autoFocus
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">Mật khẩu</label>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className="w-full rounded border p-2 pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-blue-700"
          >
            <EyeIcon off={showPassword} />
          </button>
        </div>
      </div>
      <button
        disabled={pending}
        className="w-full rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
      {state.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}
    </form>
  );
}
