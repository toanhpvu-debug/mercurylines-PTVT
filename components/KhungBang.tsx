"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronsDownUp, ChevronsUpDown, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

type Cao = "gon" | "cao";
const CO_CHU = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.35, 1.5] as const;

/**
 * Khung cuộn của một bảng dài (tồn kho từng tàu, nhật ký nhập / xuất) kèm thanh nhỏ để xem
 * thoải mái hơn:
 *   - thu / phóng chữ (70–150 %, CSS zoom cả bảng nên cột giữ đúng tỉ lệ);
 *   - Mở rộng / Thu gọn chiều cao khung (gần hết màn hình ↔ 20rem);
 *   - Toàn màn hình: bảng phủ cả cửa sổ (Esc hoặc nút Đóng để thoát). Vẽ qua portal vào
 *     <body> để không bị khung cha nào cắt.
 * Cỡ chữ và chiều cao nhớ theo trình duyệt (localStorage, khóa `mercury.khung.<ten>`).
 */
export default function KhungBang({
  ten,
  tieuDe,
  caoMacDinh = "gon",
  className,
  children,
}: {
  /** Khóa nhớ lựa chọn — cùng một loại bảng dùng chung một khóa. */
  ten: string;
  /** Chữ ở đầu khung khi xem toàn màn hình (tên tàu…). */
  tieuDe?: ReactNode;
  caoMacDinh?: Cao;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useNgonNgu();
  const khoa = `mercury.khung.${ten}`;
  const [coChu, setCoChu] = useState(1);
  const [cao, setCao] = useState<Cao>(caoMacDinh);
  const [toanMan, setToanMan] = useState(false);
  const [daNap, setDaNap] = useState(false);

  // Nạp lựa chọn đã nhớ (sau khi hydrate — đọc ngay lúc dựng sẽ lệch HTML máy chủ).
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const luu = JSON.parse(window.localStorage.getItem(khoa) ?? "null") as { coChu?: number; cao?: Cao } | null;
        if (luu && CO_CHU.includes(luu.coChu as (typeof CO_CHU)[number])) setCoChu(luu.coChu!);
        if (luu?.cao === "gon" || luu?.cao === "cao") setCao(luu.cao);
      } catch {
        /* localStorage bị chặn / dữ liệu hỏng: dùng mặc định */
      }
      setDaNap(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [khoa]);

  const nho = (x: { coChu: number; cao: Cao }) => {
    try {
      window.localStorage.setItem(khoa, JSON.stringify(x));
    } catch {
      /* không nhớ được thì vẫn đổi trong phiên này */
    }
  };
  const doiCoChu = (buoc: number) => {
    const i = CO_CHU.indexOf(coChu as (typeof CO_CHU)[number]);
    const moi = buoc === 0 ? 1 : CO_CHU[Math.min(CO_CHU.length - 1, Math.max(0, (i < 0 ? 3 : i) + buoc))];
    setCoChu(moi);
    nho({ coChu: moi, cao });
  };
  const doiCao = () => {
    const moi: Cao = cao === "gon" ? "cao" : "gon";
    setCao(moi);
    nho({ coChu, cao: moi });
  };

  // Toàn màn hình: khóa cuộn trang phía sau, Esc để thoát.
  useEffect(() => {
    if (!toanMan) return;
    const truoc = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const phim = (e: KeyboardEvent) => {
      if (e.key === "Escape") setToanMan(false);
    };
    window.addEventListener("keydown", phim);
    return () => {
      document.body.style.overflow = truoc;
      window.removeEventListener("keydown", phim);
    };
  }, [toanMan]);

  const thanh = (
    <div className={cn("no-print flex flex-wrap items-center gap-1", toanMan ? "pb-2" : "justify-end pb-1.5")}>
      {toanMan && tieuDe && <div className="mr-auto min-w-0 truncate text-sm font-semibold text-[var(--text-primary)]">{tieuDe}</div>}
      <Button type="button" variant="ghost" size="sm" onClick={() => doiCoChu(-1)} disabled={coChu <= CO_CHU[0]} title={t("chung.khung_thuNho")} aria-label={t("chung.khung_thuNho")} icon={<ZoomOut className="size-4" />} />
      <button
        type="button"
        onClick={() => doiCoChu(0)}
        title={t("chung.khung_coGoc")}
        aria-label={t("chung.khung_coGoc")}
        className="tabular w-12 rounded-md py-1 text-center text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
      >
        {Math.round(coChu * 100)}%
      </button>
      <Button type="button" variant="ghost" size="sm" onClick={() => doiCoChu(1)} disabled={coChu >= CO_CHU[CO_CHU.length - 1]} title={t("chung.khung_phongTo")} aria-label={t("chung.khung_phongTo")} icon={<ZoomIn className="size-4" />} />
      {!toanMan && (
        <Button type="button" variant="ghost" size="sm" onClick={doiCao} icon={cao === "gon" ? <ChevronsUpDown className="size-4" /> : <ChevronsDownUp className="size-4" />}>
          {cao === "gon" ? t("chung.khung_moRong") : t("chung.khung_thuGon")}
        </Button>
      )}
      {toanMan ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => setToanMan(false)} icon={<X className="size-4" />}>
          {t("chung.khung_dong")}
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => setToanMan(true)} icon={<Maximize2 className="size-4" />}>
          {t("chung.khung_toanMan")}
        </Button>
      )}
    </div>
  );

  const khung = (
    <div
      className={cn(toanMan ? "fixed inset-0 z-[60] flex flex-col bg-[var(--surface)] p-3 sm:p-4" : className)}
      role={toanMan ? "dialog" : undefined}
      aria-modal={toanMan || undefined}
    >
      {thanh}
      <div
        className={cn(
          "overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)]",
          toanMan ? "min-h-0 flex-1" : cao === "cao" ? "max-h-[calc(100vh-10rem)]" : "max-h-80"
        )}
        data-co-chu={daNap ? coChu : undefined}
      >
        {/* zoom ở lớp trong: khung giữ đúng chiều cao, chỉ bảng to / nhỏ đi. */}
        <div style={coChu !== 1 ? { zoom: coChu } : undefined}>{children}</div>
      </div>
    </div>
  );
  return toanMan ? createPortal(khung, document.body) : khung;
}
