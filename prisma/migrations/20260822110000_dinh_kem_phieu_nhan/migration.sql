-- Dinh kem ban goc (BDN scan / phieu giao) vao phieu nhan.
-- AlterTable
ALTER TABLE "ConsumableReceipt" ADD COLUMN     "attachName" TEXT,
ADD COLUMN     "attachSize" INTEGER,
ADD COLUMN     "attachStored" TEXT;
