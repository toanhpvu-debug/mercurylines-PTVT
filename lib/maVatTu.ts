/**
 * Hệ thống mã vật tư đội tàu container.
 *
 * ┌─ KHUÔN ĐANG DÙNG cho toàn bộ danh mục ────────────────────────────────────┐
 * │                                                                          │
 * │   Vật tư     D-IMPA-0075     Boong · vật tư · số thứ tự 75               │
 * │   Phụ tùng   E-SPR-0034      Máy   · phụ tùng · số thứ tự 34             │
 * │              └┬┘ └─┬┘ └─┬─┘                                              │
 * │               │    │    └── số thứ tự 4 chữ số TRONG KHUÔN ĐÓ            │
 * │               │    └─────── LOẠI HÀNG: IMPA vật tư · SPR phụ tùng        │
 * │               └──────────── D Boong · E Máy · L Điện · C Phục vụ         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Mã trả lời ngay hai câu hỏi đầu tiên khi cầm một thùng hàng trong kho: **của
 * bộ phận nào**, và **vật tư tiêu hao hay phụ tùng máy** — hai loại mua theo
 * hai đường và kiểm kê theo hai chu kỳ khác nhau.
 *
 * Bốn số cuối là SỐ THỨ TỰ trong khuôn đó, KHÔNG phải mã IMPA; mã IMPA thật
 * nằm ở cột `impa` riêng. Mỗi khuôn một dãy số riêng: đánh chung một dãy thì
 * thêm/xóa bên này làm nhảy số bên kia.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Bên dưới còn một khuôn DÀI hơn, nói thêm AI GIỮ và THUỘC THIẾT BỊ NÀO. Khuôn
 * này chưa được dùng làm mã thật — nó là bộ từ vựng phân loại mà
 * `gan-ma-vat-tu.cmd` dùng để điền ba cột `department` · `equipGroup` ·
 * `responsibleRank`. `phanTichMa` vẫn đọc được để những mã đã lỡ sinh ra
 * theo khuôn đó không thành mã rác.
 *
 *   Vật tư có mã IMPA      D-BSN-IMP-611333
 *   Vật tư không có IMPA   C-CCK-STO-0001
 *   Phụ tùng thay thế      L-ETO-SPA-SWB-0001
 *   └┬┘ └┬┘ └┬┘ └┬┘ └─┬──┘
 *    │   │   │   │    └── số thứ tự 4 chữ số (hoặc 6 số IMPA ở dạng IMP)
 *    │   │   │   └─────── nhóm thiết bị — CHỈ phụ tùng mới có đoạn này
 *    │   │   └─────────── LOẠI HÀNG: IMP · STO · SPA
 *    │   └─────────────── chức danh giữ và chịu trách nhiệm
 *    └─────────────────── D = Boong · E = Máy · L = Điện · C = Phục vụ
 *
 * Đoạn thứ ba luôn nói LOẠI HÀNG, nên nhìn mã là biết ngay đang cầm vật tư tiêu
 * hao hay phụ tùng máy — hai thứ mua theo hai đường khác nhau, kiểm kê theo hai
 * chu kỳ khác nhau, và người duyệt cũng nhìn chúng bằng con mắt khác nhau.
 *
 * Vì sao chức danh nằm TRONG mã chứ không chỉ là một cột trong database: mã
 * được viết tay lên thùng hàng, lên phiếu xuất kho, đọc qua bộ đàm khi giao
 * hàng ở cảng. Ở những chỗ đó không có cột nào để tra cả.
 *
 * File này là hàm THUẦN — không đụng database, không "server-only" — nên dùng
 * được cả ở trình duyệt lẫn trong script kiểm thử.
 */

export type BoPhan = "D" | "E" | "L" | "C";

/**
 * Bốn bộ phận giữ vật tư trên tàu.
 *
 * `yeuCau` nối sang bộ phận của YÊU CẦU VẬT TƯ (lib/roles.ts) để một dòng dự
 * trù đi đúng đường phê duyệt: máy trưởng duyệt Máy/Điện, thuyền trưởng duyệt
 * Boong/Chung. Không có ánh xạ này thì người lập phải tự chọn bộ phận, mà chọn
 * nhầm là yêu cầu nằm chờ sai bàn.
 */
export const BO_PHAN: Record<
  BoPhan,
  { ten: string; tenEn: string; yeuCau: string }
> = {
  D: { ten: "Boong", tenEn: "Deck", yeuCau: "DECK" },
  E: { ten: "Máy", tenEn: "Engine", yeuCau: "ENGINE" },
  L: { ten: "Điện", tenEn: "Electrical", yeuCau: "ELECTRICAL" },
  C: { ten: "Phục vụ", tenEn: "Catering", yeuCau: "GENERAL" },
};

/** Bộ phận của yêu cầu vật tư tương ứng — dùng khi lập dự trù từ danh mục. */
export function boPhanYeuCau(boPhan: BoPhan): string {
  return BO_PHAN[boPhan].yeuCau;
}

