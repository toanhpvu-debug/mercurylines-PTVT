import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Phần dùng chung giữa LẬP yêu cầu (POST /api/material-requests) và SỬA yêu cầu
 * (PATCH /api/material-requests/[id]).
 *
 * Tách ra vì hai đường đi phải hiểu một dòng yêu cầu GIỐNG HỆT nhau. Chép đôi
 * đoạn đọc dòng thì sớm muộn một bên được vá còn bên kia thì không, và biểu hiện
 * là dạng khó chịu nhất: lập thì chặn được số lượng 0, sửa thì lọt — cùng một
 * chứng từ, hai luật khác nhau tùy người dùng bấm nút nào.
 */

/** Một dòng yêu cầu sau khi đã đọc và làm sạch từ body JSON. */
export type DongYeuCau = {
  /** Có giá trị = vật tư trong danh mục; null = hàng mới nhập tay. */
  materialId: number | null;
  itemName: string | null;
  itemCode: string | null;
  itemUom: string | null;
  quantity: number;
  note: string | null;
  /**
   * R.O.B người lập ghi cho hàng MỚI (ngoài danh mục — hệ thống không có tồn
   * để chụp), VD lấy từ cột R.O.B của file MLS-11-05. Hàng có sẵn luôn null:
   * ROB của chúng chụp từ tồn kho (chupROB).
   */
  rob: number | null;
  /** Hàng mới là một loại sơn trong danh mục sơn (yêu cầu sơn) — xem MaterialRequestItem.paintProductId. */
  paintProductId: number | null;
};

/**
 * Đọc mảng dòng từ body JSON, BỎ QUA dòng không dùng được thay vì báo lỗi.
 *
 * Form luôn giữ sẵn một dòng trống ở cuối cho người dùng gõ tiếp, nên "dòng
 * trống" là chuyện bình thường chứ không phải sai sót — bắt lỗi ở đây thì không
 * ai lưu nổi. Việc kiểm "còn lại ít nhất một dòng" thuộc về phía gọi, vì câu
 * báo lỗi ở hai đường đi khác nhau.
 */
export function docDongYeuCau(raw: unknown): DongYeuCau[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: Record<string, unknown>): DongYeuCau | null => {
      const quantity = Number(item?.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) return null;
      const note = item?.note ? String(item.note).trim() : null;
      const isNew = item?.isNew === true || !item?.materialId;
      if (isNew) {
        const itemName = String(item?.itemName || "").trim();
        if (!itemName) return null; // hàng mới bắt buộc có tên
        return {
          materialId: null,
          itemName,
          itemCode: item?.itemCode ? String(item.itemCode).trim() : null,
          itemUom: item?.itemUom ? String(item.itemUom).trim() || "PCS" : "PCS",
          quantity,
          note,
          rob: Number.isFinite(Number(item?.rob)) && item?.rob !== null && item?.rob !== "" && Number(item?.rob) >= 0 ? Number(item?.rob) : null,
          paintProductId: Number.isInteger(Number(item?.paintProductId)) && Number(item?.paintProductId) > 0 ? Number(item?.paintProductId) : null,
        };
      }
      const materialId = Number(item?.materialId);
      if (!Number.isFinite(materialId) || materialId <= 0) return null;
      return {
        materialId,
        itemName: null,
        itemCode: null,
        itemUom: null,
        quantity,
        note,
        rob: null,
        paintProductId: null,
      };
    })
    .filter((x: DongYeuCau | null): x is DongYeuCau => x !== null);
}

/** Các materialId khác null, không trùng, của một danh sách dòng. */
export function maVatTuCoSan(items: DongYeuCau[]): number[] {
  return [
    ...new Set(
      items.map((i) => i.materialId).filter((x): x is number => x !== null)
    ),
  ];
}

/**
 * Bỏ liên kết sơn trỏ tới loại sơn không còn trong danh mục (đã xóa) thay vì để
 * lỗi khóa ngoại nổ thành màn hình 500 — dòng vẫn giữ tên / mã / đơn vị như gõ.
 */
