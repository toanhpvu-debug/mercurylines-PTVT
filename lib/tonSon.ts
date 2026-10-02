/*
 * SỬA / GỠ SƠN ĐÃ NHẬP và BẢN IN BÁO CÁO SƠN THEO MẪU MLS-11-05 — phần thuần
 * (không database): dùng chung cho trang in (client), server action và script
 * kiểm thử.
 *
 * Bản in là tờ "REQUISITION FOR STORES / YÊU CẦU VẬT TƯ" MLS-11-05 của công ty
 * (bản Excel "MLS-11-05 - CO - Paint"): chân trang ghi "Người làm báo cáo: CE,
 * CO · Thời điểm làm báo cáo: Khi cần thiết" — chính công ty gọi tờ này là báo
 * cáo sơn. Cột R.O.B lấy tồn sơn trên tàu; S.lượng yêu cầu / duyệt để trống cho
 * người lập điền.
 *
 * Người lập hay phải chỉnh tay trước khi ký (bỏ dòng không báo, sửa mô tả, điền
 * số yêu cầu, thêm dòng ngoài sổ). Chỉnh đó KHÔNG đổi số liệu hệ thống: nó là
 * một "bản sửa" cất ở trình duyệt, chỉ ghi những ô người dùng đổi — áp lên số
 * liệu mới nhất mỗi lần mở, nên tồn sơn nhập/xuất sau đó vẫn hiện đúng ở những
 * ô không sửa tay.
 */

export type CotDongSon = "moTa" | "impa" | "donVi" | "rob" | "yeuCau" | "duyet";
export type CotDauSon = "tenTau" | "ngay" | "boPhan" | "soYeuCau" | "trang";

export const COT_DONG_SON: readonly CotDongSon[] = ["moTa", "impa", "donVi", "rob", "yeuCau", "duyet"];
export const COT_DAU_SON: readonly CotDauSon[] = ["tenTau", "ngay", "boPhan", "soYeuCau", "trang"];

/** Một dòng trên tờ in — mọi ô là chuỗi để người dùng gõ tự do. */
export type DongBaoCaoSon = Record<CotDongSon, string> & {
  id: string;
  /** Gợi ý S.lượng yêu cầu = thiếu so với tồn tối thiểu ("" nếu không thiếu). Không in. */
  goiY?: string;
};

export type DauBaoCaoSon = Record<CotDauSon, string>;

/** Những chỗ người dùng đã sửa tay trên bản in (cất trong localStorage theo tàu). */
export type BanSuaBaoCaoSon = {
  v: 1;
  dau: Partial<DauBaoCaoSon>;
  /** id dòng gốc → các ô đã sửa. */
  sua: Record<string, Partial<Record<CotDongSon, string>>>;
  /** id dòng gốc đã bỏ khỏi bản in. */
  bo: string[];
  /** Dòng thêm tay (id "them-…"). */
  them: DongBaoCaoSon[];
  /** Thứ tự dòng nếu người dùng đã đổi; null = theo số liệu. */
  thuTu: string[] | null;
};

export const banSuaRong = (): BanSuaBaoCaoSon => ({ v: 1, dau: {}, sua: {}, bo: [], them: [], thuTu: null });

const chuoi = (x: unknown, max = 300) => (typeof x === "string" ? x.slice(0, max) : "");

/** Đọc bản sửa từ localStorage — dữ liệu hỏng hay của phiên bản khác thì bỏ (dùng số liệu gốc). */
export function docBanSua(raw: unknown): BanSuaBaoCaoSon | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return null;
  const ban = banSuaRong();
  if (r.dau && typeof r.dau === "object") {
    for (const k of COT_DAU_SON) {
      const v = (r.dau as Record<string, unknown>)[k];
      if (typeof v === "string") ban.dau[k] = chuoi(v);
    }
  }
  if (r.sua && typeof r.sua === "object") {
    for (const [id, o] of Object.entries(r.sua as Record<string, unknown>)) {
      if (!o || typeof o !== "object") continue;
      const sua: Partial<Record<CotDongSon, string>> = {};
      for (const k of COT_DONG_SON) {
        const v = (o as Record<string, unknown>)[k];
        if (typeof v === "string") sua[k] = chuoi(v);
      }
      if (Object.keys(sua).length) ban.sua[id.slice(0, 40)] = sua;
    }
  }
  if (Array.isArray(r.bo)) ban.bo = r.bo.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 40));
  if (Array.isArray(r.them)) {
    for (const d of r.them) {
      if (!d || typeof d !== "object") continue;
      const o = d as Record<string, unknown>;
      if (typeof o.id !== "string" || !o.id.startsWith("them-")) continue;
      ban.them.push({ id: o.id.slice(0, 40), moTa: chuoi(o.moTa), impa: chuoi(o.impa), donVi: chuoi(o.donVi), rob: chuoi(o.rob), yeuCau: chuoi(o.yeuCau), duyet: chuoi(o.duyet) });
    }
  }
  if (Array.isArray(r.thuTu)) ban.thuTu = r.thuTu.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 40));
  return ban;
}

