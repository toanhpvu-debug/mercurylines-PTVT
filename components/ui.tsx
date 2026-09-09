import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Bộ thành phần giao diện dùng chung — cùng dáng với app Quản lý thuyền viên
 * (apps/web/src/components/ui.tsx) để hai hệ thống của công ty nhìn là một.
 *
 * File này KHÔNG có "use client" và không dùng hook, nên import được từ server
 * component (đa số trang của app này). Thành phần cần state (hộp thoại, ô mật
 * khẩu có nút con mắt) nằm ở ui-client.tsx.
 *
 * Bảng đối chiếu khi chuyển trang cũ sang dáng mới:
 *   rounded-xl bg-white p-6 shadow-sm ring-1 ring-blue-100  →  <Card>
 *   <h2 text-2xl font-bold text-blue-950> + <p text-slate-600>  →  <PageHeader>
 *   <h3 text-lg font-semibold>  →  <CardHeader title=…>
 *   bg-blue-700 text-white px-4 py-2 rounded  →  <Button variant="primary">
 *   rounded border p-2  (input/select)  →  <Input> / <Select> (hoặc lớp FIELD)
 *   bg-red-100 text-red-700 rounded px-2 text-xs  →  <Badge tone="danger">
 *   <table className="w-full border text-sm">  →  <TableWrap><Table>…<Th>/<Td>
 *   text-blue-950 → text-[var(--text-primary)] · text-slate-600 → --text-secondary
 *   text-slate-500/400 → --text-muted · bg-slate-50/100 → bg-[var(--surface-sunken)]
 *   border/ring blue-100 → border-[var(--border-subtle)]
 *   link text-blue-700 → text-brand-700 dark:text-brand-300
 */

// ── Khung nội dung ────────────────────────────────────────

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface rounded-xl border shadow-sm",
        padded && "p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-700 dark:text-brand-400">
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="flex flex-wrap items-center gap-2">{action}</div>
      )}
    </div>
  );
}

// ── Số liệu ───────────────────────────────────────────────

export type Tone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

const STAT_ACCENT: Record<Tone, string> = {
  neutral: "text-[var(--text-primary)]",
  brand: "text-brand-700 dark:text-brand-400",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-rose-600 dark:text-rose-400",
  info: "text-sky-600 dark:text-sky-400",
  muted: "text-[var(--text-secondary)]",
};

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  /** Có href thì cả thẻ là một liên kết (thẻ KPI trên Dashboard). */
  href?: string;
}) {
  const noiDung = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
          {label}
        </p>
        {icon && <span className="text-[var(--text-muted)]">{icon}</span>}
      </div>
      <p className={cn("tabular mt-2 text-2xl font-semibold", STAT_ACCENT[tone])}>
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{sub}</p>
      )}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        className="surface block rounded-xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        {noiDung}
      </a>
    );
  }
  return <Card className="relative overflow-hidden">{noiDung}</Card>;
}

// ── Nhãn trạng thái ───────────────────────────────────────

/* Mỗi tone dùng nền ĐẶC khai báo trong globals.css: mọi cặp nền/chữ đã được
   giải sẵn cho đạt ≥ 4,6:1 ở cả hai chế độ, dù nhãn nằm trên thẻ hay trên hàng
   kẻ sọc. */
const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-[var(--tone-neutral-bg)] text-[var(--tone-neutral-text)]",
  brand: "bg-[var(--tone-brand-bg)] text-[var(--tone-brand-text)]",
  success: "bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]",
  warning: "bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]",
  danger: "bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]",
  info: "bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]",
  muted: "bg-[var(--tone-muted-bg)] text-[var(--tone-muted-text)]",
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className,
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/**
 * Trạng thái yêu cầu vật tư / đơn mua → tone. Dùng chung để Dashboard, danh
 * sách và trang chi tiết tô cùng một màu cho cùng một trạng thái.
 */
export const TONE_YEU_CAU: Record<string, Tone> = {
  DRAFT: "muted",
  PENDING_MASTER: "warning",
  PENDING_OFFICE: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  IN_PROCUREMENT: "brand",
  PARTIALLY_DELIVERED: "info",
  FULLY_DELIVERED: "success",
  CLOSED: "neutral",
  CANCELLED: "muted",
};

export const TONE_DON_MUA: Record<string, Tone> = {
  DRAFT: "muted",
  SENT: "brand",
  CONFIRMED: "info",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
  CLOSED: "neutral",
  CANCELLED: "muted",
};

// ── Nút ───────────────────────────────────────────────────

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
};

const BUTTON_VARIANT = {
  primary: "bg-brand-700 text-white hover:bg-brand-600 shadow-sm",
  secondary:
    "surface border text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]",
  ghost: "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]",
  danger: "bg-rose-600 text-white hover:bg-rose-500 shadow-sm",
};

