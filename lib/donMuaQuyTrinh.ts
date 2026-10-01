/**
 * QUY TRÌNH ĐƠN MUA (PO) — phần thuần, dùng chung cho server action, trang và
 * kiểm thử (scripts/kiem-tra-bao-gia.ts):
 *
 *   DRAFT (nháp: nhập báo giá, sửa dòng / giá)
 *     → PENDING_APPROVAL (chuyên viên mua sắm / người lập trình duyệt)
 *     → APPROVED (lãnh đạo phòng Kỹ thuật – Vật tư do quản trị chỉ định, hoặc
 *       người được lãnh đạo ủy quyền, duyệt; hoặc trả lại → DRAFT)
 *     → SENT (in / xuất file, gửi nhà cung cấp)
 *     → CONFIRMED (nhà cung cấp xác nhận) → nhận hàng → CLOSED.
 *
 * PO chưa duyệt không gửi được cho nhà cung cấp; chỉ sửa được ở trạng thái nháp.
 */

/**
 * Ai lập / sửa / trình / gửi đơn mua: chuyên viên mua sắm (văn phòng), quản trị,
 * và thuyền trưởng (như trước). Chuyên viên mua sắm và thuyền trưởng không bao
 * giờ duyệt PO.
 */
export const LAP_DON_MUA: readonly string[] = ["ADMIN", "MASTER", "PURCHASER"];

/**
 * Vai trò được quản trị CHỈ ĐỊNH làm lãnh đạo phòng Kỹ thuật – Vật tư (người
 * duyệt PO), hoặc NHẬN ủy quyền duyệt PO. Không có chuyên viên mua sắm: người
 * lập PO không duyệt PO — tách bạch lập và duyệt là cốt lõi của kiểm soát.
 */
export const VAI_TRO_DUYET_PO: readonly string[] = ["ADMIN", "TECH_MANAGER"];

/**
 * Ai ghi NHẬN HÀNG của PO (vào kho tàu): quản trị và thuyền trưởng — việc của
 * tàu, không phải của chuyên viên mua sắm ở văn phòng.
 */
export const NHAN_HANG_PO: readonly string[] = ["ADMIN", "MASTER"];

/** Ai thêm / sửa / ngừng dùng nhà cung cấp (xóa hẳn vẫn chỉ quản trị). */
export const QUAN_LY_NCC: readonly string[] = ["ADMIN", "PURCHASER"];

/** Ai vào được mục Kiểm soát duyệt PO (xem); duyệt thì xét thêm duocDuyet. */
export const XEM_KIEM_SOAT_PO: readonly string[] = ["ADMIN", "TECH_MANAGER", "PURCHASER"];

/** PO chờ duyệt quá số giờ này thì tô cảnh báo trong mục Kiểm soát duyệt. */
export const GIO_CANH_BAO_CHO_DUYET = 48;

/** Ủy quyền duyệt PO tối đa một năm một lần lập (như ủy quyền chung). */
export const TOI_DA_UY_QUYEN_MS = 366 * 24 * 60 * 60 * 1000;

export type NguoiDuyetPo = {
  id: number;
  role: string;
  name: string;
  /** Được quản trị chỉ định là lãnh đạo phòng KT-VT. */
  duyetDonMua?: boolean;
  /** Lãnh đạo phòng KT-VT đang ủy quyền duyệt PO cho người này (còn hiệu lực). */
  duyetPoTu?: { delegatorId: number; delegatorName: string }[];
};

export type TuCachDuyetPo = {
  /** Ký thay ai (lãnh đạo đã ủy quyền); null là duyệt bằng quyền của chính mình. */
  kyThay: { id: number; name: string } | null;
  /** Quản trị tạm duyệt vì CHƯA chỉ định lãnh đạo phòng nào. */
  tamThoi: boolean;
};

/**
 * Các tư cách duyệt PO của một người: chính mình (lãnh đạo được chỉ định), ký
 * thay từng lãnh đạo đang ủy quyền cho mình, hoặc — chỉ khi CHƯA có lãnh đạo nào
 * được chỉ định — quản trị tạm duyệt để PO không nằm kẹt ngay sau khi nâng cấp.
 */
export function tuCachDuyetPo(nguoi: NguoiDuyetPo, coLanhDao: boolean): TuCachDuyetPo[] {
  if (!VAI_TRO_DUYET_PO.includes(nguoi.role)) return [];
  const ra: TuCachDuyetPo[] = [];
  if (nguoi.duyetDonMua) ra.push({ kyThay: null, tamThoi: false });
  for (const u of nguoi.duyetPoTu ?? []) {
    if (u.delegatorId !== nguoi.id) ra.push({ kyThay: { id: u.delegatorId, name: u.delegatorName }, tamThoi: false });
  }
  if (!ra.length && !coLanhDao && nguoi.role === "ADMIN") ra.push({ kyThay: null, tamThoi: true });
  return ra;
}

