-- Yêu cầu sơn từ tàu: dòng yêu cầu trỏ về loại sơn trong danh mục sơn (để nhận
-- hàng theo PO cộng thẳng vào tồn sơn của tàu), và file MLS-11-05 tải lên ghi
-- rõ dùng cho yêu cầu vật tư hay yêu cầu sơn.
ALTER TABLE "MaterialRequestItem" ADD COLUMN "paintProductId" INTEGER;
CREATE INDEX "MaterialRequestItem_paintProductId_idx" ON "MaterialRequestItem"("paintProductId");
ALTER TABLE "MaterialRequestItem" ADD CONSTRAINT "MaterialRequestItem_paintProductId_fkey" FOREIGN KEY ("paintProductId") REFERENCES "PaintProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "YeuCauTep" ADD COLUMN "muc" TEXT NOT NULL DEFAULT 'VAT_TU';
