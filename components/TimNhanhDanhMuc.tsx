"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { useNgonNgu } from "@/lib/i18n/client";

/**
 * Thanh tìm nhanh + mục lục bộ phận, DÍNH ở đầu màn hình khi cuộn danh mục.
 *
 * Danh mục gốc có hơn 600 dòng. Trước đây ô tìm nằm trong một form phải bấm
 * "Tìm", còn muốn tới phần Máy hay Điện thì cuộn qua hàng trăm dòng. Thanh này
 * giải quyết cả hai:
 *   - Gõ là lọc: sau 300 ms không gõ nữa, đường dẫn đổi `?q=` và server trả về
 *     đúng các dòng khớp trong TOÀN BỘ danh mục (trang không cắt 40 dòng đầu mỗi
 *     bộ phận khi đang tìm). Lọc ở server chứ không ẩn/hiện dòng trên trang, vì
 *     trang mặc định chỉ dựng 40 dòng đầu mỗi bộ phận — lọc trên trang sẽ bỏ sót
 *     phần chưa dựng.
 *   - Mục lục bộ phận: mỗi ô là một liên kết #neo tới đầu bộ phận đó kèm số
 *     dòng; bấm là nhảy, không cuộn tay. Ô vàng = bộ phận đang bị cắt bớt.
 *   - Phím "/" đưa con trỏ vào ô tìm từ bất kỳ đâu trên trang.
 * Các tham số khác trên đường dẫn (loại, tàu, chức danh) giữ nguyên.
 *
 * Lọc TẠM ngay khi gõ: trong lúc chờ server (một vòng mạng + tải RSC 0,5–1,7 MB
 * — đo 2026-10-02; trên đường vệ tinh là vài giây), các dòng ĐANG hiện trên
 * trang được ẩn/hiện tức thì theo chữ của dòng, để người gõ thấy kết quả ngay.
 * Chỉ là xem trước: kết quả đầy đủ vẫn từ server (gồm cả dòng chưa dựng), và
 * khi nó về thì bỏ hết lọc tạm — thuộc tính hidden do mình gắn nằm ngoài props
 * của React, để lại thì React dùng lại thẻ <tr> cũ mà vẫn ẩn.
 */
const DAU_AN = "data-an-tim";

/** Báo cho ChonHangLoat đếm lại ô tick (nó nghe sự kiện change nổi bọt). */
function baoDoiChon() {
  document.querySelector<HTMLInputElement>("input[data-chon-vat-tu]")?.dispatchEvent(new Event("change", { bubbles: true }));
}

function boLocTam() {
  let co = false;
  for (const e of document.querySelectorAll<HTMLElement>(`[${DAU_AN}]`)) {
    e.hidden = false;
    e.removeAttribute(DAU_AN);
    co = true;
  }
  if (co) baoDoiChon();
}

