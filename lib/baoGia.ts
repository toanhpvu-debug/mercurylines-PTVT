/**
 * BÁO GIÁ NHÀ CUNG CẤP — phần thuần (không đụng database / file): dòng báo giá,
 * đọc bảng báo giá từ các hàng ô (Excel / Word), tính tổng, ghép dòng báo giá
 * với dòng của đơn mua. Kiểm ở scripts/kiem-tra-bao-gia.ts.
 */
import { docSo } from "@/lib/docSo";

export type DongBaoGia = {
  moTa: string;
  tenEn: string | null;
  partNo: string | null;
  impa: string | null;
  donVi: string;
  soLuong: number | null;
  donGia: number | null;
  ghiChu: string | null;
  canhBao: string | null;
  trang: number | null;
  /** Người xử lý bỏ dòng này (không áp dụng / không đưa vào PO). */
  boQua: boolean;
};

export type DauBaoGia = {
  nhaCungCap: string | null;
  soBaoGia: string | null;
  /** dd/mm/yyyy như in trên báo giá. */
  ngayBaoGia: string | null;
  tienTe: string | null;
};

export const DUOI_BAO_GIA = [".xlsx", ".xls", ".docx", ".doc", ".pdf"] as const;
export const TOI_DA_DONG_BAO_GIA = 500;
export const TIEN_TE = ["USD", "VND", "SGD", "EUR", "JPY", "CNY", "KRW", "GBP", "HKD", "AUD"] as const;

