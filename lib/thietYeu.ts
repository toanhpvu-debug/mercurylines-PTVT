/**
 * PHỤ TÙNG THIẾT YẾU (MLS-11-04 "Danh mục kiểm tra phụ tùng thiết yếu trên
 * tàu") — phần thuần, không đụng database: đọc bảng của mẫu Word, quy đổi cột
 * "Tối thiểu", dựng dòng báo cáo tháng. Kiểm ở scripts/kiem-tra-thiet-yeu.ts.
 *
 * Danh mục này được quản lý RIÊNG, tách khỏi danh mục vật tư chung: đó là
 * danh sách kiểm tra do công ty quy định (mỗi mục có mức tối thiểu phải luôn
 * có trên tàu), tàu điền số hằng tháng và ký gửi văn phòng. Một mục có thể gắn
 * với mặt hàng trong danh mục kho để lấy sẵn số nhập / xuất, nhưng không bắt buộc.
 *
 * Bảng của mẫu (đọc bằng word-extractor: mỗi hàng bảng một dòng, ô cách nhau
 * bằng tab) có ba loại hàng:
 *   - Tiêu đề nhóm, hai kiểu: "A. Phụ tùng cho Máy chính (Spare Parts for Main
 *     Engine)" nằm trong một ô, hoặc "C" | "SPARE PARTS FOR BOILERS" hai ô.
 *   - Mục: stt | Mô tả | Số phụ tùng | Tối thiểu | Ban đầu | Nhận trong tháng |
 *     Tổng tiêu thụ | Hiện có | Vị trí.
 *   - Hàng tiêu đề cột, hàng trống, chữ ký: bỏ qua.
 */

export type MucThietYeuDoc = {
  nhom: string;
  stt: string;
  moTa: string;
  partNo: string | null;
  toiThieu: string | null;
  toiThieuSo: number;
  tonDau: number | null;
  nhan: number | null;
  tieuThu: number | null;
  hienCo: number | null;
  viTri: string | null;
};

export type KetQuaDocMLS1104 = {
  muc: MucThietYeuDoc[];
  tenTau: string | null;
  /** Hàng có chữ mà không nhận ra (không phải nhóm, không phải mục). */
  boQua: number;
};

const sach = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Số trong một ô: "3", "2,5", " 1 " → số; trống / chữ → null. */
export function soTrongO(s: string | undefined): number | null {
  const t = sach(s).replace(",", ".");
  if (!t) return null;
  const m = t.match(/^-?\d+(?:\.\d+)?$/);
  return m ? Number(t) : null;
}

/**
 * Quy đổi cột "Tối thiểu" như in trên mẫu ra số để so với số hiện có:
 * "01 set" → 1, "1/2 set" / "½ set" → 0,5, "06" → 6, "1 of each type" → 1.
 * Không đọc được → 0 (không cảnh báo thiếu, nhưng vẫn giữ chữ gốc để in).
 */
export function soTuToiThieu(s: string | null | undefined): number {
  const t = sach(s ?? "").toLowerCase().replace(",", ".");
  if (!t) return 0;
  if (/^½/.test(t)) return 0.5;
  const ps = t.match(/^(\d+)\s*\/\s*(\d+)/);
  if (ps && Number(ps[2]) > 0) return Number(ps[1]) / Number(ps[2]);
  const so = t.match(/^(\d+(?:\.\d+)?)/);
  return so ? Number(so[1]) : 0;
}

/** Nhãn nhóm chuẩn "A. Tên nhóm" từ hai kiểu hàng tiêu đề nhóm. */
function nhanNhom(o: string[]): string | null {
  const c0 = sach(o[0]);
  const conLai = o.slice(1).map(sach).filter(Boolean);
  // Kiểu 1: cả nhãn trong một ô, "A. Phụ tùng cho Máy chính (...)".
  if (/^[A-ZĐ]\s*[.)]\s*\S/.test(c0) && conLai.length === 0) {
    return c0.replace(/^([A-ZĐ])\s*[.)]\s*/, "$1. ");
  }
  // Kiểu 2: chữ cái ở ô đầu, tên nhóm ở ô sau, các ô khác trống.
  if (/^[A-ZĐ]$/.test(c0) && conLai.length === 1 && !/^\d/.test(conLai[0])) {
    return `${c0}. ${conLai[0]}`;
  }
  return null;
}