export const coQuyenDuyetPo = (nguoi: NguoiDuyetPo, coLanhDao: boolean) => tuCachDuyetPo(nguoi, coLanhDao).length > 0;

const cungTen = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

/**
 * Được duyệt PO này không, và với tư cách nào.
 *
 * - Không ai duyệt PO do chính mình trình (trừ quản trị — công ty nhỏ có thể
 *   chỉ một người quản trị; vẫn ghi rõ trong lịch sử duyệt).
 * - Người ký thay cũng không duyệt PO do CHÍNH người đã ủy quyền trình: mượn
 *   thẩm quyền của người đang xin duyệt thì vẫn là tự ký, chỉ khác nét chữ.
 *
 * Người trình nhận theo id (lịch sử duyệt của bản cài này) nếu có, không thì
 * theo tên (cột submittedBy — đi theo đơn khi đồng bộ giữa các bản cài).
 */
export function duocDuyet(
  nguoi: NguoiDuyetPo,
  po: { status: string; submittedBy: string | null; submittedById?: number | null },
  coLanhDao: boolean
): ({ ok: true } & TuCachDuyetPo) | { ok: false; lyDo: "khongQuyen" | "khongChoDuyet" | "tuDuyet" } {
  const ds = tuCachDuyetPo(nguoi, coLanhDao);
  if (!ds.length) return { ok: false, lyDo: "khongQuyen" };
  if (po.status !== "PENDING_APPROVAL") return { ok: false, lyDo: "khongChoDuyet" };
  const laNguoiTrinh = (id: number, ten: string) => (po.submittedById != null ? po.submittedById === id : cungTen(po.submittedBy, ten));
  const tuMinh = laNguoiTrinh(nguoi.id, nguoi.name);
  for (const tc of ds) {
    if (tc.kyThay) {
      if (tuMinh || laNguoiTrinh(tc.kyThay.id, tc.kyThay.name)) continue;
    } else if (tuMinh && nguoi.role !== "ADMIN") {
      continue;
    }
    return { ok: true, ...tc };
  }
  return { ok: false, lyDo: "tuDuyet" };
}

/** Tên người duyệt in lên PO: "Trần B (ký thay Nguyễn A)" khi duyệt theo ủy quyền. */
export function tenNguoiDuyet(ten: string, kyThay: { name: string } | null): string {
  return kyThay ? `${ten} (ký thay ${kyThay.name})` : ten;
}

/** Kiểm người được quản trị chỉ định làm lãnh đạo phòng KT-VT. */
export function kiemChiDinhLanhDao(u: { role: string; isActive: boolean }): "saiVaiTro" | "biKhoa" | null {
  if (!VAI_TRO_DUYET_PO.includes(u.role)) return "saiVaiTro";
  if (!u.isActive) return "biKhoa";
  return null;
}

/** Kiểm một ủy quyền duyệt PO trước khi lập. Trả mã lỗi, hoặc null nếu hợp lệ. */
export function kiemUyQuyenDuyetPo(x: {
  giao: { id: number; role: string; isActive: boolean; duyetDonMua: boolean };
  nhan: { id: number; role: string; isActive: boolean };
  tu: Date | null;
  den: Date | null;
}): "giaoKhongPhaiLanhDao" | "tuUyQuyen" | "nhanSaiVaiTro" | "nhanBiKhoa" | "thieuNgay" | "denTruocTu" | "quaMotNam" | null {
  if (!x.giao.duyetDonMua || !x.giao.isActive) return "giaoKhongPhaiLanhDao";
  if (x.giao.id === x.nhan.id) return "tuUyQuyen";
  if (!VAI_TRO_DUYET_PO.includes(x.nhan.role)) return "nhanSaiVaiTro";
  if (!x.nhan.isActive) return "nhanBiKhoa";
  if (!x.tu || !x.den) return "thieuNgay";
  if (x.den.getTime() <= x.tu.getTime()) return "denTruocTu";
  if (x.den.getTime() - x.tu.getTime() > TOI_DA_UY_QUYEN_MS) return "quaMotNam";
  return null;
}

/** Số giờ một PO đã chờ duyệt (làm tròn xuống), tính theo đồng hồ máy chủ truyền vào. */
export function gioChoDuyet(submittedAt: Date | null, bayGio: Date): number {
  return submittedAt ? Math.max(0, Math.floor((bayGio.getTime() - submittedAt.getTime()) / 3_600_000)) : 0;
}

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
