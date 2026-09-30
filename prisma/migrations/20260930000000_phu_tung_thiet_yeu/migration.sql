-- Phụ tùng thiết yếu (MLS-11-04): danh mục kiểm tra riêng của từng tàu, tách
-- khỏi danh mục vật tư chung, và số liệu kiểm tra hằng tháng của từng mục.
-- Viết tay vì tài khoản database không tạo được shadow database.

-- CreateTable
CREATE TABLE "PhuTungThietYeu" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "nhom" TEXT NOT NULL,
    "thuTu" INTEGER NOT NULL,
    "stt" TEXT,
    "moTa" TEXT NOT NULL,
    "partNo" TEXT,
    "toiThieu" TEXT,
    "toiThieuSo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viTri" TEXT,
    "hienCo" DOUBLE PRECISION,
    "materialId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhuTungThietYeu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhuTungThietYeuThang" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "thang" TEXT NOT NULL,
    "tonDau" DOUBLE PRECISION,
    "nhan" DOUBLE PRECISION,
    "tieuThu" DOUBLE PRECISION,
    "hienCo" DOUBLE PRECISION,
    "viTri" TEXT,
    "nguoiLuu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhuTungThietYeuThang_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhuTungThietYeu_vesselId_idx" ON "PhuTungThietYeu"("vesselId");
CREATE INDEX "PhuTungThietYeu_materialId_idx" ON "PhuTungThietYeu"("materialId");
CREATE UNIQUE INDEX "PhuTungThietYeuThang_itemId_thang_key" ON "PhuTungThietYeuThang"("itemId", "thang");

-- AddForeignKey
ALTER TABLE "PhuTungThietYeu" ADD CONSTRAINT "PhuTungThietYeu_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhuTungThietYeu" ADD CONSTRAINT "PhuTungThietYeu_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhuTungThietYeuThang" ADD CONSTRAINT "PhuTungThietYeuThang_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PhuTungThietYeu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
