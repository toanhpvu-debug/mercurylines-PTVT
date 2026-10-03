/**
 * YÊU CẦU SƠN TỪ TÀU — phần thuần: ghép dòng đọc từ phiếu MLS-11-05 (qua bộ đọc
 * lib/yeuCauNhap.ts) với DANH MỤC SƠN (PaintProduct, không phải danh mục vật tư),
 * dựng dòng điền sẵn cho form, và kiểm dòng form gửi lên. Kiểm ở
 * scripts/kiem-tra-yeu-cau-son.ts.
 */
import type { DongYeuCauFile } from "@/lib/yeuCauNhap";

export type SonGhep = {
  id: number;
  code: string;
  name: string;
  maker: string | null;
  colorName: string | null;
  colorCode: string | null;
  uom: string;
  /** Dung tích một thùng / lon (lít) — phân định hai loại cùng tên khác cỡ thùng khi ghép dòng sơn. */
  packSize?: number | null;
};

const boDau = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
const khop = (s: string | null | undefined) => boDau(String(s ?? "")).replace(/[^a-z0-9]+/g, "");

/** Tên hiển thị một loại sơn trên chứng từ — cùng khuôn với dòng sơn đã lập trước nay. */
export function tenDongSon(p: Pick<SonGhep, "name" | "maker" | "colorName">): string {
  return `${p.name}${p.maker ? ` (${p.maker})` : ""}${p.colorName ? ` · ${p.colorName}` : ""}`;
}

/**
 * Ghép dòng phiếu với danh mục sơn:
 *   1. mã: ô IMPA / Part No. / mô tả trùng mã sơn (SON-0001...);
 *   2. tên trùng khít: tên, tên + màu, hãng + tên, hãng + tên + màu — so với cả
 *      mô tả lẫn từng nửa của mô tả song ngữ "Hempadur 45143(sơn epoxy)";
 *   3. mô tả CHỨA tên sơn (≥ 5 ký tự) và chứa màu nếu sơn có màu — chỉ nhận khi
 *      đúng MỘT loại sơn thỏa (nhiều loại cùng tên khác màu mà file không ghi
 *      màu thì để người lập chọn, không đoán).
 */
export function ghepSon(dong: { moTa: string; partNo: string | null; impa: string | null }[], son: SonGhep[]): (SonGhep | null)[] {
  const khoa = son.map((p) => {
    const ten = khop(p.name);
    const mau = khop(p.colorName);
    const hang = khop(p.maker);
    return {
      p,
      ma: khop(p.code),
      ten,
      mau,
      maMau: khop(p.colorCode),
      ds: new Set([ten, ten + mau, hang + ten, hang + ten + mau, ten + hang].filter((s) => s.length >= 3)),
    };
  });
  return dong.map((d) => {
    const ma = [d.partNo, d.impa, d.moTa].map(khop).filter((s) => s.length >= 3);
    const theoMa = khoa.filter((k) => k.ma.length >= 3 && ma.includes(k.ma));
    if (theoMa.length === 1) return theoMa[0].p;
    const ngoac = /^(.+?)\s*\(([^()]+)\)?\s*\.?$/.exec(d.moTa.trim());
    const ten = [d.moTa, ...(ngoac ? [ngoac[1], ngoac[2]] : [])].map(khop).filter((s) => s.length >= 3);
    const theoTen = khoa.filter((k) => ten.some((s) => k.ds.has(s)));
    if (theoTen.length === 1) return theoTen[0].p;
    const moTa = khop(d.moTa);
    const chua = khoa.filter((k) => k.ten.length >= 5 && moTa.includes(k.ten) && (!k.mau || moTa.includes(k.mau) || (k.maMau.length >= 3 && moTa.includes(k.maMau))));
    if (chua.length === 1) return chua[0].p;
    // Nhiều ứng viên: lấy loại có màu khớp (tên + màu dài nhất), nếu chỉ một.
    const coMau = chua.filter((k) => k.mau && moTa.includes(k.mau));
    return coMau.length === 1 ? coMau[0].p : null;
  });
}