/**
 * Chức danh giữ và chịu trách nhiệm về món hàng.
 *
 * `boPhan` là bộ phận CHÍNH của chức danh; `kiemNhiem` là những bộ phận họ có
 * thể giữ thêm. Cần cả hai vì biên chế thật thay đổi theo tàu: tàu có sĩ quan
 * điện thì kho điện thuộc ETO, tàu không có thì máy hai hoặc máy ba giữ. Ép
 * mỗi chức danh vào đúng một bộ phận thì một nửa đội tàu không khai nổi mã.
 *
 * `role` nối sang vai trò đăng nhập (lib/roles.ts) để lọc "vật tư tôi phải kiểm
 * kê" cho đúng người. Chức danh chưa có vai trò riêng trong hệ thống tài khoản
 * (thủy thủ trưởng, thợ máy, bếp trưởng...) để null — thà để trống còn hơn gán
 * bừa sang chức danh khác rồi lọc ra sai người.
 */
export const CHUC_DANH: Record<
  string,
  {
    boPhan: BoPhan;
    kiemNhiem?: BoPhan[];
    ten: string;
    tenEn: string;
    role: string | null;
  }
> = {
  // ─── Boong ───
  MST: {
    boPhan: "D",
    kiemNhiem: ["C"],
    ten: "Thuyền trưởng",
    tenEn: "Master",
    role: "MASTER",
  },
  CO: {
    boPhan: "D",
    kiemNhiem: ["C"],
    ten: "Đại phó",
    tenEn: "Chief Officer",
    role: "CHIEF_OFFICER",
  },
  "2O": { boPhan: "D", ten: "Phó hai", tenEn: "2nd Officer", role: "SECOND_OFFICER" },
  "3O": { boPhan: "D", ten: "Phó ba", tenEn: "3rd Officer", role: "THIRD_OFFICER" },
  BSN: { boPhan: "D", ten: "Thủy thủ trưởng", tenEn: "Bosun", role: null },
  // ─── Máy ───
  CE: {
    boPhan: "E",
    kiemNhiem: ["L"],
    ten: "Máy trưởng",
    tenEn: "Chief Engineer",
    role: "CHIEF_ENGINEER",
  },
  "2E": {
    boPhan: "E",
    kiemNhiem: ["L"],
    ten: "Máy hai",
    tenEn: "2nd Engineer",
    role: "SECOND_ENGINEER",
  },
  "3E": {
    boPhan: "E",
    kiemNhiem: ["L"],
    ten: "Máy ba",
    tenEn: "3rd Engineer",
    role: "THIRD_ENGINEER",
  },
  "4E": { boPhan: "E", ten: "Máy tư", tenEn: "4th Engineer", role: "FOURTH_ENGINEER" },
  OIL: { boPhan: "E", ten: "Thợ máy", tenEn: "Oiler", role: null },
  FIT: { boPhan: "E", ten: "Thợ nguội", tenEn: "Fitter", role: null },
  // ─── Điện ───
  ETO: {
    boPhan: "L",
    kiemNhiem: ["E"],
    ten: "Sĩ quan điện",
    tenEn: "Electro-Technical Officer",
    role: null,
  },
  ELC: { boPhan: "L", ten: "Thợ điện", tenEn: "Electrician", role: null },
  // ─── Phục vụ ───
  CCK: { boPhan: "C", ten: "Bếp trưởng", tenEn: "Chief Cook", role: null },
  STW: { boPhan: "C", ten: "Phục vụ viên", tenEn: "Steward / Messman", role: null },
};

/**
 * Vai trò đăng nhập → chức danh giữ vật tư.
 *
 * Chỉ suy được với những chức danh CÓ vai trò riêng trong hệ thống tài khoản.
 * Thủy thủ trưởng, thợ máy, sĩ quan điện, bếp trưởng đều đăng nhập bằng vai trò
 * CREW nên từ vai trò không suy ra được người nào giữ kho nào — những tài khoản
 * đó phải khai thẳng ở cột `User.rankCode`.
 */
export function chucDanhTuVaiTro(role: string): string | null {
  const hit = Object.entries(CHUC_DANH).find(([, cd]) => cd.role === role);
  return hit ? hit[0] : null;
}

/**
 * Chức danh giữ vật tư của một tài khoản: lấy cột khai tay trước, không có thì
 * suy từ vai trò đăng nhập.
 *
 * Khai tay được ưu tiên vì nó cụ thể hơn: một tài khoản CREW có thể là thủy thủ
 * trưởng hoặc bếp trưởng, chỉ người lập tài khoản mới biết.
 */
export function chucDanhCuaNguoiDung(user: {
  role: string;
  rankCode?: string | null;
}): string | null {
  const khaiTay = (user.rankCode ?? "").trim();
  if (khaiTay && CHUC_DANH[khaiTay]) return khaiTay;
  return chucDanhTuVaiTro(user.role);
}

/** Chức danh này có được giữ hàng của bộ phận đó không. */
export function chucDanhThuocBoPhan(chucDanh: string, boPhan: BoPhan): boolean {
  const cd = CHUC_DANH[chucDanh];
  if (!cd) return false;
  return cd.boPhan === boPhan || (cd.kiemNhiem ?? []).includes(boPhan);
}

/**
 * Nhóm thiết bị — tầng phân loại giữa bộ phận và từng món hàng.
 *
 * Ba nguyên tắc khi đặt nhóm, để danh sách này không phình ra vô tội vạ:
 *
 *  1. **Tách khi phụ tùng KHÔNG dùng chung được.** Máy chính tách theo hãng
 *     (BME / UEC) vì hai họ máy hai kỳ này gần như không có chi tiết nào lắp
 *     lẫn nhau, mà Mercury Lines chạy cả hai.
 *  2. **Tách khi NGƯỜI GIỮ khác nhau.** Chằng buộc container (đại phó, thủy
 *     thủ trưởng) tách khỏi chằng buộc bến & neo dù cùng là dây và ma ní.
 *  3. **Gộp khi chỉ khác tên gọi.** Không đặt nhóm riêng cho từng cái bơm; tất
 *     cả bơm và van đi chung PMP.
 */
