-- File Word / Excel gốc của chuẩn biểu mẫu + logo lấy từ file (đầu chứng từ PO / RFQ).
-- Viết tay vì tài khoản database không tạo được shadow database.

-- CreateTable
CREATE TABLE "FormStandardTep" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "logo" BYTEA,
    "logoMime" TEXT,
    "logoTen" TEXT,
    "dongChu" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormStandardTep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormStandardTep_code_key" ON "FormStandardTep"("code");
