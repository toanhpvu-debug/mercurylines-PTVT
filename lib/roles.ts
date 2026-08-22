// Vai trò và phân cấp phê duyệt.
//
// Không đặt trong lib/auth.ts vì file đó là "server-only" (đọc session, gọi
// database), còn các hằng số và hàm thuần ở đây cần dùng được cả ở component
// phía trình duyệt.
//
// Phân cấp trên tàu theo đúng cơ cấu thật:
//
//   Sĩ quan / thuyền viên (CREW)
//        │ lập yêu cầu rồi trình lên
//        ▼
//   Máy trưởng (bộ phận Máy/Điện)  ·  Thuyền trưởng (mọi bộ phận)
//        │ duyệt cấp tàu
//        ▼
//   Quản lý kỹ thuật công ty (TECH_MANAGER)
//        │ duyệt cấp công ty
//        ▼
//   Mua sắm
//
// Thuyền trưởng duyệt được cả yêu cầu buồng máy vì trên tàu thuyền trưởng là
// người chịu trách nhiệm cao nhất; ngược lại máy trưởng KHÔNG duyệt yêu cầu
// boong. Nếu chỉ cho đúng một người duyệt mỗi bộ phận thì máy trưởng đi bờ là
// yêu cầu buồng máy nằm kẹt.

export const ROLES = [
  "ADMIN",
  "TECH_MANAGER",
  "MASTER",
  "CHIEF_OFFICER",
  "SECOND_OFFICER",
  "THIRD_OFFICER",
  "CHIEF_ENGINEER",
  "SECOND_ENGINEER",
  "THIRD_ENGINEER",
  "FOURTH_ENGINEER",
  "CREW",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Quản trị hệ thống",
  TECH_MANAGER: "Quản lý kỹ thuật (công ty)",
  MASTER: "Thuyền trưởng",
  CHIEF_OFFICER: "Đại phó",
  SECOND_OFFICER: "Phó 2",
  THIRD_OFFICER: "Phó 3",
  CHIEF_ENGINEER: "Máy trưởng",
  SECOND_ENGINEER: "Máy 2",
  THIRD_ENGINEER: "Máy 3",
  FOURTH_ENGINEER: "Máy 4",
  CREW: "Thuyền viên",
};

/** Chức danh tiếng Anh — in lên biểu mẫu song ngữ MLS-11-05. */
export const ROLE_LABEL_EN: Record<string, string> = {
  MASTER: "Master",
  CHIEF_OFFICER: "Chief Officer",
  SECOND_OFFICER: "2nd Officer",
  THIRD_OFFICER: "3rd Officer",
  CHIEF_ENGINEER: "Chief Engineer",
  SECOND_ENGINEER: "2nd Engineer",
  THIRD_ENGINEER: "3rd Engineer",
  FOURTH_ENGINEER: "4th Engineer",
  CREW: "Crew",
  TECH_MANAGER: "Technical Manager",
  ADMIN: "Administrator",
};

export const ROLE_DESC: Record<string, string> = {
  ADMIN: "Toàn quyền trên toàn đội tàu, kể cả quản lý tài khoản.",
  TECH_MANAGER:
    "Văn phòng: duyệt cấp công ty các yêu cầu tàu đã duyệt, xem toàn đội.",
  MASTER: "Trên tàu: duyệt cấp tàu MỌI bộ phận, nhập xuất kho, danh mục tàu.",
  CHIEF_ENGINEER:
    "Trên tàu: duyệt cấp tàu bộ phận Máy/Điện, nhập xuất kho, danh mục tàu.",
  CHIEF_OFFICER:
    "Sĩ quan boong: lập và trình yêu cầu vật tư; quản lý sơn của tàu (nhập/xuất sơn, sơ đồ sơn, nhật ký thi công) và gửi yêu cầu cấp sơn. Không duyệt.",
  SECOND_OFFICER: "Sĩ quan boong: lập và trình yêu cầu vật tư. Không duyệt.",
  THIRD_OFFICER: "Sĩ quan boong: lập và trình yêu cầu vật tư. Không duyệt.",
  SECOND_ENGINEER: "Sĩ quan máy: lập và trình yêu cầu vật tư. Không duyệt.",
  THIRD_ENGINEER: "Sĩ quan máy: lập và trình yêu cầu vật tư. Không duyệt.",
  FOURTH_ENGINEER: "Sĩ quan máy: lập và trình yêu cầu vật tư. Không duyệt.",
  CREW: "Lập và trình yêu cầu vật tư của tàu mình. Không duyệt.",
};

