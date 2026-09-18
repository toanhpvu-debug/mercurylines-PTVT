-- Cấu hình hệ thống do quản trị đặt ngay trong app (khóa API bộ đọc AI, mô hình...).
-- Giá trị bí mật được mã hóa (lib/maHoaBiMat.ts) trước khi ghi. Viết tay vì tài
-- khoản database không tạo được shadow database.

-- CreateTable
CREATE TABLE "CauHinhHeThong" (
    "khoa" TEXT NOT NULL,
    "giaTri" TEXT NOT NULL,
    "biMat" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CauHinhHeThong_pkey" PRIMARY KEY ("khoa")
);
