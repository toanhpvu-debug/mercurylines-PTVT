-- Dấu vết để HOÀN TÁC một phiếu giao đã duyệt (quản trị tại văn phòng gỡ bỏ):
-- dòng nhập kho nào do phiếu nào sinh ra, và dòng phiếu nào đã TẠO MỚI mặt hàng
-- (khác với dòng chỉ gắn vào mặt hàng có sẵn). Không đặt khóa ngoại từ
-- InventoryTransaction sang PhieuGiaoNhan vì bảng giao dịch được đồng bộ tàu↔bờ
-- còn bảng phiếu thì không.
ALTER TABLE "InventoryTransaction" ADD COLUMN "phieuGiaoId" INTEGER;
CREATE INDEX "InventoryTransaction_phieuGiaoId_idx" ON "InventoryTransaction"("phieuGiaoId");
ALTER TABLE "PhieuGiaoNhanDong" ADD COLUMN "taoMoi" BOOLEAN;
