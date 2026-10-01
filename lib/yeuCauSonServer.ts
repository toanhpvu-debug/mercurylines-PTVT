import "server-only";

import type { Prisma } from "@prisma/client";
import { ROLE_LABEL, boPhanCuaChucDanh, trinhThangLenCongTy } from "@/lib/roles";
import { capSoYeuCauTx } from "@/lib/yeuCauVatTu";
import { tenDongSon, type DongSonGui } from "@/lib/yeuCauSon";

/*
 * YÊU CẦU SƠN TỪ TÀU — phần ghi database, chạy trong giao dịch của nơi gọi (server
 * action, hoặc script kiểm thử rồi cuộn ngược).
 *
 * KHÔNG có đường duyệt riêng cho sơn: yêu cầu sơn là một MaterialRequest loại
 * vật tư (MLS-11-05B) nên đi đúng dây chuyền đang có
 *
 *   Đại phó lập → Thuyền trưởng duyệt cấp tàu → Công ty duyệt → Mua sắm (PO)
 *   → Nhận hàng: dòng sơn cộng thẳng vào tồn sơn của tàu (nhapSonTuDonMuaTx)
 *
 * Bộ phận theo chức danh người lập nên yêu cầu của đại phó (Boong) về đúng bàn
 * thuyền trưởng; máy trưởng xin sơn buồng máy thì nằm trong thẩm quyền máy trưởng.
 */

export type NguoiLapSon = { id: number; name: string; role: string };

export async function taoYeuCauSonTx(
  tx: Prisma.TransactionClient,
  input: {
    vesselId: number;
    nguoi: NguoiLapSon;
    dong: DongSonGui[];
    purpose: string | null;
    priority: string;
    requiredDate: Date | null;
    /** File MLS-11-05 đã tải (yêu cầu sơn từ file) — ghi requestId vào file. */
    tuTep?: number | null;
  }
): Promise<{ id: number; requestNo: string; status: string; soDong: number }> {
  const { vesselId, nguoi, dong } = input;
  const vessel = await tx.vessel.findUniqueOrThrow({ where: { id: vesselId }, select: { code: true, name: true } });
  const ids = [...new Set(dong.map((d) => d.paintProductId).filter((x): x is number => x !== null))];
  const [son, ton] = await Promise.all([
    tx.paintProduct.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true, maker: true, colorName: true, uom: true } }),
    tx.paintStock.findMany({ where: { vesselId, productId: { in: ids } }, select: { productId: true, quantity: true } }),
  ]);
  const sonTheoId = new Map(son.map((p) => [p.id, p]));
  const tonTheoId = new Map(ton.map((s) => [s.productId, s.quantity]));
  const thangLenCongTy = trinhThangLenCongTy(nguoi.role);
  const status = thangLenCongTy ? "PENDING_OFFICE" : "PENDING_MASTER";
  const now = new Date();
  const requestNo = await capSoYeuCauTx(tx, "MR", vessel.code);
  const req = await tx.materialRequest.create({
    data: {
      requestNo,
      kind: "STORE",
      vesselId,
      requestedBy: nguoi.name,
      requestedByRole: nguoi.role,
      requestedById: nguoi.id,
      department: boPhanCuaChucDanh(nguoi.role) ?? "DECK",
      priority: ["LOW", "NORMAL", "HIGH", "URGENT"].includes(input.priority) ? input.priority : "NORMAL",
      requiredDate: input.requiredDate,
      // Lập và trình trong một lần bấm (người lập đã soát dòng ở form), nhưng
      // nhật ký vẫn ghi đủ hai mốc như đường lập tay.
      status,
      submittedBy: nguoi.name,
      submittedAt: now,
      // Thuyền trưởng / quản trị lập thì cấp tàu coi như đã ký — nếu không, yêu
      // cầu của chính thuyền trưởng kẹt ở PENDING_MASTER (không tự duyệt được).
      ...(thangLenCongTy ? { shipApprovedBy: nguoi.name, shipApprovedRole: nguoi.role, shipApprovedAt: now } : {}),
      purpose: input.purpose || `Yêu cầu cấp sơn cho ${vessel.name}`,
      items: {
        create: dong.map((d) => {
          // Loại sơn bị xóa khỏi danh mục giữa lúc mở form và lúc gửi: giữ dòng như gõ.
          const p = d.paintProductId !== null ? sonTheoId.get(d.paintProductId) : undefined;
          return {
            // Sơn nằm ở danh mục sơn, không phải danh mục vật tư: dòng "mới" về
            // mặt vật tư, trỏ sang loại sơn qua paintProductId.
            materialId: null,
            paintProductId: p?.id ?? null,
            itemName: p ? tenDongSon(p) : d.ten,
            itemCode: p ? p.code : d.ma,
            itemUom: p ? p.uom : d.dvt || "L",
            quantity: d.soLuong,
            // ROB: tồn sơn của tàu cho loại có trong danh mục; sơn ngoài danh mục
            // thì số người lập ghi (cột R.O.B của file).
            robSnapshot: p ? (tonTheoId.get(p.id) ?? 0) : (d.robFile ?? 0),
            approvedQuantity: thangLenCongTy ? d.soLuong : 0,
            note: d.ghiChu,
          };
        }),
      },
    },
    select: { id: true, requestNo: true, status: true },
  });
  await tx.materialRequestEvent.createMany({
    data: [
      { requestId: req.id, fromStatus: null, toStatus: "DRAFT", actorName: nguoi.name, actorRole: nguoi.role, note: `Lập yêu cầu cấp sơn ${dong.length} dòng${input.tuTep ? " từ file MLS-11-05" : ""}` },
      {
        requestId: req.id,
        fromStatus: "DRAFT",
        toStatus: status,
        actorName: nguoi.name,
        actorRole: nguoi.role,
        note: thangLenCongTy ? `${ROLE_LABEL[nguoi.role] ?? nguoi.role} lập và trình — cấp tàu đã ký, chuyển thẳng lên công ty` : "Trình duyệt",
      },
    ],
  });
  if (input.tuTep) {
    await tx.yeuCauTep.updateMany({ where: { id: input.tuTep, nguoiTaiId: nguoi.id, requestId: null, muc: "SON" }, data: { requestId: req.id } });
  }
  return { ...req, soDong: dong.length };
}

/**
 * Nhận hàng theo PO cho một dòng SƠN (dòng yêu cầu có paintProductId): cộng vào
 * tồn sơn của tàu và ghi phiếu nhập sơn — cùng cách ghi với "Nhập sơn" tay
 * (upsert + increment, không đọc rồi ghi lại).
 */
export async function nhapSonTuDonMuaTx(
  tx: Prisma.TransactionClient,
  input: { vesselId: number; productId: number; soLuong: number; poNo: string; nguoi: string }
): Promise<void> {
  const { vesselId, productId, soLuong } = input;
  if (!(soLuong > 0)) return;
  await tx.paintStock.upsert({
    where: { vesselId_productId: { vesselId, productId } },
    update: { quantity: { increment: soLuong } },
    create: { vesselId, productId, quantity: soLuong },
  });
  await tx.paintTransaction.create({
    data: { vesselId, productId, type: "IN", quantity: soLuong, note: `Nhận hàng ${input.poNo}`, performedBy: input.nguoi },
  });
}
