/*
 * NHẬN DẠNG TÊN SƠN ghi trên phiếu giao / phiếu yêu cầu — phần thuần, dùng chung
 * cho server (nhập phiếu, nhận dạng lại danh mục) và client (bảng soát).
 *
 * Phiếu giao của đại lý in mỗi dòng thành MỘT chuỗi, thường chữ hoa không dấu
 * (xuất từ phần mềm kế toán):
 *
 *   "SON JOTAFIX PU TC RAL 5002 A 17.91L"
 *   "CHAT DONG RAN JOTAFIX PU TC, COMP B 2L"
 *   "DUNG MOI JOTUN THINNER NO. 10 20L"
 *
 * Nhập nguyên chuỗi làm tên thì danh mục sơn không có hãng, hệ sơn, màu, dung
 * tích — bảng tồn toàn "Khác" và "—", bản in MLS-11-05 thì mô tả lộn xộn. Ở đây
 * tách chuỗi thành: dòng sản phẩm (kèm thành phần A/B), hãng, hệ sơn, mã màu
 * (RAL ####, STD ###), tên màu, thành phần, dung tích một thùng/lon.
 *
 * Nguyên tắc: chỉ tách cái nhận ra CHẮC CHẮN — tên màu chỉ lấy khi đứng cuối
 * (sau khi đã gỡ thành phần, dung tích), tiền tố "SƠN" chỉ bỏ khi nhận ra hãng.
 * Không nhận ra thì để nguyên, người soát sửa tay.
 */

export type VaiTroSon = "SON" | "DUNG_MOI" | "DONG_RAN";

export type NhanDangSon = {
  /** Tên chuẩn: dòng sản phẩm + thành phần (+ vai trò), không màu, không dung tích. */
  ten: string;
  hang: string | null;
  /** Mã hệ sơn (lib/paintTypes.ts) hoặc null nếu không đoán được. */
  loaiSon: string | null;
  mau: string | null;
  maMau: string | null;
  thanhPhan: "A" | "B" | null;
  /** Dung tích một thùng / lon (lít). */
  dungTich: number | null;
  vaiTro: VaiTroSon | null;
};

/** Bỏ dấu + chữ hoa để so khớp (giữ nguyên độ dài từng chữ cái không bảo đảm — chỉ dùng để test). */
const khongDau = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase();