/** Một dòng của form yêu cầu sơn (mọi ô là chuỗi người dùng gõ). */
export type DongFormSon = {
  /** Id loại sơn trong danh mục; "" = sơn ngoài danh mục (gõ tay). */
  paintProductId: string;
  ten: string;
  ma: string;
  dvt: string;
  soLuong: string;
  ghiChu: string;
  /** R.O.B ghi trên file (chỉ dùng cho sơn ngoài danh mục — sơn có trong danh mục lấy tồn sơn của tàu). */
  robFile: string;
  goiY?: string;
};

/** Dòng file + kết quả ghép → dòng điền sẵn. Tên / mã / đơn vị theo file vẫn giữ để đổi sang "ngoài danh mục" khỏi gõ lại. */
export function dongFormSonTuFile(dong: DongYeuCauFile[], ghep: (SonGhep | null)[], goiY: (d: DongYeuCauFile) => string | undefined): DongFormSon[] {
  return dong.map((d, i) => {
    const p = ghep[i];
    return {
      paintProductId: p ? String(p.id) : "",
      ten: d.moTa,
      ma: d.partNo ?? d.impa ?? "",
      dvt: d.donVi ?? "",
      soLuong: d.soLuong !== null && d.soLuong > 0 ? String(d.soLuong) : "",
      ghiChu: [d.phan, d.ghiChu].filter(Boolean).join("; ").slice(0, 300),
      robFile: d.rob !== null ? String(d.rob) : "",
      goiY: goiY(d),
    };
  });
}

/** Số đề xuất xin thêm: phần thiếu so với định mức (làm tròn 2 số lẻ), 0 nếu đủ / chưa đặt định mức. */
export function soThieuDinhMuc(ton: number, minQty: number): number {
  return minQty > 0 && ton < minQty ? Math.round((minQty - ton) * 100) / 100 : 0;
}

/** Dòng sơn đã kiểm, sẵn sàng ghi vào yêu cầu. */
export type DongSonGui = {
  paintProductId: number | null;
  ten: string;
  ma: string | null;
  dvt: string | null;
  soLuong: number;
  ghiChu: string | null;
  robFile: number | null;
};

const soDuong = (v: unknown): number | null => {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

/**
 * Kiểm dòng form gửi lên. Dòng trống hẳn (không chọn sơn, không tên) bỏ qua;
 * dòng có nội dung mà số lượng không phải số dương thì báo đúng số dòng (đánh từ
 * 1) thay vì lặng lẽ bỏ — người lập tưởng đã xin mà thực ra mất dòng.
 */
export function docDongGuiSon(raw: unknown): { ok: true; dong: DongSonGui[] } | { ok: false; dongLoi: number } {
  if (!Array.isArray(raw)) return { ok: true, dong: [] };
  const dong: DongSonGui[] = [];
  for (let i = 0; i < raw.length && i < 300; i++) {
    const d = (raw[i] && typeof raw[i] === "object" ? raw[i] : {}) as Record<string, unknown>;
    const id = Number(d.paintProductId);
    const paintProductId = Number.isInteger(id) && id > 0 ? id : null;
    const ten = String(d.ten ?? "").trim().slice(0, 300);
    if (!paintProductId && !ten) continue;
    const soLuong = soDuong(d.soLuong);
    if (soLuong === null || Number.isNaN(soLuong) || soLuong <= 0) return { ok: false, dongLoi: i + 1 };
    const rob = soDuong(d.robFile);
    dong.push({
      paintProductId,
      ten,
      ma: String(d.ma ?? "").trim().slice(0, 80) || null,
      dvt: String(d.dvt ?? "").trim().slice(0, 20) || null,
      soLuong,
      ghiChu: String(d.ghiChu ?? "").trim().slice(0, 300) || null,
      robFile: rob === null || Number.isNaN(rob) ? null : rob,
    });
  }
  return { ok: true, dong };
}
