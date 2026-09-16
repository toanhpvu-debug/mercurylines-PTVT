import "server-only";

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
