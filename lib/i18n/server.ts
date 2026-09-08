import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { taoBoNgonNgu, type BoNgonNgu } from "./dich";
import { COOKIE_NGON_NGU, docNgonNgu, type NgonNgu } from "./ngonNgu";

/**
 * Ngôn ngữ của request hiện tại — đọc từ cookie, nhớ theo request (React cache)
 * nên layout, trang, component và server action cùng gọi mà chỉ đọc một lần.
 */
export const layNgonNgu = cache(async (): Promise<NgonNgu> => {
  const kho = await cookies();
  return docNgonNgu(kho.get(COOKIE_NGON_NGU)?.value);
});

/**
 * Dùng trong server component và server action:
 *   const { t, locale, ngay } = await layT();
 *   <h2>{t("materials.tieuDe")}</h2>
 */
export async function layT(): Promise<BoNgonNgu> {
  return taoBoNgonNgu(await layNgonNgu());
}
