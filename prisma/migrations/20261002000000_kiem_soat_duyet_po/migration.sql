-- Kiểm soát duyệt PO: lãnh đạo phòng KT-VT do quản trị chỉ định, ủy quyền chỉ
-- để duyệt PO, lịch sử trình / duyệt / trả lại.
ALTER TABLE "User" ADD COLUMN "duyetDonMua" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Delegation" ADD COLUMN "phamVi" TEXT;

CREATE TABLE "LichSuDuyetPo" (
    "id" SERIAL NOT NULL,
    "poId" INTEGER NOT NULL,
    "poNo" TEXT NOT NULL,
    "hanhDong" TEXT NOT NULL,
    "nguoiId" INTEGER,
    "nguoi" TEXT NOT NULL,
    "kyThayId" INTEGER,
    "kyThay" TEXT,
    "ghiChu" TEXT,
    "tong" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tienTe" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LichSuDuyetPo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LichSuDuyetPo_poId_idx" ON "LichSuDuyetPo"("poId");
CREATE INDEX "LichSuDuyetPo_createdAt_idx" ON "LichSuDuyetPo"("createdAt");