/** Lớp của nút — dùng cho <Link> hay <a> muốn trông như nút. */
export function buttonClass(
  variant: keyof typeof BUTTON_VARIANT = "secondary",
  size: "sm" | "md" = "md",
  className?: string
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none",
    size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
    BUTTON_VARIANT[variant],
    className
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ── Ô nhập ────────────────────────────────────────────────

/** Lớp ô nhập — xuất ra để form phức tạp (nhiều ô trong bảng) dùng thẳng. */
export const FIELD =
  "field w-full rounded-lg border px-3 py-2 text-sm " +
  "placeholder:text-[var(--text-muted)] focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none " +
  "disabled:cursor-not-allowed disabled:opacity-60";

/** Có truyền bề rộng riêng không (w-64, w-24…) — `w-full` không tính. */
const CO_BE_RONG = /(^|\s)w-(?!full(\s|$))/;

/**
 * Ghép lớp cho ô nhập, BỎ `w-full` mặc định khi nơi gọi đã truyền bề rộng riêng.
 *
 * `cn` chỉ nối chuỗi chứ không gộp lớp Tailwind cùng nhóm, mà giữa hai lớp cùng
 * nhóm thì lớp nào thắng là do THỨ TỰ TRONG TỆP CSS quyết định, không phải thứ
 * tự trong `class=""`. Nên `cn(FIELD, "w-64")` vẫn ra ô rộng hết dòng — đúng lỗi
 * làm sổ trang bị chằng buộc xếp thành một cột dọc thay vì một hàng ngang. Gỡ
 * `w-full` đi thì không còn hai lớp tranh nhau, khỏi phải dùng `!important`.
 *
 * `max-w-` / `min-w-` không tranh với `w-full` nên vẫn giữ nguyên.
 */
function lopO(className?: string) {
  const co = className ? CO_BE_RONG.test(className) : false;
  return cn(co ? FIELD.replace("w-full ", "") : FIELD, className);
}

export function Input({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={lopO(className)} {...rest} />;
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={lopO(className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={lopO(cn("cursor-pointer pr-8", className))} {...rest}>
      {children}
    </select>
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-[var(--text-muted)]">
          {hint}
        </span>
      )}
    </label>
  );
}

// ── Thông báo ─────────────────────────────────────────────

/** Hộp thông báo trong trang (cảnh báo chưa gán tàu, kết quả form…). */
export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2.5 text-sm",
        TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </div>
  );
}

// ── Bảng ──────────────────────────────────────────────────

export function TableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface overflow-x-auto rounded-xl border shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

/** `dense` giảm đệm cho bảng dữ liệu dài — nhìn được nhiều dòng hơn một màn hình. */
export function Table({
  children,
  className,
  dense,
}: {
  children: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <table
      className={cn(
        "w-full min-w-max text-sm",
        dense && "[&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2",
        className
      )}
    >
      {children}
    </table>
  );
}

export function Th({
  children,
  align = "left",
  className,
  colSpan,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  colSpan?: number;
}) {
  return (
    <th
      colSpan={colSpan}
      className={cn(
        "border-b border-[var(--border-subtle)] px-4 py-3 text-xs font-semibold",
        "whitespace-nowrap text-[var(--text-secondary)] uppercase tracking-wide",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
  colSpan,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-b border-[var(--border-subtle)] px-4 py-3 text-[var(--text-primary)]",
        align === "right" && "text-right tabular",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("last:[&>td]:border-b-0", className)}>{children}</tr>
  );
}

/** Dòng tiêu đề nhóm trong bảng (Boong · Máy · Điện…). */
export function TrNhom({
  children,
  colSpan,
  className,
}: {
  children: ReactNode;
  colSpan: number;
  className?: string;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={cn(
          "border-y border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]",
          className
        )}
      >
        {children}
      </td>
    </tr>
  );
}

// ── Trạng thái rỗng / lỗi / đang tải ──────────────────────

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2 className={cn("size-5 animate-spin text-brand-500", className)} />
  );
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-muted)]">
        {icon ?? <Inbox className="size-5" />}
      </span>
      <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      {hint && (
        <p className="max-w-sm text-xs text-[var(--text-secondary)]">{hint}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-rose-500/10 text-rose-500">
        <AlertTriangle className="size-5" />
      </span>
      <p className="max-w-md text-sm text-[var(--text-primary)]">{message}</p>
    </div>
  );
}

// ── Avatar chữ cái ────────────────────────────────────────

/** Hue theo tên để phân biệt người; độ sáng / bão hòa theo chế độ (biến CSS). */
export function avatarHue(ten: string): number {
  let h = 0;
  for (const c of ten) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function initials(ten: string): string {
  const tu = ten.trim().split(/\s+/).filter(Boolean);
  if (tu.length === 0) return "?";
  if (tu.length === 1) return tu[0].slice(0, 2).toUpperCase();
  return (tu[0][0] + tu[tu.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const hue = avatarHue(name);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `oklch(var(--avatar-bg) ${hue})`,
        color: `oklch(var(--avatar-fg) ${hue})`,
      }}
    >
      {initials(name)}
    </span>
  );
}

// ── Thanh tiến độ ─────────────────────────────────────────

const METER_BAR: Record<Tone, string> = {
  neutral: "bg-slate-400",
  brand: "bg-brand-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  muted: "bg-slate-300",
};

export function Meter({
  value,
  max = 100,
  tone = "brand",
  className,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]",
        className
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all", METER_BAR[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Cặp nhãn / giá trị ────────────────────────────────────

export function DataRow({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-xs text-[var(--text-secondary)]">{label}</dt>
      <dd className="text-right text-sm font-medium text-[var(--text-primary)]">
        {value ?? "—"}
      </dd>
    </div>
  );
}
