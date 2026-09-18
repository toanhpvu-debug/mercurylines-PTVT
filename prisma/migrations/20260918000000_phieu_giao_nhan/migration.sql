-- Phiếu giao hàng của nhà cung cấp (PDF scan) + từng dòng hàng đọc ra, nằm ở
-- HÀNG CHỜ DUYỆT: chỉ khi người có quyền phê duyệt thì mặt hàng mới vào danh
-- mục tàu và tồn kho mới được cộng. Viết tay vì tài khoản database không tạo
-- được shadow database (xem migration 20260916000000).

-- CreateTable
CREATE TABLE "PhieuGiaoNhan" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "warehouseId" INTEGER,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "nguonChu" TEXT NOT NULL DEFAULT 'TAY',
    "chuDoc" TEXT,
    "nhaCungCap" TEXT,
    "soPhieu" TEXT,
    "ngayGiao" TIMESTAMP(3),
    "ghiChu" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CHO_DUYET',
    "uploadedById" INTEGER NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lyDoTuChoi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhieuGiaoNhan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhieuGiaoNhanDong" (
    "id" SERIAL NOT NULL,
    "phieuId" INTEGER NOT NULL,
    "thuTu" INTEGER NOT NULL,
    "chuGoc" TEXT,
    "ten" TEXT NOT NULL,
    "partNo" TEXT,
    "impa" TEXT,
    "soLuong" DOUBLE PRECISION NOT NULL,
    "donVi" TEXT NOT NULL DEFAULT 'PCS',
    "loai" TEXT NOT NULL DEFAULT 'SPARE',
    "thietBi" TEXT,
    "materialId" INTEGER,
    "chon" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PhieuGiaoNhanDong_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhieuGiaoNhan_storedName_key" ON "PhieuGiaoNhan"("storedName");
CREATE INDEX "PhieuGiaoNhan_vesselId_idx" ON "PhieuGiaoNhan"("vesselId");
CREATE INDEX "PhieuGiaoNhan_status_idx" ON "PhieuGiaoNhan"("status");
CREATE INDEX "PhieuGiaoNhanDong_phieuId_idx" ON "PhieuGiaoNhanDong"("phieuId");
CREATE INDEX "PhieuGiaoNhanDong_materialId_idx" ON "PhieuGiaoNhanDong"("materialId");

-- AddForeignKey
ALTER TABLE "PhieuGiaoNhan" ADD CONSTRAINT "PhieuGiaoNhan_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhieuGiaoNhan" ADD CONSTRAINT "PhieuGiaoNhan_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhieuGiaoNhanDong" ADD CONSTRAINT "PhieuGiaoNhanDong_phieuId_fkey" FOREIGN KEY ("phieuId") REFERENCES "PhieuGiaoNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhieuGiaoNhanDong" ADD CONSTRAINT "PhieuGiaoNhanDong_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
