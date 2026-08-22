// Dầu đốt · Dầu nhờn · Hóa chất — hằng số và quy tắc nghiệp vụ.
//
// Đặt riêng ngoài app/consumable-actions.ts vì file "use server" chỉ được
// export hàm async, mà các bảng nhãn dưới đây cần dùng cả ở component trình
// duyệt.

export const CONSUMABLE_CATEGORIES = [
  { value: "FUEL", label: "Dầu đốt (Fuel oil)", icon: "🛢️" },
  { value: "LUBE", label: "Dầu nhờn (Lube oil)", icon: "🧴" },
  { value: "CHEMICAL", label: "Hóa chất (Chemical)", icon: "🧪" },
] as const;

export const CATEGORY_VALUES: string[] = CONSUMABLE_CATEGORIES.map(
  (c) => c.value
);

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CONSUMABLE_CATEGORIES.map((c) => [c.value, c.label])
);

export const CATEGORY_ICON: Record<string, string> = Object.fromEntries(
  CONSUMABLE_CATEGORIES.map((c) => [c.value, c.icon])
);

/** Chủng loại trong từng nhóm. */
export const GRADES: Record<string, { value: string; label: string }[]> = {
  FUEL: [
    { value: "HFO", label: "HFO — dầu nặng (High Sulphur)" },
    { value: "VLSFO", label: "VLSFO — dầu nặng lưu huỳnh rất thấp ≤0,50%" },
    { value: "ULSFO", label: "ULSFO — dầu nặng lưu huỳnh siêu thấp ≤0,10%" },
    { value: "MDO", label: "MDO — dầu diesel hàng hải" },
    { value: "MGO", label: "MGO — dầu gas oil hàng hải ≤0,10%" },
    { value: "OTHER", label: "Khác" },
  ],
  LUBE: [
    { value: "CYL", label: "Dầu xy-lanh (Cylinder oil)" },
    { value: "SYS", label: "Dầu hệ thống (System oil)" },
    { value: "AE", label: "Dầu máy đèn (AE / Trunk piston)" },
    { value: "HYD", label: "Dầu thủy lực (Hydraulic)" },
    { value: "GEAR", label: "Dầu hộp số (Gear oil)" },
    { value: "GREASE", label: "Mỡ (Grease)" },
    { value: "OTHER", label: "Khác" },
  ],
  CHEMICAL: [
    { value: "BOILER", label: "Xử lý nước nồi hơi" },
    { value: "COOLING", label: "Xử lý nước làm mát" },
    { value: "FUEL_TREAT", label: "Phụ gia xử lý dầu" },
    { value: "CLEANING", label: "Tẩy rửa / vệ sinh" },
    { value: "SEWAGE", label: "Xử lý nước thải" },
    { value: "OTHER", label: "Khác" },
  ],
};

export const GRADE_LABEL: Record<string, string> = Object.fromEntries(
  Object.values(GRADES)
    .flat()
    .map((g) => [g.value, g.label])
);

/** Nơi tiêu thụ — báo cáo dầu của tàu tách theo đúng các mục này. */
export const CONSUMERS = [
  { value: "ME", label: "Máy chính (M/E)" },
  { value: "AE", label: "Máy đèn (A/E)" },
  { value: "BOILER", label: "Nồi hơi (Boiler)" },
  { value: "INERT", label: "Máy khí trơ (IGG)" },
  { value: "OTHER", label: "Khác" },
] as const;

export const CONSUMER_VALUES: string[] = CONSUMERS.map((c) => c.value);
export const CONSUMER_LABEL: Record<string, string> = Object.fromEntries(
  CONSUMERS.map((c) => [c.value, c.label])
);

export const TRANSACTION_LABEL: Record<string, string> = {
  IN: "Nhận lên tàu",
  OUT: "Xuất / trả / hao hụt",
  CONSUME: "Tiêu thụ",
};

