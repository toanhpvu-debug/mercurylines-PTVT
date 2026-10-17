import { dauThangVN, ngayCuaVN } from "@/lib/kyQuy";

/**
 * PHỤ TÙNG THIẾT YẾU (MLS-11-04 "Danh mục kiểm tra phụ tùng thiết yếu trên
 * tàu") — phần thuần, không đụng database: đọc bảng của tệp tàu gửi (Word / Excel),
 * quy đổi cột "Tối thiểu", đối chiếu với danh mục đã có, dựng dòng báo cáo tháng.
 * Kiểm ở scripts/kiem-tra-thiet-yeu.ts.
 *
 * Danh mục này được quản lý RIÊNG, tách khỏi danh mục vật tư chung: đó là
 * danh sách kiểm tra do công ty quy định (mỗi mục có mức tối thiểu phải luôn
 * có trên tàu), tàu điền số hằng tháng và ký gửi văn phòng. Một mục có thể gắn
 * với mặt hàng trong danh mục kho để lấy sẵn số nhập / xuất, nhưng không bắt buộc.
 *
 * Tệp tàu gửi KHÔNG cùng một khuôn nên đọc theo DÒNG TIÊU ĐỀ CỘT (Mô tả / Description,
 * Số phụ tùng, Tối thiểu, Ban đầu, Nhận, Tiêu thụ, Hiện có, Vị trí — tiếng Việt hay tiếng
 * Anh), không theo vị trí cột cố định:
 *   - mẫu trống của công ty: cột "stt" riêng, 9 cột;
 *   - báo cáo tháng tàu đã điền: số thứ tự viết chung ô mô tả ("1. Main Bearing (Bạc
 *     trục):"), 8 cột, số kèm đơn vị ("1 SET", "2PCS");
 *   - bảng tiếng Anh kiểu No. · System Category · Spare Part Name · Min. Qty · Unit.
 * Tiêu đề nhóm, hai kiểu: "A. Phụ tùng cho Máy chính (...)" một ô, hoặc "C" | "SPARE
 * PARTS FOR BOILERS" hai ô; bảng có cột nhóm (System Category) thì nhóm theo cột đó.
 * Không thấy dòng tiêu đề cột thì đọc theo khuôn MLS-11-04 (stt | mô tả | …).
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
  /** Ô "Ngày (Date)" của tệp (dd/mm/yyyy) và tháng của số trong tệp ("YYYY-MM"); null = chưa điền. */
  ngay: string | null;
  thang: string | null;
  /** Hàng có chữ mà không nhận ra (không phải nhóm, không phải mục). */
  boQua: number;
  /** Đọc theo dòng tiêu đề cột (true) hay theo khuôn MLS-11-04 cố định. */
  theoTieuDe: boolean;
};

const sach = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
/** Chữ thường, bỏ dấu, gộp khoảng trắng — để so tiêu đề cột / tên tàu. */
const khongDau = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const hai = (n: number) => String(n).padStart(2, "0");

/** Số trong một ô: "3", "2,5", " 1 " → số; trống / chữ → null. */
export function soTrongO(s: string | undefined): number | null {
  const t = sach(s).replace(",", ".");
  if (!t) return null;
  const m = t.match(/^-?\d+(?:\.\d+)?$/);
  return m ? Number(t) : null;
}

/**
 * Số trong ô số của tệp tàu đã điền: như soTrongO nhưng nhận cả đơn vị viết kèm ("1 SET",
 * "2PCS", "12 pcs" → 1, 2, 12), phân số ("1/2" → 0,5) và gạch ("-" = không có → 0). Chữ
 * khác → null (không đoán).
 */
