/**
 * NHÓM CON THEO CHƯƠNG MÃ IMPA — tầng dưới bộ phận ở cột "Nhóm" của danh mục.
 *
 * Mã IMPA 6 chữ số (Marine Stores Guide) mở đầu bằng số chương: 61 13 33 là
 * cờ lê (chương 61 Hand tools), 47 03 97 là túi đục lỗ (chương 47 Stationery).
 * Lấy nhóm con từ chương thì mọi mặt hàng có IMPA đều có nhóm đúng, cùng một
 * luật, không phải gán tay — và không lặp lại tên bộ phận ("Boong (Deck)") như
 * cột Category của dữ liệu nhập từ sheet theo bộ phận.
 *
 * Tên hiển thị nằm ở từ điển (`labels.impaChuong_<số chương>`). Kiểm ở
 * scripts/kiem-tra-nhom-impa.ts.
 */

/** Các chương của IMPA Marine Stores Guide. */
export const CHUONG_IMPA = [
  "00", "11", "15", "17", "19", "21", "23", "25", "27", "31", "33", "35", "37", "39", "45", "47",
  "49", "51", "53", "55", "59", "61", "63", "65", "67", "69", "71", "73", "75", "77", "79", "81", "85", "87",
] as const;
export type ChuongImpa = (typeof CHUONG_IMPA)[number];

/** Chương IMPA của một mã ("61.13.33", "611333", "IMPA 470397"); không phải mã IMPA → null. */
export function chuongImpa(impa: string | null | undefined): ChuongImpa | null {
  const so = String(impa ?? "").replace(/\D/g, "");
  if (so.length < 4 || so.length > 6) return null;
  const ch = so.slice(0, 2);
  return (CHUONG_IMPA as readonly string[]).includes(ch) ? (ch as ChuongImpa) : null;
}

/**
 * Chương IMPA có NHÓM RIÊNG trong bộ phân loại công ty (NHOM_THIET_BI,
 * lib/maVatTu.ts) với người giữ khác người giữ mặc định của bộ phận: hải đồ /
 * thiết bị hàng hải, tủ thuốc, văn phòng phẩm do Phó hai giữ chứ không phải
 * Thủy thủ trưởng. Chỉ áp khi mặt hàng thuộc đúng bộ phận của nhóm đó.
 */
export const NHOM_THEO_CHUONG: Partial<Record<ChuongImpa, string>> = {
  "37": "NAV",
  "39": "MED",
  "47": "DOC",
};

const boDau = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Tên nhóm (Category) chỉ lặp lại tên bộ phận — "Boong (Deck)", "Vật tư Boong",
 * "ENGINE STORE", "Phục vụ (Catering)", "Vật tư nhà bếp & phục vụ"... — nên
 * không đáng hiện ở cột Nhóm. So sau khi bỏ dấu, bỏ tiền tố "vật tư" và hậu tố
 * "store(s) / dept".
 */
const TEN_BO_PHAN = new Set(
  [
    "boong", "deck", "boong deck",
    "may", "engine", "may engine",
    "dien", "electric", "electrical", "dien electric",
    "phuc vu", "catering", "phuc vu catering", "tieu hao", "phuc vu tieu hao", "phuc vu tieu hao service", "service", "consumables",
    "service consumables", "nha bep", "nha bep phuc vu", "galley", "cabin galley", "sinh hoat phuc vu", "sinh hoat phuc vu cabin galley",
    "an toan", "safety", "an toan safety", "an toan chung", "an toan chung safety", "general safety", "bao ho", "bao ho an toan",
    "khac", "other", "store", "stores", "spare", "spares", "spare parts", "vat tu", "phu tung",
  ].map(boDau)
);

export function laTenBoPhan(ten: string | null | undefined): boolean {
  const k = boDau(String(ten ?? ""));
  if (!k) return true;
  const gon = k.replace(/^vat tu /, "").replace(/ (stores?|dept|department)$/, "").trim();
  return TEN_BO_PHAN.has(k) || TEN_BO_PHAN.has(gon);
}
