import "server-only";

import type { Prisma } from "@prisma/client";

/**
 * Số đơn mua theo quy ước chứng từ: PO-<mã tàu>-<năm 2 số>-<số thứ tự>.
 * VD PO-MLS001-26-0007.
 *
 * Trước đây số đơn là dấu thời gian kèm số ngẫu nhiên (PO-1787711139511-115):
 * máy đọc được, người thì không. Số yêu cầu vật tư đã đổi sang quy ước này rồi,
 * để đơn mua lệch chuẩn thì hai chứng từ của cùng một việc mua lại đánh số theo
 * hai kiểu, và không đối chiếu được với nhau khi tra sổ.
 *
 * Lấy số LỚN NHẤT đã dùng trong năm của tàu rồi +1, không dựa vào số lượng đơn:
 * xóa một đơn giữa chừng mà đếm lại thì số vừa xóa được cấp lần hai, trong khi
 * số cũ có thể đã nằm trên chứng từ gửi cho nhà cung cấp.
 */
// Vùng khóa tư vấn dành cho việc cấp số đơn mua. Xem chú thích KHOA_TON_KHO về
// lý do mỗi nghiệp vụ phải có số vùng riêng.
export const KHOA_SINH_SO_PO = 811002;

/**
 * Băm tiền tố dãy số PO thành một số int32 để làm chìa khóa thứ hai.
 *
 * Phải khóa theo ĐÚNG thứ chia dãy số chứ không phải theo vesselId: tiền tố
 * dựng từ vessel.code sau khi bỏ hết ký tự không phải chữ/số, nên hai tàu khai
 * "MLS-001" và "MLS001" — hoặc hai tàu có mã toàn ký tự đặc biệt, cùng lùi về
 * "NA" — dùng CHUNG một dãy số trong khi vesselId khác nhau. Khóa theo vesselId
 * thì hai bên đó không xếp hàng với nhau, cùng đọc thấy số lớn nhất giống nhau,
 * cùng sinh một poNo, và một bên vỡ vì poNo là khóa duy nhất.
 *
 * Đụng độ băm chỉ khiến hai dãy số chẳng liên quan phải chờ nhau — chậm một
 * nhịp, KHÔNG bao giờ sai số liệu.
 */
export function khoaDaySoPO(tienTo: string) {
  let bam = 0;
  for (let i = 0; i < tienTo.length; i++) {
    bam = (Math.imul(bam, 31) + tienTo.charCodeAt(i)) | 0;
  }
  return bam;
}

/**
 * Nhận Prisma.TransactionClient chứ KHÔNG nhận client trần, vì hàm này tự xin
 * khóa tư vấn: pg_advisory_xact_lock chỉ giữ tới hết giao dịch, gọi ngoài giao
 * dịch thì khóa nhả ngay và chẳng xếp hàng được ai. Ràng buộc kiểu ở đây là để
 * không đường cấp số nào quên xin khóa — khóa tư vấn chỉ có tác dụng khi MỌI
 * bên ghi đều xin, một cửa bỏ qua là cửa kia có xin cũng thành trang trí.
 */
export async function sinhSoDonMua(
  tx: Prisma.TransactionClient,
  vesselId: number
): Promise<string> {
  const vessel = await tx.vessel.findUnique({
    where: { id: vesselId },
    select: { code: true },
  });
  const maTau = (vessel?.code ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  // Khóa theo mã tàu nhưng KHÔNG kèm năm: dãy số chia theo năm, còn khóa thì
  // không nên chia, nếu không thì đúng khoảnh khắc giao thừa hai đơn của cùng
  // một tàu lại rơi vào hai khóa khác nhau. Khóa rộng hơn dãy số chỉ tốn thêm
  // một nhịp chờ; khóa hẹp hơn dãy số là mất tác dụng.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_SINH_SO_PO}::int, ${khoaDaySoPO(
    `PO-${maTau || "NA"}-`
  )}::int)`;
  const nam = String(new Date().getFullYear()).slice(-2);
  const dau = `PO-${maTau || "NA"}-${nam}-`;
  const ganNhat = await tx.purchaseOrder.findFirst({
    where: { poNo: { startsWith: dau } },
    orderBy: { poNo: "desc" },
    select: { poNo: true },
  });
  const so = ganNhat ? Number(ganNhat.poNo.slice(dau.length)) || 0 : 0;
  return `${dau}${String(so + 1).padStart(4, "0")}`;
}
