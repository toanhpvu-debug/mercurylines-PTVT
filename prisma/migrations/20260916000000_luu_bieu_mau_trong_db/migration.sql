-- Chỗ chứa tệp biểu mẫu Excel gốc của công ty (MLS-11-06...).
--
-- Viết tay thay vì để `prisma migrate dev` sinh ra: tài khoản database của dự án
-- không có quyền tạo database nên không dựng được shadow database. Nội dung dưới
-- đây đúng bằng những gì Prisma sinh cho model BieuMauTep trong schema.prisma —
-- đổi model thì phải sửa cả đây.

-- CreateTable
CREATE TABLE "BieuMauTep" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BieuMauTep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BieuMauTep_code_key" ON "BieuMauTep"("code");