export const NHOM_THIET_BI: Record<
  string,
  { boPhan: BoPhan; ten: string; tenEn: string; chucDanh: string[] }
> = {
  // ─── BOONG ────────────────────────────────────────────────────────────────
  NAV: {
    boPhan: "D",
    ten: "Hành hải & buồng lái",
    tenEn: "Navigation & Bridge Equipment",
    chucDanh: ["2O", "3O"],
  },
  COM: {
    boPhan: "D",
    ten: "Thông tin liên lạc & GMDSS",
    tenEn: "Radio Communication & GMDSS",
    chucDanh: ["2O", "MST"],
  },
  LSA: {
    boPhan: "D",
    ten: "Trang bị cứu sinh",
    tenEn: "Life Saving Appliances",
    chucDanh: ["3O", "CO"],
  },
  FFA: {
    boPhan: "D",
    ten: "Trang bị cứu hỏa",
    tenEn: "Fire Fighting Appliances",
    chucDanh: ["3O", "CO"],
  },
  MOR: {
    boPhan: "D",
    ten: "Chằng buộc bến & neo",
    tenEn: "Mooring & Anchoring",
    chucDanh: ["BSN", "CO"],
  },
  LSH: {
    boPhan: "D",
    ten: "Chằng buộc container",
    tenEn: "Container Lashing & Securing",
    chucDanh: ["CO", "BSN"],
  },
  HCV: {
    boPhan: "D",
    ten: "Nắp hầm hàng & thông gió hầm",
    tenEn: "Hatch Covers & Hold Ventilation",
    chucDanh: ["CO", "BSN"],
  },
  CGO: {
    boPhan: "D",
    ten: "Thiết bị làm hàng boong",
    tenEn: "Cargo Gear & Deck Cranes (rigging)",
    chucDanh: ["CO", "BSN"],
  },
  PNT: {
    boPhan: "D",
    ten: "Sơn & bảo dưỡng vỏ tàu",
    tenEn: "Paints & Hull Maintenance",
    chucDanh: ["BSN", "CO"],
  },
  DST: {
    boPhan: "D",
    ten: "Vật tư & dụng cụ boong",
    tenEn: "Deck Stores & Tools",
    chucDanh: ["BSN", "CO"],
  },
  MED: {
    boPhan: "D",
    ten: "Y tế & tủ thuốc",
    tenEn: "Medical Stores",
    chucDanh: ["2O", "MST"],
  },
  DOC: {
    boPhan: "D",
    ten: "Hải đồ, ấn phẩm & văn phòng phẩm",
    tenEn: "Charts, Publications & Stationery",
    chucDanh: ["2O", "MST"],
  },
  // ─── MÁY ──────────────────────────────────────────────────────────────────
  BME: {
    boPhan: "E",
    ten: "Máy chính MAN B&W (2 kỳ)",
    tenEn: "Main Engine — MAN B&W",
    chucDanh: ["2E", "CE"],
  },
  UEC: {
    boPhan: "E",
    ten: "Máy chính Mitsubishi UEC (2 kỳ)",
    tenEn: "Main Engine — Mitsubishi UEC",
    chucDanh: ["2E", "CE"],
  },
  TCH: {
    boPhan: "E",
    ten: "Tăng áp (turbocharger)",
    tenEn: "Turbocharger",
    chucDanh: ["2E"],
  },
  SHF: {
    boPhan: "E",
    ten: "Hệ trục & chân vịt",
    tenEn: "Shafting, Stern Tube & Propeller",
    chucDanh: ["2E", "CE"],
  },
  AEG: {
    boPhan: "E",
    ten: "Máy phát điện (diesel)",
    tenEn: "Auxiliary Engine / Generator",
    chucDanh: ["3E"],
  },
  BLR: {
    boPhan: "E",
    ten: "Nồi hơi & trao đổi nhiệt",
    tenEn: "Boiler & Heat Exchangers",
    chucDanh: ["3E", "4E"],
  },
  PUR: {
    boPhan: "E",
    ten: "Phân ly & lọc dầu",
    tenEn: "Purifiers & Filters",
    chucDanh: ["4E", "OIL"],
  },
  PMP: {
    boPhan: "E",
    ten: "Bơm, van & đường ống",
    tenEn: "Pumps, Valves & Piping",
    chucDanh: ["4E", "3E"],
  },
  CMP: {
    boPhan: "E",
    ten: "Máy nén khí & chai gió",
    tenEn: "Air Compressors & Air Bottles",
    chucDanh: ["3E", "4E"],
  },
  REF: {
    boPhan: "E",
    ten: "Máy lạnh & điều hòa",
    tenEn: "Refrigeration & Air Conditioning",
    chucDanh: ["3E", "4E"],
  },
  STG: {
    boPhan: "E",
    ten: "Máy lái & thiết bị lái",
    tenEn: "Steering Gear",
    chucDanh: ["2E", "3E"],
  },
  DKM: {
    boPhan: "E",
    ten: "Máy boong: tời, cẩu, neo (phần cơ)",
    tenEn: "Deck Machinery — mechanical side",
    chucDanh: ["3E", "2E"],
  },
  BWM: {
    boPhan: "E",
    ten: "Xử lý nước dằn (BWMS)",
    tenEn: "Ballast Water Management System",
    chucDanh: ["3E", "2E"],
  },
  SEW: {
    boPhan: "E",
    ten: "Xử lý nước thải & phân ly dầu nước",
    tenEn: "Sewage Treatment & Oily Water Separator",
    chucDanh: ["4E"],
  },
  TOL: {
    boPhan: "E",
    ten: "Dụng cụ & vật tư tiêu hao buồng máy",
    tenEn: "Engine Tools & Consumables",
    chucDanh: ["CE", "FIT"],
  },
  AUX: {
    boPhan: "E",
    ten: "Thiết bị phụ khác buồng máy",
    tenEn: "Other Auxiliary Machinery",
    chucDanh: ["3E", "4E"],
  },
  // ─── ĐIỆN ─────────────────────────────────────────────────────────────────
  SWB: {
    boPhan: "L",
    ten: "Bảng điện chính & phân phối",
    tenEn: "Main Switchboard & Distribution",
    chucDanh: ["ETO", "2E"],
  },
  MOT: {
    boPhan: "L",
    ten: "Động cơ điện & khởi động từ",
    tenEn: "Electric Motors & Starters",
    chucDanh: ["ETO", "ELC"],
  },
  AUT: {
    boPhan: "L",
    ten: "Tự động hóa, báo động & cảm biến",
    tenEn: "Automation, Alarm & Sensors",
    chucDanh: ["ETO", "2E"],
  },
  LIT: {
    boPhan: "L",
    ten: "Chiếu sáng & đèn hàng hải",
    tenEn: "Lighting & Navigation Lights",
    chucDanh: ["ELC", "ETO"],
  },
  BAT: {
    boPhan: "L",
    ten: "Ắc quy & nguồn dự phòng",
    tenEn: "Batteries & Emergency Power",
    chucDanh: ["ETO", "ELC"],
  },
  ELS: {
    boPhan: "L",
    ten: "Vật tư điện (cáp, cầu chì, đầu nối)",
    tenEn: "Electrical Stores",
    chucDanh: ["ELC", "ETO"],
  },
  // ─── PHỤC VỤ ──────────────────────────────────────────────────────────────
  GAL: {
    boPhan: "C",
    ten: "Thiết bị bếp & kho lạnh thực phẩm",
    tenEn: "Galley Equipment & Provision Rooms",
    chucDanh: ["CCK"],
  },
  UTN: {
    boPhan: "C",
    ten: "Dụng cụ ăn uống & đồ bếp",
    tenEn: "Utensils, Crockery & Cutlery",
    chucDanh: ["CCK", "STW"],
  },
  LIN: {
    boPhan: "C",
    ten: "Đồ vải & buồng ở",
    tenEn: "Linen & Accommodation",
    chucDanh: ["STW", "CO"],
  },
  CLN: {
    boPhan: "C",
    ten: "Vệ sinh & giặt là",
    tenEn: "Cleaning & Laundry",
    chucDanh: ["STW", "CCK"],
  },
  PRV: {
    boPhan: "C",
    ten: "Thực phẩm & đồ khô",
    tenEn: "Provisions & Dry Stores",
    chucDanh: ["CCK", "MST"],
  },
};