function locTam(gt: string) {
  boLocTam();
  const q = gt.trim().toLowerCase();
  if (!q) return;
  const an = (e: HTMLElement) => {
    e.hidden = true;
    e.setAttribute(DAU_AN, "1");
  };
  for (const o of document.querySelectorAll<HTMLInputElement>("input[data-chon-vat-tu]")) {
    const tr = o.closest("tr");
    if (tr && !(tr.textContent ?? "").toLowerCase().includes(q)) {
      an(tr);
      // Dòng bị ẩn thì bỏ tick — không để thao tác hàng loạt chạy lên dòng không thấy.
      o.checked = false;
    }
  }
  // Bộ phận không còn dòng nào hiện thì ẩn cả khối (tiêu đề bộ phận / thiết bị).
  for (const tb of document.querySelectorAll<HTMLElement>('tbody[id^="bo-phan-"]')) {
    const conHien = [...tb.querySelectorAll<HTMLInputElement>("input[data-chon-vat-tu]")].some((o) => !o.closest("tr")?.hidden);
    if (!conHien) an(tb);
  }
  baoDoiChon();
}
export default function TimNhanhDanhMuc({
  nhom,
  tongDong,
  dangHien,
}: {
  nhom: { key: string; label: string; total: number; hienThi: number }[];
  tongDong: number;
  dangHien: number;
}) {
  const { t } = useNgonNgu();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qTrenUrl = params.get("q") ?? "";
  const daXemTatCa = params.get("full") === "1";
  const [q, setQ] = useState(qTrenUrl);
  const [dangTim, batDauTim] = useTransition();
  const o = useRef<HTMLInputElement>(null);
  const hen = useRef<number | null>(null);

  const duongDanVoi = (sua: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params.toString());
    sua(p);
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const xemTatCaHref = duongDanVoi((p) => p.set("full", "1"));
  const thuGonHref = duongDanVoi((p) => p.delete("full"));

  const dayLenUrl = (gt: string) => {
    // Dựng từ đường dẫn LÚC CHẠY, không từ params của lượt vẽ cũ: hẹn giờ 500 ms
    // có thể chạy sau khi người dùng đã bấm đổi tab loại / tàu — dùng params cũ
    // là kéo đường dẫn về tab trước.
    const p = new URLSearchParams(window.location.search);
    if (gt.trim()) p.set("q", gt.trim());
    else p.delete("q");
    const qs = p.toString();
    const href = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    batDauTim(() => {
      router.replace(href, { scroll: false });
    });
  };

  // Chữ đang gõ (ref, cập nhật trong sự kiện) — để hiệu ứng khi kết quả server về
  // biết người dùng đã gõ tiếp hay chưa.
  const qHienTai = useRef(qTrenUrl);
  const doiQ = (gt: string) => {
    setQ(gt);
    qHienTai.current = gt;
    // Chữ trùng kết quả đang hiện (gõ rồi xóa lại, thêm dấu cách, Enter cùng chữ):
    // đường dẫn không đổi nên kết quả server không "về" lại — trả trang về
    // nguyên kết quả server thay vì lọc tạm (lọc theo chữ trên dòng có thể ẩn
    // dòng khớp theo trường không in ra, như thiết bị).
    if (gt.trim() === qTrenUrl.trim()) boLocTam();
    else locTam(gt);
    if (hen.current !== null) window.clearTimeout(hen.current);
    // Đã lọc tạm ngay trên trang nên chờ lâu hơn một chút mới hỏi server: bớt
    // các lượt tải cả trang giữa chừng khi người dùng còn đang gõ.
    hen.current = window.setTimeout(() => dayLenUrl(gt), 500);
  };

  // Kết quả server về (đường dẫn đổi): bỏ lọc tạm; nếu người dùng đã gõ tiếp
  // sau lượt vừa về thì lọc tạm lại theo chữ hiện tại.
  useEffect(() => {
    boLocTam();
    if (qHienTai.current.trim() !== qTrenUrl.trim()) locTam(qHienTai.current);
  }, [qTrenUrl]);
  useEffect(() => boLocTam, []);

  useEffect(() => {
    // Phím "/" như GitHub, Gmail: tới ô tìm ngay, không phải cuộn lên đầu trang.
    const bat = (e: KeyboardEvent) => {
      const dich = e.target as HTMLElement | null;
      const dangGo =
        dich && (dich.tagName === "INPUT" || dich.tagName === "TEXTAREA" || dich.tagName === "SELECT" || dich.isContentEditable);
      if (e.key === "/" && !dangGo) {
        e.preventDefault();
        o.current?.focus();
        o.current?.select();
      }
    };
    window.addEventListener("keydown", bat);
    return () => {
      window.removeEventListener("keydown", bat);
      if (hen.current !== null) window.clearTimeout(hen.current);
    };
  }, []);

  return (
    <div className="sticky top-14 z-20 -mx-5 mb-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface-raised)]/80">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (hen.current !== null) window.clearTimeout(hen.current);
          dayLenUrl(q);
        }}
      >
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            ref={o}
            type="search"
            value={q}
            onChange={(e) => doiQ(e.target.value)}
            placeholder={t("materials.timNhanhGoiY")}
            autoComplete="off"
            spellCheck={false}
            aria-label={t("chung.tim")}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-2 pr-9 pl-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
          />
          {dangTim ? (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-[var(--text-muted)]" />
          ) : q ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                qHienTai.current = "";
                boLocTam();
                if (hen.current !== null) window.clearTimeout(hen.current);
                dayLenUrl("");
                o.current?.focus();
              }}
              aria-label={t("chung.xoaTim")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]"
            >
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-[var(--border-subtle)] px-1.5 text-xs text-[var(--text-muted)] sm:block">
              /
            </kbd>
          )}
        </label>
        <span className="tabular shrink-0 text-sm text-[var(--text-secondary)]">
          {t("materials.dangHienNTrongM", { n: String(dangHien), m: String(tongDong) })}
        </span>
      </form>

      {nhom.length > 0 && (
        <nav aria-label={t("materials.nhayToi")} className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">{t("materials.nhayToi")}</span>
          {nhom.map((n) => (
            <a
              key={n.key}
              href={`#bo-phan-${n.key}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
            >
              {n.label}
              <Badge tone={n.hienThi < n.total ? "warning" : "neutral"}>
                {n.hienThi < n.total ? `${n.hienThi}/${n.total}` : n.total}
              </Badge>
            </a>
          ))}
          <span className="ml-auto">
            {daXemTatCa ? (
              <Link href={thuGonHref} className="text-xs text-[var(--text-secondary)] hover:underline">
                {t("materials.thuGonLai")}
              </Link>
            ) : dangHien < tongDong ? (
              <Link href={xemTatCaHref} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
                {t("materials.xemTatCaNDong", { n: String(tongDong) })}
              </Link>
            ) : null}
          </span>
        </nav>
      )}
    </div>
  );
}