/**
 * Sĩ quan dưới quyền thuyền trưởng / máy trưởng.
 *
 * Chức danh khác nhau nhưng QUYỀN giống hệt nhau: lập và trình yêu cầu, không
 * duyệt. Tách chức danh ra khỏi quyền như vậy để biểu mẫu và nhật ký ghi đúng
 * "Máy 2 Nguyễn Văn A" thay vì "CREW", mà không làm ma trận phân quyền nở ra
 * theo số chức danh.
 */
export const SI_QUAN: readonly string[] = [
  "CHIEF_OFFICER",
  "SECOND_OFFICER",
  "THIRD_OFFICER",
  "SECOND_ENGINEER",
  "THIRD_ENGINEER",
  "FOURTH_ENGINEER",
  "CREW",
];

/** Thứ tự hiển thị trong ô chọn chức danh — theo cấp bậc thật trên tàu. */
export const NHOM_CHUC_DANH: { nhom: string; vaiTro: string[] }[] = [
  { nhom: "Boong", vaiTro: ["MASTER", "CHIEF_OFFICER", "SECOND_OFFICER", "THIRD_OFFICER"] },
  {
    nhom: "Máy",
    vaiTro: [
      "CHIEF_ENGINEER",
      "SECOND_ENGINEER",
      "THIRD_ENGINEER",
      "FOURTH_ENGINEER",
    ],
  },
  { nhom: "Khác trên tàu", vaiTro: ["CREW"] },
  { nhom: "Văn phòng", vaiTro: ["TECH_MANAGER", "ADMIN"] },
];

/**
 * Bộ phận mặc định của một chức danh — dùng để chọn sẵn bộ phận khi sĩ quan
 * lập yêu cầu, đỡ phải chọn tay và đỡ chọn nhầm (chọn nhầm là yêu cầu đi lạc
 * sang người duyệt khác).
 */
export function boPhanCuaChucDanh(role: string): string | null {
  if (["CHIEF_ENGINEER", "SECOND_ENGINEER", "THIRD_ENGINEER", "FOURTH_ENGINEER"].includes(role)) {
    return "ENGINE";
  }
  if (["MASTER", "CHIEF_OFFICER", "SECOND_OFFICER", "THIRD_OFFICER"].includes(role)) {
    return "DECK";
  }
  return null;
}

/** Chỉ huy trên tàu — duyệt bước cấp tàu. */
export const CHI_HUY_TAU: readonly string[] = ["MASTER", "CHIEF_ENGINEER"];

/** Duyệt bước cấp công ty. */
export const DUYET_CONG_TY: readonly string[] = ["ADMIN", "TECH_MANAGER"];

/** Vận hành trên tàu: nhập xuất kho, gán vật tư vào danh mục tàu. */
export const VAN_HANH_TAU: readonly string[] = [
  "ADMIN",
  "MASTER",
  "CHIEF_ENGINEER",
];

/**
 * Ai vận hành module Sơn của một tàu: nhập/xuất sơn, khu vực, sơ đồ sơn, nhật
 * ký thi công, và lập yêu cầu cấp sơn gửi lên.
 *
 * Có ĐẠI PHÓ vì trên tàu, sơn và bảo quản vỏ là việc của bộ phận boong mà đại
 * phó là trưởng bộ phận — kho sơn nằm dưới quyền đại phó. Máy trưởng vẫn giữ
 * vì phần sơn buồng máy thuộc bộ phận máy.
 *
 * Đây là quyền RIÊNG cho phần sơn, không dùng canManageVesselCatalog: quyền đó
 * dành cho danh mục vật tư của tàu, cho đại phó quyền đó là mở rộng ngoài ý
 * muốn sang một nghiệp vụ khác.
 */