/** Dòng + đầu phiếu sẽ in: số liệu gốc mới nhất, áp những chỗ đã sửa tay. */
export function apDungBanSua(
  goc: { dau: DauBaoCaoSon; dong: DongBaoCaoSon[] },
  ban: BanSuaBaoCaoSon
): { dau: DauBaoCaoSon; dong: DongBaoCaoSon[] } {
  const bo = new Set(ban.bo);
  const dong = [
    ...goc.dong.filter((d) => !bo.has(d.id)).map((d) => ({ ...d, ...(ban.sua[d.id] ?? {}) })),
    ...ban.them,
  ];
  let xep = dong;
  if (ban.thuTu) {
    const viTri = new Map(ban.thuTu.map((id, i) => [id, i]));
    // Dòng có trong thứ tự đã xếp đứng trước theo đúng thứ tự đó; dòng mới phát
    // sinh sau lần xếp (vừa nhập thêm sơn) nối vào cuối theo thứ tự số liệu.
    xep = [
      ...dong.filter((d) => viTri.has(d.id)).sort((a, b) => viTri.get(a.id)! - viTri.get(b.id)!),
      ...dong.filter((d) => !viTri.has(d.id)),
    ];
  }
  return { dau: { ...goc.dau, ...ban.dau }, dong: xep };
}

/** Số chỗ bản in khác số liệu gốc (để nói rõ trên màn hình bản này đã sửa tay). */
export function demChoKhac(goc: { dau: DauBaoCaoSon; dong: DongBaoCaoSon[] }, ban: BanSuaBaoCaoSon): number {
  const coGoc = new Set(goc.dong.map((d) => d.id));
  let n = 0;
  for (const k of COT_DAU_SON) if (ban.dau[k] !== undefined && ban.dau[k] !== goc.dau[k]) n++;
  for (const [id, sua] of Object.entries(ban.sua)) {
    if (!coGoc.has(id) || ban.bo.includes(id)) continue;
    const d = goc.dong.find((x) => x.id === id)!;
    for (const k of COT_DONG_SON) if (sua[k] !== undefined && sua[k] !== d[k]) n++;
  }
  n += ban.bo.filter((id) => coGoc.has(id)).length;
  n += ban.them.length;
  if (ban.thuTu) {
    const tuNhien = apDungBanSua(goc, { ...ban, thuTu: null }).dong.map((d) => d.id);
    const daXep = apDungBanSua(goc, ban).dong.map((d) => d.id);
    if (tuNhien.join("|") !== daXep.join("|")) n++;
  }
  return n;
}

/** Bỏ những phần của bản sửa trỏ tới dòng không còn trong số liệu (loại sơn đã gỡ khỏi tàu). */
export function gonBanSua(goc: { dong: DongBaoCaoSon[] }, ban: BanSuaBaoCaoSon): BanSuaBaoCaoSon {
  const coGoc = new Set(goc.dong.map((d) => d.id));
  const sua: BanSuaBaoCaoSon["sua"] = {};
  for (const [id, s] of Object.entries(ban.sua)) if (coGoc.has(id)) sua[id] = s;
  const conId = new Set([...coGoc, ...ban.them.map((d) => d.id)]);
  return {
    ...ban,
    sua,
    bo: ban.bo.filter((id) => coGoc.has(id)),
    thuTu: ban.thuTu ? ban.thuTu.filter((id) => conId.has(id)) : null,
  };
}

/** Sửa một ô của dòng: dòng thêm tay sửa thẳng; dòng gốc ghi vào `sua` (gõ lại đúng số gốc là xóa chỗ sửa). */
export function suaOBanIn(
  goc: { dong: DongBaoCaoSon[] },
  ban: BanSuaBaoCaoSon,
  id: string,
  cot: CotDongSon,
  giaTri: string
): BanSuaBaoCaoSon {
  if (id.startsWith("them-")) {
    return { ...ban, them: ban.them.map((d) => (d.id === id ? { ...d, [cot]: giaTri } : d)) };
  }
  const d = goc.dong.find((x) => x.id === id);
  if (!d) return ban;
  const cu = { ...(ban.sua[id] ?? {}) };
  if (giaTri === d[cot]) delete cu[cot];
  else cu[cot] = giaTri;
  const sua = { ...ban.sua };
  if (Object.keys(cu).length) sua[id] = cu;
  else delete sua[id];
  return { ...ban, sua };
}