/**
 * ĐOẠN THỨ BA LUÔN NÓI LOẠI HÀNG — đây là điểm phân biệt vật tư với phụ tùng:
 *
 *   IMP  vật tư tiêu hao CÓ mã IMPA    → đoạn cuối là 6 số IMPA
 *   STO  vật tư tiêu hao KHÔNG có IMPA → đoạn cuối là số thứ tự
 *   SPA  phụ tùng thay thế             → thêm đoạn nhóm thiết bị rồi tới số thứ tự
 *
 * Vì sao cần cả STO chứ không chỉ IMP: không phải vật tư nào cũng có mã IMPA —
 * hàng đặt riêng, hàng nội địa, và cả những dòng mà file kiểm kê gốc ghi mã
 * cụt. Thiếu STO thì đám đó phải mượn khuôn của phụ tùng, và trong danh sách
 * chúng trông y hệt phụ tùng máy.
 *
 * Vì sao phụ tùng dài hơn một đoạn: với phụ tùng, câu hỏi đầu tiên luôn là
 * "của máy nào" — hỏi một chi tiết mà không nói máy nào thì không đặt mua được.
 * Với vật tư tiêu hao thì không có câu hỏi đó.
 */
export const LOAI_HANG = {
  // Hai đoạn của khuôn ĐANG DÙNG.
  IMPA: "Vật tư",
  SPR: "Phụ tùng",
  // Ba đoạn của khuôn dài (xem đầu file).
  IMP: "Vật tư tiêu hao (có mã IMPA)",
  STO: "Vật tư tiêu hao (không có mã IMPA)",
  SPA: "Phụ tùng thay thế",
} as const;

/** Hai đoạn loại hàng của khuôn đang dùng — vật tư và phụ tùng, không có gì khác. */
export const LOAI_NGAN = ["IMPA", "SPR"] as const;
export type LoaiNgan = (typeof LOAI_NGAN)[number];

/**
 * `Material.materialType` (SPARE · STORE) → đoạn loại hàng trong mã.
 *
 * Loại hàng lấy từ CỘT, không suy từ "có mã IMPA hay không": một cái bơm dự
 * phòng vẫn là phụ tùng dù nhà cung cấp có gán cho nó mã IMPA, còn một cuộn
 * băng dính không có mã IMPA vẫn là vật tư.
 */
