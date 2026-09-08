import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Nhật ký thao tác.
 *
 * Hai đường ghi, cố ý khác nhau:
 *
 *  1. TỰ ĐỘNG ở proxy.ts — mọi request làm thay đổi dữ liệu (POST/PUT/PATCH/
 *     DELETE, gồm cả server action vì Next gửi chúng bằng POST). Đường này bắt
 *     được cả những thao tác mà người viết mã quên ghi log, kể cả request bị
 *     chặn vì thiếu quyền. Nó chỉ biết đường dẫn và phương thức, không biết
 *     nghiệp vụ gì.
 *
 *  2. THỦ CÔNG bằng ghiNhatKy() ở những chỗ đáng kể: duyệt, từ chối, xóa, đổi
 *     quyền. Đường này biết rõ nghiệp vụ ("duyet-yeu-cau #12, cấp TÀU, SL 150")
 *     và ghi được cả việc ký thay ai.
 *
 * Ghi log KHÔNG BAO GIỜ được làm hỏng nghiệp vụ: mọi lỗi ở đây đều nuốt lại và
 * chỉ in ra console. Mất một dòng log còn hơn chặn một phiếu xuất kho.
 */
export type NhatKy = {
  userId?: number | null;
  email?: string | null;
  role?: string | null;
  vesselId?: number | null;
  method?: string;
  path?: string;
  /** Tên nghiệp vụ dạng kebab: "duyet-yeu-cau", "xoa-tau", "doi-quyen". */
  action: string;
  ketQua?: "OK" | "TU_CHOI" | "LOI";
  /** Ký thay ai — id người đã ủy quyền. */
  onBehalfOfId?: number | null;
  detail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export async function ghiNhatKy(x: NhatKy) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: x.userId ?? null,
        email: x.email ?? null,
        role: x.role ?? null,
        vesselId: x.vesselId ?? null,
        method: x.method ?? "ACTION",
        path: x.path ?? "-",
        action: x.action,
        ketQua: x.ketQua ?? "OK",
        onBehalfOfId: x.onBehalfOfId ?? null,
        detail: x.detail ?? null,
        ip: x.ip ?? null,
        userAgent: x.userAgent ?? null,
      },
    });
  } catch (e) {
    console.error("[nhat-ky] không ghi được:", (e as Error).message);
  }
}

/**
 * Ghi nhật ký cho một thao tác của người đang đăng nhập.
 *
 * Nhận thẳng đối tượng user mà server action nào cũng đã có sẵn trong tay, nên
 * chỗ gọi chỉ còn một dòng — log càng dễ ghi thì càng ít bị bỏ quên.
 *
 * vesselId là BẮT BUỘC, và cố ý không có giá trị mặc định lấy từ user.
 *
 * Trước đây chỗ này viết `x.vesselId ?? user.vesselId ?? null`, nghe thì tiện
 * mà thật ra là cái bẫy: nó lặng lẽ điền TÀU CỦA NGƯỜI BẤM vào một dòng nhật ký
 * nói về TÀU CỦA CHỨNG TỪ. Hai tàu ấy khác nhau ở đúng những chỗ đáng ghi nhật
 * ký nhất — người của tàu A duyệt hộ giấy tờ tàu B, người công ty thao tác trên
 * một tàu cụ thể. Sổ ghi sai tàu còn tệ hơn sổ bỏ trống: bỏ trống thì biết là
 * không biết, ghi sai thì tra ra kết luận sai mà vẫn tin.
 *
 * Bắt khai tường minh biến chuyện "quên" thành LỖI BIÊN DỊCH. Thao tác không
 * thuộc tàu nào (phân quyền, ủy quyền) thì khai thẳng `vesselId: null` — mất
 * đúng một dòng, đổi lấy việc đọc mã là biết ngay chủ ý.
 */
export async function ghiNhatKyNguoiDung(
  user: { id: number; email: string; role: string },
  x: Omit<NhatKy, "userId" | "email" | "role" | "vesselId"> & {
    vesselId: number | null;
  }
) {
  await ghiNhatKy({
    ...x,
    userId: user.id,
    email: user.email,
    role: user.role,
  });
}
