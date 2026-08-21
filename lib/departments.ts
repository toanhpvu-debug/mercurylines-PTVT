// Phân bộ phận theo cơ cấu tàu, đúng thứ tự của form kiểm kê công ty
// (MLS-11-06): Boong → Máy → Điện → Phục vụ/Tiêu hao → An toàn → Khác.
//
// Dùng chung cho trang Tồn kho và trang Danh mục vật tư — trước đây logic này
// nằm lọt trong trang Tồn kho nên trang Danh mục không có cách phân nhóm nào.

export type Department = {
  key: string;
  label: string;
  icon: string;
};

type DepartmentRule = Department & { re: RegExp };

const RULES: readonly DepartmentRule[] = [
  { key: "DECK", label: "Boong (Deck)", icon: "🛳", re: /boong|deck/i },
  {
    key: "ENGINE",
    label: "Máy (Engine)",
    icon: "⚙️",
    // Kèm tên thiết bị buồng máy hay gặp trong file kiểm kê thật: bơm, máy nén,
    // máy phân ly, nồi hơi, xử lý nước dằn/nước thải, tuabin, xuồng cứu sinh...
    re: /máy|may chinh|engine|\beng\b|-eng|compressor|separator|purifier|boiler|\bpump\b|ballast|bwms|sewage|turbine|turbo|cooler|incinerator|lifeboat|generator|\btank\b/i,
  },
  {
    key: "ELEC",
    label: "Điện (Electric)",
    icon: "⚡",
    // Kèm đèn/light/lamp: đèn hàng hải là thiết bị điện, nhưng nhóm của nó
    // ("Hệ thống đèn hàng hải") không chứa chữ "điện" nên trước đây bị xếp nhầm.
    re: /điện|dien|elec|đèn|light|lamp|battery|ắc quy|ac quy/i,
  },
  {
    key: "SERVICE",
    label: "Phục vụ / Tiêu hao (Service)",
    icon: "🧺",
    re: /tiêu hao|tieu hao|phục vụ|phuc vu|service|steward|consum|store|catering|galley|bếp|bep/i,
  },
  {
    key: "SAFETY",
    label: "An toàn (Safety)",
    icon: "🦺",
    re: /an toàn|an toan|safety|bảo hộ|bao ho/i,
  },
] as const;

export const OTHER_DEPARTMENT: Department = {
  key: "OTHER",
  label: "Khác",
  icon: "📦",
};

/** Danh sách bộ phận theo đúng thứ tự hiển thị, có mục "Khác" ở cuối. */
export const DEPARTMENTS: readonly Department[] = [
  ...RULES.map(({ key, label, icon }) => ({ key, label, icon })),
  OTHER_DEPARTMENT,
];

/**
 * Suy ra bộ phận từ các chuỗi mô tả, xét lần lượt theo thứ tự ưu tiên truyền vào
 * (thường là: nhóm vật tư → thiết bị đi kèm → mã kho). Không khớp gì thì "Khác".
 */
export function departmentOf(sources: (string | null | undefined)[]): string {
  for (const src of sources) {
    if (!src) continue;
    const hit = RULES.find((d) => d.re.test(src));
    if (hit) return hit.key;
  }
  return OTHER_DEPARTMENT.key;
}

/**
 * Bộ phận của một vật tư, có xét loại.
 *
 * Phụ tùng (Spare) không đoán được bộ phận thì xếp vào **Máy** chứ không phải
 * "Khác": trên tàu, phụ tùng gần như luôn thuộc buồng máy trừ khi nhóm ghi rõ
 * là boong/điện/phục vụ. Không có quy tắc này thì các thiết bị tên tiếng Anh
 * (Oil Separator, BWMS, Sewage Treatment...) đều rơi hết vào "Khác".
 */
export function departmentOfMaterial(
  sources: (string | null | undefined)[],
  materialType: string
): string {
  const key = departmentOf(sources);
  if (key === OTHER_DEPARTMENT.key && materialType === "SPARE") {
    return "ENGINE";
  }
  return key;
}

export type MaterialLike = {
  materialType: string;
  equipment?: string | null;
  /** Tên nhóm (Category) — file kiểm kê của công ty ghi thiết bị vào cột "Nhóm". */
  categoryName?: string | null;
  nameVn: string;
};

/**
 * Thiết bị của một phụ tùng, để gom nhóm trong phần Máy (Máy chính, Máy đèn...).
 * Trả null với vật tư thường (Store).
 *
 * Lấy từ trường `equipment` trước — nó chỉ được điền khi nhập từ Word MLS-11-04.
 * File Excel kiểm kê MLS-11-06 lại ghi thiết bị ở cột "Nhóm" nên phải lấy tiếp
 * từ Category, nếu không toàn bộ phụ tùng sẽ hiện "chưa rõ thiết bị".
 */
export function equipmentOf(m: MaterialLike): string | null {
  if (m.materialType !== "SPARE") return null;
  const fromField = (m.equipment ?? "").trim();
  if (fromField) return fromField;
  const fromCategory = (m.categoryName ?? "").trim();
  if (fromCategory) return fromCategory;
  return "Chưa rõ thiết bị";
}

/**
 * So sánh hai vật tư trong cùng một bộ phận:
 * Vật tư (Store) đứng trước → Phụ tùng (Spare) xếp sau theo từng thiết bị →
 * trong mỗi thiết bị sắp theo tên.
 */
export function compareWithinDepartment(
  a: MaterialLike,
  b: MaterialLike
): number {
  const spareA = a.materialType === "SPARE" ? 1 : 0;
  const spareB = b.materialType === "SPARE" ? 1 : 0;
  if (spareA !== spareB) return spareA - spareB;
  const eqA = equipmentOf(a) ?? "";
  const eqB = equipmentOf(b) ?? "";
  if (eqA !== eqB) return eqA.localeCompare(eqB, "vi");
  return a.nameVn.localeCompare(b.nameVn, "vi");
}