const sach = (s: unknown) => String(s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const so = (s: string): number | null => {
  const t = s.replace(/[^\d.,-]/g, "");
  if (!t || !/\d/.test(t)) return null;
  const n = docSo(t);
  return Number.isFinite(n) ? n : null;
};

// Tiêu đề cột — thứ tự kiểm quan trọng: "Unit price" có chữ "unit", "Amount"
// có thể là "Total amount"; đơn giá và thành tiền phải nhận trước ĐVT. Mỗi cột
// có thể có nhiều mẫu theo thứ tự ưu tiên: bảng "Item | Description" thì cột
// "Item" là số thứ tự, mô tả phải nhận "Description" trước.
const COT: { k: keyof CotBaoGia; re: RegExp | RegExp[] }[] = [
  { k: "donGia", re: /u\.?\s*\/?\s*price|unit\s*(price|cost|rate)|đơn\s*giá|don\s*gia|^price|^rate$|giá\s*(đơn vị|chào)/i },
  { k: "thanhTien", re: /amount|total|thành\s*tiền|thanh\s*tien|^value$|^sum$/i },
  { k: "soLuong", re: /q\s*['’]?\s*t\s*y|quantity|số\s*lượng|so\s*luong|^sl$|^qty/i },
  { k: "donVi", re: /^unit$|^units?\b(?!\s*price)|uom|u\/m|đvt|dvt|đơn\s*vị(?!\s*giá)|don\s*vi(?!\s*gia)/i },
  { k: "impa", re: /impa/i },
  { k: "partNo", re: /part\s*(no|number|#)|p\/n|^pn$|maker'?s?\s*ref|code|mã\s*(hàng|sp|vt)|ký\s*hiệu|article/i },
  { k: "moTa", re: [/desc|particular|tên\s*(hàng|vật tư|sản phẩm)|mô\s*tả|mo\s*ta|hàng\s*hóa|nội\s*dung/i, /item|product|goods/i] },
  { k: "ghiChu", re: /remark|note|ghi\s*chú|delivery|lead\s*time|maker|brand|origin|xuất xứ/i },
];
type CotBaoGia = { moTa: number; partNo: number; impa: number; donVi: number; soLuong: number; donGia: number; thanhTien: number; ghiChu: number };

/** Dò dòng tiêu đề bảng và vị trí cột; null nếu không thấy bảng báo giá. */
export function timTieuDe(rows: string[][]): { hang: number; cot: CotBaoGia } | null {
  for (let r = 0; r < Math.min(rows.length, 60); r++) {
    const cot: CotBaoGia = { moTa: -1, partNo: -1, impa: -1, donVi: -1, soLuong: -1, donGia: -1, thanhTien: -1, ghiChu: -1 };
    const dung = new Set<number>();
    for (const { k, re } of COT) {
      for (const mau of Array.isArray(re) ? re : [re]) {
        const c = rows[r].findIndex((o, i) => !dung.has(i) && o.length <= 60 && mau.test(sach(o)));
        if (c >= 0) {
          cot[k] = c;
          dung.add(c);
          break;
        }
      }
    }
    if (cot.moTa >= 0 && (cot.soLuong >= 0 || cot.donGia >= 0)) return { hang: r, cot };
  }
  return null;
}

const RE_CHAN_BANG = /^(sub\s*-?\s*total|total|grand\s*total|tổng|cộng|discount|chiết\s*khấu|freight|delivery\s*(fee|charge)|transport|vat|tax|thuế|amount\s*in\s*words|bằng\s*chữ)/i;
const RE_TIEN = new RegExp(`(?<![A-Z])(${TIEN_TE.join("|")})(?![A-Z])`);
const RE_SO_BAO_GIA = /(quotation|quote|offer|our\s*ref|q\/?\s*ref|báo\s*giá)\s*(no\.?|number|nr\.?|#|số)?\s*[:：#.]?\s*([A-Z0-9][\w\-/.]{2,30})/i;
const RE_NGAY = /(?:date|dated|ngày)\s*[:：]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})/i;
const RE_CONG_TY = /(company|co\.?,?\s*ltd|limited|joint\s*stock|jsc|corporation|corp\b|inc\b|pte\.?\s*ltd|gmbh|công\s*ty|cty\b)/i;

/** Chuẩn ngày "5/3/26" → "05/03/2026". */
function chuanNgay(s: string): string | null {
  const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(s);
  if (!m) return null;
  const nam = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${nam}`;
}

/** Đầu báo giá từ các hàng phía trên bảng (và chính hàng tiêu đề, để bắt loại tiền "Unit price (USD)"). */
export function dauTuHang(rows: string[][]): DauBaoGia {
  const dong = rows.map((r) => r.map(sach).filter(Boolean).join("  ")).filter(Boolean);
  const tatCa = dong.join("\n");
  const soBg = tatCa.match(RE_SO_BAO_GIA)?.[3] ?? null;
  const ngay = tatCa.match(RE_NGAY)?.[1] ?? null;
  const ncc = dong.find((d) => RE_CONG_TY.test(d) && d.length <= 120) ?? null;
  return {
    nhaCungCap: ncc,
    soBaoGia: soBg && !/^(no|number|date)$/i.test(soBg) ? soBg : null,
    ngayBaoGia: ngay ? chuanNgay(ngay) : null,
    tienTe: tatCa.toUpperCase().match(RE_TIEN)?.[1] ?? (/vnđ|vnd|đồng/i.test(tatCa) ? "VND" : null),
  };
}

/**
 * Đọc bảng báo giá từ các hàng ô: tìm hàng tiêu đề, lấy từng dòng có mô tả và
 * có số lượng hoặc đơn giá, dừng ở dòng tổng / chiết khấu. Thiếu đơn giá mà có
 * thành tiền + số lượng thì suy ra đơn giá (đánh dấu cần kiểm).
 */
export function dongTuBang(rowsVao: unknown[][]): { dong: DongBaoGia[]; boQua: number; dau: DauBaoGia } | { loi: string } {
  const rows = rowsVao.map((r) => (r ?? []).map(sach));
  const td = timTieuDe(rows);
  if (!td) return { loi: "Không tìm thấy bảng báo giá (cần dòng tiêu đề có cột Mô tả / Description và Số lượng / Q'ty hoặc Đơn giá / Unit price)." };
  const { hang, cot } = td;
  const lay = (r: string[], c: number) => (c >= 0 ? (r[c] ?? "") : "");
  const dong: DongBaoGia[] = [];
  let boQua = 0;
  for (let r = hang + 1; r < rows.length && dong.length < TOI_DA_DONG_BAO_GIA; r++) {
    const o = rows[r];
    const moTa = lay(o, cot.moTa);
    const cauDau = o.find((x) => x) ?? "";
    if (!o.some((x) => x)) continue;
    if (RE_CHAN_BANG.test(moTa) || (!moTa && RE_CHAN_BANG.test(cauDau))) break;
    const soLuong = so(lay(o, cot.soLuong));
    let donGia = so(lay(o, cot.donGia));
    const thanhTien = so(lay(o, cot.thanhTien));
    let canhBao: string | null = null;
    if (!moTa || moTa.length < 2 || /^\d+([.,]\d+)?$/.test(moTa)) {
      if (moTa || soLuong !== null || donGia !== null) boQua++;
      continue;
    }
    if (soLuong === null && donGia === null && thanhTien === null) {
      // Dòng tiêu đề nhóm ("MAIN ENGINE SPARES") hay ghi chú — không phải dòng hàng.
      boQua++;
      continue;
    }
    if (donGia === null && thanhTien !== null && soLuong) {
      donGia = Math.round((thanhTien / soLuong) * 10000) / 10000;
      canhBao = "Đơn giá suy ra từ thành tiền / số lượng";
    } else if (donGia !== null && thanhTien !== null && soLuong && Math.abs(donGia * soLuong - thanhTien) > Math.max(0.02, thanhTien * 0.005)) {
      canhBao = `Thành tiền trên báo giá (${thanhTien}) khác số lượng × đơn giá (${Math.round(donGia * soLuong * 100) / 100})`;
    }
    const impa = lay(o, cot.impa).replace(/\D/g, "");
    dong.push({
      moTa: moTa.slice(0, 300),
      tenEn: null,
      partNo: lay(o, cot.partNo).slice(0, 80) || null,
      impa: /^\d{6}$/.test(impa) ? impa : null,
      donVi: (lay(o, cot.donVi) || "PCS").toUpperCase().slice(0, 20),
      soLuong,
      donGia,
      ghiChu: lay(o, cot.ghiChu).slice(0, 200) || null,
      canhBao,
      trang: null,
      boQua: false,
    });
  }
  if (!dong.length) return { loi: "Tìm thấy bảng nhưng không có dòng hàng nào có số lượng / đơn giá." };
  return { dong, boQua, dau: dauTuHang(rows.slice(0, hang + 1)) };
}

/** Tổng báo giá: cộng dòng (bỏ dòng boQua), trừ chiết khấu %, cộng phí. */
export function tongBaoGia(dong: Pick<DongBaoGia, "soLuong" | "donGia" | "boQua">[], chietKhau = 0, phiVanChuyen = 0, phiGiaoHang = 0) {
  const tron = (n: number) => Math.round(n * 100) / 100;
  const cong = tron(dong.filter((d) => !d.boQua).reduce((s, d) => s + (d.soLuong ?? 0) * (d.donGia ?? 0), 0));
  const giam = tron((cong * (chietKhau || 0)) / 100);
  return { cong, giam, tong: tron(cong - giam + (phiVanChuyen || 0) + (phiGiaoHang || 0)) };
}

const chuanKhop = (s: string | null | undefined) => (s ?? "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Ghép dòng báo giá với dòng của đơn mua: Part No. trước, rồi mô tả (trùng
 * khít, hoặc một bên chứa bên kia khi đủ dài). Mỗi dòng PO chỉ ghép một lần.
 */
export function ghepVaoDonMua(dong: Pick<DongBaoGia, "moTa" | "partNo" | "impa">[], items: { id: number; description: string; partNo: string | null }[]): (number | null)[] {
  const daDung = new Set<number>();
  const chon = (pred: (it: (typeof items)[number]) => boolean) => {
    const it = items.find((x) => !daDung.has(x.id) && pred(x));
    if (!it) return null;
    daDung.add(it.id);
    return it.id;
  };
  return dong.map((d) => {
    const pn = chuanKhop(d.partNo);
    const impa = chuanKhop(d.impa);
    const ten = chuanKhop(d.moTa);
    return (
      (pn.length >= 3 ? chon((it) => chuanKhop(it.partNo) === pn) : null) ??
      (impa.length === 6 ? chon((it) => chuanKhop(it.partNo) === impa) : null) ??
      chon((it) => chuanKhop(it.description) === ten) ??
      (ten.length >= 8 ? chon((it) => {
        const t = chuanKhop(it.description);
        return t.length >= 8 && (t.includes(ten) || ten.includes(t));
      }) : null)
    );
  });
}

/** Đọc dòng báo giá từ cột JSON (bỏ phần tử hỏng). */
export function docDongBaoGia(v: unknown): DongBaoGia[] {
  if (!Array.isArray(v)) return [];
  const ra: DongBaoGia[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const d = x as Partial<DongBaoGia>;
    if (typeof d.moTa !== "string") continue;
    const sn = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : null);
    ra.push({
      moTa: d.moTa,
      tenEn: d.tenEn ?? null,
      partNo: d.partNo ?? null,
      impa: d.impa ?? null,
      donVi: d.donVi || "PCS",
      soLuong: sn(d.soLuong),
      donGia: sn(d.donGia),
      ghiChu: d.ghiChu ?? null,
      canhBao: d.canhBao ?? null,
      trang: sn(d.trang),
      boQua: d.boQua === true,
    });
  }
  return ra;
}

/**
 * Kiểm & chuẩn hóa các dòng người dùng sửa trên trang báo giá (mọi ô là chữ).
 * Dòng mô tả trống bị bỏ; số sai → báo đúng dòng.
 */
export function sachDongBaoGiaNhap(v: unknown): { ok: true; dong: DongBaoGia[] } | { ok: false; n: number } {
  if (!Array.isArray(v)) return { ok: true, dong: [] };
  const ra: DongBaoGia[] = [];
  const soNhap = (x: unknown): number | null | "sai" => {
    const s = String(x ?? "").trim();
    if (!s) return null;
    const n = so(s);
    return n === null || n < 0 ? "sai" : n;
  };
  for (let i = 0; i < Math.min(v.length, TOI_DA_DONG_BAO_GIA); i++) {
    const d = (v[i] ?? {}) as Record<string, unknown>;
    const moTa = sach(d.moTa).slice(0, 300);
    if (!moTa) continue;
    const sl = soNhap(d.soLuong);
    const dg = soNhap(d.donGia);
    if (sl === "sai" || dg === "sai") return { ok: false, n: i + 1 };
    ra.push({
      moTa,
      tenEn: sach(d.tenEn).slice(0, 200) || null,
      partNo: sach(d.partNo).slice(0, 80) || null,
      impa: /^\d{6}$/.test(sach(d.impa)) ? sach(d.impa) : null,
      donVi: (sach(d.donVi) || "PCS").toUpperCase().slice(0, 20),
      soLuong: sl,
      donGia: dg,
      ghiChu: sach(d.ghiChu).slice(0, 200) || null,
      canhBao: sach(d.canhBao).slice(0, 300) || null,
      trang: typeof d.trang === "number" ? d.trang : null,
      boQua: d.boQua === true,
    });
  }
  return { ok: true, dong: ra };
}

/** Ngày "dd/mm/yyyy" → Date (12:00 giờ máy); sai → null. */
export function ngayTuDdMm(s: string | null | undefined): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12);
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}