export const VAN_HANH_SON: readonly string[] = [
  "ADMIN",
  "MASTER",
  "CHIEF_OFFICER",
  "CHIEF_ENGINEER",
];

/**
 * Ai vận hành phần Dầu · Dầu nhờn · Hóa chất của một tàu.
 *
 * Dầu đốt và dầu nhờn là việc của BUỒNG MÁY — máy trưởng chịu trách nhiệm nhận
 * bunker, ghi tiêu thụ và giữ mẫu theo MARPOL. Đại phó không đụng vào.
 *
 * Hóa chất thì cả hai bộ phận cùng dùng: máy trưởng lo hóa chất nồi hơi, nước
 * làm mát, xử lý dầu; đại phó lo hóa chất tẩy rửa, vệ sinh hầm hàng. Vì vậy
 * quyền của hóa chất rộng hơn một bậc.
 */
export const VAN_HANH_NHIEN_LIEU: readonly string[] = [
  "ADMIN",
  "MASTER",
  "CHIEF_ENGINEER",
];

export const VAN_HANH_HOA_CHAT: readonly string[] = [
  "ADMIN",
  "MASTER",
  "CHIEF_ENGINEER",
  "CHIEF_OFFICER",
];

/** Ai được lập và trình yêu cầu vật tư. */
export const LAP_YEU_CAU: readonly string[] = [
  "ADMIN",
  "MASTER",
  "CHIEF_ENGINEER",
  ...SI_QUAN,
];

/** Bộ phận thuộc quyền máy trưởng. */
const BO_PHAN_CUA_MAY_TRUONG = ["ENGINE", "ELECTRICAL", "ELEC"];

/**
 * Ai là người chịu trách nhiệm duyệt cấp tàu cho một bộ phận — dùng để hiển thị
 * "đang chờ ai", không phải để chặn quyền (xem coDuyetCapTau).
 */
export function nguoiDuyetCapTau(department: string): string {
  return BO_PHAN_CUA_MAY_TRUONG.includes((department || "").toUpperCase())
    ? "CHIEF_ENGINEER"
    : "MASTER";
}

/** Người này có được duyệt cấp TÀU cho yêu cầu thuộc bộ phận này không. */
export function coDuyetCapTau(role: string, department: string): boolean {
  if (role === "ADMIN" || role === "MASTER") return true;
  if (role === "CHIEF_ENGINEER") {
    return BO_PHAN_CUA_MAY_TRUONG.includes((department || "").toUpperCase());
  }
  return false;
}

/** Người này có được duyệt cấp CÔNG TY không. */
export function coDuyetCongTy(role: string): boolean {
  return DUYET_CONG_TY.includes(role);
}

/**
 * Lý do bị từ chối quyền duyệt cấp tàu, để báo cho đúng chỗ thay vì
 * "Bạn không có quyền" chung chung.
 */
export function viSaoKhongDuyetDuoc(role: string): string {
  if (SI_QUAN.includes(role)) {
    return "Yêu cầu phải do thuyền trưởng hoặc máy trưởng duyệt.";
  }
  if (role === "CHIEF_ENGINEER") {
    return "Máy trưởng chỉ duyệt yêu cầu bộ phận Máy/Điện. Yêu cầu này thuộc bộ phận khác nên thuyền trưởng duyệt.";
  }
  if (role === "TECH_MANAGER") {
    return "Quản lý kỹ thuật duyệt ở bước công ty, sau khi tàu đã duyệt.";
  }
  return "Bạn không có quyền thực hiện thao tác này.";
}

export type VesselScope = {
  all: boolean;
  vesselId: number | null;
  unassigned: boolean;
};

