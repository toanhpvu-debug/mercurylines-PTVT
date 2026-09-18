-- Lỗi nguyên văn của bộ đọc AI ở lần đọc gần nhất (null = không lỗi). Trang duyệt
-- hiện thẳng cho người dùng thay vì câu chung chung "mạng hoặc hạn mức".
ALTER TABLE "PhieuGiaoNhan" ADD COLUMN "loiAi" TEXT;
