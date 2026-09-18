/**
 * Tách các DÒNG HÀNG từ chữ đọc được của một phiếu giao hàng (delivery note /
 * packing list) của nhà cung cấp — thuần chuỗi, không đụng server, kiểm thử ở
 * scripts/kiem-tra-doc-phieu-giao.ts.
 *
 * Đầu vào là chữ do lib/pdfChu.ts (lớp chữ PDF) hoặc lib/pdfOcr.ts (OCR bản
 * scan) trả về: mỗi dòng của trang là một dòng chữ, các cột của bảng cách nhau
 * bằng " | " (hoặc tab / nhiều khoảng trắng nếu là OCR).
 *
 * Kết quả là ĐỀ XUẤT ĐIỀN SẴN, không phải sự thật: người duyệt đối chiếu với
 * bản scan rồi mới bấm duyệt. Vì vậy bộ tách chọn phía "đọc được nhiều dòng"
 * hơn là "đọc chắc từng dòng" — thừa một dòng rác thì bỏ tick, thiếu một dòng
 * hàng thì người duyệt phải gõ tay cả dòng.
 *
 * Mỗi dòng hàng cần: tên, số lượng, đơn vị; có thể thêm Part No. / IMPA / thiết
 * bị. Cách nhận:
 *   - SỐ LƯỢNG + ĐƠN VỊ: ưu tiên hai ô bảng kề nhau "2 | SET"; không có thì cụm
 *     "số đơn-vị" (2 PCS, 5.5 KG, 10 cái) — lấy cụm CUỐI dòng vì số lượng đứng
 *     sau mô tả, còn "3.2mm" trong tên hàng đứng trước.
 *   - PART NO.: sau nhãn P/N, Part No, Mã; hoặc một mã dài từ 4 ký tự có chữ số
 *     kèm chữ cái hoặc gạch (21001-1234, DLF-155, EN3200A) — trừ kích cỡ kiểu
 *     "3.2mm", "230V" và ngày tháng.
 *   - IMPA: đúng 6 chữ số đứng riêng.
 *   - TÊN: ô có nhiều chữ nhất còn lại sau khi gỡ số thứ tự đầu dòng, số lượng,
 *     đơn vị, nhãn Qty, Part No., IMPA.
 *   - THIẾT BỊ: dòng tiêu đề không có số lượng mà nêu tên máy (Main Engine,
 *     A/E No.2, Máy đèn...) áp cho các dòng hàng bên dưới cho tới tiêu đề kế.
 */

export type DongPhieuGiao = {
  chuGoc: string;
  ten: string;
  partNo: string | null;
  impa: string | null;
  soLuong: number;
  donVi: string;
  loai: "STORE" | "SPARE";
  thietBi: string | null;
};

export type KetQuaDocPhieuGiao = {
  dong: DongPhieuGiao[];
  nhaCungCap: string | null;
  soPhieu: string | null;
  ngayGiao: string | null;
  /** Dòng có chữ nhưng không nhận ra là dòng hàng (tiêu đề, tổng, chữ ký...). */
  boQua: number;
};

// Đơn vị: tiếng Anh + tiếng Việt có dấu và KHÔNG dấu (OCR thường rụng dấu).
const DON_VI =
  "pcs?|pieces?|pce|sets?|ea|each|nos?|units?|kgs?|kilo|g|grams?|l|ltrs?|lit|liters?|litres?|ml|m|mtrs?|meters?|metres?|mm|cm|box|boxes|bx|packs?|pkt|pkg|rolls?|rl|bags?|cans?|drums?|pairs?|prs?|bottles?|btl|tubes?|cartons?|ctn|kits?|lengths?|sheets?|cái|cai|chiếc|chiec|bộ|bo|hộp|hop|thùng|thung|cuộn|cuon|túi|tui|lon|chai|đôi|doi|cặp|cap|mét|met|lít|tấm|tam|gói|goi|kiện|kien|ống|ong";
// Dạng ngược "PCS: 3" chỉ nhận đơn vị rõ nghĩa (bỏ no/m/g/l/bo/cap... dễ trùng chữ thường).
const DON_VI_NGUOC =
  "pcs?|pieces?|sets?|each|units?|kgs?|ltrs?|liters?|litres?|mtrs?|meters?|metres?|box|boxes|packs?|rolls?|bags?|cans?|drums?|pairs?|bottles?|tubes?|cartons?|kits?|sheets?|cái|chiếc|bộ|hộp|thùng|cuộn|túi";
