// Tách các ô của phiếu nhận từ chữ đọc được (BDN scan, phiếu giao hàng, hoặc
// bảng dán tay).
//
// NGUYÊN TẮC: kết quả ở đây là ĐỀ XUẤT để điền sẵn, không bao giờ ghi thẳng vào
// dữ liệu. Đọc nhầm một chữ số của khối lượng dầu là sai cả bảng cân đối nhiên
// liệu và sai cả hồ sơ MARPOL. Người nhập phải đối chiếu với bản gốc rồi mới
// lưu — bản gốc được đính kèm ngay vào phiếu để đối chiếu được về sau.
//
// Không nằm trong lib/pdfOcr.ts vì phần tách chuỗi này thuần túy, dùng được cho
// cả chữ dán tay lẫn chữ từ OCR, và kiểm thử được mà không cần Windows.

export type PhieuDeXuat = {
  docNo: string | null;
  receivedAt: string | null; // yyyy-mm-dd
  port: string | null;
  supplier: string | null;
  barge: string | null;
  productName: string | null;
  quantity: number | null;
  uom: string | null;
  density: number | null;
  viscosity: number | null;
  sulphur: number | null;
  waterContent: number | null;
  flashPoint: number | null;
  bnValue: number | null;
  sampleSealNo: string | null;
  unitPrice: number | null;
  currency: string | null;
  expiryDate: string | null;
  /** Ô nào đọc được — để giao diện tô sáng đúng chỗ cần kiểm lại. */
  daDoc: string[];
};

const RONG: PhieuDeXuat = {
  docNo: null,
  receivedAt: null,
  port: null,
  supplier: null,
  barge: null,
  productName: null,
  quantity: null,
  uom: null,
  density: null,
  viscosity: null,
  sulphur: null,
  waterContent: null,
  flashPoint: null,
  bnValue: null,
  sampleSealNo: null,
  unitPrice: null,
  currency: null,
  expiryDate: null,
  daDoc: [],
};

/**
 * Số trong chứng từ dầu viết nhiều kiểu: "450.250", "450,250", "1.234,5".
 * OCR còn hay đọc nhầm chữ O thành số 0 và ngược lại, nên bỏ hết ký tự không
 * phải số trước khi đổi.
 */