export function soCoDonVi(s: string | undefined): number | null {
  const t = sach(s).toLowerCase().replace(",", ".");
  if (!t) return null;
  if (/^[-–—]+$/.test(t)) return 0;
  if (/^½/.test(t)) return 0.5;
  const ps = /^(\d+)\s*\/\s*(\d+)(?![\d.])/.exec(t);
  if (ps && Number(ps[2]) > 0) return Number(ps[1]) / Number(ps[2]);
  const m = /^(-?\d+(?:\.\d+)?)(?:\s*[^\d\s./].*)?$/.exec(t);
  return m ? Number(m[1]) : null;
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

/** Mô tả gọn: một dòng, bỏ dấu ":" thừa cuối ("Main Bearing (Bạc trục):"). */
const gonMoTa = (s: string) =>
  sach(s)
    .replace(/\s*:\s*$/, "")
    .slice(0, 300);

// ─── Hàng bảng từ chữ Word ──────────────────────────────────────────────────

/**
 * Hàng bảng từ chữ word-extractor. Ô kết thúc bằng tab, hàng bảng kết thúc bằng tab ở
 * cuối dòng; xuống dòng TRONG một ô (tiêu đề "Mô tả⏎Description", ô ký "Máy hai⏎second
 * engineer") cắt hàng thành nhiều dòng — ghép lại tới dòng kết thúc bằng tab. Dòng không
 * có tab đứng ngay trước một mảnh hàng chỉ được ghép khi nó giống mảnh ô (ngắn, hoặc mở
 * đầu bằng số thứ tự / chữ nhóm); đoạn văn thường (tên biểu mẫu) đứng riêng.
 */
export function ghepHangWord(body: string): string[][] {
  const ra: string[][] = [];
  const xuat = (s: string) => ra.push(s.split("\t"));
  const giongManhO = (s: string) => {
    const t = s.trim();
    return t.length > 0 && (t.length <= 30 || /^\d{1,3}\s*[.)]?\s+\S/.test(t) || /^[A-ZĐ]\s*[.)]\s*\S/.test(t));
  };
  let manh: string | null = null;
  let soManh = 0;
  let cho: string | null = null;
  for (const dong of body.split(/\r?\n/)) {
    if (manh !== null) {
      manh += ` ${dong}`;
      soManh++;
      // Hàng hỏng không bao giờ kết thúc: cắt sau 8 dòng để không nuốt cả phần còn lại.
      if (dong.endsWith("\t") || soManh >= 8) {
        xuat(manh);
        manh = null;
      }
      continue;
    }
    if (dong.includes("\t")) {
      let dau = "";
      if (cho !== null) {
        if (giongManhO(cho)) dau = `${cho} `;
        else xuat(cho);
        cho = null;
      }
      if (dong.endsWith("\t")) xuat(dau + dong);
      else {
        manh = dau + dong;
        soManh = 1;
      }
      continue;
    }
    if (cho !== null) xuat(cho);
    cho = dong.trim() ? dong : null;
  }
  if (manh !== null) xuat(manh);
  if (cho !== null) xuat(cho);
  return ra;
}

/** Tách văn bản word-extractor (hàng = dòng, ô = tab) thành các hàng ô — không ghép hàng bị cắt. */
export function tachHang(body: string): string[][] {
  return body.split(/\r?\n/).map((d) => d.split("\t"));
}

// ─── Đầu tệp: tên tàu, ngày ─────────────────────────────────────────────────

/**
 * Tên tàu và ngày trên đầu tệp: "Tên tàu (Vessel): M.ODYSSEY      Ngày (Date): 30 /09/2026"
 * (mẫu trống "ODYSSEY………….. Ngày (Date):……../…….. /2026" → chỉ có tên tàu). Ngày cho biết
 * số trong tệp là của tháng nào.
 */
export function docDauTep(dong: readonly string[]): { tenTau: string | null; ngay: string | null; thang: string | null } {
  let tenTau: string | null = null;
  let ngay: string | null = null;
  let thang: string | null = null;
  for (const raw of dong) {
    const s = raw.normalize("NFC").replace(/\t/g, "   ");
    if (!tenTau) {
      const m =
        /(?:t[êe]n t[àa]u\s*\(\s*vessel\s*\)|\(\s*vessel\s*\)|vessel'?s? name|vessel(?=\s*[:：])|t[êe]n t[àa]u)\s*[:：]?\s*(.+?)\s*(?=ng[àa]y\b|\(\s*date|date\s*[:：(]|…|\.{2,}|\s{3,}|$)/i.exec(s);
      const t = m ? m[1].replace(/[\s.:…]+$/, "").trim() : "";
      if (/[\p{L}\p{N}]/u.test(t)) tenTau = t.slice(0, 80);
    }
    if (!ngay) {
      const d = /(?:date|ng[àa]y)\s*\)?\s*[:：]?\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})/i.exec(s);
      if (d) {
        const [dd, mm, yy] = [Number(d[1]), Number(d[2]), Number(d[3])];
        if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 2000 && yy <= 2100) {
          ngay = `${hai(dd)}/${hai(mm)}/${yy}`;
          thang = `${yy}-${hai(mm)}`;
        }
      }
    }
  }
  return { tenTau, ngay, thang };
}

