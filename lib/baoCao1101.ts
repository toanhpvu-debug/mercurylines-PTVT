/**
 * BÁO CÁO NHẬN & SỬ DỤNG VẬT TƯ (MLS-11-01) — phần tính thuần, không đụng
 * database. Trang /reports và kiểm thử scripts/kiem-tra-bao-cao-1101.ts dùng chung.
 *
 * Mỗi giao dịch kho được xếp vào một trong ba loại:
 *   - NHAN: nhận hàng thật (phiếu giao, nhận theo PO, nhập tay).
 *   - DUNG: xuất dùng thật.
 *   - KIEM_KE: điều chỉnh khi kiểm kê / nạp tồn ban đầu từ file — KHÔNG phải
 *     nhận hay dùng. Trước đây lần nạp tồn từ file kiểm kê hiện thành "Vật tư
 *     nhận" của tháng đó; nay đứng riêng và được ghi rõ ở cột Ghi chú.
 * Nên: tồn đợt trước + nhận − dùng ± điều chỉnh = tồn hiện có; điều chỉnh
 * (nếu có) luôn được nêu ở Ghi chú để người đọc đối được số.
 */

import { LECH_VN_MS } from "@/lib/kyQuy";

export type LoaiGiaoDich1101 = "NHAN" | "DUNG" | "KIEM_KE";

export type GiaoDich1101 = {
  type: string;
  materialId: number;
  quantity: number;
  occurredAt: Date;
  note: string | null;
  performedBy: string | null;
  /** Dòng do file kiểm kê MLS-11-06 ghi: cột của biểu mẫu mà dòng làm khớp (lib/tonKhoQuy.ts). */
  cotBaoCao?: string | null;
};

/** Ghi chú của giao dịch điều chỉnh kiểm kê (nạp tồn từ file, kiểm kê theo file, kiểm kê tay). */
export function laKiemKe(note: string | null | undefined): boolean {
  return /ki[ểe]m\s*k[êe]|stock[\s-]?take|stocktaking|inventory\s*count/i.test(note ?? "");
}

/**
 * Dòng do file kiểm kê MLS-11-06 ghi theo kỳ đi theo cột của nó: "Nhận trong kỳ" là
 * nhận, "Tiêu thụ trong kỳ" là dùng (ghi chú vẫn nói "kiểm kê" nhưng đó là số tàu
 * báo nhận / dùng thật); "Còn tồn đợt trước" / "Tồn trên tàu" là điều chỉnh kiểm kê.
 */
export function loaiGiaoDich(g: Pick<GiaoDich1101, "type" | "note" | "cotBaoCao">): LoaiGiaoDich1101 {
  if (g.cotBaoCao === "nhan") return "NHAN";
  if (g.cotBaoCao === "tieuThu") return "DUNG";
  if (g.cotBaoCao || laKiemKe(g.note)) return "KIEM_KE";
  return g.type === "IN" ? "NHAN" : "DUNG";
}

export type TongHop1101 = {
  materialId: number;
  tonDau: number;
  nhan: number;
  dung: number;
  /** Tổng điều chỉnh kiểm kê trong tháng (+ / −). */
  dieuChinh: number;
  tonCuoi: number;
  ngayNhan: Date[];
  ngayDung: Date[];
  /** Nguồn nhận (PO / phiếu giao / ghi chú nhập tay), không trùng, theo thứ tự thời gian. */
  nguonNhan: string[];
  /** Ghi chú của các lần xuất dùng, không trùng. */
  mucDichDung: string[];
  dieuChinhDs: { ngay: Date; so: number }[];
  /** Lần nhận đầu tiên từ trước tới nay của mặt hàng (ở các kho này) nằm trong tháng. */
  moiNhan: boolean;
};

const tron = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Tổng hợp theo mặt hàng cho một tháng [dau, cuoi). `giaoDich` là mọi giao
 * dịch từ đầu tháng tới nay (giao dịch sau tháng dùng để lùi tồn hiện tại về
 * cuối tháng); `tonHienTai` là tồn hiện tại theo mặt hàng; `nhanDauTien` là
 * ngày nhận thật đầu tiên từ trước tới nay của từng mặt hàng.
 */