function soTu(raw: string | undefined): number | null {
  if (!raw) return null;
  // Lấy CỤM SỐ ĐẦU TIÊN chứ không bỏ hết ký tự không phải số: "985.2 kg/m3"
  // mà bỏ hết chữ thì số 3 của "m3" dính vào thành 985.23.
  const m = raw.match(/-?\d[\d.,]*/);
  if (!m) return null;
  let t = m[0].replace(/[.,]+$/, "");
  if (!t) return null;
  // Có cả dấu chấm lẫn phẩy: dấu đứng sau là dấu thập phân.
  if (t.includes(",") && t.includes(".")) {
    t = t.lastIndexOf(",") > t.lastIndexOf(".")
      ? t.replace(/\./g, "").replace(",", ".")
      : t.replace(/,/g, "");
  } else if (t.includes(",")) {
    // "450,250" trong chứng từ dầu là 450,250 tấn (dấu thập phân), không phải
    // 450 nghìn — khối lượng một lần cấp bunker không tới mức đó.
    t = t.replace(",", ".");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Ngày viết dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, dd.mm.yy — trả về yyyy-mm-dd. */
function ngayTu(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();

  let m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let nam = m[3];
    if (nam.length === 2) nam = `20${nam}`;
    const ngay = m[1].padStart(2, "0");
    const thang = m[2].padStart(2, "0");
    // Chứng từ hàng hải dùng dd/mm/yyyy; nếu số đầu > 12 thì chắc chắn là ngày,
    // ngược lại vẫn giữ dd/mm vì đó là quy ước của biểu mẫu đang dùng.
    if (Number(thang) > 12) return null;
    return `${nam}-${thang}-${ngay}`;
  }
  return null;
}

/**
 * Tìm dòng khớp nhãn rồi lấy phần GIÁ TRỊ.
 *
 * Ưu tiên phần sau dấu hai chấm CUỐI CÙNG, không phải phần sau nhãn. Chứng từ
 * dầu hay viết "Density at 15 deg C: 985.2 kg/m3" hoặc "Barge Name: MT SEA
 * SUPPLIER 7" — cắt theo nhãn thì còn dính "at 15 deg C" và "Name:", làm số
 * đọc ra thành 15985.2.
 */
function timTheoNhan(dong: string[], nhan: RegExp): string | null {
  for (const d of dong) {
    if (!nhan.test(d)) continue;
    const viTri = d.lastIndexOf(":");
    if (viTri >= 0 && viTri < d.length - 1) {
      const sau = d.slice(viTri + 1).trim();
      if (sau) return sau;
    }
    const sau = d.replace(nhan, "").replace(/^[\s:.\-–—]+/, "").trim();
    if (sau) return sau;
  }
  return null;
}

/**
 * Số của một đại lượng ĐO — bỏ nhiệt độ quy chiếu trước khi lấy số.
 *
 * "Density at 15 deg C 985.2" mà không có dấu hai chấm thì cắt theo nhãn vẫn
 * còn số 15 dính vào, ra 15985.2. Nhiệt độ quy chiếu là phần của TÊN đại lượng
 * chứ không phải giá trị.
 */
function soDoTu(raw: string | undefined): number | null {
  if (!raw) return null;
  const sach = raw
    .replace(/\b(at|@)\s*\d+(\.\d+)?\s*(deg\s*)?°?\s*[cf]\b/gi, " ")
    .replace(/\b\d+\s*(deg\s*)?°\s*[cf]\b/gi, " ");
  return soTu(sach);
}

const NHAN = {
  docNo: /\b(bdn|b\.?d\.?n\.?)\s*(no|number|nr)?\b|delivery\s*note\s*(no|number)|số\s*bdn|so\s*bdn|invoice\s*no|delivery\s*receipt\s*no|số\s*phiếu|so\s*phieu/i,
  date: /date\s*of\s*delivery|delivery\s*date|date\s*deliver|ngày\s*giao|ngay\s*giao|ngày\s*nhận|ngay\s*nhan|^\s*date\b/i,
  port: /port\s*of\s*delivery|delivery\s*port|^\s*port\b|cảng|cang\b/i,
  supplier: /supplier|seller|physical\s*supplier|nhà\s*cung\s*cấp|nha\s*cung\s*cap/i,
  barge: /barge|bunker\s*tanker|delivering\s*vessel|sà\s*lan|sa\s*lan/i,
  product: /product\s*(name|grade|type)|grade\s*of\s*(fuel|oil)|tên\s*hàng|ten\s*hang|mặt\s*hàng|mat\s*hang/i,
  quantity: /quantity\s*(delivered|supplied)?|qty\s*delivered|delivered\s*quantity|metric\s*tons?\s*delivered|số\s*lượng|so\s*luong|khối\s*lượng|khoi\s*luong/i,
  density: /density|khối\s*lượng\s*riêng|khoi\s*luong\s*rieng|tỷ\s*trọng|ty\s*trong/i,
  viscosity: /viscosity|độ\s*nhớt|do\s*nhot/i,
  sulphur: /sulphur|sulfur|lưu\s*huỳnh|luu\s*huynh/i,
  water: /water\s*(content)?|hàm\s*lượng\s*nước|ham\s*luong\s*nuoc/i,
  flash: /flash\s*point|điểm\s*chớp\s*cháy|diem\s*chop\s*chay/i,
  bn: /\btbn\b|\bbn\b\s*value|base\s*number|trị\s*số\s*kiềm/i,
  seal: /seal\s*(no|number)|sample\s*seal|số\s*niêm|so\s*niem|niêm\s*phong/i,
  price: /unit\s*price|price\s*per|đơn\s*giá|don\s*gia/i,
  expiry: /expiry|expiration|best\s*before|hạn\s*dùng|han\s*dung|hạn\s*sử\s*dụng/i,
};

/** Đơn vị hay gặp trong chứng từ dầu / hóa chất. */
function donViTu(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/\b(MT|M3|M\^3|KG|LTR|LITRE|LITER|L|DRUM|CAN|BOX|TON|TONNES?)\b/i);
  if (!m) return null;
  const v = m[1].toUpperCase();
  if (v === "LTR" || v === "LITRE" || v === "LITER") return "L";
  if (v === "TON" || v === "TONNE" || v === "TONNES") return "MT";
  if (v === "M^3") return "M3";
  return v;
}