/**
 * Tên tàu ghi trong tệp có phải tàu đang chọn không — so phần tên sau khi bỏ "M." / "MV",
 * dấu chấm, khoảng trắng ("M.ODYSSEY" = "M. ODYSSEY" = "ODYSSEY"). null = tệp không ghi tên.
 */
export function cungTauTep(tenTep: string | null, tau: { name: string; code: string }): boolean | null {
  if (!tenTep) return null;
  const goc = (s: string) =>
    khongDau(s)
      .split(/[^a-z0-9]+/)
      .filter((x) => x && !["m", "mv", "mt", "ms", "ss", "tau"].includes(x))
      .join("");
  const a = goc(tenTep);
  if (a.length < 3) return null;
  return [tau.name, tau.code].some((x) => {
    const b = goc(x);
    return b.length >= 3 && (a === b || a.includes(b) || b.includes(a));
  });
}

// ─── Đọc bảng ───────────────────────────────────────────────────────────────

type CotTep = "stt" | "moTa" | "partNo" | "toiThieu" | "donVi" | "tonDau" | "nhan" | "tieuThu" | "hienCo" | "viTri" | "nhom" | "thietBi";

/**
 * Nhận cột theo chữ tiêu đề (đã bỏ dấu). Thứ tự quan trọng: "Số phụ tùng ban đầu" là cột
 * Ban đầu, "Số phụ tùng nhận trong tháng" là cột Nhận — chỉ "Số phụ tùng (Spare Part No.)"
 * mới là cột số phụ tùng.
 */
const NHAN_COT: [CotTep, RegExp][] = [
  ["tonDau", /ban dau|begin(ning)? stock|opening|last r\.?o\.?b|ton dau/],
  ["nhan", /^nhan$|nhan trong|nhap trong|rcvd|receiv/],
  ["tieuThu", /tieu thu|consum|conspt|^cons\.?$|su dung/],
  ["hienCo", /hien co|remain|r\.?o\.?b|on ?board|ton tren tau/],
  ["toiThieu", /toi thieu|minimum|min\.? ?(qty|quantity)|^min\.?$/],
  ["donVi", /^(unit|units|dvt|don vi( tinh)?|uom)\b/],
  ["viTri", /vi tri|location|noi (de|cat)/],
  ["partNo", /spare part no|part ?no\b|part number|p\/n|so phu tung|ma phu tung|so hieu/],
  ["stt", /^(stt|tt|so tt|no\.?|nr\.?|s\/n|#|item no\.?)$/],
  ["moTa", /mo ta|description|part name|ten phu tung|ten vat tu|ten hang|^name$|^items?$/],
  ["nhom", /system category|^nhom|category|^group/],
  ["thietBi", /equipment|thiet bi/],
];

type TieuDe = { vt: number; cot: Partial<Record<CotTep, number>> };

/** Dòng tiêu đề cột: có cột mô tả, có cột tối thiểu hoặc hiện có, nhận ra ít nhất 3 cột. */
function timTieuDe(hang: readonly string[][]): TieuDe | null {
  for (let i = 0; i < Math.min(hang.length, 40); i++) {
    const o = hang[i].map((c) => khongDau(c ?? ""));
    if (o.filter(Boolean).length < 3) continue;
    const cot: Partial<Record<CotTep, number>> = {};
    o.forEach((c, j) => {
      if (!c || c.length > 80) return;
      const k = NHAN_COT.find(([ten, re]) => cot[ten] === undefined && re.test(c));
      if (k) cot[k[0]] = j;
    });
    if (cot.moTa !== undefined && (cot.toiThieu !== undefined || cot.hienCo !== undefined) && Object.keys(cot).length >= 3) return { vt: i, cot };
  }
  return null;
}

function docTheoTieuDe(hang: readonly string[][], { vt, cot }: TieuDe): { muc: MucThietYeuDoc[]; boQua: number } {
  const o = (r: string[], k: CotTep) => (cot[k] === undefined ? "" : sach(r[cot[k]!]));
  const muc: MucThietYeuDoc[] = [];
  let nhom = "Khác";
  let nhomCot = "";
  let boQua = 1; // chính dòng tiêu đề
  const sttTuDong = new Map<string, number>();
  for (const r of hang.slice(vt + 1)) {
    if (!r.some((c) => sach(c))) continue;
    const n = nhanNhom(r);
    if (n) {
      nhom = n;
      nhomCot = "";
      continue;
    }
    let stt = o(r, "stt").replace(/[.)]$/, "");
    let moTa = o(r, "moTa") || o(r, "thietBi");
    // Số thứ tự viết chung ô mô tả: "1. Main Bearing (Bạc trục):".
    const g = /^(\d{1,3})\s*[.)\-–:]\s*(\S.*)$/.exec(moTa) ?? (!stt ? /^(\d{1,3})\s+(\D.*)$/.exec(moTa) : null);
    if (g && (!stt || stt === g[1])) {
      stt = g[1];
      moTa = g[2];
    }
    const toiThieuChu = [o(r, "toiThieu"), o(r, "donVi")].filter(Boolean).join(" ");
    const coStt = /^\d{1,4}$/.test(stt);
    // Không số thứ tự: chỉ nhận khi bảng không có cột stt mà ô tối thiểu là một lượng
    // ("2 set", "½") — dòng ký tên / họ tên cuối bảng cũng rơi đúng các cột đó.
    if (gonMoTa(moTa).length < 2 || (!coStt && (cot.stt !== undefined || !/^(\d|½)/.test(o(r, "toiThieu"))))) {
      boQua++;
      continue;
    }
    if (cot.nhom !== undefined) nhomCot = o(r, "nhom") || nhomCot;
    const nhomMuc = (nhomCot || nhom).slice(0, 200);
    if (!coStt) {
      const k = (sttTuDong.get(nhomMuc) ?? 0) + 1;
      sttTuDong.set(nhomMuc, k);
      stt = String(k);
    }
    const toiThieu = toiThieuChu || null;
    muc.push({
      nhom: nhomMuc,
      stt,
      moTa: gonMoTa(moTa),
      partNo: o(r, "partNo") || null,
      toiThieu,
      toiThieuSo: soTuToiThieu(toiThieu),
      tonDau: soCoDonVi(o(r, "tonDau")),
      nhan: soCoDonVi(o(r, "nhan")),
      tieuThu: soCoDonVi(o(r, "tieuThu")),
      hienCo: soCoDonVi(o(r, "hienCo")),
      viTri: o(r, "viTri") || null,
    });
  }
  return { muc, boQua };
}

