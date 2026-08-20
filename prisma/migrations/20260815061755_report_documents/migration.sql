-- CreateTable
CREATE TABLE "ReportDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vesselId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "period" TEXT,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "note" TEXT,
    "uploadedById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportDocument_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReportDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportDocument_storedName_key" ON "ReportDocument"("storedName");
