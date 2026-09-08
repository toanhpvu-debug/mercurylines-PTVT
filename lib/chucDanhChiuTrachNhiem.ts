import { departmentOfMaterial } from "@/lib/departments";
import type { BoPhan } from "@/lib/maVatTu";

/**
 * Ai chịu trách nhiệm GIỮ và KIỂM KÊ một mặt hàng — trả về CHỨC DANH, không
 * phải một con người cụ thể.
 *
 * Trong danh mục gốc (dùng chung toàn đội) không có "một người" nào cả: cùng
 * một loại phụ tùng thì trên tàu này do Máy 2 giữ, tàu kia cũng Máy 2 — nên câu
 * trả lời đúng là chức danh, còn tên người thì tùy tài khoản của từng tàu. Cột
 * "Giữ bởi" vì vậy hiện chức danh.
 *
 * Ba nguồn, theo đúng thứ tự tin cậy:
 *
 *   1. "gan"      — cột responsibleRank đã được gán tay (gan-ma-vat-tu.cmd).
 *                   Tôn trọng tuyệt đối: người vận hành biết rõ hơn mọi suy đoán.
 *   2. "thiet-bi" — suy theo NHÓM THIẾT BỊ (mã Category) với phụ tùng máy, nơi
 *                   trách nhiệm chia theo sĩ quan phụ trách từng cụm máy: máy
 *                   chính do Máy 2, máy phụ do Máy 3, phân ly do Máy 4...
 *   3. "bo-phan"  — không nhận ra thiết bị thì lùi về NGƯỜI GIỮ KHO của bộ phận
 *                   (suy từ nhóm vật tư y như phần gom nhóm ở trang danh mục).
 *
 * Nhờ ba tầng này, MỌI mặt hàng đều có một chức danh chịu trách nhiệm hiển thị
 * được ngay, kể cả khi cột responsibleRank còn trống — mà vẫn tự động dùng dữ
 * liệu đã gán khi có.
 */

// Nhóm hiển thị mà departmentOfMaterial trả về → chữ cái bộ phận.
// Trùng khớp KEY_BO_PHAN (trang danh mục) và BO_PHAN_THEO_NHOM (nhập file).
const KEY_BO_PHAN: Record<string, BoPhan> = {
  DECK: "D",
  SAFETY: "D",
  OTHER: "D",
  ENGINE: "E",
  ELEC: "L",
  SERVICE: "C",
};

/**
 * Người GIỮ KHO mặc định của mỗi bộ phận — người trực tiếp giữ và kiểm kê, chứ
 * không phải trưởng bộ phận. Khớp với gan-ma-vat-tu.ts (THEO_NHOM):
 *   Boong  → Thủy thủ trưởng   Điện → Thợ điện
 *   Máy    → Máy trưởng        Phục vụ → Bếp trưởng
 * Máy để Máy trưởng vì đây là mức "kho máy nói chung"; phụ tùng theo cụm máy cụ
 * thể đã được bảng THEO_CATEGORY bên dưới bắt trước, mịn hơn.
 */
const GIU_KHO_BO_PHAN: Record<BoPhan, string> = {
  D: "BSN",
  E: "CE",
  L: "ELC",
  C: "CCK",
};

/**
 * Nhóm thiết bị cụ thể (mã Category) → sĩ quan phụ trách. Lấy đúng các giá trị
 * chức danh trong gan-ma-vat-tu.ts để hai nơi không nói khác nhau về cùng một
 * cụm máy. Chỉ liệt kê phụ tùng máy — nơi trách nhiệm thật sự chia theo sĩ quan.
 */
const THEO_CATEGORY: Record<string, string> = {
  "CAT-main-engine": "2E",
  "CAT-main-engine-6uec35lse-c1": "2E",
  "CAT-turbine": "2E",
  "CAT-aux-engine": "3E",
  "CAT-air-compressor": "3E",
  "CAT-main-air-compressor": "3E",
  "CAT-bwms": "3E",
  "CAT-ballast-w-m-system": "3E",
  "CAT-oil-separator": "4E",
  "CAT-sewage-treatment": "4E",
  "CAT-main-l-o-pump": "4E",
  "CAT-water-tank": "4E",
  "CAT-engine-stores": "CE",
  "CAT-engine-store": "CE",
};

export type NguonChucDanh = "gan" | "thiet-bi" | "bo-phan";

export type MonChiuTrachNhiem = {
  responsibleRank?: string | null;
  categoryCode?: string | null;
  categoryName?: string | null;
  department?: string | null;
  equipment?: string | null;
  code?: string | null;
  materialType: string;
};

/**
 * Chức danh chịu trách nhiệm của một mặt hàng, kèm NGUỒN suy ra (để giao diện
 * phân biệt "đã gán" với "suy tạm"). Trả null chỉ khi không xếp nổi vào bộ phận
 * nào — trên thực tế gần như không xảy ra vì departmentOfMaterial luôn có mục
 * "Khác" → boong.
 */
export function chucDanhChiuTrachNhiem(
  m: MonChiuTrachNhiem
): { chucDanh: string; nguon: NguonChucDanh } | null {
  const daGan = (m.responsibleRank ?? "").trim();
  if (daGan) return { chucDanh: daGan, nguon: "gan" };

  const cat = (m.categoryCode ?? "").trim();
  if (cat && THEO_CATEGORY[cat]) {
    return { chucDanh: THEO_CATEGORY[cat], nguon: "thiet-bi" };
  }

  const key = departmentOfMaterial(
    [m.categoryName, m.equipment, m.code],
    m.materialType,
    m.department
  );
  const bp = KEY_BO_PHAN[key];
  return bp ? { chucDanh: GIU_KHO_BO_PHAN[bp], nguon: "bo-phan" } : null;
}

/**
 * Chỉ huy chịu trách nhiệm CẢ phần cấp dưới giữ; cấp dưới chỉ giữ phần mình.
 * Khi lọc theo một chức danh, "bao trùm" thêm những người giữ kho dưới quyền.
 * Cấp giữ kho (Máy 2/3/4, thủy thủ trưởng, thợ điện, bếp trưởng) không có mặt ở
 * đây nên chỉ khớp đúng phần của chính họ.
 */
const BAO_TRUM: Record<string, readonly string[]> = {
  MST: ["BSN", "CCK", "CE", "ELC", "2E", "3E", "4E"], // thuyền trưởng: toàn tàu
  CO: ["BSN"], // đại phó: kho boong (thủy thủ trưởng giữ)
  CE: ["2E", "3E", "4E"], // máy trưởng: cả buồng máy
  ETO: ["ELC"], // sĩ quan điện: kho điện
};

/**
 * Chức danh `rankFilter` có phụ trách mặt hàng này không — dùng cho ô lọc "chọn
 * chức danh" ở trang danh mục, để danh sách khớp đúng cột "Giữ bởi".
 *
 * Cấp giữ kho chọn ra ĐÚNG phần mình giữ (Máy 3 → đúng phần Máy 3), cấp chỉ huy
 * chọn ra thêm phần cấp dưới (Máy trưởng → cả buồng máy). Nhờ vế thứ hai, nút
 * "Xem vật tư tôi quản lý" của thuyền trưởng / đại phó / máy trưởng vẫn ra danh
 * sách thay vì trống trơn.
 */
export function laNguoiPhuTrach(
  rankFilter: string,
  m: MonChiuTrachNhiem
): boolean {
  const tn = chucDanhChiuTrachNhiem(m);
  if (!tn) return false;
  if (tn.chucDanh === rankFilter) return true;
  return (BAO_TRUM[rankFilter] ?? []).includes(tn.chucDanh);
}