/** Khuôn MLS-11-04 cố định khi không thấy dòng tiêu đề: stt | mô tả | số phụ tùng | tối thiểu | ban đầu | nhận | tiêu thụ | hiện có | vị trí. */
function docTheoKhuon(hang: readonly string[][]): { muc: MucThietYeuDoc[]; boQua: number } {
  const muc: MucThietYeuDoc[] = [];
  let nhom = "Khác";
  let boQua = 0;
  const mucTu = (stt: string, moTa: string, sau: string[]): MucThietYeuDoc => {
    const toiThieu = sach(sau[1]) || null;
    return {
      nhom,
      stt,
      moTa: gonMoTa(moTa),
      partNo: sach(sau[0]) || null,
      toiThieu,
      toiThieuSo: soTuToiThieu(toiThieu),
      tonDau: soCoDonVi(sau[2]),
      nhan: soCoDonVi(sau[3]),
      tieuThu: soCoDonVi(sau[4]),
      hienCo: soCoDonVi(sau[5]),
      viTri: sach(sau[6]) || null,
    };
  };
  for (const o of hang) {
    if (!o.some((c) => sach(c))) continue;
    const c0 = sach(o[0]);
    if (/vessel\)|t[êe]n t[àa]u/i.test(c0)) continue;
    const n = nhanNhom(o);
    if (n) {
      nhom = n;
      continue;
    }
    if (/^\d{1,3}$/.test(c0) && sach(o[1])) {
      muc.push(mucTu(c0, o[1], o.slice(2)));
      continue;
    }
    const g = /^(\d{1,3})\s*[.)]\s*(\S.*)$/.exec(c0);
    if (g && o.length >= 3) {
      muc.push(mucTu(g[1], g[2], o.slice(1)));
      continue;
    }
    boQua++; // tiêu đề cột, chữ ký, ghi chú...
  }
  return { muc, boQua };
}

/**
 * Đọc bảng danh mục phụ tùng thiết yếu từ các hàng đã tách ô (Word: ghepHangWord; Excel:
 * từng dòng của sheet). Mục đứng trước mọi tiêu đề nhóm vào nhóm "Khác".
 */
