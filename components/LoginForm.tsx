"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { LogIn, Mail } from "lucide-react";
import { login } from "@/app/actions";
import { Button, Field, Input, Notice } from "@/components/ui";
import { PasswordInput } from "@/components/ui-client";
import { useNgonNgu } from "@/lib/i18n/client";

export default function LoginForm() {
  const { t } = useNgonNgu();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const [state, formAction, pending] = useActionState(login, {
    message: "",
  });
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label={t("login.email")}>
        <span className="relative block">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            name="email"
            type="email"
            placeholder="ten@mercurylines.com"
            className="pl-9"
            defaultValue={state.email ?? ""}
            required
            autoFocus
          />
        </span>
      </Field>
      <Field label={t("login.matKhau")}>
        <PasswordInput
          name="password"
          placeholder="••••••••"
          required
          labels={{ show: t("login.hienMatKhau"), hide: t("login.anMatKhau") }}
        />
      </Field>
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        loading={pending}
        icon={<LogIn className="size-4" />}
      >
        {pending ? t("login.dangDangNhap") : t("login.dangNhap")}
      </Button>
      {state.message && <Notice tone="danger">{state.message}</Notice>}
    </form>
  );
}