export function doanLoai(materialType: string | null | undefined): LoaiNgan {
  return materialType === "SPARE" ? "SPR" : "IMPA";
}

export type LoaiHang = keyof typeof LOAI_HANG;

/**
 * Các họ máy chính mà đội tàu đang chạy.
 *
 * Mỗi tàu khai một họ ở `Vessel.mainEngineGroup`. Phụ tùng máy chính lấy nhóm
 * theo họ máy của tàu dùng nó, chứ không theo một mặc định chung: công ty có cả
 * MAN B&W lẫn Mitsubishi UEC, đặt mặc định là sớm muộn cũng có thùng hàng về
 * tới tàu rồi mới biết không lắp được.
 */
export const NHOM_MAY_CHINH = ["BME", "UEC"] as const;

/** Đoạn thay chỗ nhóm thiết bị khi mặt hàng đi theo mã IMPA. */
export const DOAN_IMPA = "IMP";

export type MaVatTu = {
  raw: string;
  boPhan: BoPhan;
  /**
   * Chức danh giữ hàng — chỉ khuôn dài mới nói được.
   *
   * Khuôn đang dùng (`D-IMPA-0075`) KHÔNG mang chức danh, nên ở đây là null.
   * Đọc là "mã này không nói ai giữ", chứ không phải "không ai giữ": người giữ
   * nằm ở cột `responsibleRank`.
   */
  chucDanh: string | null;
  /** IMPA · SPR (khuôn đang dùng) hoặc IMP · STO · SPA (khuôn dài). */
  loai: LoaiHang;
  /** Nhóm thiết bị — chỉ phụ tùng khuôn dài (SPA) mới có. */
  nhomThietBi: string | null;
  /** Mã IMPA 6 số, hoặc null. */
  impa: string | null;
  /** Số thứ tự, hoặc null với hàng đi theo mã IMPA. */
  stt: number | null;
};

/**
 * Bỏ dấu chấm, khoảng trắng, gạch nối khỏi mã IMPA.
 *
 * Người nhập gõ "61.13.33", catalogue in "61 13 33", file Excel xuất ra
 * "611333" — cùng một mặt hàng. Không chuẩn hóa thì cùng một thứ nằm ba dòng
 * khác nhau trong danh mục.
 */
export function chuanHoaImpa(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const so = String(raw).replace(/[\s.\-_]/g, "");
  return /^\d{6}$/.test(so) ? so : null;
}

/** Số thứ tự 4 chữ số: 1 → "0001". */
function sttChuoi(stt: number): string {
  return String(Math.trunc(stt)).padStart(4, "0");
}

function kiemTraChucDanh(boPhan: BoPhan, chucDanh: string): string | null {
  const cd = CHUC_DANH[chucDanh];
  if (!cd) return `Chức danh "${chucDanh}" không có trong quy ước.`;
  if (!chucDanhThuocBoPhan(chucDanh, boPhan)) {
    const duoc = [cd.boPhan, ...(cd.kiemNhiem ?? [])]
      .map((b) => BO_PHAN[b].ten)
      .join(" · ");
    return `Chức danh ${chucDanh} (${cd.ten}) chỉ giữ hàng bộ phận ${duoc}, không phải ${BO_PHAN[boPhan].ten}.`;
  }
  return null;
}

/** Sinh mã cho vật tư tiêu hao có mã IMPA. */
export function sinhMaImpa(x: {
  boPhan: BoPhan;
  chucDanh: string;
  impa: string;
}): { ma: string } | { loi: string } {
  const loiCd = kiemTraChucDanh(x.boPhan, x.chucDanh);
  if (loiCd) return { loi: loiCd };
  const impa = chuanHoaImpa(x.impa);
  if (!impa) {
    return { loi: `Mã IMPA "${x.impa}" không hợp lệ — phải đủ 6 chữ số.` };
  }
  return { ma: `${x.boPhan}-${x.chucDanh}-${DOAN_IMPA}-${impa}` };
}

/** Sinh mã cho phụ tùng thay thế: có đoạn SPA và nhóm thiết bị. */
export function sinhMaPhuTung(x: {
  boPhan: BoPhan;
  chucDanh: string;
  nhomThietBi: string;
  stt: number;
}): { ma: string } | { loi: string } {
  const loiCd = kiemTraChucDanh(x.boPhan, x.chucDanh);
  if (loiCd) return { loi: loiCd };
  const nhom = NHOM_THIET_BI[x.nhomThietBi];
  if (!nhom) {
    return { loi: `Nhóm thiết bị "${x.nhomThietBi}" không có trong quy ước.` };
  }
  if (nhom.boPhan !== x.boPhan) {
    return {
      loi: `Nhóm ${x.nhomThietBi} (${nhom.ten}) thuộc bộ phận ${BO_PHAN[nhom.boPhan].ten}.`,
    };
  }
  const loiStt = kiemTraStt(x.stt);
  if (loiStt) return { loi: loiStt };
  return {
    ma: `${x.boPhan}-${x.chucDanh}-SPA-${x.nhomThietBi}-${sttChuoi(x.stt)}`,
  };
}

/**
 * Sinh mã cho vật tư tiêu hao KHÔNG có mã IMPA.
 *
 * Không kèm nhóm thiết bị: một cuộn băng dính hay một cây chổi không thuộc máy
 * nào cả. Nhóm vẫn được lưu ở cột equipGroup để lọc, chỉ là không nhét vào mã —
 * nhét vào thì phải bịa ra một nhóm cho những thứ không có nhóm.
 */