// Quy tắc phạm vi:
//   ADMIN, TECH_MANAGER  -> toàn đội (vai trò văn phòng)
//   có gán tàu           -> chỉ tàu đó
//   MASTER không gán tàu -> toàn đội (giữ nguyên cách dùng cũ: thuyền trưởng
//                           không gán tàu vẫn đang được dùng như tài khoản văn phòng)
//   còn lại không gán tàu -> không thấy tàu nào
//
// CHIEF_ENGINEER không có ngoại lệ "không gán tàu thì toàn đội": máy trưởng là
// chức danh trên MỘT con tàu, cho thấy toàn đội là mở rộng quyền ngoài ý muốn.
export function vesselScope(user: {
  role: string;
  vesselId: number | null;
}): VesselScope {
  if (user.role === "ADMIN" || user.role === "TECH_MANAGER") {
    return { all: true, vesselId: null, unassigned: false };
  }
  if (user.vesselId) {
    return { all: false, vesselId: user.vesselId, unassigned: false };
  }
  if (user.role === "MASTER") {
    return { all: true, vesselId: null, unassigned: false };
  }
  return { all: false, vesselId: null, unassigned: true };
}

// Ai được chỉnh danh mục vật tư của một tàu (gán/gỡ vật tư):
// ADMIN mọi tàu; thuyền trưởng / máy trưởng tàu mình; CREW không.
export function canManageVesselCatalog(
  user: { role: string; vesselId: number | null },
  vesselId: number
) {
  if (user.role === "ADMIN") return true;
  if (CHI_HUY_TAU.includes(user.role)) {
    const scope = vesselScope(user);
    return scope.all || scope.vesselId === vesselId;
  }
  return false;
}

/**
 * Người này có được vận hành phần Sơn của tàu này không.
 *
 * Cùng khuôn với canManageVesselCatalog: đúng vai trò VÀ đúng tàu. Người bị
 * giới hạn tàu không đụng được sang tàu khác kể cả gõ thẳng URL.
 */
export function coQuanLySon(
  user: { role: string; vesselId: number | null },
  vesselId: number
) {
  if (!VAN_HANH_SON.includes(user.role)) return false;
  const scope = vesselScope(user);
  return scope.all || scope.vesselId === vesselId;
}

/**
 * Người này có được thao tác nhóm dầu/hóa chất này trên tàu này không.
 *
 * Truyền category = null khi chỉ cần biết "có vào được module không" (mở trang,
 * xem tồn); truyền cụ thể khi sắp ghi một giao dịch của nhóm đó.
 */
export function coQuanLyNhienLieu(
  user: { role: string; vesselId: number | null },
  vesselId: number,
  category?: string | null
) {
  const nhom =
    category === "CHEMICAL"
      ? VAN_HANH_HOA_CHAT
      : category
        ? VAN_HANH_NHIEN_LIEU
        : VAN_HANH_HOA_CHAT; // không nêu nhóm: hỏi quyền rộng nhất
  if (!nhom.includes(user.role)) return false;
  const scope = vesselScope(user);
  return scope.all || scope.vesselId === vesselId;
}

/** Các nhóm mà người này được ghi giao dịch trên tàu đã cho. */
export function nhomNhienLieuChoPhep(
  user: { role: string; vesselId: number | null },
  vesselId: number
): string[] {
  const ra: string[] = [];
  for (const c of ["FUEL", "LUBE", "CHEMICAL"]) {
    if (coQuanLyNhienLieu(user, vesselId, c)) ra.push(c);
  }
  return ra;
}

/**
 * Người này có được duyệt yêu cầu ở trạng thái hiện tại của nó không, xét cả
 * phạm vi tàu. Trả về cấp duyệt để nơi gọi biết đang ở bước nào.
 *
 * Gộp vào một chỗ vì cùng một câu hỏi được hỏi ở ba nơi (server action, trang
 * chi tiết, trang danh sách); tách ra là sớm muộn cũng lệch nhau.
 */
export function capDuyetChoPhep(
  user: { role: string; vesselId: number | null },
  request: { vesselId: number; status: string; department: string }
): "TAU" | "CONG_TY" | null {
  const scope = vesselScope(user);
  if (request.status === "PENDING_MASTER") {
    if (!scope.all && request.vesselId !== scope.vesselId) return null;
    return coDuyetCapTau(user.role, request.department) ? "TAU" : null;
  }
  if (request.status === "PENDING_OFFICE") {
    return coDuyetCongTy(user.role) ? "CONG_TY" : null;
  }
  return null;
}