/**
 * Đọc một khối chữ (từ OCR bản scan hoặc dán tay) thành các ô đề xuất.
 *
 * Chỉ nhận những gì CHẮC CHẮN đọc được; ô nào không thấy nhãn thì để trống chứ
 * không đoán. Đoán bừa còn tệ hơn để trống: ô trống thì người nhập biết phải
 * gõ, ô sai thì họ tưởng máy đã đọc đúng.
 */
export function docPhieuTuChu(chu: string): PhieuDeXuat {
  const dong = chu
    .split(/\r?\n/)
    .map((d) => d.replace(/\s+/g, " ").trim())
    .filter((d) => d && !/^-{2,}.*-{2,}$/.test(d));

  const kq: PhieuDeXuat = { ...RONG, daDoc: [] };
  const ghi = <K extends keyof PhieuDeXuat>(k: K, v: PhieuDeXuat[K]) => {
    if (v === null || v === "" || (typeof v === "number" && !Number.isFinite(v))) {
      return;
    }
    kq[k] = v;
    kq.daDoc.push(k as string);
  };

  const soLuongRaw = timTheoNhan(dong, NHAN.quantity);

  ghi("docNo", timTheoNhan(dong, NHAN.docNo));
  ghi("receivedAt", ngayTu(timTheoNhan(dong, NHAN.date) ?? undefined));
  ghi("port", timTheoNhan(dong, NHAN.port));
  ghi("supplier", timTheoNhan(dong, NHAN.supplier));
  ghi("barge", timTheoNhan(dong, NHAN.barge));
  ghi("productName", timTheoNhan(dong, NHAN.product));
  ghi("quantity", soTu(soLuongRaw ?? undefined));
  ghi("uom", donViTu(soLuongRaw));
  ghi("density", soDoTu(timTheoNhan(dong, NHAN.density) ?? undefined));
  ghi("viscosity", soDoTu(timTheoNhan(dong, NHAN.viscosity) ?? undefined));
  ghi("sulphur", soTu(timTheoNhan(dong, NHAN.sulphur) ?? undefined));
  ghi("waterContent", soTu(timTheoNhan(dong, NHAN.water) ?? undefined));
  ghi("flashPoint", soDoTu(timTheoNhan(dong, NHAN.flash) ?? undefined));
  ghi("bnValue", soTu(timTheoNhan(dong, NHAN.bn) ?? undefined));
  ghi("sampleSealNo", timTheoNhan(dong, NHAN.seal));
  ghi("expiryDate", ngayTu(timTheoNhan(dong, NHAN.expiry) ?? undefined));

  const giaRaw = timTheoNhan(dong, NHAN.price);
  ghi("unitPrice", soTu(giaRaw ?? undefined));
  const tien = giaRaw?.match(/\b(USD|EUR|SGD|VND|JPY|GBP)\b/i);
  ghi("currency", tien ? tien[1].toUpperCase() : null);

  // Số BDN hay dính thêm chữ phía sau ("SG-2026-004471 Page 1 of 2").
  if (kq.docNo) {
    kq.docNo = kq.docNo.split(/\s{2,}|\s(?=page\b)/i)[0].trim().slice(0, 60);
  }
  // Cảng / nhà cung cấp cũng vậy, cắt bớt đuôi thừa.
  for (const k of ["port", "supplier", "barge", "productName"] as const) {
    if (kq[k]) kq[k] = kq[k]!.slice(0, 120).trim();
  }

  return kq;
}