/**
 * Đọc bảng MLS-11-04 từ các hàng đã tách ô. Mục đứng trước mọi tiêu đề nhóm
 * (mẫu tự làm) vào nhóm "Khác". Tên tàu lấy từ dòng "Tên tàu (Vessel) …".
 */
export function docHangMLS1104(hang: string[][]): KetQuaDocMLS1104 {
  const muc: MucThietYeuDoc[] = [];
  let nhom = "Khác";
  let boQua = 0;
  let tenTau: string | null = null;
  for (const o of hang) {
    const coChu = o.some((c) => sach(c));
    if (!coChu) continue;
    const c0 = sach(o[0]);
    if (!tenTau && /Vessel\)/i.test(c0)) {
      const m = c0.match(/Vessel\)\s*[:：]?\s*([^….]+?)\s*[….]{2,}/i) ?? c0.match(/Vessel\)\s*[:：]?\s*(\S[^N]*?)\s{2,}/i);
      if (m && sach(m[1])) tenTau = sach(m[1]);
      continue;
    }
    const n = nhanNhom(o);
    if (n) {
      nhom = n;
      continue;
    }
    if (/^\d{1,3}$/.test(c0) && sach(o[1])) {
      const toiThieu = sach(o[3]) || null;
      muc.push({
        nhom,
        stt: c0,
        moTa: sach(o[1]).slice(0, 300),
        partNo: sach(o[2]) || null,
        toiThieu,
        toiThieuSo: soTuToiThieu(toiThieu),
        tonDau: soTrongO(o[4]),
        nhan: soTrongO(o[5]),
        tieuThu: soTrongO(o[6]),
        hienCo: soTrongO(o[7]),
        viTri: sach(o[8]) || null,
      });
      continue;
    }
    // Tiêu đề cột, chữ ký, ghi chú...
    boQua++;
  }
  return { muc, tenTau, boQua };
}

/** Tách văn bản word-extractor (hàng = dòng, ô = tab) thành các hàng ô. */
export function tachHang(body: string): string[][] {
  return body.split(/\r?\n/).map((d) => d.split("\t"));
}

