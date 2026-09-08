import { tuDien } from "./_kieu";

/**
 * Nhãn dùng chung toàn app cho các MÃ trong database: vai trò, trạng thái yêu
 * cầu / đơn mua, bộ phận, loại hàng, loại giao dịch.
 *
 * Khóa = `<nhóm>_<MÃ>` để tra bằng khóa động: tTuDo(`labels.reqStatus_${status}`).
 * Bảng tiếng Việt khớp ROLE_LABEL / REQUEST_STATUS_LABEL / DEPARTMENTS đang có;
 * bảng tiếng Anh khớp ROLE_LABEL_EN (in trên biểu mẫu MLS-11-05).
 */
export const labels = tuDien(
  {
    role_ADMIN: "Quản trị hệ thống",
    role_TECH_MANAGER: "Quản lý kỹ thuật (công ty)",
    role_MASTER: "Thuyền trưởng",
    role_CHIEF_OFFICER: "Đại phó",
    role_SECOND_OFFICER: "Phó 2",
    role_THIRD_OFFICER: "Phó 3",
    role_CHIEF_ENGINEER: "Máy trưởng",
    role_SECOND_ENGINEER: "Máy 2",
    role_THIRD_ENGINEER: "Máy 3",
    role_FOURTH_ENGINEER: "Máy 4",
    role_CREW: "Thuyền viên",

    reqStatus_DRAFT: "Nháp",
    reqStatus_PENDING_MASTER: "Chờ tàu duyệt",
    reqStatus_PENDING_OFFICE: "Chờ công ty duyệt",
    reqStatus_APPROVED: "Đã duyệt",
    reqStatus_REJECTED: "Từ chối",
    reqStatus_IN_PROCUREMENT: "Đang mua sắm",
    reqStatus_PARTIALLY_DELIVERED: "Giao một phần",
    reqStatus_FULLY_DELIVERED: "Giao đủ",
    reqStatus_CLOSED: "Hoàn tất",
    reqStatus_CANCELLED: "Đã hủy",

    poStatus_DRAFT: "Nháp",
    poStatus_SENT: "Đã gửi NCC",
    poStatus_CONFIRMED: "NCC xác nhận",
    poStatus_PARTIALLY_RECEIVED: "Nhận một phần",
    poStatus_RECEIVED: "Đã nhận đủ",
    poStatus_CLOSED: "Hoàn tất",
    poStatus_CANCELLED: "Đã hủy",

    dept_DECK: "Boong (Deck)",
    dept_ENGINE: "Máy (Engine)",
    dept_ELEC: "Điện (Electric)",
    dept_SERVICE: "Phục vụ / Tiêu hao (Service)",
    dept_SAFETY: "An toàn (Safety)",
    dept_OTHER: "Khác",

    /** Bộ phận của YÊU CẦU vật tư (MaterialRequest.department). */
    reqDept_DECK: "Boong",
    reqDept_ENGINE: "Máy",
    reqDept_ELECTRICAL: "Điện",
    reqDept_GENERAL: "Chung",

    type_STORE: "Vật tư",
    type_SPARE: "Phụ tùng",
    typeLong_STORE: "Vật tư (Store)",
    typeLong_SPARE: "Phụ tùng (Spare)",

    tx_IN: "Nhập",
    tx_OUT: "Xuất",

    active_true: "Đang dùng",
    active_false: "Ngừng dùng",
    critical_true: "Critical",
    critical_false: "Normal",

    vesselStatus_ACTIVE: "Đang khai thác",
    vesselStatus_INACTIVE: "Ngừng khai thác",

    priority_LOW: "Thấp",
    priority_NORMAL: "Bình thường",
    priority_HIGH: "Cao",
    priority_URGENT: "Khẩn",
  },
  {
    role_ADMIN: "Administrator",
    role_TECH_MANAGER: "Technical Manager (office)",
    role_MASTER: "Master",
    role_CHIEF_OFFICER: "Chief Officer",
    role_SECOND_OFFICER: "2nd Officer",
    role_THIRD_OFFICER: "3rd Officer",
    role_CHIEF_ENGINEER: "Chief Engineer",
    role_SECOND_ENGINEER: "2nd Engineer",
    role_THIRD_ENGINEER: "3rd Engineer",
    role_FOURTH_ENGINEER: "4th Engineer",
    role_CREW: "Crew",

    reqStatus_DRAFT: "Draft",
    reqStatus_PENDING_MASTER: "Awaiting vessel approval",
    reqStatus_PENDING_OFFICE: "Awaiting office approval",
    reqStatus_APPROVED: "Approved",
    reqStatus_REJECTED: "Rejected",
    reqStatus_IN_PROCUREMENT: "In procurement",
    reqStatus_PARTIALLY_DELIVERED: "Partially delivered",
    reqStatus_FULLY_DELIVERED: "Fully delivered",
    reqStatus_CLOSED: "Closed",
    reqStatus_CANCELLED: "Cancelled",

    poStatus_DRAFT: "Draft",
    poStatus_SENT: "Sent to supplier",
    poStatus_CONFIRMED: "Supplier confirmed",
    poStatus_PARTIALLY_RECEIVED: "Partially received",
    poStatus_RECEIVED: "Fully received",
    poStatus_CLOSED: "Closed",
    poStatus_CANCELLED: "Cancelled",

    dept_DECK: "Deck",
    dept_ENGINE: "Engine",
    dept_ELEC: "Electrical",
    dept_SERVICE: "Service / Consumables",
    dept_SAFETY: "Safety",
    dept_OTHER: "Other",

    reqDept_DECK: "Deck",
    reqDept_ENGINE: "Engine",
    reqDept_ELECTRICAL: "Electrical",
    reqDept_GENERAL: "General",

    type_STORE: "Stores",
    type_SPARE: "Spare parts",
    typeLong_STORE: "Stores",
    typeLong_SPARE: "Spare parts",

    tx_IN: "Receipt",
    tx_OUT: "Issue",

    active_true: "Active",
    active_false: "Inactive",
    critical_true: "Critical",
    critical_false: "Normal",

    vesselStatus_ACTIVE: "In service",
    vesselStatus_INACTIVE: "Out of service",

    priority_LOW: "Low",
    priority_NORMAL: "Normal",
    priority_HIGH: "High",
    priority_URGENT: "Urgent",
  }
);