/** Hãng nhận ra từ tên hãng hoặc tên dòng sản phẩm đặc trưng của hãng. */
const HANG: [RegExp, string][] = [
  [/\bJOTUN\b|\b(JOTAFIX|JOTAMASTIC|JOTACOTE|JOTAPROTECT|HARDTOP|HARTOP|HARTOPX|PENGUARD|SEAFORCE|SEAQUANTUM|TANKGUARD|MARATHON)\b|\bPILOT\s+II\b|\bBARRIER\s+\d/, "Jotun"],
  [/\bHEMPEL'?S?\b|\b(HEMPADUR|HEMPATHANE|HEMPALIN|HEMUCRYL|HEMPAQUICK|HEMPAXANE|HEMPAGUARD|GLOBIC|OLYMPIC)\b/, "Hempel"],
  [/\bINTERNATIONAL\b|\bAKZO\s?NOBEL\b|\b(INTERZONE|INTERGARD|INTERTHANE|INTERSHIELD|INTERSPEED|INTERLAC|INTERPRIME|INTERSWIFT|INTERSMOOTH)\b/, "International"],
  [/\b(CHUGOKU|CMP)\b|\b(SEAFLO|EPICON|BANNOH)\b/, "Chugoku"],
  [/\bKANSAI\b/, "Kansai"],
  [/\bNIPPON\b/, "Nippon Paint"],
  [/\b(SIGMACOVER|SIGMADUR|SIGMAPRIME|SIGMASHIELD|SIGMA)\b/, "Sigma (PPG)"],
  [/\bPPG\b/, "PPG"],
  [/\bKCC\b/, "KCC"],
];

/** Tên màu (một chữ, đứng cuối tên) → tên chuẩn. */
const MAU: [RegExp, string][] = [
  [/^(BLACK|BLK)$/, "BLACK"],
  [/^(WHITE|WHT)$/, "WHITE"],
  [/^(GREY|GRAY|GRE|GRY)$/, "GREY"],
  [/^RED$/, "RED"],
  [/^(GREEN|GRN)$/, "GREEN"],
  [/^(BLUE|BLU)$/, "BLUE"],
  [/^(YELLOW|YLW|YEL)$/, "YELLOW"],
  [/^ORANGE$/, "ORANGE"],
  [/^(BROWN|BRN)$/, "BROWN"],
  [/^(BUFF|CREAM|BEIGE|SILVER)$/, ""],
  [/^(ALU|ALUMINIUM|ALUMINUM)$/, "ALUMINIUM"],
];
const MAU_VIET: [RegExp, string][] = [
  [/^DEN$/, "ĐEN"],
  [/^TRANG$/, "TRẮNG"],
  [/^XAM$/, "XÁM"],
  [/^XANH$/, "XANH"],
  [/^VANG$/, "VÀNG"],
  [/^NAU$/, "NÂU"],
];
const SAC_DO = /^(LIGHT|DARK|LT|DK|PALE)$/;

/** Hệ sơn theo từ khóa (đã bỏ dấu, chữ hoa) — theo thứ tự ưu tiên. */
const HE_SON: [RegExp, string][] = [
  [/\bTHINNER\b|\bSOLVENT\b|\bDUNG MOI\b/, "OTHER"],
  [/ANTI.?FOULING|\bA\/F\b|CHONG HA|SEAFORCE|SEAQUANTUM|INTERSPEED|GLOBIC|OLYMPIC/, "ANTI_FOULING"],
  [/PRIMER|\bLOT\b/, "PRIMER"],
  [/\bPU\s*TC\b|TOP\s?COAT|\bFINISH\b|ENAMEL|HARDTOP|HARTOP|THANE\b|INTERTHANE|HEMPATHANE|POLYURETHANE|\bPHU\b|PILOT\s+II/, "TOPCOAT"],
  [/\bDECK\b|\bBOONG\b/, "DECK"],
  [/\bTANK\b|TANKGUARD|\bKET\b/, "TANK"],
  [/MASTIC|ANTI.?CORROSIVE|CHONG RI|\bEPOXY\b|PENGUARD|HEMPADUR|INTERGARD|INTERZONE/, "ANTI_CORROSIVE"],
];

const KIEU_HOA = (mau: string, chu: string) => (chu === chu.toUpperCase() ? mau : mau.charAt(0) + mau.slice(1).toLowerCase());

export function nhanDangTenSon(moTa: string): NhanDangSon {
  const goc = moTa.normalize("NFC").replace(/\s+/g, " ").trim();
  const ketQua: NhanDangSon = { ten: goc, hang: null, loaiSon: null, mau: null, maMau: null, thanhPhan: null, dungTich: null, vaiTro: null };
  if (!goc) return ketQua;
  const hoa = goc === goc.toUpperCase();
  let s = goc
    // "17. 1L" (phần mềm tách nhầm khoảng trắng sau dấu thập phân) → "17.1L".
    .replace(/(\d)[.,]\s+(\d)/g, "$1.$2")
    // "A18L" — chữ thành phần dính liền dung tích.
    .replace(/(^|[\s,])([AB])(\d+(?:\.\d+)?\s*(?:L|LT|LTR|LTRS|LIT|LITRE|LITER|LÍT)\b)/gi, "$1$2 $3");

  // 1. Dung tích một thùng / lon: cụm số + lít CUỐI cùng.
  const dt = [...s.matchAll(/(?<![\p{L}\d.])(\d+(?:[.,]\d+)?)\s*(?:L|LT|LTR|LTRS|LIT|LITRE|LITRES|LITER|LITERS|LÍT)(?![\p{L}\d])\.?/giu)].at(-1);
  if (dt) {
    const n = Number(dt[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n <= 1000) {
      ketQua.dungTich = n;
      s = (s.slice(0, dt.index) + " " + s.slice((dt.index ?? 0) + dt[0].length)).trim();
    }
  }

  // 2. Vai trò ghi ở đầu dòng (tiếng Việt có / không dấu).
  let boTienToSon = false;
  const dau = khongDau(s);
  const vaiTroDau: [RegExp, VaiTroSon][] = [
    [/^CHAT DONG RAN\s+/, "DONG_RAN"],
    [/^DUNG MOI\s+/, "DUNG_MOI"],
    [/^SON\s+/, "SON"],
  ];
  for (const [re, vt] of vaiTroDau) {
    const m = re.exec(dau);
    if (!m) continue;
    ketQua.vaiTro = vt;
    if (vt === "SON") boTienToSon = true;
    else s = s.slice(m[0].length);
    break;
  }
  const dauSau = khongDau(s);
  if (!ketQua.vaiTro || ketQua.vaiTro === "SON") {
    if (/\b(HARDENER|CURING AGENT)\b/.test(dauSau)) ketQua.vaiTro = "DONG_RAN";
    else if (/\b(THINNER|SOLVENT)\b/.test(dauSau)) ketQua.vaiTro = "DUNG_MOI";
  }

  // 3. Thành phần A / B.
  const cp = /[,\s]*\b(?:COMP(?:ONENT)?|PART)\.?\s*([AB])\b|[,\s]*\bCP\s?([AB])\b/i.exec(s);
  if (cp) {
    ketQua.thanhPhan = (cp[1] ?? cp[2]).toUpperCase() as "A" | "B";
    s = (s.slice(0, cp.index) + " " + s.slice(cp.index + cp[0].length)).trim();
  } else {
    const cuoi = /[,\s]+([AB])$/i.exec(s);
    if (cuoi && cuoi.index > 0) {
      ketQua.thanhPhan = cuoi[1].toUpperCase() as "A" | "B";
      s = s.slice(0, cuoi.index).trim();
    }
  }
  if (!ketQua.thanhPhan && ketQua.vaiTro === "DONG_RAN" && !/\b(HARDENER|CURING AGENT)\b/i.test(s)) ketQua.thanhPhan = "B";

  // 4. Mã màu: RAL ####, STD ###.
  const ral = /\bRAL\s*-?\s*(\d{4})\b/i.exec(s);
  const std = /\bSTD\.?\s*-?\s*(\d{2,4}[A-Z]?)\b/i.exec(s);
  const ma = ral ?? std;
  if (ma) {
    ketQua.maMau = `${ral ? "RAL" : "STD"} ${ma[1].toUpperCase()}`;
    s = (s.slice(0, ma.index) + " " + s.slice(ma.index + ma[0].length)).replace(/\s+/g, " ").trim();
  }

  // 5. Tên màu: chỉ lấy chữ ĐỨNG CUỐI (kèm "LIGHT/DARK" đứng trước nếu có).
  const tu = s.split(" ");
  const cuoiTu = (tu.at(-1) ?? "").replace(/[.,;:]$/, "");
  const cuoiKhongDau = khongDau(cuoiTu);
  const mauEn = MAU.find(([re]) => re.test(cuoiKhongDau));
  // "ĐỎ" chỉ nhận khi viết có dấu — "DO" không dấu quá dễ trùng chữ khác.
  const mauVi = mauEn ? undefined : /^đỏ$/i.test(cuoiTu) ? ([/./, "ĐỎ"] as [RegExp, string]) : MAU_VIET.find(([re]) => re.test(cuoiKhongDau));
  const mauKhop = mauEn ?? mauVi;
  if (mauKhop && tu.length > 1) {
    let tenMau = mauKhop[1] || cuoiKhongDau;
    tu.pop();
    const truoc = khongDau(tu.at(-1) ?? "");
    if (tu.length > 1 && SAC_DO.test(truoc)) {
      const sac = { LT: "LIGHT", DK: "DARK" }[truoc] ?? truoc;
      tenMau = `${sac} ${tenMau}`;
      tu.pop();
    }
    ketQua.mau = KIEU_HOA(tenMau, cuoiTu);
    s = tu.join(" ");
  }

  // 6. Hãng (theo tên hãng / dòng sản phẩm).
  const sKhongDau = khongDau(s);
  const hang = HANG.find(([re]) => re.test(sKhongDau));
  if (hang) ketQua.hang = hang[1];
  if (boTienToSon && ketQua.hang) s = s.replace(/^(SƠN|SON)\s+/i, "");

  // 7. Hệ sơn.
  const heKhongDau = khongDau(`${ketQua.vaiTro === "DUNG_MOI" ? "DUNG MOI " : ""}${s}`);
  ketQua.loaiSon = HE_SON.find(([re]) => re.test(heKhongDau))?.[1] ?? null;

  // 8. Tên chuẩn: dọn dấu câu thừa, "NO. 10" → "NO.10", rồi gắn thành phần và vai trò.
  let ten = s
    .replace(/\b(NO|No|no)\.\s+(\d)/g, "$1.$2")
    .replace(/\s*,\s*/g, ", ")
    .replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!ten) return { ...ketQua, ten: goc };
  if (ketQua.thanhPhan && !/\b(HARDENER|CURING AGENT|COMP\.?\s*[AB])\b/i.test(ten)) ten += hoa ? ` COMP ${ketQua.thanhPhan}` : ` Comp ${ketQua.thanhPhan}`;
  if (ketQua.vaiTro === "DONG_RAN" && !/\b(HARDENER|CURING AGENT)\b/i.test(ten)) ten += hoa ? " (ĐÓNG RẮN)" : " (đóng rắn)";
  if (ketQua.vaiTro === "DUNG_MOI" && !/\b(THINNER|SOLVENT)\b/i.test(ten)) ten += hoa ? " (DUNG MÔI)" : " (dung môi)";
  ketQua.ten = ten.slice(0, 200);
  return ketQua;
}

/** Thông tin sơn đã có ít nhất một phần nhận dạng được (đáng đề xuất cho người dùng). */
export const coNhanDang = (n: NhanDangSon) => Boolean(n.hang || n.loaiSon || n.mau || n.maMau || n.thanhPhan || n.dungTich);

export type ThongTinLoaiSon = {
  name: string;
  maker: string | null;
  paintType: string;
  colorName: string | null;
  colorCode: string | null;
  packSize: number;
};

/**
 * Đề xuất thông tin cho một loại sơn ĐÃ CÓ trong danh mục (thường tên còn chép
 * nguyên chuỗi phiếu giao): tên chuẩn từ nhận dạng; hãng / màu / mã màu / dung
 * tích chỉ điền khi đang trống; hệ sơn chỉ đổi khi đang là "Khác". `coDoi` =
 * có gì khác hiện tại (đáng đưa vào danh sách cho người dùng duyệt).
 */
export function deXuatThongTinSon(p: ThongTinLoaiSon): ThongTinLoaiSon & { coDoi: boolean } {
  const n = nhanDangTenSon(p.name);
  const d: ThongTinLoaiSon = {
    name: n.ten || p.name,
    maker: p.maker || n.hang,
    paintType: p.paintType && p.paintType !== "OTHER" ? p.paintType : n.loaiSon ?? p.paintType ?? "OTHER",
    colorName: p.colorName || n.mau,
    colorCode: p.colorCode || n.maMau,
    packSize: p.packSize > 0 ? p.packSize : n.dungTich ?? 0,
  };
  const coDoi =
    d.name !== p.name ||
    (d.maker ?? null) !== (p.maker ?? null) ||
    d.paintType !== p.paintType ||
    (d.colorName ?? null) !== (p.colorName ?? null) ||
    (d.colorCode ?? null) !== (p.colorCode ?? null) ||
    d.packSize !== p.packSize;
  return { ...d, coDoi };
}
