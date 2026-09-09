"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import {
  Anchor,
  BarChart3,
  Boxes,
  ChevronRight,
  ClipboardList,
  Droplets,
  FileText,
  History,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Paintbrush,
  Ship,
  ShoppingCart,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import ChonNgonNgu from "@/components/ChonNgonNgu";
import DoiChuDe from "@/components/DoiChuDe";
import { LogoLockup } from "@/components/MercuryLogo";
import { Avatar } from "@/components/ui";
import type { ChuDe } from "@/lib/chuDe";
import { cn } from "@/lib/cn";

/**
 * Vỏ ứng dụng — thanh bên + thanh trên — cùng bố cục với app Quản lý thuyền
 * viên (apps/web/src/components/Layout.tsx) để hai hệ thống của công ty nhìn
 * là một.
 *
 * Là client component vì cần biết đang ở trang nào (tô đậm mục menu) và giữ
 * trạng thái mở/đóng của ngăn kéo trên màn hình nhỏ. Mọi CHỮ đã được dịch ở
 * server (app/(app)/layout.tsx) và trao xuống — file này không tra từ điển,
 * nên đổi ngôn ngữ không kéo theo bundle từ điển ra client thêm lần nữa.
 */

export type TenIcon =
  | "dashboard"
  | "fleet"
  | "materials"
  | "inventory"
  | "requests"
  | "purchasing"
  | "reports"
  | "paint"
  | "consumables"
  | "lashing"
  | "documents"
  | "users"
  | "audit";

const ICON: Record<TenIcon, ReactNode> = {
  dashboard: <LayoutDashboard className="size-4" />,
  fleet: <Ship className="size-4" />,
  materials: <Boxes className="size-4" />,
  inventory: <Warehouse className="size-4" />,
  requests: <ClipboardList className="size-4" />,
  purchasing: <ShoppingCart className="size-4" />,
  reports: <BarChart3 className="size-4" />,
  paint: <Paintbrush className="size-4" />,
  consumables: <Droplets className="size-4" />,
  lashing: <Link2 className="size-4" />,
  documents: <FileText className="size-4" />,
  users: <Users className="size-4" />,
  audit: <History className="size-4" />,
};

export type MucMenu = {
  href: string;
  label: string;
  icon: TenIcon;
  /** Chỉ khớp đúng đường dẫn (Dashboard), không khớp tiền tố. */
  end?: boolean;
  /** Mục "Đội tàu": sổ ra danh sách từng tàu bên dưới. */
  doiTau?: boolean;
};

export type NhomMenu = { label: string; items: MucMenu[] };

type TauTrongMenu = { id: number; code: string; name: string };

const MUC =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition";
const MUC_THUONG =
  "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]";
const MUC_DANG_CHON = "bg-brand-500/12 text-brand-700 dark:text-brand-300";

