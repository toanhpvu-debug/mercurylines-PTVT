-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LashingReportLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reportId" INTEGER NOT NULL,
    "gearId" INTEGER NOT NULL,
    "gearName" TEXT NOT NULL DEFAULT '',
    "partNo" TEXT,
    "minQty" REAL NOT NULL DEFAULT 0,
    "standardQty" REAL NOT NULL DEFAULT 0,
    "inOrder" REAL NOT NULL DEFAULT 0,
    "outOfOrder" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "LashingReportLine_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "LashingReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LashingReportLine_gearId_fkey" FOREIGN KEY ("gearId") REFERENCES "LashingGear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LashingReportLine" ("gearId", "id", "inOrder", "outOfOrder", "reportId") SELECT "gearId", "id", "inOrder", "outOfOrder", "reportId" FROM "LashingReportLine";
DROP TABLE "LashingReportLine";
ALTER TABLE "new_LashingReportLine" RENAME TO "LashingReportLine";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
