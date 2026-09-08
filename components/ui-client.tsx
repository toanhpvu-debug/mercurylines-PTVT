"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { FIELD } from "@/components/ui";

/**
 * Phần có state của bộ thành phần giao diện (xem components/ui.tsx). Tách file
 * để ui.tsx vẫn import được từ server component.
 */

/**
 * Ô nhập mật khẩu kèm nút con mắt để hiện/ẩn nội dung.
 *
 * - type="button": nằm trong <form> nên nếu để mặc định nó sẽ GỬI BIỂU MẪU.
 * - onMouseDown preventDefault: giữ con trỏ ở lại trong ô nhập.
 * - aria-pressed + nhãn đổi theo trạng thái để trình đọc màn hình đọc đúng.
 */
export function PasswordInput({
  labels,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  labels: { show: string; hide: string };
}) {
  const [shown, setShown] = useState(false);
  const label = shown ? labels.hide : labels.show;
  return (
    <span className="relative block">
      <input
        {...rest}
        type={shown ? "text" : "password"}
        className={cn(FIELD, "pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        onMouseDown={(e) => e.preventDefault()}
        aria-label={label}
        aria-pressed={shown}
        title={label}
        className={cn(
          "absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md",
          "text-[var(--text-secondary)] transition hover:bg-[var(--surface-sunken)]",
          "hover:text-[var(--text-primary)]",
          "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
        )}
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm sm:p-8">
      <div
        className={cn("surface my-auto w-full rounded-2xl border shadow-2xl", width)}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--surface-sunken)]"
            aria-label="close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
