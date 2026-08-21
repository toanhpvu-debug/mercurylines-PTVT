-- Vet phe duyet hai cap: tau duyet truoc, cong ty duyet sau.
-- AlterTable
ALTER TABLE "MaterialRequest" ADD COLUMN     "shipApprovedAt" TIMESTAMP(3),
ADD COLUMN     "shipApprovedBy" TEXT,
ADD COLUMN     "shipApprovedRole" TEXT;
