/**
 * Đa ngôn ngữ (tiếng Việt · English) cho toàn app.
 *
 * Cách dùng — chỉ ba điểm vào:
 *
 *   Server component / server action / route:
 *     import { layT } from "@/lib/i18n/server";
 *     const { t, tTuDo, locale, ngay, ngayGio, tenChucDanh } = await layT();
 *
 *   Client component ("use client"):
 *     import { useNgonNgu } from "@/lib/i18n/client";
 *     const { t, tTuDo, locale, ngay } = useNgonNgu();
 *
 *   Từ điển: lib/i18n/dict/<module>.ts — xem quy ước ở dict/_kieu.ts.
 *
 *   t("materials.tieuDe")                      — khóa có kiểm tra kiểu
 *   t("dashboard.nCanhBao", { n: 3 })          — tham số {n}
 *   tTuDo(`labels.reqStatus_${status}`)        — khóa tính động
 *   ngay(x) · ngayGio(x) · so(n)               — định dạng theo ngôn ngữ
 *   tenChucDanh("2E") · tenBoPhan("E")         — tên chức danh / bộ phận
 *
 * Đổi ngôn ngữ: <ChonNgonNgu /> (components) → GET /api/ngon-ngu?lang=en&next=…
 * đặt cookie `lang` rồi quay lại trang. Dùng GET chứ không dùng server action
 * vì proxy.ts ghi nhật ký MỌI request POST — đổi ngôn ngữ ở trang đăng nhập mà
 * đi bằng POST thì nhật ký ghi thành một lần "đăng nhập".
 *
 * File này chỉ tái xuất phần THUẦN (dùng được cả hai phía). Đừng import
 * ./server từ client hay ./client từ server.
 */
export {
  COOKIE_NGON_NGU,
  MA_LOCALE,
  NGON_NGU,
  NGON_NGU_MAC_DINH,
  TEN_NGON_NGU,
  docNgonNgu,
  laNgonNgu,
  type NgonNgu,
} from "./ngonNgu";
export { dichTheo, dichTuDo, taoBoNgonNgu, tra, type BoNgonNgu, type HamDich, type HamDichTuDo, type ThamSo } from "./dich";
export { TU_DIEN, type KhoaDich } from "./tuDien";
