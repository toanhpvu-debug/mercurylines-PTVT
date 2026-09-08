"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { taoBoNgonNgu, type BoNgonNgu } from "./dich";
import { NGON_NGU_MAC_DINH, type NgonNgu } from "./ngonNgu";

const NgonNguContext = createContext<NgonNgu>(NGON_NGU_MAC_DINH);

/** Đặt ở layout gốc, nhận ngôn ngữ server đã đọc từ cookie. */
export function NgonNguProvider({
  locale,
  children,
}: {
  locale: NgonNgu;
  children: ReactNode;
}) {
  return (
    <NgonNguContext.Provider value={locale}>{children}</NgonNguContext.Provider>
  );
}

/**
 * Dùng trong client component ("use client"):
 *   const { t, locale } = useNgonNgu();
 *   <button>{pending ? t("chung.dangLuu") : t("chung.luu")}</button>
 */
export function useNgonNgu(): BoNgonNgu {
  const locale = useContext(NgonNguContext);
  return useMemo(() => taoBoNgonNgu(locale), [locale]);
}
