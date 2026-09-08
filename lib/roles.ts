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

/**
 * Ai quản DANH MỤC dầu · dầu nhờn · hóa chất dùng chung toàn đội (sửa, ngừng
 * dùng, xóa mặt hàng).
 *
 * Có máy trưởng: đây là danh mục nghiệp vụ của buồng máy, người nắm rõ mã dầu,
 * TBN, độ nhớt và hóa chất nào dùng cho nồi hơi chính là máy trưởng — chứ không
 * phải văn phòng. Khác với danh mục SƠN (vẫn thuộc thuyền trưởng/văn phòng) vì
 * sơn là việc boong.
 */
export const QUAN_DANH_MUC_NHIEN_LIEU: readonly string[] = [
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

/**
 * Ai được LẬP YÊU CẦU xin cấp dầu · dầu nhờn · hóa chất.
 *
 * RỘNG HƠN quyền ghi nghiệp vụ, và cố ý như vậy: sĩ quan máy trực ca là người
 * biết sắp hết cái gì, nên phải xin cấp được — nhưng không vì thế mà được ghi
 * phiếu bunker, sửa tồn hay đổi định mức. Gộp hai quyền làm một thì hoặc là
 * Máy 3 ghi được BDN, hoặc là Máy 3 không xin được dầu; cả hai đều sai.
 *
 * Yêu cầu của sĩ quan máy đi qua máy trưởng SƠ DUYỆT rồi mới lên công ty.
 */
export const XIN_CAP_NHIEN_LIEU: readonly string[] = [
  "ADMIN",
  "MASTER",
  "CHIEF_ENGINEER",
  "CHIEF_OFFICER",
  "SECOND_ENGINEER",
  "THIRD_ENGINEER",
  "FOURTH_ENGINEER",
];

/** Sĩ quan máy dưới quyền máy trưởng. */
export const SI_QUAN_MAY: readonly string[] = [
  "SECOND_ENGINEER",
  "THIRD_ENGINEER",
  "FOURTH_ENGINEER",
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
  /**
   * Danh sách tàu của tài khoản BỜ được phân công (FleetAssignment).
   * null nghĩa là không giới hạn theo danh sách — dùng `all` và `vesselId`.
   */
  vesselIds: number[] | null;
  unassigned: boolean;
};

/**
 * Hình dạng tối thiểu của "người đang thao tác" mà các hàm quyền cần biết.
 *
 * `fleetVesselIds` và `uyQuyen` do lib/auth.ts đọc từ database rồi gắn vào;
 * để tùy chọn nên mọi nơi gọi cũ (chỉ có role + vesselId) vẫn chạy nguyên.
 */
export type NguoiThaoTac = {
  id?: number;
  role: string;
  vesselId: number | null;
  fleetVesselIds?: number[] | null;
  uyQuyen?: UyQuyen[];
};

export type TrangThaiUyQuyen =
  | "DA_THU_HOI"
  | "HET_HAN"
  | "CHUA_TOI"
  | "HIEU_LUC";

/**
 * Trạng thái của một ủy quyền tại thời điểm `bayGio`.
 *
 * Nhận mốc thời gian làm tham số chứ không tự gọi Date.now(): hàm thuần thì
 * kiểm thử được, và React cũng không cho gọi hàm không thuần lúc dựng giao diện.
 */
export function trangThaiUyQuyen(
  uq: { startAt: Date; endAt: Date; revokedAt: Date | null },
  bayGio: Date
): TrangThaiUyQuyen {
  if (uq.revokedAt) return "DA_THU_HOI";
  if (uq.endAt.getTime() < bayGio.getTime()) return "HET_HAN";
  if (uq.startAt.getTime() > bayGio.getTime()) return "CHUA_TOI";
  return "HIEU_LUC";
}

/** Một ủy quyền CÒN HIỆU LỰC mà người này đang nhận. */
export type UyQuyen = {
  delegatorId: number;
  delegatorName: string;
  delegatorRole: string;
  delegatorVesselId: number | null;
  delegatorFleetVesselIds?: number[] | null;
};

/**
 * Các "danh tính" mà người này được dùng khi xét quyền: chính mình trước, rồi
 * tới quyền mượn từ người ủy quyền.
 *
 * Tách ra thành danh sách thay vì cộng dồn quyền: cộng dồn thì mất dấu ai là
 * người thật sự có thẩm quyền, mà chứng từ và nhật ký phải ghi được "ký thay
 * máy trưởng Nguyễn Văn A" chứ không phải "có quyền từ đâu đó".
 */
export function danhTinhHieuLuc(user: NguoiThaoTac): {
  id: number | undefined;
  role: string;
  vesselId: number | null;
  fleetVesselIds?: number[] | null;
  uyQuyenTu: UyQuyen | null;
}[] {
  const ra = [
    {
      id: user.id,
      role: user.role,
      vesselId: user.vesselId,
      fleetVesselIds: user.fleetVesselIds,
      uyQuyenTu: null as UyQuyen | null,
    },
  ];
  for (const u of user.uyQuyen ?? []) {
    // Vai trò mượn là ADMIN thì bỏ qua: vesselScope() trả {all:true} cho
    // ADMIN, nên một danh tính mượn như vậy sẽ xóa sạch bộ lọc tàu của
    // chính người dùng. Quyền quản trị không đem cho mượn được.
    if (u.delegatorRole === "ADMIN") continue;
    ra.push({
      id: user.id, // vẫn là con người đó, chỉ mượn thẩm quyền
      role: u.delegatorRole,
      vesselId: u.delegatorVesselId,
      fleetVesselIds: u.delegatorFleetVesselIds,
      uyQuyenTu: u,
    });
  }
  return ra;
}

/**
 * Người này có ĐƯỢC CHỌN giữa nhiều tàu không.
 *
 * Khác với `scope.all`: quản lý kỹ thuật được phân công 5 tàu thì không phải
 * toàn đội, nhưng vẫn cần ô chọn tàu. Trước đây giao diện hỏi thẳng
 * `scope.all` nên nhóm này rơi vào nhánh "chỉ có đúng một tàu" và không chọn
 * được tàu nào.
 */
export function chonDuocTau(scope: VesselScope): boolean {
  return scope.all || (scope.vesselIds?.length ?? 0) > 0;
}

/** Tàu này có nằm trong phạm vi được xem/được thao tác không. */
export function trongPhamVi(scope: VesselScope, vesselId: number): boolean {
  if (scope.all) return true;
  if (scope.vesselIds) return scope.vesselIds.includes(vesselId);
  return scope.vesselId === vesselId;
}

// Quy tắc phạm vi:
//   ADMIN, TECH_MANAGER  -> toàn đội (vai trò văn phòng)
//   có gán tàu           -> chỉ tàu đó
//   MASTER không gán tàu -> toàn đội (giữ nguyên cách dùng cũ: thuyền trưởng
//                           không gán tàu vẫn đang được dùng như tài khoản văn phòng)
//   còn lại không gán tàu -> không thấy tàu nào
//
// CHIEF_ENGINEER không có ngoại lệ "không gán tàu thì toàn đội": máy trưởng là
// chức danh trên MỘT con tàu, cho thấy toàn đội là mở rộng quyền ngoài ý muốn.
export function vesselScope(user: NguoiThaoTac): VesselScope {
  // Quản trị hệ thống luôn thấy toàn đội — có phân công tàu cũng không thu hẹp,
  // vì người sửa lỗi phải vào được mọi tàu.
  if (user.role === "ADMIN") {
    return { all: true, vesselId: null, vesselIds: null, unassigned: false };
  }
  // Tài khoản BỜ: có phân công tàu thì chỉ thấy đúng số tàu đó. KHÔNG phân
  // công dòng nào thì giữ nguyên toàn đội — nếu không, nâng cấp xong là mọi
  // quản lý kỹ thuật mất sạch quyền cho tới khi ai đó nhớ ra phải đi gán tàu.
  if (user.role === "TECH_MANAGER") {
    const ds = user.fleetVesselIds ?? [];
    return ds.length
      ? { all: false, vesselId: null, vesselIds: ds, unassigned: false }
      : { all: true, vesselId: null, vesselIds: null, unassigned: false };
  }
  if (user.vesselId) {
    return {
      all: false,
      vesselId: user.vesselId,
      vesselIds: null,
      unassigned: false,
    };
  }
  if (user.role === "MASTER") {
    return { all: true, vesselId: null, vesselIds: null, unassigned: false };
  }
  return { all: false, vesselId: null, vesselIds: null, unassigned: true };
}

/**
 * Phạm vi tàu RỘNG NHẤT mà người này có, kể cả quyền đang mượn từ ủy quyền.
 *
 * Dùng cho việc XEM (danh sách, bảng tổng hợp): người nhận ủy quyền của quản lý
 * kỹ thuật phải thấy được tàu của người kia thì mới xử lý thay được.
 */
export function vesselScopeDayDu(user: NguoiThaoTac): VesselScope {
  const ds = danhTinhHieuLuc(user).map((d) => vesselScope(d));
  if (ds.some((s) => s.all)) {
    return { all: true, vesselId: null, vesselIds: null, unassigned: false };
  }
  const ids = new Set<number>();
  for (const s of ds) {
    if (s.vesselIds) for (const i of s.vesselIds) ids.add(i);
    else if (s.vesselId) ids.add(s.vesselId);
  }
  if (!ids.size) {
    return { all: false, vesselId: null, vesselIds: null, unassigned: true };
  }
  const mang = [...ids];
  return mang.length === 1
    ? { all: false, vesselId: mang[0], vesselIds: null, unassigned: false }
    : { all: false, vesselId: null, vesselIds: mang, unassigned: false };
}

// Ai được chỉnh danh mục vật tư của một tàu (gán/gỡ vật tư):
// ADMIN mọi tàu; thuyền trưởng / máy trưởng tàu mình; CREW không.
export function canManageVesselCatalog(user: NguoiThaoTac, vesselId: number) {
  return danhTinhHieuLuc(user).some((d) => {
    if (d.role === "ADMIN") return true;
    if (!CHI_HUY_TAU.includes(d.role)) return false;
    return trongPhamVi(vesselScope(d), vesselId);
  });
}

/**
 * Người này có được vận hành phần Sơn của tàu này không.
 *
 * Cùng khuôn với canManageVesselCatalog: đúng vai trò VÀ đúng tàu. Người bị
 * giới hạn tàu không đụng được sang tàu khác kể cả gõ thẳng URL.
 */
export function coQuanLySon(user: NguoiThaoTac, vesselId: number) {
  return danhTinhHieuLuc(user).some(
    (d) => VAN_HANH_SON.includes(d.role) && trongPhamVi(vesselScope(d), vesselId)
  );
}

/**
 * Người này có được thao tác nhóm dầu/hóa chất này trên tàu này không.
 *
 * Truyền category = null khi chỉ cần biết "có vào được module không" (mở trang,
 * xem tồn); truyền cụ thể khi sắp ghi một giao dịch của nhóm đó.
 */
export function coQuanLyNhienLieu(
  user: NguoiThaoTac,
  vesselId: number,
  category?: string | null
) {
  const nhom =
    category === "CHEMICAL"
      ? VAN_HANH_HOA_CHAT
      : category
        ? VAN_HANH_NHIEN_LIEU
        : VAN_HANH_HOA_CHAT; // không nêu nhóm: hỏi quyền rộng nhất
  return danhTinhHieuLuc(user).some(
    (d) => nhom.includes(d.role) && trongPhamVi(vesselScope(d), vesselId)
  );
}

/**
 * Người này có được XIN CẤP nhóm này trên tàu này không.
 *
 * Sĩ quan máy xin được cả ba nhóm — buồng máy dùng cả dầu đốt, dầu nhờn lẫn
 * hóa chất nồi hơi/nước làm mát. Đại phó chỉ hóa chất, đúng như quyền vận hành
 * của ông ấy.
 */
export function coXinCapNhienLieu(
  user: NguoiThaoTac,
  vesselId: number,
  category?: string | null
) {
  return danhTinhHieuLuc(user).some((d) => {
    if (!XIN_CAP_NHIEN_LIEU.includes(d.role)) return false;
    // Đại phó là người boong: chỉ xin được hóa chất.
    if (d.role === "CHIEF_OFFICER" && category && category !== "CHEMICAL") {
      return false;
    }
    return trongPhamVi(vesselScope(d), vesselId);
  });
}

/** Các nhóm mà người này được XIN CẤP trên tàu đã cho. */
export function nhomXinCapChoPhep(
  user: { role: string; vesselId: number | null },
  vesselId: number
): string[] {
  const ra: string[] = [];
  for (const c of ["FUEL", "LUBE", "CHEMICAL"]) {
    if (coXinCapNhienLieu(user, vesselId, c)) ra.push(c);
  }
  return ra;
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
  user: NguoiThaoTac,
  request: {
    vesselId: number;
    status: string;
    department: string;
    requestedById?: number | null;
  }
): "TAU" | "CONG_TY" | null {
  return capDuyetChiTiet(user, request).cap;
}

/**
 * Như capDuyetChoPhep nhưng nói thêm quyền đó đến từ đâu: của chính mình, hay
 * mượn của người đã ủy quyền. Nơi gọi cần biết để ghi đúng "ký thay ai" lên
 * chứng từ và vào nhật ký.
 */
export function capDuyetChiTiet(
  user: NguoiThaoTac,
  request: {
    vesselId: number;
    status: string;
    department: string;
    requestedById?: number | null;
  }
): { cap: "TAU" | "CONG_TY" | null; uyQuyenTu: UyQuyen | null } {
  for (const d of danhTinhHieuLuc(user)) {
    const cap = capDuyetMotDanhTinh(d, user, request);
    if (cap) return { cap, uyQuyenTu: d.uyQuyenTu };
  }
  return { cap: null, uyQuyenTu: null };
}

function capDuyetMotDanhTinh(
  danhTinh: {
    id: number | undefined;
    role: string;
    vesselId: number | null;
    fleetVesselIds?: number[] | null;
    uyQuyenTu: UyQuyen | null;
  },
  nguoiThat: NguoiThaoTac,
  request: {
    vesselId: number;
    status: string;
    department: string;
    requestedById?: number | null;
  }
): "TAU" | "CONG_TY" | null {
  const user = danhTinh;
  const scope = vesselScope(danhTinh);
  if (request.status === "PENDING_MASTER") {
    if (!trongPhamVi(scope, request.vesselId)) return null;
    // KHÔNG AI DUYỆT YÊU CẦU DO CHÍNH MÌNH LẬP.
    //
    // Máy trưởng quản toàn bộ dầu, dầu nhờn, hóa chất của tàu, nhưng khi chính
    // ông ấy xin cấp thì chữ ký duyệt phải là người khác — nếu không thì "duyệt"
    // chỉ là ký hai lần vào cùng một tờ giấy. Yêu cầu của máy trưởng do thuyền
    // trưởng duyệt ở cấp tàu; yêu cầu của Máy 2/3/4 thì máy trưởng duyệt.
    //
    // Yêu cầu do THUYỀN TRƯỞNG lập không rơi vào đây: nó được chuyển thẳng lên
    // công ty ngay lúc trình (xem app/actions.ts), vì trên tàu không còn ai
    // trên thuyền trưởng để ký.
    //
    // ỦY QUYỀN KHÔNG PHÁ ĐƯỢC QUY TẮC NÀY, theo cả hai chiều:
    //   - người nhận ủy quyền không duyệt yêu cầu do CHÍNH HỌ lập, dù đang
    //     mượn quyền của cấp trên;
    //   - và cũng không duyệt yêu cầu do NGƯỜI ỦY QUYỀN lập — mượn thẩm quyền
    //     của chính người đang xin cấp thì vẫn là tờ giấy tự ký, chỉ khác nét
    //     chữ. Trường hợp đó để thuyền trưởng hoặc công ty duyệt.
    if (
      request.requestedById != null &&
      (nguoiThat.id === request.requestedById ||
        danhTinh.uyQuyenTu?.delegatorId === request.requestedById)
    ) {
      return null;
    }
    return coDuyetCapTau(user.role, request.department) ? "TAU" : null;
  }
  if (request.status === "PENDING_OFFICE") {
    if (!coDuyetCongTy(user.role)) return null;
    // Quản lý kỹ thuật được phân công tàu thì chỉ duyệt tàu của mình.
    //
    // CỐ Ý không chặn "tự duyệt" ở bước công ty: yêu cầu do thuyền trưởng hay
    // quản trị lập đi THẲNG lên đây (xem trinhThangLenCongTy). Chặn nốt bước
    // này thì công ty chỉ có một người là yêu cầu nằm kẹt vĩnh viễn — đúng cái
    // bẫy mà bước cấp tàu đã phải mở lối đi vòng để tránh. Bước cấp tàu đã bảo
    // đảm có hai chữ ký khác nhau cho yêu cầu từ tàu.
    return trongPhamVi(scope, request.vesselId) ? "CONG_TY" : null;
  }
  return null;
}

/**
 * Yêu cầu do người này lập có được chuyển THẲNG lên công ty khi trình không.
 *
 * Đúng với thuyền trưởng và quản trị: trên tàu không còn ai trên thuyền trưởng
 * để ký cấp tàu. Không có lối này thì yêu cầu của thuyền trưởng nằm kẹt vĩnh
 * viễn ở "Chờ tàu duyệt" — chính ông ấy bị chặn tự duyệt, còn máy trưởng thì
 * không duyệt được yêu cầu boong.
 */
export function trinhThangLenCongTy(role: string): boolean {
  return role === "MASTER" || role === "ADMIN";
}
