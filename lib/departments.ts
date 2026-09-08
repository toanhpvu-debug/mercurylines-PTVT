// Phân bộ phận theo cơ cấu tàu, đúng thứ tự của form kiểm kê công ty
// (MLS-11-06): Boong → Máy → Điện → Phục vụ/Tiêu hao → An toàn → Khác.
//
// Dùng chung cho trang Tồn kho và trang Danh mục vật tư — trước đây logic này
// nằm lọt trong trang Tồn kho nên trang Danh mục không có cách phân nhóm nào.

/**
 * Tên hiển thị của bộ phận nằm ở từ điển (`labels.dept_<KEY>`), không ở đây:
 * nơi nào hiện ra màn hình thì tra theo `key` để đổi được theo ngôn ngữ. File
 * này chỉ giữ phần LUẬT — mã bộ phận, biểu tượng và cách đoán từ mô tả.
 */
export type Department = {
  key: string;
  icon: string;
};

type DepartmentRule = Department & { re: RegExp };

const RULES: readonly DepartmentRule[] = [
  { key: "DECK", icon: "🛳", re: /boong|deck/i },
  {
    key: "ENGINE",
    icon: "⚙️",
    // Kèm tên thiết bị buồng máy hay gặp trong file kiểm kê thật: bơm, máy nén,
    // máy phân ly, nồi hơi, xử lý nước dằn/nước thải, tuabin, xuồng cứu sinh...
    re: /máy|may chinh|engine|\beng\b|-eng|compressor|separator|purifier|boiler|\bpump\b|ballast|bwms|sewage|turbine|turbo|cooler|incinerator|lifeboat|generator|\btank\b/i,
  },
  {
    key: "ELEC",
    icon: "⚡",
    // Kèm đèn/light/lamp: đèn hàng hải là thiết bị điện, nhưng nhóm của nó
    // ("Hệ thống đèn hàng hải") không chứa chữ "điện" nên trước đây bị xếp nhầm.
    re: /điện|dien|elec|đèn|light|lamp|battery|ắc quy|ac quy/i,
  },
  {
    key: "SERVICE",
    icon: "🧺",
    re: /tiêu hao|tieu hao|phục vụ|phuc vu|service|steward|consum|store|catering|galley|bếp|bep/i,
  },
  {
    key: "SAFETY",
    icon: "🦺",
    re: /an toàn|an toan|safety|bảo hộ|bao ho/i,
  },
] as const;

export const OTHER_DEPARTMENT: Department = {
  key: "OTHER",
  icon: "📦",
};

/** Danh sách bộ phận theo đúng thứ tự hiển thị, có mục "Khác" ở cuối. */
export const DEPARTMENTS: readonly Department[] = [
  ...RULES.map(({ key, icon }) => ({ key, icon })),
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
  materialType: string,
  /**
   * Bộ phận đã ghi sẵn ở cột `Material.department` (D · E · L · C).
   *
   * Có thì DÙNG LUÔN, không đoán lại. Cột đó do người vận hành gán và chính nó
   * quyết định mã của món hàng (`L-IMPA-0003`); đoán lại bằng từ khóa thì một
   * dòng có mã bộ phận Điện vẫn có thể bị xếp xuống nhóm Máy trên màn hình —
   * mã nói một đằng, chỗ hiển thị nói một nẻo.
   */
  boPhanDaGan?: string | null
): string {
  const daGan = (boPhanDaGan ?? "").trim().toUpperCase();
  if (daGan && THEO_MA_BO_PHAN[daGan]) return THEO_MA_BO_PHAN[daGan];
  const key = departmentOf(sources);
  if (key === OTHER_DEPARTMENT.key && materialType === "SPARE") {
    return "ENGINE";
  }
  return key;
}

