-- Báo giá nhà cung cấp → PO; trình duyệt / duyệt PO (lãnh đạo phòng KT-VT);
-- nhà cung cấp xác nhận. Viết tay vì tài khoản database không tạo được shadow database.

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN "submittedBy" TEXT,
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "approvedBy" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvalNote" TEXT,
ADD COLUMN "supplierConfirmedAt" TIMESTAMP(3),
ADD COLUMN "supplierConfirmRef" TEXT;

-- CreateTable
CREATE TABLE "BaoGiaNcc" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "supplierId" INTEGER,
    "poId" INTEGER,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "loaiTep" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "nhaCungCapDoc" TEXT,
    "soBaoGia" TEXT,
    "ngayBaoGia" TIMESTAMP(3),
    "tienTe" TEXT,
    "chietKhau" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "phiVanChuyen" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "phiGiaoHang" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dong" JSONB NOT NULL,
    "ghiChuDoc" TEXT,
    "loiAi" TEXT,
    "aiDangDocTu" TIMESTAMP(3),
    "aiTienDo" TEXT,
    "trangThai" TEXT NOT NULL DEFAULT 'CHO_XU_LY',
    "nguoiTaiId" INTEGER NOT NULL,
    "nguoiTai" TEXT NOT NULL,
    "apDungBoi" TEXT,
    "apDungLuc" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaoGiaNcc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TepDonMua" (
    "id" SERIAL NOT NULL,
    "poId" INTEGER NOT NULL,
    "loai" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "nguoiTai" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TepDonMua_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BaoGiaNcc_storedName_key" ON "BaoGiaNcc"("storedName");
CREATE INDEX "BaoGiaNcc_vesselId_idx" ON "BaoGiaNcc"("vesselId");
CREATE INDEX "BaoGiaNcc_poId_idx" ON "BaoGiaNcc"("poId");
CREATE UNIQUE INDEX "TepDonMua_storedName_key" ON "TepDonMua"("storedName");
CREATE INDEX "TepDonMua_poId_idx" ON "TepDonMua"("poId");

-- AddForeignKey
ALTER TABLE "BaoGiaNcc" ADD CONSTRAINT "BaoGiaNcc_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
