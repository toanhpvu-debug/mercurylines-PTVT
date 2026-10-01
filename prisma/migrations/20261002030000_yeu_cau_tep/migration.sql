-- Yêu cầu nhanh từ file MLS-11-05B (vật tư) / MLS-11-05A (phụ tùng): Word / Excel / PDF / PDF scan.
CREATE TABLE "YeuCauTep" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "loaiTep" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "dau" JSONB NOT NULL DEFAULT '{}',
    "dong" JSONB NOT NULL DEFAULT '[]',
    "ghiChuDoc" TEXT,
    "loiAi" TEXT,
    "aiDangDocTu" TIMESTAMP(3),
    "aiTienDo" TEXT,
    "nguoiTaiId" INTEGER NOT NULL,
    "nguoiTai" TEXT NOT NULL,
    "requestId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YeuCauTep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "YeuCauTep_storedName_key" ON "YeuCauTep"("storedName");
CREATE INDEX "YeuCauTep_nguoiTaiId_idx" ON "YeuCauTep"("nguoiTaiId");
CREATE INDEX "YeuCauTep_requestId_idx" ON "YeuCauTep"("requestId");

ALTER TABLE "YeuCauTep" ADD CONSTRAINT "YeuCauTep_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