/** Chữ cái bộ phận trong mã vật tư → nhóm hiển thị của giao diện. */
const THEO_MA_BO_PHAN: Record<string, string> = {
  D: "DECK",
  E: "ENGINE",
  L: "ELEC",
  C: "SERVICE",
};

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
  return THIET_BI_CHUA_RO;
}

/**
 * Giá trị thay chỗ khi phụ tùng không nói được nó lắp ở đâu.
 *
 * Là một GIÁ TRỊ chứ không phải null: nhóm "chưa rõ thiết bị" vẫn phải gom
 * được thành một cụm và xếp thứ tự như mọi thiết bị khác. Nhưng nó là thứ
 * duy nhất ở đây lọt ra màn hình, nên nơi hiển thị phải so với hằng số này
 * rồi thay bằng chữ trong từ điển (`materials.chuaRoThietBi`) — tên thiết bị
 * thật thì giữ nguyên vì đó là dữ liệu người dùng nhập.
 */
export const THIET_BI_CHUA_RO = "Chưa rõ thiết bị";

// Một bộ đối chiếu dùng chung. `String.localeCompare(x, "vi")` dựng một
// Intl.Collator MỚI cho mỗi lần gọi — đặt trong hàm so sánh thì với 600 dòng
// là hơn 10.000 lần dựng, đủ làm trang chậm thêm vài giây.
const viCollator = new Intl.Collator("vi");

/**
 * Thiết bị được đưa lên đầu danh sách phụ tùng, không xếp theo vần.
 *
 * Máy chính đứng đầu vì đó là thiết bị hay phải tra nhất: dừng máy chính là
 * dừng con tàu, nên khi mở danh mục ra người ta tìm phụ tùng máy chính trước.
 * Xếp theo vần thì nó nằm lẫn giữa "Air Compressor" và "Oil Separator", phải
 * cuộn qua mấy chục dòng mới tới.
 *
 * Thêm thiết bị khác vào đây là thêm một dòng — thứ tự trong mảng chính là thứ
 * tự hiển thị.
 */
const THIET_BI_UU_TIEN: readonly RegExp[] = [
  /máy chính|may chinh|main engine/i,
  // Máy đèn đứng ngay sau máy chính: mất máy đèn là mất điện toàn tàu, nên đây
  // là thiết bị thứ hai người ta tra tới.
  /máy đèn|may den|máy phụ|may phu|aux\.? ?engine|auxiliary engine/i,
];

/** Bậc ưu tiên của một thiết bị: càng nhỏ càng lên trên. */
function uuTienThietBi(equip: string): number {
  const i = THIET_BI_UU_TIEN.findIndex((re) => re.test(equip));
  return i < 0 ? THIET_BI_UU_TIEN.length : i;
}

/**
 * Sắp xếp vật tư trong một bộ phận:
 * Vật tư (Store) đứng trước → Phụ tùng (Spare) xếp sau theo từng thiết bị, máy
 * chính lên đầu rồi mới tới các thiết bị khác theo vần → trong mỗi thiết bị sắp
 * theo tên.
 *
 * Tính sẵn khóa sắp xếp một lần cho mỗi dòng thay vì tính lại trong hàm so
 * sánh — hàm so sánh chạy O(n log n) lần nên mọi việc nặng đặt trong đó đều bị
 * nhân lên hàng nghìn lần.
 */
export function sortWithinDepartment<T>(
  rows: T[],
  pick: (row: T) => MaterialLike
): T[] {
  return rows
    .map((row) => {
      const m = pick(row);
      const equip = equipmentOf(m) ?? "";
      return {
        row,
        spare: m.materialType === "SPARE" ? 1 : 0,
        uuTien: uuTienThietBi(equip),
        equip,
        name: m.nameVn,
      };
    })
    .sort(
      (a, b) =>
        a.spare - b.spare ||
        a.uuTien - b.uuTien ||
        viCollator.compare(a.equip, b.equip) ||
        viCollator.compare(a.name, b.name)
    )
    .map((x) => x.row);
}
