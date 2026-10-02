-- Sửa / gỡ sơn đã nhập: đánh dấu dòng điều chỉnh (không tính tiêu thụ) và gắn
-- dòng nhập với phiếu giao sơn đã sinh ra nó (để gỡ cả phiếu).
ALTER TABLE "PaintTransaction" ADD COLUMN "dieuChinh" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PaintTransaction" ADD COLUMN "phieuSonId" INTEGER;
CREATE INDEX "PaintTransaction_phieuSonId_idx" ON "PaintTransaction"("phieuSonId");

-- Phiếu giao đã nhập TRƯỚC khi có cột: tìm lại dòng nhập theo đúng cách lúc nhập
-- đã ghi (ghi chú "Phiếu giao <số> · <NCC>", nhập IN, cùng tàu, tạo trong vài
-- phút quanh lúc phiếu được nhập).
UPDATE "PaintTransaction" t
SET "phieuSonId" = s."id"
FROM "SonPhieuTep" s
WHERE s."trangThai" = 'DA_AP_DUNG'
  AND s."apDungLuc" IS NOT NULL
  AND t."phieuSonId" IS NULL
  AND t."vesselId" = s."vesselId"
  AND t."type" = 'IN'
  AND t."jobId" IS NULL
  AND t."note" = LEFT('Phiếu giao ' || COALESCE(s."soPhieu", s."fileName") || COALESCE(' · ' || s."nhaCungCap", ''), 300)
  AND t."createdAt" BETWEEN s."apDungLuc" - INTERVAL '10 minutes' AND s."apDungLuc" + INTERVAL '1 minute';
