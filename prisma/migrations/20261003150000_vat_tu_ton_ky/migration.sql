-- Tồn kho vật tư & phụ tùng theo KỲ (quý), như sơn:
--   - InventoryTransaction.cotBaoCao: dòng do file kiểm kê MLS-11-06 ghi — cột của biểu
--     mẫu mà dòng làm khớp ("tonDau" = Còn tồn đợt trước, "nhan" = Nhận trong kỳ,
--     "tieuThu" = Tiêu thụ trong kỳ, "tonCuoi" = Tồn trên tàu / số đếm). Báo cáo theo
--     kỳ xếp dòng "nhan" / "tieuThu" thẳng vào cột đó; null = dòng thường.
--   - InventoryTransaction.kiemKeId: lần kiểm kê theo file (KiemKeTep) đã ghi dòng —
--     để gỡ được cả lần kiểm kê. Không khóa ngoại: KiemKeTep không đồng bộ giữa bản cài.
--   - KiemKeTep.tuNgay: đầu kỳ của file (ô "From month / Từ tháng"); null = file chỉ có
--     số đếm tại ngày kiểm kê.
ALTER TABLE "InventoryTransaction" ADD COLUMN "cotBaoCao" TEXT;
ALTER TABLE "InventoryTransaction" ADD COLUMN "kiemKeId" INTEGER;
CREATE INDEX "InventoryTransaction_kiemKeId_idx" ON "InventoryTransaction"("kiemKeId");
ALTER TABLE "KiemKeTep" ADD COLUMN "tuNgay" TIMESTAMP(3);
