/**
 * QUY TRÌNH ĐƠN MUA (PO) — phần thuần, dùng chung cho server action, trang và
 * kiểm thử (scripts/kiem-tra-bao-gia.ts):
 *
 *   DRAFT (nháp: nhập báo giá, sửa dòng / giá)
 *     → PENDING_APPROVAL (người lập trình duyệt)
 *     → APPROVED (lãnh đạo phòng Kỹ thuật – Vật tư duyệt; hoặc trả lại → DRAFT)
 *     → SENT (in / xuất file, gửi nhà cung cấp)
 *     → CONFIRMED (nhà cung cấp xác nhận) → nhận hàng → CLOSED.
 *
 * PO chưa duyệt không gửi được cho nhà cung cấp; chỉ sửa được ở trạng thái nháp.
 */

/** Ai lập / sửa / trình / gửi đơn mua (như trước: quản trị và thuyền trưởng). */
export const LAP_DON_MUA: readonly string[] = ["ADMIN", "MASTER"];
/**
 * Ai DUYỆT đơn mua: lãnh đạo phòng Kỹ thuật – Vật tư. Trong app đó là vai trò
 * Quản lý kỹ thuật (công ty) — TECH_MANAGER — và quản trị.
 */
export const DUYET_DON_MUA: readonly string[] = ["ADMIN", "TECH_MANAGER"];

/** Trạng thái đích → các trạng thái được phép đi tới nó. */
export const PO_DUOC_TU: Record<string, readonly string[]> = {
  PENDING_APPROVAL: ["DRAFT"],
  APPROVED: ["PENDING_APPROVAL"],
  // Trả lại (người duyệt) / rút lại (người lập) để sửa tiếp.
  DRAFT: ["PENDING_APPROVAL"],
  SENT: ["APPROVED"],
  CONFIRMED: ["SENT"],
  CLOSED: ["RECEIVED", "PARTIALLY_RECEIVED"],
  CANCELLED: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "CONFIRMED"],
};

export function duocChuyen(tu: string, toi: string): boolean {
  return (PO_DUOC_TU[toi] ?? []).includes(tu);
}

/** Chỉ đơn NHÁP mới sửa được dòng / giá / đầu đơn và nhận báo giá vào. */
export const laNhap = (status: string) => status === "DRAFT";

/** Đơn đã qua duyệt (in / xuất file gửi nhà cung cấp được). */
export const daDuyet = (status: string) => ["APPROVED", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"].includes(status);

/**
 * Được duyệt đơn này không: đúng vai trò duyệt, và KHÔNG tự duyệt đơn mình
 * trình — trừ quản trị (công ty nhỏ có thể chỉ một người quản trị; việc tự
 * duyệt vẫn ghi rõ trong nhật ký).
 */
export function duocDuyet(nguoi: { role: string; name: string }, po: { status: string; submittedBy: string | null }): { ok: true } | { ok: false; lyDo: "khongQuyen" | "khongChoDuyet" | "tuDuyet" } {
  if (!DUYET_DON_MUA.includes(nguoi.role)) return { ok: false, lyDo: "khongQuyen" };
  if (po.status !== "PENDING_APPROVAL") return { ok: false, lyDo: "khongChoDuyet" };
  if (nguoi.role !== "ADMIN" && po.submittedBy && po.submittedBy.trim() === nguoi.name.trim()) return { ok: false, lyDo: "tuDuyet" };
  return { ok: true };
}

/** Tổng tiền đơn: cộng dòng, trừ chiết khấu %, cộng phí — làm tròn 2 số lẻ như trên bản in. */
export function tongDonMua(items: { quantity: number; unitPrice: number }[], discountPercent = 0, transportFee = 0, deliveryFee = 0) {
  const tron = (n: number) => Math.round(n * 100) / 100;
  const cong = tron(items.reduce((s, it) => s + it.quantity * it.unitPrice, 0));
  const giam = tron((cong * (discountPercent || 0)) / 100);
  const sauGiam = tron(cong - giam);
  return { cong, giam, sauGiam, tong: tron(sauGiam + (transportFee || 0) + (deliveryFee || 0)) };
}

/** Thư gửi nhà cung cấp (mở trình gửi thư của máy): tiêu đề + nội dung ngắn. */
export function thuGuiNcc(x: { poNo: string; congTy: string; tau: string; tong: string; tienTe: string; lienHe: string | null }): { tieuDe: string; noiDung: string } {
  return {
    tieuDe: `Purchase Order ${x.poNo} — ${x.congTy}`,
    noiDung: [
      `Dear ${x.lienHe || "Sirs"},`,
      "",
      `Please find attached our Purchase Order ${x.poNo} for MV ${x.tau} (total ${x.tong} ${x.tienTe}).`,
      "Kindly confirm the order (sign & stamp the PO, or reply to this email) and advise the delivery schedule.",
      "",
      "Best regards,",
      x.congTy,
    ].join("\n"),
  };
}
