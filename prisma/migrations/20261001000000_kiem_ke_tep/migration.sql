-- Kiểm kê theo file (MLS-11-06 Excel / PDF scan): hàng chờ đối chiếu trước khi
-- đặt lại tồn kho. Viết tay vì tài khoản database không tạo được shadow database.

-- CreateTable
CREATE TABLE "KiemKeTep" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "loaiTep" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "khoChon" TEXT NOT NULL DEFAULT 'AUTO',
    "ngayKiemKe" TIMESTAMP(3) NOT NULL,
    "dong" JSONB NOT NULL,
    "ghiChuDoc" TEXT,
    "loiAi" TEXT,
    "aiDangDocTu" TIMESTAMP(3),
    "aiTienDo" TEXT,
    "trangThai" TEXT NOT NULL DEFAULT 'CHO_DUYET',
    "nguoiTaiId" INTEGER NOT NULL,
    "nguoiTai" TEXT NOT NULL,
    "apDungBoi" TEXT,
    "apDungLuc" TIMESTAMP(3),
    "ketQua" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KiemKeTep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KiemKeTep_storedName_key" ON "KiemKeTep"("storedName");
CREATE INDEX "KiemKeTep_vesselId_idx" ON "KiemKeTep"("vesselId");
CREATE INDEX "KiemKeTep_trangThai_idx" ON "KiemKeTep"("trangThai");

-- AddForeignKey
ALTER TABLE "KiemKeTep" ADD CONSTRAINT "KiemKeTep_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