export function sinhMaVatTu(x: {
  boPhan: BoPhan;
  chucDanh: string;
  stt: number;
}): { ma: string } | { loi: string } {
  const loiCd = kiemTraChucDanh(x.boPhan, x.chucDanh);
  if (loiCd) return { loi: loiCd };
  const loiStt = kiemTraStt(x.stt);
  if (loiStt) return { loi: loiStt };
  return { ma: `${x.boPhan}-${x.chucDanh}-STO-${sttChuoi(x.stt)}` };
}

/**
 * Sinh mã theo KHUÔN ĐANG DÙNG: `[bộ phận]-[IMPA|SPR]-[4 số]`.
 *
 * Đây là hàm mà mọi chỗ mint mã mới phải gọi. Không nhận chức danh vì khuôn này
 * không mang chức danh — thêm một tham số chỉ để bỏ đi là mời người sau tưởng
 * nó có tác dụng.
 */
export function sinhMaNgan(x: {
  boPhan: BoPhan;
  loai: LoaiNgan;
  stt: number;
}): { ma: string } | { loi: string } {
  if (!BO_PHAN[x.boPhan]) {
    return { loi: `Bộ phận "${x.boPhan}" không có trong quy ước (D · E · L · C).` };
  }
  if (x.loai !== "IMPA" && x.loai !== "SPR") {
    return { loi: `Loại hàng "${x.loai}" không có trong quy ước (IMPA · SPR).` };
  }
  const loiStt = kiemTraStt(x.stt);
  if (loiStt) return { loi: loiStt };
  return { ma: `${x.boPhan}-${x.loai}-${sttChuoi(x.stt)}` };
}

/**
 * Số thứ tự kế tiếp của một khuôn đang dùng, tính từ những mã ĐÃ CÓ.
 *
 * Không đếm số dòng rồi +1: xóa một mặt hàng giữa chừng là số thứ tự quay lại
 * trùng mã cũ, mà mã cũ có thể còn nằm trên thùng hàng trong kho.
 */
export function sttKeTiepNgan(
  boPhan: BoPhan,
  loai: LoaiNgan,
  maDaCo: readonly string[]
): number {
  const dau = `${boPhan}-${loai}-`;
  let lonNhat = 0;
  for (const ma of maDaCo) {
    if (!ma.startsWith(dau)) continue;
    const so = Number(ma.slice(dau.length));
    if (Number.isInteger(so) && so > lonNhat) lonNhat = so;
  }
  return lonNhat + 1;
}

function kiemTraStt(stt: number): string | null {
  return !Number.isFinite(stt) || stt < 1 || stt > 9999
    ? "Số thứ tự phải nằm trong khoảng 1 → 9999."
    : null;
}

/**
 * Số thứ tự kế tiếp cho một nhóm, tính từ những mã ĐÃ CÓ.
 *
 * Không đếm số dòng rồi +1: xóa một mặt hàng giữa chừng là số thứ tự quay lại
 * trùng mã cũ, mà mã cũ có thể còn nằm trên thùng hàng trong kho. Luôn lấy số
 * lớn nhất đang dùng rồi cộng một.
 */
export function sttKeTiep(
  tienTo: {
    boPhan: BoPhan;
    chucDanh: string;
    /** Có nhóm = đếm cho phụ tùng (SPA); bỏ trống = đếm cho vật tư (STO). */
    nhomThietBi?: string | null;
  },
  maDaCo: readonly string[]
): number {
  const dau = tienTo.nhomThietBi
    ? `${tienTo.boPhan}-${tienTo.chucDanh}-SPA-${tienTo.nhomThietBi}-`
    : `${tienTo.boPhan}-${tienTo.chucDanh}-STO-`;
  let lonNhat = 0;
  for (const ma of maDaCo) {
    if (!ma.startsWith(dau)) continue;
    const so = Number(ma.slice(dau.length));
    if (Number.isInteger(so) && so > lonNhat) lonNhat = so;
  }
  return lonNhat + 1;
}

/**
 * ĐÁNH SỐ THEO KHỐI — để số thứ tự trong mã có trật tự, không phải cấp bừa.
 *
 * Trong mỗi khuôn (`D-IMPA-`, `E-SPR-`...), dãy 0001–9999 được chia thành các
 * KHỐI 100 số. Mỗi nhóm vật tư chiếm trọn một hoặc vài khối liền nhau:
 *
 *   D-IMPA-0001 … 0300   Boong (Deck)              142 mặt hàng, 3 khối
 *   D-IMPA-0301 … 0500   Vật tư Boong               97 mặt hàng, 2 khối
 *   D-IMPA-0501 … 0600   Vật tư bảo hộ & an toàn    35 mặt hàng, 1 khối
 *
 * Nhờ vậy nhìn con số là đoán được nhóm, và hàng cùng nhóm nằm cạnh nhau trên
 * kệ cũng nằm cạnh nhau trong danh sách — cái mà người đi kiểm kê cần nhất.
 *
 * Mỗi nhóm được cấp đủ khối để chứa GẤP ĐÔI số hàng đang có. Chỗ trống ấy
 * chính là điểm của cách chia này: nhập thêm hàng vào một nhóm thì số mới vẫn
 * rơi đúng vào khối của nhóm đó, không phải đánh số lại cả danh mục — mà đánh
 * số lại là phải in lại nhãn dán ngoài kho.
 *
 * BỐ CỤC KHỐI KHÔNG LƯU Ở ĐÂU CẢ: nó nằm ngay trong những mã đã cấp. Đọc mã
 * hiện có là biết mỗi nhóm đang chiếm khoảng nào. Lưu thêm một bảng bố cục thì
 * có hai nguồn sự thật, và nguồn sai là nguồn không ai đọc lại.
 */