export function docBangThietYeu(hang: readonly string[][]): KetQuaDocMLS1104 {
  const dau = docDauTep(hang.slice(0, 40).map((o) => o.join("\t")));
  const td = timTieuDe(hang);
  const theoTieuDe = td ? docTheoTieuDe(hang, td) : null;
  // Lưới an toàn: dòng tiêu đề bị cắt dở (chỉ nửa sau lọt vào một hàng) làm lệch cột → đọc
  // theo khuôn MLS-11-04 ra nhiều mục hơn thì lấy khuôn.
  const theoKhuon = docTheoKhuon(hang);
  const chon = theoTieuDe && theoTieuDe.muc.length >= theoKhuon.muc.length ? theoTieuDe : theoKhuon;
  return { muc: chon.muc, tenTau: dau.tenTau, ngay: dau.ngay, thang: dau.thang, boQua: chon.boQua, theoTieuDe: chon === theoTieuDe };
}

/** Tên cũ — giữ cho chỗ gọi / kiểm thử sẵn có. */
export const docHangMLS1104 = docBangThietYeu;

// ─── Đối chiếu tệp với danh mục đã có ───────────────────────────────────────

export type MucCoSan = { id: number; nhom: string; stt: string | null; moTa: string; partNo: string | null };

const chuanKhop = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
/** Khóa nhóm: chữ cái đầu ("A. …" → "a") — đổi chữ sau tên nhóm vẫn là nhóm đó — hoặc cả tên nhóm. */
export const khoaNhom = (n: string) => {
  const m = /^\s*([A-ZĐ])\s*[.)]/.exec(n);
  return m ? m[1].toLowerCase() : chuanKhop(n);
};

/**
 * Ghép từng mục của tệp với mục đã có trong danh mục của tàu — để nhập tệp tháng sau
 * CẬP NHẬT số chứ không nhân đôi danh mục hay mất lịch sử các tháng. Cùng nhóm (chữ A/B/C
 * hoặc tên nhóm) và lần lượt: mô tả trùng (bỏ dấu câu, hoa thường) → số phụ tùng trùng →
 * cùng số thứ tự mà mô tả cùng đầu. Mỗi mục đã có ghép với tối đa một mục của tệp.
 */
export function doiChieuThietYeu(
  tep: readonly Pick<MucThietYeuDoc, "nhom" | "stt" | "moTa" | "partNo">[],
  coSan: readonly MucCoSan[]
): { khop: (number | null)[]; khongTrongTep: number[] } {
  const khop: (number | null)[] = tep.map(() => null);
  const daDung = new Set<number>();
  const buoc = (khoa: (m: { nhom: string; stt: string | null; moTa: string; partNo: string | null }) => string | null) => {
    const theo = new Map<string, MucCoSan[]>();
    for (const c of coSan) {
      const k = daDung.has(c.id) ? null : khoa(c);
      if (k) theo.set(k, [...(theo.get(k) ?? []), c]);
    }
    tep.forEach((m, i) => {
      const k = khop[i] === null ? khoa(m) : null;
      const c = k ? theo.get(k)?.find((x) => !daDung.has(x.id)) : undefined;
      if (c) {
        khop[i] = c.id;
        daDung.add(c.id);
      }
    });
  };
  buoc((m) => (chuanKhop(m.moTa) ? `${khoaNhom(m.nhom)}|${chuanKhop(m.moTa)}` : null));
  buoc((m) => (chuanKhop(m.partNo).length >= 3 ? `${khoaNhom(m.nhom)}|pn|${chuanKhop(m.partNo)}` : null));
  buoc((m) => (m.stt && chuanKhop(m.moTa) ? `${khoaNhom(m.nhom)}|${m.stt}|${chuanKhop(m.moTa).slice(0, 12)}` : null));
  return { khop, khongTrongTep: coSan.filter((c) => !daDung.has(c.id)).map((c) => c.id) };
}

// ─── Tháng (giờ Việt Nam) ───────────────────────────────────────────────────

/** Tháng "YYYY-MM" hợp lệ, không thì tháng hiện tại (giờ Việt Nam — máy chủ chạy giờ UTC). */
export function thangHopLe(s: string | null | undefined, bayGio = new Date()): string {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s ?? ""));
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${m[1]}-${m[2]}`;
  const n = ngayCuaVN(bayGio);
  return `${n.nam}-${hai(n.thang)}`;
}

/** Tháng `thang` có sau tháng hiện tại (giờ Việt Nam) không — số tháng tương lai không nhận. */
export const thangTuongLai = (thang: string, bayGio = new Date()) => thang > thangHopLe(null, bayGio);

/** "YYYY-MM" lùi / tiến `n` tháng. */
export function congThang(thang: string, n: number): string {
  const [y, m] = thang.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${hai((t % 12) + 1)}`;
}

