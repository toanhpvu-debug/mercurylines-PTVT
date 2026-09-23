-- Bộ đọc AI chạy NỀN sau khi tải phiếu lên: dấu "đang đọc từ lúc nào" (null =
-- không đọc; quá 30 phút coi là bị gián đoạn) và tiến độ "x/y" lượt gọi AI để
-- trang duyệt hiện cho người dùng.
ALTER TABLE "PhieuGiaoNhan" ADD COLUMN "aiDangDocTu" TIMESTAMP(3);
ALTER TABLE "PhieuGiaoNhan" ADD COLUMN "aiTienDo" TEXT;