export const CACH_KHOI = 100;

/** Khối chứa số này (1-based): 1→1, 100→1, 101→2. */
export function khoiCuaSo(stt: number): number {
  return Math.ceil(stt / CACH_KHOI);
}

/** Số đầu tiên của một khối: khối 1→1, khối 4→301. */
export function soDauKhoi(khoi: number): number {
  return (khoi - 1) * CACH_KHOI + 1;
}

/** Số khối cần cấp cho một nhóm: đủ chứa gấp đôi số hàng đang có, ít nhất một. */
export function soKhoiCanCho(soMatHang: number): number {
  return Math.max(1, Math.ceil((soMatHang * 2) / CACH_KHOI));
}

export type ChoTiepTheo = {
  stt: number;
  /**
   * false = khối của nhóm đã kín, mã mới phải xếp tạm vào đuôi dãy.
   *
   * Không phải lỗi, chỉ là dấu hiệu danh mục đã lớn hơn bố cục cũ. Người gọi
   * nên báo lên để chạy `doi-ma-vat-tu.cmd --theo-nhom --dong-y` xếp lại.
   */
  trongKhoi: boolean;
};

/**
 * Số thứ tự kế tiếp cho một mặt hàng MỚI, đặt vào đúng khối của nhóm nó.
 *
 * Ba trường hợp, theo đúng thứ tự ưu tiên:
 *
 *  1. Nhóm đã có mã và ngay sau mã lớn nhất còn trống → lấy số đó. Hàng mới
 *     nằm liền sau hàng cũ cùng nhóm.
 *  2. Nhóm chưa có mã nào → mở một khối MỚI ở mốc trăm kế tiếp. Nhóm mới bắt
 *     đầu ở số tròn (0301, 0401...) chứ không chen vào giữa khối người khác.
 *  3. Khối đã kín → xếp vào đuôi dãy và trả về `trongKhoi: false`.
 *
 * Luôn lấy số LỚN NHẤT đang dùng rồi cộng một, không đếm số dòng: xóa một mặt
 * hàng giữa chừng mà đếm dòng thì mã vừa xóa được cấp lại, trong khi nó có thể
 * còn nằm trên thùng hàng ngoài kho.
 */
export function sttTheoNhom(
  boPhan: BoPhan,
  loai: LoaiNgan,
  /** Mọi mã đang có, kèm nhóm của nó. Nhóm để null nghĩa là hàng chưa xếp nhóm. */
  daCo: readonly { ma: string; nhom: string | number | null }[],
  nhomCanCap: string | number | null
): ChoTiepTheo {
  const dau = `${boPhan}-${loai}-`;
  const trongKhuon: number[] = [];
  const cuaNhom: number[] = [];
  for (const x of daCo) {
    if (!x.ma.startsWith(dau)) continue;
    const so = Number(x.ma.slice(dau.length));
    if (!Number.isInteger(so) || so < 1) continue;
    trongKhuon.push(so);
    // So sánh bằng String để "3" và 3 là một nhóm — categoryId có thể tới đây
    // dưới dạng số hoặc chuỗi tùy nơi gọi.
    if (String(x.nhom ?? "") === String(nhomCanCap ?? "")) cuaNhom.push(so);
  }
  const daDung = new Set(trongKhuon);
  const lonNhat = trongKhuon.length ? Math.max(...trongKhuon) : 0;

  if (cuaNhom.length) {
    const ke = Math.max(...cuaNhom) + 1;
    if (!daDung.has(ke)) return { stt: ke, trongKhoi: true };
  } else {
    const moc = soDauKhoi(khoiCuaSo(lonNhat) + 1);
    if (!daDung.has(moc)) return { stt: moc, trongKhoi: true };
  }

  let duoi = lonNhat + 1;
  while (daDung.has(duoi)) duoi++;
  return { stt: duoi, trongKhoi: false };
}

/**
 * Chia dãy số cho từng nhóm khi xếp lại TOÀN BỘ một khuôn.
 *
 * Nhận số lượng hàng của từng nhóm (đã theo thứ tự muốn xếp), trả về số bắt
 * đầu của mỗi nhóm. Nhóm nào cũng bắt đầu ở một mốc trăm.
 */
export function boCucKhoi(
  nhomTheoThuTu: readonly { nhom: string; soMatHang: number }[]
): Map<string, { dau: number; cuoi: number }> {
  const kq = new Map<string, { dau: number; cuoi: number }>();
  let khoi = 1;
  for (const n of nhomTheoThuTu) {
    const can = soKhoiCanCho(n.soMatHang);
    kq.set(n.nhom, {
      dau: soDauKhoi(khoi),
      cuoi: soDauKhoi(khoi + can) - 1,
    });
    khoi += can;
  }
  return kq;
}

const RE_NGAN = /^([DELC])-(IMPA|SPR)-(\d{4})$/;
const RE_IMPA = /^([DELC])-([A-Z0-9]{2,3})-IMP-(\d{6})$/;
const RE_STORE = /^([DELC])-([A-Z0-9]{2,3})-STO-(\d{4})$/;
const RE_SPARE = /^([DELC])-([A-Z0-9]{2,3})-SPA-([A-Z]{3})-(\d{4})$/;

