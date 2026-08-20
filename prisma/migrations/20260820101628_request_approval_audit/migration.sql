-- AlterTable
ALTER TABLE "MaterialRequest" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "MaterialRequest" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "MaterialRequest" ADD COLUMN "rejectedAt" DATETIME;
ALTER TABLE "MaterialRequest" ADD COLUMN "rejectedBy" TEXT;
ALTER TABLE "MaterialRequest" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "MaterialRequest" ADD COLUMN "submittedAt" DATETIME;
ALTER TABLE "MaterialRequest" ADD COLUMN "submittedBy" TEXT;

-- CreateTable
CREATE TABLE "MaterialRequestEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requestId" INTEGER NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
