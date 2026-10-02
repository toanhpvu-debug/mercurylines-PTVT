-- Nhập sơn từ phiếu giao / nhận (Excel MLS-11-05, Excel, Word, PDF, PDF scan): file + dòng đọc được chờ soát.
CREATE TABLE "SonPhieuTep" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "loaiTep" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "nguonDoc" TEXT,
    "soPhieu" TEXT,
    "nhaCungCap" TEXT,
    "ngayNhan" TIMESTAMP(3),
    "dong" JSONB NOT NULL DEFAULT '[]',
    "ghiChuDoc" TEXT,
    "loiAi" TEXT,
    "aiDangDocTu" TIMESTAMP(3),
    "aiTienDo" TEXT,
    "trangThai" TEXT NOT NULL DEFAULT 'CHO_XU_LY',
    "nguoiTaiId" INTEGER NOT NULL,
    "nguoiTai" TEXT NOT NULL,
    "apDungBoi" TEXT,
    "apDungLuc" TIMESTAMP(3),
    "ketQua" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SonPhieuTep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SonPhieuTep_storedName_key" ON "SonPhieuTep"("storedName");
CREATE INDEX "SonPhieuTep_vesselId_idx" ON "SonPhieuTep"("vesselId");

ALTER TABLE "SonPhieuTep" ADD CONSTRAINT "SonPhieuTep_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