/** Tháng "YYYY-MM" hợp lệ, không thì tháng hiện tại. */
export function thangHopLe(s: string | null | undefined, bayGio = new Date()): string {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s ?? ""));
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${m[1]}-${m[2]}`;
  return `${bayGio.getFullYear()}-${String(bayGio.getMonth() + 1).padStart(2, "0")}`;
}

/** [đầu tháng, đầu tháng sau) theo giờ máy chủ. */
export function khoangThang(thang: string): { dau: Date; cuoi: Date } {
  const [y, m] = thang.split("-").map(Number);
  return { dau: new Date(y, m - 1, 1), cuoi: new Date(y, m, 1) };
}

/** Ngày ghi trên báo cáo: tháng đang chạy → hôm nay; tháng đã qua → ngày cuối tháng. dd/mm/yyyy. */
export function ngayBaoCao(thang: string, bayGio = new Date()): string {
  const { cuoi } = khoangThang(thang);
  const d = bayGio < cuoi && bayGio >= khoangThang(thang).dau ? bayGio : new Date(cuoi.getTime() - 24 * 3600 * 1000);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Một dòng báo cáo tháng (đã có số) — dùng chung cho trang, bản in và tệp Word. */
export type DongThietYeu = {
  id: number;
  nhom: string;
  stt: string;
  moTa: string;
  partNo: string | null;
  toiThieu: string | null;
  toiThieuSo: number;
  tonDau: number | null;
  nhan: number | null;
  tieuThu: number | null;
  hienCo: number | null;
  viTri: string | null;
  /** Nguồn số: đã lưu tháng này / lấy từ nhập-xuất kho / ước theo tháng trước. */
  nguon: "DA_LUU" | "KHO" | "UOC";
  maVatTu: string | null;
};

/** Thiếu: có mức tối thiểu và số hiện có (đã biết) thấp hơn. */
export function laThieu(d: Pick<DongThietYeu, "toiThieuSo" | "hienCo">): boolean {
  return d.toiThieuSo > 0 && d.hienCo !== null && d.hienCo < d.toiThieuSo - 1e-9;
}

/** Gom dòng theo nhóm, giữ thứ tự xuất hiện. */
export function gomNhom<T extends { nhom: string }>(dong: T[]): { nhom: string; dong: T[] }[] {
  const ra: { nhom: string; dong: T[] }[] = [];
  for (const d of dong) {
    const cuoi = ra[ra.length - 1];
    if (cuoi && cuoi.nhom === d.nhom) cuoi.dong.push(d);
    else {
      const cu = ra.find((x) => x.nhom === d.nhom);
      if (cu) cu.dong.push(d);
      else ra.push({ nhom: d.nhom, dong: [d] });
    }
  }
  return ra;
}

/** Số để in: bỏ phần thập phân thừa; null → trống. */
export function soIn(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return String(Math.round(n * 100) / 100);
}

/**
 * Một dòng BẢN IN (và tệp Word): mọi ô là chữ, như người làm báo cáo gõ. Bản
 * sửa trước khi in chỉ sống trong trình duyệt, không đổi số liệu hệ thống; dòng
 * thêm tay có id bắt đầu bằng "moi-".
 */
export type DongIn = {
  id: string;
  nhom: string;
  stt: string;
  moTa: string;
  partNo: string;
  toiThieu: string;
  tonDau: string;
  nhan: string;
  tieuThu: string;
  hienCo: string;
  viTri: string;
};

/** Chín ô của một hàng mục, đúng thứ tự cột trên mẫu MLS-11-04. */
export const COT_IN = ["stt", "moTa", "partNo", "toiThieu", "tonDau", "nhan", "tieuThu", "hienCo", "viTri"] as const;

export function dongInTu(d: DongThietYeu): DongIn {
  return {
    id: String(d.id),
    nhom: d.nhom,
    stt: d.stt,
    moTa: d.moTa,
    partNo: d.partNo ?? "",
    toiThieu: d.toiThieu ?? "",
    tonDau: soIn(d.tonDau),
    nhan: soIn(d.nhan),
    tieuThu: soIn(d.tieuThu),
    hienCo: soIn(d.hienCo),
    viTri: d.viTri ?? "",
  };
}

/** Dòng bản in có thiếu không (so theo chữ đang hiện trên bản in). */
export function laThieuIn(d: Pick<DongIn, "toiThieu" | "hienCo">): boolean {
  return laThieu({ toiThieuSo: soTuToiThieu(d.toiThieu), hienCo: soTrongO(d.hienCo) });
}

export const TOI_DA_DONG_IN = 600;

/**
 * Kiểm bản in người dùng gửi lên (xuất Word bản đã sửa): đúng dạng, cắt độ dài.
 * Sai dạng → null.
 */
export function sachBanIn(x: unknown): { tenTau: string; ngay: string; dong: DongIn[] } | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const chu = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max) : "");
  if (!Array.isArray(o.dong) || o.dong.length > TOI_DA_DONG_IN) return null;
  const dong: DongIn[] = [];
  for (const r of o.dong) {
    if (!r || typeof r !== "object") return null;
    const d = r as Record<string, unknown>;
    dong.push({
      id: chu(d.id, 40),
      nhom: chu(d.nhom, 200).trim() || "—",
      stt: chu(d.stt, 12),
      moTa: chu(d.moTa, 300),
      partNo: chu(d.partNo, 80),
      toiThieu: chu(d.toiThieu, 60),
      tonDau: chu(d.tonDau, 20),
      nhan: chu(d.nhan, 20),
      tieuThu: chu(d.tieuThu, 20),
      hienCo: chu(d.hienCo, 20),
      viTri: chu(d.viTri, 120),
    });
  }
  return { tenTau: chu(o.tenTau, 120), ngay: chu(o.ngay, 40), dong };
}

/** Sự kiện trình duyệt báo bảng đang mở bỏ bản in sửa tay (detail = id tàu). */
export const SU_KIEN_XOA_BAN_IN = "mercury:ban-in-1104-xoa";

/** Khóa localStorage của bản in đã sửa tay (tàu + tháng). */
export function khoaBanIn(vesselId: number, thang: string): string {
  return `mercury.bao-cao-1104.${vesselId}.${thang}`;
}

/**
 * Xóa mọi bản in đã sửa tay của một tàu trên máy này — gọi sau khi gỡ hoặc nhập
 * lại danh mục: mục đã đổi hết id, bản nháp cũ không còn khớp và sẽ che mất
 * danh mục mới. Chỉ chạy ở trình duyệt.
 */
export function xoaBanInCuaTau(vesselId: number): void {
  try {
    const tien = khoaBanIn(vesselId, "");
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(tien)) window.localStorage.removeItem(k);
    }
  } catch {
    /* localStorage bị chặn: không có gì để xóa */
  }
  window.dispatchEvent(new CustomEvent(SU_KIEN_XOA_BAN_IN, { detail: vesselId }));
}