/** Sửa một ô của đầu phiếu (gõ lại đúng giá trị gốc là xóa chỗ sửa). */
export function suaDauBanIn(goc: { dau: DauBaoCaoSon }, ban: BanSuaBaoCaoSon, cot: CotDauSon, giaTri: string): BanSuaBaoCaoSon {
  const dau = { ...ban.dau };
  if (giaTri === goc.dau[cot]) delete dau[cot];
  else dau[cot] = giaTri;
  return { ...ban, dau };
}

/** Bỏ một dòng khỏi bản in. */
export function boDongBanIn(ban: BanSuaBaoCaoSon, id: string): BanSuaBaoCaoSon {
  const thuTu = ban.thuTu ? ban.thuTu.filter((x) => x !== id) : null;
  if (id.startsWith("them-")) return { ...ban, them: ban.them.filter((d) => d.id !== id), thuTu };
  const sua = { ...ban.sua };
  delete sua[id];
  return { ...ban, sua, bo: ban.bo.includes(id) ? ban.bo : [...ban.bo, id], thuTu };
}

/** Đổi chỗ một dòng lên (-1) hoặc xuống (+1) trong bản in. */
export function doiChoDongBanIn(goc: { dau: DauBaoCaoSon; dong: DongBaoCaoSon[] }, ban: BanSuaBaoCaoSon, id: string, huong: -1 | 1): BanSuaBaoCaoSon {
  const ids = apDungBanSua(goc, ban).dong.map((d) => d.id);
  const i = ids.indexOf(id);
  const j = i + huong;
  if (i < 0 || j < 0 || j >= ids.length) return ban;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return { ...ban, thuTu: ids };
}

/** Số lượng như trên tờ in tay: không phần nghìn thừa, dấu phẩy thập phân kiểu Việt Nam. */
export function soIn(n: number): string {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Math.round(n * 1000) / 1000);
}

/**
 * Mô tả một loại sơn trên tờ in theo cách tàu vẫn ghi ở MLS-11-05:
 * HÃNG · TÊN · MÃ MÀU · MÀU ("JOTUN HARTOP PAL 9003A WHITE"). Phần nào đã nằm
 * sẵn trong tên thì không lặp lại.
 */
export function moTaSonIn(p: { name: string; maker: string | null; colorCode: string | null; colorName: string | null }): string {
  const ten = p.name.replace(/\s+/g, " ").trim();
  const thuong = ten.toLocaleLowerCase("vi");
  const coSan = (x: string) => thuong.includes(x.toLocaleLowerCase("vi"));
  const phan: string[] = [];
  const hang = (p.maker ?? "").trim();
  if (hang && !coSan(hang)) phan.push(hang);
  phan.push(ten);
  for (const x of [p.colorCode, p.colorName]) {
    const v = (x ?? "").trim();
    if (v && !coSan(v) && !phan.some((y) => y.toLocaleLowerCase("vi") === v.toLocaleLowerCase("vi"))) phan.push(v);
  }
  return phan.join(" ").replace(/\s+/g, " ").trim();
}

/** Dòng gốc của bản in từ tồn sơn của tàu (đã xếp theo tên). */
export function dongBaoCaoTuTon(
  ton: { productId: number; quantity: number; minQty: number; product: { name: string; maker: string | null; colorCode: string | null; colorName: string | null; uom: string } }[]
): DongBaoCaoSon[] {
  return ton.map((s) => {
    const thieu = s.minQty > 0 && s.quantity < s.minQty ? Math.round((s.minQty - s.quantity) * 1000) / 1000 : 0;
    return {
      id: `p${s.productId}`,
      moTa: moTaSonIn(s.product),
      // Mẫu in mã IMPA — danh mục sơn không có, và không bao giờ in mã nội bộ SON-####.
      impa: "",
      donVi: s.product.uom,
      rob: soIn(s.quantity),
      yeuCau: "",
      duyet: "",
      goiY: thieu > 0 ? soIn(thieu) : "",
    };
  });
}

/**
 * Ước số trang khi in: chiều cao vùng in A4 dọc trừ lề trên/dưới 0,75" của mẫu
 * (297 − 38,1 = 258,9 mm ≈ 978 px ở 96 dpi). Tờ xem trước dựng đúng bề rộng
 * giấy nên chiều cao đo trên màn hình là chiều cao khi in.
 */
export const CAO_TRANG_IN_PX = 978;
export function uocSoTrang(caoPx: number): number {
  if (!Number.isFinite(caoPx) || caoPx <= 0) return 1;
  return Math.max(1, Math.ceil((caoPx - 2) / CAO_TRANG_IN_PX));
}

/**
 * Số tồn mới người dùng gõ khi sửa; null nếu không hợp lệ. Ô nhập là
 * type="number" nên trình duyệt luôn gửi dấu chấm thập phân ("1.5"); vẫn nhận
 * dấu phẩy cho chắc. KHÔNG đoán dấu chấm hàng nghìn — "1.500" từ ô số là 1,5.
 */
export function docSoTon(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 1000) / 1000 : null;
}