export async function locSonCoThat(items: DongYeuCau[]): Promise<DongYeuCau[]> {
  const ids = [...new Set(items.map((i) => i.paintProductId).filter((x): x is number => x !== null))];
  if (!ids.length) return items;
  const co = new Set((await prisma.paintProduct.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((p) => p.id));
  return items.map((i) => (i.paintProductId !== null && !co.has(i.paintProductId) ? { ...i, paintProductId: null } : i));
}

/**
 * Mọi materialId đều có thật trong danh mục chưa?
 *
 * Kiểm trước khi ghi để lỗi khóa ngoại không nổ thành màn hình 500 — người dùng
 * mất luôn cả yêu cầu vừa gõ và không hiểu vì sao.
 */
export async function duVatTuTrongDanhMuc(materialIds: number[]) {
  if (!materialIds.length) return true;
  const co = await prisma.material.findMany({
    where: { id: { in: materialIds } },
    select: { id: true },
  });
  return co.length === materialIds.length;
}

/**
 * Chụp ROB — số còn tồn trên tàu tại THỜI ĐIỂM này — cho từng vật tư có sẵn.
 *
 * Chụp lại chứ không tra ngược lúc in: ô ROB trên biểu mẫu MLS-11-05 nói "lúc
 * xin còn bấy nhiêu", tra ngược sau khi đã nhập hàng về sẽ cho ra một con số
 * đúng ở hiện tại nhưng sai với chính tờ giấy người ta đã ký.
 */
export async function chupROB(vesselId: number, materialIds: number[]) {
  if (!materialIds.length) return new Map<number, number>();
  const nhom = await prisma.inventory.groupBy({
    by: ["materialId"],
    where: { vesselId, materialId: { in: materialIds } },
    _sum: { quantity: true },
  });
  return new Map(nhom.map((g) => [g.materialId, Number(g._sum.quantity ?? 0)]));
}

// Vùng khóa tư vấn cấp số yêu cầu vật tư (khác vùng của tồn kho 811001 và số PO
// 811002). Xem app/actions.ts:sinhSoDonMua về lý do phải xin khóa trong CÙNG
// giao dịch với lúc đọc số lớn nhất — nếu không, hai yêu cầu cùng tàu nộp sát
// nhau cùng đọc thấy số cũ, cùng sinh một requestNo, một bên vỡ vì requestNo là
// khóa duy nhất, người dùng nhận màn hình 500 và mất luôn yêu cầu vừa gõ.
const KHOA_SINH_SO_YEU_CAU = 811003;

// Khóa theo ĐÚNG thứ chia dãy số (tiền tố đã bỏ ký tự đặc biệt), không theo
// vesselId: hai tàu mã "MLS-001"/"MLS001" cùng lùi về một tiền tố nên dùng chung
// dãy số dù vesselId khác nhau. Đụng độ băm chỉ khiến hai dãy chẳng liên quan
// chờ nhau một nhịp, không bao giờ sai số.
function khoaDaySoYeuCau(tienTo: string) {
  let bam = 0;
  for (let i = 0; i < tienTo.length; i++) {
    bam = (Math.imul(bam, 31) + tienTo.charCodeAt(i)) | 0;
  }
  return bam;
}

/**
 * Cấp số yêu cầu theo quy ước chứng từ: <MR|SR>-<mã tàu>-<năm 2 số>-<số thứ tự>,
 * VD MR-MLS001-26-0007 — số lớn nhất đã dùng trong năm của tàu + 1 (không đếm,
 * để xóa yêu cầu không làm trùng số).
 *
 * PHẢI gọi trong CÙNG giao dịch với lúc ghi yêu cầu: hàm xin khóa tư vấn theo
 * dãy số của tàu (y hệt sinhSoDonMua bên app/actions.ts), khóa nhả khi giao dịch
 * kết thúc. Khóa theo tiền tố KHÔNG kèm năm để hai yêu cầu rơi đúng khoảnh khắc
 * giao thừa vẫn xếp hàng với nhau. Dùng chung cho yêu cầu vật tư / phụ tùng
 * (POST /api/material-requests) và yêu cầu sơn.
 */
export async function capSoYeuCauTx(tx: Prisma.TransactionClient, prefix: "MR" | "SR", vesselCode: string): Promise<string> {
  const vesselTag = vesselCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const base = `${prefix}-${vesselTag}-${String(new Date().getFullYear()).slice(-2)}-`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_SINH_SO_YEU_CAU}::int, ${khoaDaySoYeuCau(`${prefix}-${vesselTag}-`)}::int)`;
  const latest = await tx.materialRequest.findFirst({
    where: { requestNo: { startsWith: base } },
    orderBy: { requestNo: "desc" },
    select: { requestNo: true },
  });
  let seq = latest ? Number(latest.requestNo.slice(base.length)) + 1 : 1;
  if (!Number.isFinite(seq) || seq < 1) seq = 1;
  return `${base}${String(seq).padStart(4, "0")}`;
}