export function tongHop1101(x: {
  tonHienTai: Map<number, number>;
  giaoDich: GiaoDich1101[];
  dau: Date;
  cuoi: Date;
  nhanDauTien: Map<number, Date>;
  nguonCua?: (g: GiaoDich1101) => string | null;
}): Map<number, TongHop1101> {
  const ra = new Map<number, TongHop1101>();
  const lay = (id: number) => {
    let d = ra.get(id);
    if (!d) {
      d = { materialId: id, tonDau: 0, nhan: 0, dung: 0, dieuChinh: 0, tonCuoi: 0, ngayNhan: [], ngayDung: [], nguonNhan: [], mucDichDung: [], dieuChinhDs: [], moiNhan: false };
      ra.set(id, d);
    }
    return d;
  };
  const sauThang = new Map<number, number>();
  for (const id of x.tonHienTai.keys()) lay(id);
  const theoGio = [...x.giaoDich].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  for (const g of theoGio) {
    const co = g.type === "IN" ? g.quantity : -g.quantity;
    if (g.occurredAt >= x.cuoi) {
      sauThang.set(g.materialId, (sauThang.get(g.materialId) ?? 0) + co);
      continue;
    }
    if (g.occurredAt < x.dau) continue;
    const d = lay(g.materialId);
    const loai = loaiGiaoDich(g);
    if (loai === "KIEM_KE") {
      d.dieuChinh += co;
      d.dieuChinhDs.push({ ngay: g.occurredAt, so: co });
    } else if (loai === "NHAN") {
      // Dòng "bớt nhận" của file kiểm kê là XUẤT gắn cột Nhận: trừ khỏi số nhận.
      d.nhan += g.type === "IN" ? g.quantity : -g.quantity;
      d.ngayNhan.push(g.occurredAt);
      const nguon = (x.nguonCua?.(g) ?? g.note ?? "").trim();
      if (nguon && !d.nguonNhan.includes(nguon)) d.nguonNhan.push(nguon);
    } else {
      // Dòng "bớt tiêu thụ" của file kiểm kê là NHẬP gắn cột Tiêu thụ: trừ khỏi số dùng.
      d.dung += g.type === "IN" ? -g.quantity : g.quantity;
      d.ngayDung.push(g.occurredAt);
      const md = (g.note ?? "").trim();
      if (md && !d.mucDichDung.includes(md)) d.mucDichDung.push(md);
    }
  }
  for (const d of ra.values()) {
    d.tonCuoi = tron((x.tonHienTai.get(d.materialId) ?? 0) - (sauThang.get(d.materialId) ?? 0));
    d.nhan = tron(d.nhan);
    d.dung = tron(d.dung);
    d.dieuChinh = tron(d.dieuChinh);
    d.tonDau = tron(d.tonCuoi - d.nhan + d.dung - d.dieuChinh);
    const dauTien = x.nhanDauTien.get(d.materialId);
    d.moiNhan = Boolean(dauTien && dauTien >= x.dau && dauTien < x.cuoi);
  }
  return ra;
}

/** Có gì để in không (bỏ mặt hàng không tồn, không nhận, không dùng, không điều chỉnh). */
export function coSo1101(d: TongHop1101): boolean {
  return d.tonDau !== 0 || d.nhan !== 0 || d.dung !== 0 || d.dieuChinh !== 0 || d.tonCuoi !== 0;
}

/** dd/mm theo giờ Việt Nam (máy chủ chạy giờ UTC). */
const ddmm = (d: Date) => {
  const vn = new Date(d.getTime() + LECH_VN_MS);
  return `${String(vn.getUTCDate()).padStart(2, "0")}/${String(vn.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Cột "Ngày": mọi ngày khác nhau trong tháng (dd/mm); nhiều quá thì ngày đầu – ngày cuối kèm số lần. */
export function chuoiNgay1101(ds: Date[]): string {
  const ngay = [...new Set(ds.map(ddmm))];
  if (ngay.length <= 3) return ngay.join(", ");
  return `${ngay[0]} – ${ngay[ngay.length - 1]} (${ds.length} lần)`;
}

const so = (n: number) => String(tron(n));
const dau = (n: number) => (n > 0 ? `+${so(n)}` : so(n));
const cat = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * Ghi chú tự động của một dòng: mới nhận lần đầu, nguồn nhận, mục đích dùng,
 * điều chỉnh kiểm kê (đối được số), dưới mức tối thiểu. Ngắn, đủ đọc trên giấy.
 */
export function ghiChu1101(d: TongHop1101, minStock: number): string {
  const phan: string[] = [];
  if (d.moiNhan) phan.push("Mới nhận lần đầu");
  if (d.nguonNhan.length) {
    const hien = d.nguonNhan.slice(0, 2).map((s) => cat(s, 48));
    phan.push(`Nhận: ${hien.join("; ")}${d.nguonNhan.length > 2 ? ` (+${d.nguonNhan.length - 2})` : ""}`);
  }
  if (d.mucDichDung.length) {
    const hien = d.mucDichDung.slice(0, 2).map((s) => cat(s, 40));
    phan.push(`Dùng: ${hien.join("; ")}${d.mucDichDung.length > 2 ? ` (+${d.mucDichDung.length - 2})` : ""}`);
  }
  if (d.dieuChinhDs.length) {
    const banDau = d.tonDau === 0 && d.nhan === 0 && d.dung === 0 && d.dieuChinhDs.length === 1;
    const ct = d.dieuChinhDs.map((x) => `${dau(x.so)} ${ddmm(x.ngay)}`);
    phan.push(banDau ? `Tồn ban đầu (kiểm kê ${ddmm(d.dieuChinhDs[0].ngay)}): ${so(d.dieuChinh)}` : `Điều chỉnh kiểm kê ${ct.slice(0, 3).join(", ")}${ct.length > 3 ? "…" : ""}`);
  }
  if (minStock > 0 && d.tonCuoi < minStock) phan.push(`Dưới tối thiểu (min ${so(minStock)})`);
  // Tồn đầu âm = số liệu kho tự mâu thuẫn (tồn bị sửa mà không có giao dịch) —
  // không tự "sửa" cho đẹp, chỉ chỉ ra để người lập báo cáo kiểm thẻ kho.
  if (d.tonDau < 0) phan.push("Tồn đầu âm — đối chiếu thẻ kho");
  return phan.join(". ");
}

/** Nhãn nguồn nhận theo PO: "Nhận hàng PO-2026-012" → "PO-2026-012 (Tên NCC)". */
export function nhanNguonPO(note: string | null, nccTheoPo: Map<string, string>): string | null {
  const m = /^Nhận hàng\s+(\S+)/i.exec(note ?? "");
  if (!m) return null;
  const ncc = nccTheoPo.get(m[1]);
  return ncc ? `${m[1]} (${ncc})` : m[1];
}