/** [đầu tháng, đầu tháng sau) theo giờ Việt Nam. */
export function khoangThang(thang: string): { dau: Date; cuoi: Date } {
  const [y, m] = thang.split("-").map(Number);
  return { dau: dauThangVN(y, m), cuoi: dauThangVN(y, m + 1) };
}

/** Ngày ghi trên báo cáo: tháng đang chạy → hôm nay; tháng đã qua → ngày cuối tháng (giờ Việt Nam). dd/mm/yyyy. */
export function ngayBaoCao(thang: string, bayGio = new Date()): string {
  const { dau, cuoi } = khoangThang(thang);
  const n = ngayCuaVN(bayGio < cuoi && bayGio >= dau ? bayGio : new Date(cuoi.getTime() - 1));
  return `${hai(n.ngay)}/${hai(n.thang)}/${n.nam}`;
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

/**
 * Phần cần bổ sung của một mục dưới mức tối thiểu: thiếu bao nhiêu, theo đơn vị của cột
 * Tối thiểu ("2 set", hiện có 1 → thiếu 1 "set"). null khi không thiếu.
 */
export function canBoSung(d: Pick<DongThietYeu, "toiThieu" | "toiThieuSo" | "hienCo">): { so: number; donVi: string } | null {
  if (!laThieu(d)) return null;
  return {
    so: Math.round((d.toiThieuSo - (d.hienCo ?? 0)) * 100) / 100,
    donVi: sach(d.toiThieu ?? "").replace(/^(½|\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s*/, ""),
  };
}

/** Tóm tắt từng nhóm của báo cáo tháng: số mục, dưới tối thiểu, chưa có số hiện có. */
export function tongHopNhom(dong: readonly Pick<DongThietYeu, "nhom" | "toiThieuSo" | "hienCo">[]): { nhom: string; soMuc: number; soThieu: number; soChuaCoSo: number }[] {
  return gomNhom([...dong]).map((g) => ({
    nhom: g.nhom,
    soMuc: g.dong.length,
    soThieu: g.dong.filter(laThieu).length,
    soChuaCoSo: g.dong.filter((d) => d.hienCo === null).length,
  }));
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

/**
 * VỊ TRÍ CÓ THỂ cất phụ tùng thiết yếu trên tàu — gợi ý cho ô "Vị trí / Location" khi sửa (vẫn gõ
 * tự do được), và chọn một lần cho cả nhóm. `ma` là chữ in lên mẫu, viết tắt như tàu vẫn ghi (file
 * MLS-11-04 của M.ODYSSEY ghi "E/R"); tên đầy đủ hai thứ tiếng ở từ điển (thietYeu.viTri_<khoa>).
 * Thứ tự: buồng máy và các chỗ trong buồng máy trước (đa số phụ tùng thiết yếu là của máy), rồi
 * các buồng / kho khác.
 */
export const VI_TRI_CO_THE = [
  { khoa: "ER", ma: "E/R" },
  { khoa: "ER_STORE", ma: "E/R store" },
  { khoa: "ER_WORKSHOP", ma: "E/R workshop" },
  { khoa: "ER_UPPER", ma: "E/R upper flat" },
  { khoa: "ER_LOWER", ma: "E/R lower flat" },
  { khoa: "ECR", ma: "ECR" },
  { khoa: "PURIFIER", ma: "Purifier room" },
  { khoa: "SG", ma: "S/G room" },
  { khoa: "EMG_GEN", ma: "EM'CY gen. room" },
  { khoa: "CO2", ma: "CO2 room" },
  { khoa: "CRANE", ma: "Crane house" },
  { khoa: "DECK_STORE", ma: "Deck store" },
  { khoa: "BOSUN", ma: "Bosun store" },
  { khoa: "FORE", ma: "Fore store" },
  { khoa: "PAINT", ma: "Paint store" },
  { khoa: "BRIDGE", ma: "Bridge" },
  { khoa: "LIFEBOAT", ma: "Lifeboat" },
] as const;

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

// ─── Hiệu chỉnh danh mục ngay trên bảng (chế độ "Hiệu chỉnh danh mục & số lượng") ───
//
// Bảng hiển thị gom dòng theo nhóm (gomNhom: nhóm theo lần xuất hiện đầu, trong nhóm theo thứ
// tự mảng) — nên đổi chỗ / chuyển nhóm chỉ là sắp lại mảng; lưu thì thứ tự mảng thành thuTu.

type DongSapXep = { id: string; nhom: string; stt: string };

/** Số thứ tự của nhóm đang là dãy 1, 2, 3… liền nhau theo thứ tự dòng. */
function sttLienNhau(stt: readonly string[]): boolean {
  return stt.length > 0 && stt.every((s, i) => /^\d+$/.test(s.trim()) && Number(s.trim()) === i + 1);
}

/**
 * Đổi chỗ một dòng với dòng kề trên (-1) / dưới (+1) CÙNG NHÓM. Số thứ tự đứng yên ở vị trí
 * (dòng lên trên nhận số của chỗ mới) — bản in vẫn đọc 1, 2, 3… Đầu / cuối nhóm thì giữ nguyên.
 */
export function doiChoDong<T extends DongSapXep>(ds: readonly T[], id: string, huong: -1 | 1): T[] {
  const i = ds.findIndex((d) => d.id === id);
  if (i < 0) return [...ds];
  let j = i + huong;
  while (j >= 0 && j < ds.length && ds[j].nhom !== ds[i].nhom) j += huong;
  if (j < 0 || j >= ds.length) return [...ds];
  const ra = [...ds];
  ra[i] = { ...ds[j], stt: ds[i].stt };
  ra[j] = { ...ds[i], stt: ds[j].stt };
  return ra;
}

/**
 * Chuyển một dòng sang nhóm khác: đứng cuối nhóm mới, số thứ tự tiếp sau số lớn nhất của nhóm
 * đó; nhóm cũ đang đánh số 1, 2, 3… liền nhau thì đánh lại cho liền (số tự đặt khác thì giữ).
 */
export function chuyenNhomDong<T extends DongSapXep>(ds: readonly T[], id: string, nhomMoi: string): T[] {
  const i = ds.findIndex((d) => d.id === id);
  if (i < 0 || !nhomMoi || ds[i].nhom === nhomMoi) return [...ds];
  const nhomCu = ds[i].nhom;
  const danhLai = sttLienNhau(ds.filter((d) => d.nhom === nhomCu).map((d) => d.stt));
  const conLai = ds.filter((_, k) => k !== i);
  const sttMoi = String(Math.max(0, ...conLai.filter((d) => d.nhom === nhomMoi).map((d) => Number(d.stt.trim()) || 0)) + 1);
  const cuoi = conLai.map((d) => d.nhom).lastIndexOf(nhomMoi);
  const ra = [...conLai];
  ra.splice(cuoi < 0 ? ra.length : cuoi + 1, 0, { ...ds[i], nhom: nhomMoi, stt: sttMoi });
  if (!danhLai) return ra;
  let n = 0;
  return ra.map((d) => (d.nhom === nhomCu ? { ...d, stt: String(++n) } : d));
}

/** Đổi tên một nhóm: mọi dòng mang tên cũ nhận tên mới. */
export function doiTenNhomDong<T extends { nhom: string }>(ds: readonly T[], cu: string, moi: string): T[] {
  return ds.map((d) => (d.nhom === cu ? { ...d, nhom: moi } : d));
}

/**
 * Bảng đang hiệu chỉnh nhận danh sách mới từ máy chủ (vừa thêm / xóa mục): giữ thứ tự và chữ
 * đang sửa của các dòng cũ, bỏ dòng đã xóa, chèn dòng mới vào cuối nhóm của nó.
 */
export function ghepDongMoi<T extends { id: string; nhom: string }>(dangSua: readonly T[], tuMayChu: readonly T[]): T[] {
  const coTrenMay = new Set(tuMayChu.map((d) => d.id));
  const ra = dangSua.filter((d) => coTrenMay.has(d.id));
  const daCo = new Set(ra.map((d) => d.id));
  for (const g of tuMayChu) {
    if (daCo.has(g.id)) continue;
    const cuoi = ra.map((d) => d.nhom).lastIndexOf(g.nhom);
    ra.splice(cuoi < 0 ? ra.length : cuoi + 1, 0, g);
  }
  return ra;
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
