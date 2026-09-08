import type { BangChu, TuDienNamespace } from "./dict/_kieu";
import { actions } from "./dict/actions";
import { actionsModule } from "./dict/actionsModule";
import { chung } from "./dict/chung";
import { consumables } from "./dict/consumables";
import { dashboard } from "./dict/dashboard";
import { inventory } from "./dict/inventory";
import { labels } from "./dict/labels";
import { login } from "./dict/login";
import { materials } from "./dict/materials";
import { menu } from "./dict/menu";
import { paint } from "./dict/paint";
import { purchasing } from "./dict/purchasing";
import { requests } from "./dict/requests";
import { vessels } from "./dict/vessels";

/**
 * Toàn bộ từ điển, gom theo không gian tên. Mỗi module một file trong ./dict —
 * thêm module mới thì thêm một dòng ở đây, còn lại tự nối.
 *
 * Từ điển là mã nguồn thường (không phải JSON tải về): cả hai bảng chữ đi cùng
 * bundle, đổi ngôn ngữ không phải tải thêm gì, và tsc kiểm tra được khóa.
 */
export const TU_DIEN = {
  chung,
  menu,
  login,
  labels,
  dashboard,
  materials,
  inventory,
  requests,
  purchasing,
  paint,
  consumables,
  vessels,
  actions,
  actionsModule,
} satisfies Record<string, TuDienNamespace<BangChu>>;

type TD = typeof TU_DIEN;

/**
 * Mọi khóa hợp lệ dưới dạng "khongGianTen.khoa" — t() chỉ nhận kiểu này, nên gõ
 * sai khóa là tsc báo ngay chứ không đợi tới lúc màn hình hiện chuỗi khóa thô.
 * Khóa tính động (`labels.reqStatus_${status}`) thì dùng tTuDo().
 */
export type KhoaDich = {
  [N in keyof TD]: `${N & string}.${keyof TD[N]["vi"] & string}`;
}[keyof TD];
