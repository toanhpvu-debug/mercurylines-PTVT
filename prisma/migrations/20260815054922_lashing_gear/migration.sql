-- CreateTable
CREATE TABLE "LashingGear" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vesselId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "partNo" TEXT,
    "minQty" REAL NOT NULL DEFAULT 0,
    "standardQty" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LashingGear_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LashingReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vesselId" INTEGER NOT NULL,
    "reportDate" DATETIME NOT NULL,
    "voyageNo" TEXT,
    "position" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LashingReport_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LashingReportLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reportId" INTEGER NOT NULL,
    "gearId" INTEGER NOT NULL,
    "inOrder" REAL NOT NULL DEFAULT 0,
    "outOfOrder" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "LashingReportLine_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "LashingReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LashingReportLine_gearId_fkey" FOREIGN KEY ("gearId") REFERENCES "LashingGear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LashingGear_vesselId_name_key" ON "LashingGear"("vesselId", "name");
