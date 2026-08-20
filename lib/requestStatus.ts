// Trạng thái yêu cầu vật tư — hằng số dùng chung cho server action lẫn giao diện.
// KHÔNG để trong app/actions.ts vì file "use server" chỉ được export hàm async.

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING_MASTER: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  IN_PROCUREMENT: "Đang mua sắm",
  PARTIALLY_DELIVERED: "Giao một phần",
  FULLY_DELIVERED: "Giao đủ",
  CLOSED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

export const REQUEST_STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_MASTER: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-700",
  IN_PROCUREMENT: "bg-blue-100 text-blue-800",
  PARTIALLY_DELIVERED: "bg-indigo-100 text-indigo-800",
  FULLY_DELIVERED: "bg-teal-100 text-teal-800",
  CLOSED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-slate-200 text-slate-500",
};

// Chuyển trạng thái hợp lệ: đích -> các trạng thái nguồn được phép.
// Yêu cầu phải được TRÌNH (PENDING_MASTER) rồi mới duyệt được — nháp và
// đã trình là hai việc khác nhau về trách nhiệm.
export const REQUEST_ALLOWED_FROM: Record<string, string[]> = {
  PENDING_MASTER: ["DRAFT"],
  APPROVED: ["PENDING_MASTER"],
  REJECTED: ["PENDING_MASTER"],
  IN_PROCUREMENT: ["APPROVED"],
  PARTIALLY_DELIVERED: ["IN_PROCUREMENT"],
  FULLY_DELIVERED: ["IN_PROCUREMENT", "PARTIALLY_DELIVERED"],
  CLOSED: ["FULLY_DELIVERED"],
  CANCELLED: ["DRAFT", "PENDING_MASTER", "APPROVED"],
};