/** Tách một mã thành các phần; trả về lỗi nếu sai quy ước. */
export function phanTichMa(ma: string): MaVatTu | { loi: string } {
  const s = String(ma || "").trim().toUpperCase();
  if (!s) return { loi: "Mã trống." };

  // Khuôn đang dùng đi trước: nó chiếm gần như toàn bộ danh mục, và thử trước
  // cũng tránh mập mờ với khuôn dài — "IMPA"/"SPR" không phải mã chức danh.
  const mNgan = RE_NGAN.exec(s);
  if (mNgan) {
    const [, boPhan, loai, stt] = mNgan;
    return {
      raw: s,
      boPhan: boPhan as BoPhan,
      chucDanh: null,
      loai: loai as LoaiHang,
      nhomThietBi: null,
      impa: null,
      stt: Number(stt),
    };
  }

  const mImpa = RE_IMPA.exec(s);
  if (mImpa) {
    const [, boPhan, chucDanh, impa] = mImpa;
    const loi = kiemTraChucDanh(boPhan as BoPhan, chucDanh);
    if (loi) return { loi };
    return {
      raw: s,
      boPhan: boPhan as BoPhan,
      chucDanh,
      loai: "IMP",
      nhomThietBi: null,
      impa,
      stt: null,
    };
  }

  const mStore = RE_STORE.exec(s);
  if (mStore) {
    const [, boPhan, chucDanh, stt] = mStore;
    const loi = kiemTraChucDanh(boPhan as BoPhan, chucDanh);
    if (loi) return { loi };
    return {
      raw: s,
      boPhan: boPhan as BoPhan,
      chucDanh,
      loai: "STO",
      nhomThietBi: null,
      impa: null,
      stt: Number(stt),
    };
  }

  const mSpare = RE_SPARE.exec(s);
  if (mSpare) {
    const [, boPhan, chucDanh, nhom, stt] = mSpare;
    const loi = kiemTraChucDanh(boPhan as BoPhan, chucDanh);
    if (loi) return { loi };
    const tb = NHOM_THIET_BI[nhom];
    if (!tb) return { loi: `Nhóm thiết bị "${nhom}" không có trong quy ước.` };
    if (tb.boPhan !== boPhan) {
      return {
        loi: `Nhóm ${nhom} (${tb.ten}) thuộc bộ phận ${BO_PHAN[tb.boPhan].ten}, không khớp tiền tố "${boPhan}".`,
      };
    }
    return {
      raw: s,
      boPhan: boPhan as BoPhan,
      chucDanh,
      loai: "SPA",
      nhomThietBi: nhom,
      impa: null,
      stt: Number(stt),
    };
  }

  return {
    loi:
      "Sai khuôn mã. Khuôn đang dùng:\n" +
      "  [D|E|L|C]-IMPA-[4 số]                      vật tư    ví dụ D-IMPA-0075\n" +
      "  [D|E|L|C]-SPR-[4 số]                       phụ tùng  ví dụ E-SPR-0034\n" +
      "Khuôn dài (có chức danh) cũng đọc được:\n" +
      "  [D|E|L|C]-[CHỨC DANH]-IMP-[6 số IMPA]      vật tư có mã IMPA\n" +
      "  [D|E|L|C]-[CHỨC DANH]-STO-[4 số]           vật tư không có mã IMPA\n" +
      "  [D|E|L|C]-[CHỨC DANH]-SPA-[NHÓM]-[4 số]    phụ tùng thay thế",
  };
}

/** Mã này có hợp lệ không, và sai ở đâu. */
export function kiemTraMa(ma: string): { hopLe: boolean; loi?: string } {
  const kq = phanTichMa(ma);
  return "loi" in kq ? { hopLe: false, loi: kq.loi } : { hopLe: true };
}

/** Mô tả mã bằng tiếng Việt để hiện lên giao diện. */
export function moTaMa(ma: string): string {
  const kq = phanTichMa(ma);
  if ("loi" in kq) return kq.loi;
  const phan = [`${BO_PHAN[kq.boPhan].ten}`];
  if (kq.chucDanh) phan.push(CHUC_DANH[kq.chucDanh].ten);
  if (kq.loai === "IMPA" || kq.loai === "SPR") {
    phan.push(LOAI_HANG[kq.loai], `STT ${kq.stt}`);
  } else if (kq.loai === "IMP") {
    phan.push(`vật tư IMPA ${kq.impa}`);
  } else if (kq.loai === "STO") {
    phan.push(`vật tư (không có IMPA)`, `STT ${kq.stt}`);
  } else {
    phan.push("phụ tùng", `${NHOM_THIET_BI[kq.nhomThietBi!].ten}`, `STT ${kq.stt}`);
  }
  return phan.join(" · ");
}

/** Các chức danh dùng được cho một nhóm thiết bị (gợi ý khi nhập liệu). */
export function chucDanhChoNhom(nhomThietBi: string): string[] {
  return NHOM_THIET_BI[nhomThietBi]?.chucDanh ?? [];
}

/** Danh sách nhóm thiết bị của một bộ phận. */
export function nhomTheoBoPhan(boPhan: BoPhan): string[] {
  return Object.keys(NHOM_THIET_BI).filter(
    (k) => NHOM_THIET_BI[k].boPhan === boPhan
  );
}