/**
 * Giới hạn lưu huỳnh MARPOL Annex VI Reg 14.
 *
 * 0,50% m/m áp dụng toàn cầu từ 01/01/2020; 0,10% m/m trong vùng kiểm soát khí
 * thải (ECA: biển Baltic, biển Bắc, Bắc Mỹ, vùng biển Caribbe thuộc Hoa Kỳ, và
 * Địa Trung Hải từ 01/05/2025).
 *
 * Tàu có hệ thống lọc khí thải (scrubber) được dùng dầu vượt giới hạn — vì vậy
 * đây là CẢNH BÁO để người nhập đối chiếu, không phải chặn cứng. Chặn cứng thì
 * tàu có scrubber không ghi được lô dầu thật của mình.
 */
export const GIOI_HAN_LUU_HUYNH = {
  TOAN_CAU: 0.5,
  ECA: 0.1,
} as const;

export type CanhBaoLuuHuynh = {
  muc: "VUOT_TOAN_CAU" | "VUOT_ECA" | "DAT";
  loi: string;
};

/** Đối chiếu hàm lượng lưu huỳnh của một lô dầu với giới hạn MARPOL. */
export function kiemTraLuuHuynh(sulphur: number | null): CanhBaoLuuHuynh | null {
  if (sulphur === null || !Number.isFinite(sulphur)) return null;
  if (sulphur > GIOI_HAN_LUU_HUYNH.TOAN_CAU) {
    return {
      muc: "VUOT_TOAN_CAU",
      loi: `Lưu huỳnh ${sulphur}% vượt giới hạn toàn cầu 0,50% (MARPOL VI Reg 14). Chỉ hợp lệ nếu tàu có hệ thống lọc khí thải đang hoạt động.`,
    };
  }
  if (sulphur > GIOI_HAN_LUU_HUYNH.ECA) {
    return {
      muc: "VUOT_ECA",
      loi: `Lưu huỳnh ${sulphur}% đạt giới hạn toàn cầu nhưng vượt 0,10% của vùng ECA. Không dùng được trong ECA nếu không có lọc khí thải.`,
    };
  }
  return {
    muc: "DAT",
    loi: `Lưu huỳnh ${sulphur}% — dùng được cả trong vùng ECA.`,
  };
}

/**
 * MARPOL Annex VI Reg 18.8.1: mẫu đại diện của lô dầu phải giữ trên tàu tới
 * khi dùng hết lô đó, và ít nhất 12 tháng kể từ ngày giao.
 *
 * Tự tính mốc này khi nhận, thay vì để người dùng nhớ — bỏ mẫu sớm là mất bằng
 * chứng đối chứng khi bị kiểm tra (PSC), giữ mãi thì tủ mẫu chật cứng.
 */
export function mocGiuMauDau(receivedAt: Date): Date {
  const d = new Date(receivedAt);
  d.setMonth(d.getMonth() + 12);
  return d;
}

/** Hạn dùng của lô hóa chất, tính từ ngày nhận nếu mặt hàng khai hạn dùng. */
export function tinhHanDung(
  receivedAt: Date,
  shelfLifeMonths: number | null | undefined
): Date | null {
  if (!shelfLifeMonths || shelfLifeMonths <= 0) return null;
  const d = new Date(receivedAt);
  d.setMonth(d.getMonth() + shelfLifeMonths);
  return d;
}

/** Số ngày còn lại tới một mốc; âm nghĩa là đã quá. */
export function soNgayToi(moc: Date | null | undefined): number | null {
  if (!moc) return null;
  return Math.ceil((moc.getTime() - Date.now()) / 86_400_000);
}

/** Ngưỡng bắt đầu nhắc hạn dùng hóa chất. */
export const NGUONG_CANH_BAO_HAN_DUNG = 60;

/**
 * Đơn vị hợp lệ theo nhóm. Dầu đốt tính bằng tấn (MT) như BDN và báo cáo dầu;
 * dầu nhờn theo lít hoặc thùng; hóa chất theo can/kg/lít.
 */
export const UOM_GOI_Y: Record<string, string[]> = {
  FUEL: ["MT", "M3", "L"],
  LUBE: ["L", "DRUM", "KG"],
  CHEMICAL: ["L", "KG", "CAN", "BOX"],
};