export default function AppShell({
  nhom,
  tau,
  taiKhoan,
  nhan,
  chuDeBanDau,
  logout,
  children,
}: {
  nhom: NhomMenu[];
  tau: TauTrongMenu[];
  taiKhoan: { name: string; vaiTro: string; phamVi: string };
  nhan: {
    heThong: string;
    dangXuat: string;
    tatCaDoiTau: string;
    moMenu: string;
    dongMenu: string;
    cheDoSang: string;
    cheDoToi: string;
  };
  chuDeBanDau: ChuDe;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const [moNgan, setMoNgan] = useState(false);
  // Đang đứng ở trang của một con tàu thì danh sách tàu mở sẵn, để thấy ngay
  // mình đang ở đâu trong đội tàu.
  const [moDoiTau, setMoDoiTau] = useState(pathname.startsWith("/vessels"));

  const dangChon = (m: MucMenu) =>
    m.end ? pathname === m.href : pathname === m.href || pathname.startsWith(m.href + "/");

  const dieuHuong = (
    <nav className="flex flex-col gap-6">
      {nhom.map((g) => (
        <div key={g.label}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            {g.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {g.items.map((m) =>
              m.doiTau && tau.length > 0 ? (
                <div key={m.href}>
                  <button
                    type="button"
                    onClick={() => setMoDoiTau((v) => !v)}
                    aria-expanded={moDoiTau}
                    className={cn(MUC, "w-full text-left", dangChon(m) ? MUC_DANG_CHON : MUC_THUONG)}
                  >
                    {ICON[m.icon]}
                    <span className="flex-1">{m.label}</span>
                    <ChevronRight
                      className={cn("size-3.5 opacity-60 transition-transform", moDoiTau && "rotate-90")}
                      aria-hidden
                    />
                  </button>
                  {moDoiTau && (
                    <div className="mt-0.5 ml-5 flex flex-col gap-0.5 border-l border-[var(--border-subtle)] pl-3">
                      <Link
                        href="/vessels"
                        onClick={() => setMoNgan(false)}
                        className="rounded-md px-2 py-1.5 text-xs text-brand-700 transition hover:bg-[var(--surface-sunken)] dark:text-brand-300"
                      >
                        {nhan.tatCaDoiTau}
                      </Link>
                      {tau.map((v) => {
                        const dangXem = pathname === `/vessels/${v.id}`;
                        return (
                          <Link
                            key={v.id}
                            href={`/vessels/${v.id}`}
                            onClick={() => setMoNgan(false)}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition hover:bg-[var(--surface-sunken)]",
                              dangXem
                                ? "bg-[var(--surface-sunken)] font-medium text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)]"
                            )}
                          >
                            <Anchor className="size-3 shrink-0 opacity-60" />
                            <span className="font-display text-[11px] tracking-wide text-[var(--text-muted)]">
                              {v.code}
                            </span>
                            <span className="truncate">{v.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setMoNgan(false)}
                  aria-current={dangChon(m) ? "page" : undefined}
                  className={cn(MUC, dangChon(m) ? MUC_DANG_CHON : MUC_THUONG)}
                >
                  {ICON[m.icon]}
                  {m.label}
                </Link>
              )
            )}
          </div>
        </div>
      ))}
    </nav>
  );

  const chanThanhBen = (
    <p className="mt-6 px-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
      ISM · MLS-11 · IMPA
    </p>
  );

  return (
    <div className="flex min-h-screen">
      {/* Họa tiết vòng cung của nhận diện — dưới cùng, không nhận chuột. */}
      <div className="app-motif" aria-hidden="true" />

      {/* Thanh bên — màn hình lớn */}
      <aside className="surface sticky top-0 z-10 hidden h-screen w-64 shrink-0 flex-col border-r px-4 py-5 lg:flex">
        <Link href="/dashboard" className="px-2">
          <LogoLockup height={30} />
        </Link>
        <div className="mt-8 flex-1 overflow-y-auto">{dieuHuong}</div>
        {chanThanhBen}
      </aside>

      {/* Thanh bên — màn hình nhỏ (ngăn kéo) */}
      {moNgan && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMoNgan(false)}
          />
          <aside className="surface absolute inset-y-0 left-0 flex w-72 flex-col border-r px-4 py-5">
            <div className="flex items-center justify-between px-2">
              <LogoLockup height={28} />
              <button
                type="button"
                onClick={() => setMoNgan(false)}
                aria-label={nhan.dongMenu}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-8 flex-1 overflow-y-auto">{dieuHuong}</div>
            {chanThanhBen}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-header surface sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMoNgan(true)}
            aria-label={nhan.moMenu}
            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <p className="hidden text-xs text-[var(--text-secondary)] sm:block">
            {nhan.heThong}
          </p>

          <div className="ml-auto flex items-center gap-2">
            <Suspense>
              <ChonNgonNgu />
            </Suspense>
            <DoiChuDe banDau={chuDeBanDau} nhan={{ sang: nhan.cheDoSang, toi: nhan.cheDoToi }} />

            {/* Tài khoản — sát góc phải, sau nút ngôn ngữ và sáng/tối */}
            <div className="ml-1 flex items-center gap-2 border-l border-[var(--border-subtle)] pl-3">
              <Avatar name={taiKhoan.name} size={32} />
              <div className="hidden leading-tight md:block">
                <p className="text-sm font-medium text-[var(--text-primary)]">{taiKhoan.name}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {taiKhoan.vaiTro} · {taiKhoan.phamVi}
                </p>
              </div>
              <form action={logout}>
                <button
                  type="submit"
                  title={nhan.dangXuat}
                  aria-label={nhan.dangXuat}
                  className="rounded-lg p-2 text-[var(--text-secondary)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
                >
                  <LogOut className="size-4" />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="relative z-10 min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