const SO = "\\d{1,6}(?:[.,]\\d{1,3})?";
const RE_SL_DV_COT = new RegExp(`(?<![\\w.,])(${SO})\\s*\\|\\s*(${DON_VI})(?![\\w])`, "i");
const RE_SL_DV = new RegExp(`(?<![\\w.,/-])(${SO})\\s*(${DON_VI})(?![\\w])`, "gi");
const RE_DV_SL = new RegExp(`(?<![\\w])(${DON_VI_NGUOC})\\s*[:：]\\s*(${SO})(?![\\w.,])`, "i");
const RE_NHAN_SL = /\b(?:q'?ty|quantity|số\s*lượng|so\s*luong)\s*[:：]?|\b(?:unit|đvt|dvt|s\.?l\.?)\s*[:：]/gi;
const RE_PN_NHAN =
  /(?:p\/?n|part\s*no\.?|part\s*number|part\s*#|mã\s*(?:phụ\s*tùng|hàng|số)?|ma\s*(?:phu\s*tung|hang|so)|code|item\s*no\.?|ref\.?)\s*[:：#]?\s*([A-Z0-9][A-Z0-9\-\/\.]{2,})/i;
const RE_TOKEN = /\b[A-Z0-9][A-Z0-9\-\/\.]{3,}\b/gi;
const RE_KICH_CO = new RegExp(`^${SO}(?:${DON_VI}|[A-Z]{1,2})$`, "i");
const RE_NGAY = /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/;
const RE_IMPA = /(?:impa\s*[:：#]?\s*)?(?<![\d\-\/.])(\d{6})(?![\d\-\/.])/i;
const RE_STT_DAU = /^\s*(?:\d{1,3}|[a-z])[.)\-:]?\s+(?=\S)/i;
const RE_THIET_BI =
  /\b(main\s*engine|m\/e\b|aux(?:iliary)?\s*engine|a\/e\b(?:\s*no\.?\s*\d)?|d\/g\b(?:\s*no\.?\s*\d)?|generator|gen(?:erator)?\s*engine|purifier|separator|compressor|boiler|pump|winch|windlass|crane|steering\s*gear|máy\s*chính|may\s*chinh|máy\s*đèn|may\s*den|máy\s*phát|may\s*phat|máy\s*lọc|máy\s*nén|nồi\s*hơi|noi\s*hoi|bơm|tời|cẩu|máy\s*lái)/i;
const RE_BO_QUA =
  /^(?:total|sub\s*total|grand\s*total|tổng|tong|thành\s*tiền|thanh\s*tien|page\s*\d|trang\s*\d|received\s*by|người\s*nhận|nguoi\s*nhan|delivered\s*by|người\s*giao|nguoi\s*giao|checked\s*by|người\s*kiểm|nguoi\s*kiem|signature|chữ\s*ký|chu\s*ky|ký\s*tên|ky\s*ten|remarks?|ghi\s*chú|ghi\s*chu|note[s:]|thank|cảm\s*ơn|cam\s*on|tel[:.]|fax|e-?mail|www\.|http)/i;
const RE_DONG_TIEU_DE_BANG =
  /(?:(?:^|\|)\s*(?:no\.?|stt|item|s\.?n\.?)\s*(?:\||$))|(?:description|mô\s*tả|mo\s*ta|tên\s*hàng|ten\s*hang|diễn\s*giải|dien\s*giai)[^|]*\|.*(?:q(?:ua)?n?'?ty|s\.?l\.?|số\s*lượng|so\s*luong)/i;
const RE_SPARE_TU =
  /\b(ring|bearing|valve|gasket|seal|o-?ring|filter\s*element|piston|nozzle|injector|liner|sleeve|spring|shaft|gear|impeller|bush|plate|cover|kit|element|cartridge|belt|hose\s*assy|sensor|switch|relay|contactor|fuse|lamp|bulb|thermostat|bạc|bac|van|gioăng|gioang|phớt|phot|xéc\s*măng|xec\s*mang|vòi\s*phun|voi\s*phun|ống\s*lót|lò\s*xo|lo\s*xo|trục|truc|bánh\s*răng|banh\s*rang|cánh\s*bơm|cảm\s*biến|cam\s*bien|rơ\s*le|ro\s*le|cầu\s*chì|cau\s*chi)\b/i;

function chuanDonVi(dv: string): string {
  const s = dv.toLowerCase();
  const bang: Array<[RegExp, string]> = [
    [/^(pcs?|pieces?|pce|ea|each|nos?|units?|cái|cai|chiếc|chiec)$/, "PCS"],
    [/^(sets?|bộ|bo|kits?)$/, "SET"],
    [/^(kgs?|kilo)$/, "KG"],
    [/^(g|grams?)$/, "G"],
    [/^(l|ltrs?|lit|liters?|litres?|lít)$/, "LTR"],
    [/^ml$/, "ML"],
    [/^(m|mtrs?|meters?|metres?|mét|met|lengths?)$/, "M"],
    [/^(mm|cm)$/, s.toUpperCase()],
    [/^(box|boxes|bx|hộp|hop)$/, "BOX"],
    [/^(packs?|pkt|pkg|gói|goi)$/, "PACK"],
    [/^(rolls?|rl|cuộn|cuon)$/, "ROLL"],
    [/^(bags?|túi|tui)$/, "BAG"],
    [/^(cans?|lon)$/, "CAN"],
    [/^(drums?|thùng|thung)$/, "DRUM"],
    [/^(pairs?|prs?|đôi|doi|cặp|cap)$/, "PAIR"],
    [/^(bottles?|btl|chai)$/, "BTL"],
    [/^(tubes?|ống|ong)$/, "TUBE"],
    [/^(cartons?|ctn|kiện|kien)$/, "CTN"],
    [/^(sheets?|tấm|tam)$/, "SHT"],
  ];
  for (const [re, ra] of bang) if (re.test(s)) return ra;
  return s.toUpperCase();
}

function soTu(raw: string): number {
  const s = raw.trim();
  // "1,5" kiểu Việt → 1.5; "1,250" kiểu quốc tế → 1250; còn lại theo dấu chấm.
  if (/^\d{1,3},\d{3}$/.test(s)) return Number(s.replace(",", ""));
  return Number(s.replace(",", "."));
}

function docTieuDe(dong: string[]): Pick<KetQuaDocPhieuGiao, "nhaCungCap" | "soPhieu" | "ngayGiao"> {
  let nhaCungCap: string | null = null;
  let soPhieu: string | null = null;
  let ngayGiao: string | null = null;
  for (const d of dong.slice(0, 40)) {
    if (!nhaCungCap) {
      const m = d.match(
        /(?:supplier|seller|vendor|from|nhà\s*cung\s*cấp|nha\s*cung\s*cap|ncc|đơn\s*vị\s*giao|don\s*vi\s*giao|bên\s*giao|ben\s*giao)\s*[:：]\s*(.{3,80})/i
      );
      if (m) nhaCungCap = m[1].split("|")[0].trim();
    }
    if (!soPhieu) {
      const m = d.match(
        // Số phiếu phải có ít nhất một chữ số — không thì "PHIEU GIAO HANG So phieu"
        // bị bắt nhầm chữ "phieu" làm số phiếu.
        /(?:delivery\s*(?:note|order)|packing\s*list|d\/?n|invoice|phiếu\s*giao(?:\s*hàng)?|phieu\s*giao(?:\s*hang)?|số\s*phiếu|so\s*phieu|ref(?:erence)?)\s*(?:no\.?|number|số|so|#)?\s*[:：]?\s*((?=[A-Z0-9\/\-\.]*\d)[A-Z0-9][A-Z0-9\/\-\.]{2,})/i
      );
      if (m) soPhieu = m[1];
    }
    if (!ngayGiao) {
      const m = d.match(/(?:date|ngày(?:\s*giao)?|ngay(?:\s*giao)?)\s*[:：]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i);
      if (m) ngayGiao = m[1];
    }
  }
  return { nhaCungCap, soPhieu, ngayGiao };
}

/** Tìm số lượng + đơn vị trong dòng; trả về phần còn lại đã gỡ cụm đó. */
function timSoLuong(goc: string): { so: number; dv: string; conLai: string } | null {
  const cot = goc.match(RE_SL_DV_COT);
  if (cot) return { so: soTu(cot[1]), dv: chuanDonVi(cot[2]), conLai: goc.replace(cot[0], " | ") };
  const tatCa = [...goc.matchAll(RE_SL_DV)];
  const cuoi = tatCa[tatCa.length - 1];
  if (cuoi) {
    const truoc = goc.slice(0, cuoi.index);
    const sau = goc.slice((cuoi.index ?? 0) + cuoi[0].length);
    return { so: soTu(cuoi[1]), dv: chuanDonVi(cuoi[2]), conLai: `${truoc} ${sau}` };
  }
  const nguoc = goc.match(RE_DV_SL);
  if (nguoc) return { so: soTu(nguoc[2]), dv: chuanDonVi(nguoc[1]), conLai: goc.replace(nguoc[0], " ") };
  return null;
}

function laMaPhuTung(tk: string): boolean {
  if (tk.length < 4 || !/\d/.test(tk)) return false;
  if (!/[A-Z]/i.test(tk) && !/[\-\/]/.test(tk)) return false; // toàn số không gạch = số lượng/IMPA
  if (RE_KICH_CO.test(tk) || RE_NGAY.test(tk)) return false;
  if (new RegExp(`^(${DON_VI})$`, "i").test(tk)) return false;
  return true;
}

export function docPhieuGiaoTuChu(chu: string): KetQuaDocPhieuGiao {
  const dongThuong = chu
    .split(/\r?\n/)
    .map((d) =>
      d
        .replace(/--- trang \d+ ---/g, "")
        .replace(/\t/g, " | ")
        .replace(/ {3,}/g, " | ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
  const tieuDe = docTieuDe(dongThuong);
  const ra: DongPhieuGiao[] = [];
  let boQua = 0;
  let thietBiHienTai: string | null = null;

  for (const goc of dongThuong) {
    if (RE_BO_QUA.test(goc) || RE_DONG_TIEU_DE_BANG.test(goc)) {
      boQua++;
      continue;
    }
    const sl = timSoLuong(goc);
    if (!sl || !Number.isFinite(sl.so)) {
      // Không có số lượng: có thể là tiêu đề thiết bị cho các dòng bên dưới.
      const tb = goc.match(RE_THIET_BI);
      if (tb && goc.length <= 60) thietBiHienTai = goc.replace(/[|:]+/g, " ").replace(/\s+/g, " ").trim();
      boQua++;
      continue;
    }
    let conLai = sl.conLai.replace(RE_NHAN_SL, " ");

    let partNo: string | null = null;
    const pn1 = conLai.match(RE_PN_NHAN);
    if (pn1) {
      partNo = pn1[1];
      conLai = conLai.replace(pn1[0], " ");
    }
    let impa: string | null = null;
    const im = conLai.match(RE_IMPA);
    if (im) {
      impa = im[1];
      conLai = conLai.replace(im[0], " ");
    }
    if (!partNo) {
      const ungVien = [...conLai.matchAll(RE_TOKEN)].map((x) => x[0]).filter(laMaPhuTung);
      // Ưu tiên mã có gạch, rồi mã dài.
      ungVien.sort((a, b) => Number(/[\-\/]/.test(b)) - Number(/[\-\/]/.test(a)) || b.length - a.length);
      if (ungVien[0]) {
        partNo = ungVien[0];
        conLai = conLai.replace(partNo, " ");
      }
    }

    // Tên: gỡ số thứ tự đầu dòng, chọn ô có nhiều chữ nhất.
    const oChu = conLai
      .split("|")
      .map((o) => o.replace(/\s+/g, " ").trim().replace(RE_STT_DAU, "").trim())
      .filter((o) => /[A-Za-zÀ-ỹ]{2,}/.test(o));
    oChu.sort((a, b) => b.length - a.length);
    const ten = (oChu[0] ?? "").replace(/^[\-–—:.,\s]+|[\-–—:.,\s]+$/g, "").trim();
    if (ten.length < 2) {
      boQua++;
      continue;
    }

    const loai: "STORE" | "SPARE" =
      partNo || RE_SPARE_TU.test(ten) || thietBiHienTai ? "SPARE" : impa ? "STORE" : "SPARE";
    ra.push({
      chuGoc: goc,
      ten,
      partNo,
      impa,
      soLuong: sl.so,
      donVi: sl.dv,
      loai,
      thietBi: thietBiHienTai,
    });
  }

  return { dong: ra, boQua, ...tieuDe };
}
