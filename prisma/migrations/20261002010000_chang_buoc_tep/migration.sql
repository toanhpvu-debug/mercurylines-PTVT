-- Nhập dụng cụ chằng buộc từ file MLS-11-13 (Word / Excel / PDF / PDF scan).
CREATE TABLE "ChangBuocTep" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "loaiTep" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "tenTauDoc" TEXT,
    "cangDoc" TEXT,
    "ngayDoc" TIMESTAMP(3),
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
    "reportId" INTEGER,
    "ketQua" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangBuocTep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChangBuocTep_storedName_key" ON "ChangBuocTep"("storedName");
CREATE INDEX "ChangBuocTep_vesselId_idx" ON "ChangBuocTep"("vesselId");

ALTER TABLE "ChangBuocTep" ADD CONSTRAINT "ChangBuocTep_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
