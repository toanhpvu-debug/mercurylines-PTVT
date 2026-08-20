-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PurchaseOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poNo" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "orderDate" DATETIME,
    "expectedDate" DATETIME,
    "notes" TEXT,
    "subject" TEXT,
    "supplierRef" TEXT,
    "discountPercent" REAL NOT NULL DEFAULT 0,
    "transportFee" REAL NOT NULL DEFAULT 0,
    "deliveryFee" REAL NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseOrder" ("createdAt", "createdBy", "currency", "expectedDate", "id", "notes", "orderDate", "poNo", "status", "supplierId", "updatedAt", "vesselId") SELECT "createdAt", "createdBy", "currency", "expectedDate", "id", "notes", "orderDate", "poNo", "status", "supplierId", "updatedAt", "vesselId" FROM "PurchaseOrder";
DROP TABLE "PurchaseOrder";
ALTER TABLE "new_PurchaseOrder" RENAME TO "PurchaseOrder";
CREATE UNIQUE INDEX "PurchaseOrder_poNo_key" ON "PurchaseOrder"("poNo");
CREATE TABLE "new_Vessel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imo" TEXT,
    "flag" TEXT,
    "vesselType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "formStandard" TEXT NOT NULL DEFAULT 'MLS',
    "hullNo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Vessel" ("code", "createdAt", "flag", "id", "imo", "name", "status", "updatedAt", "vesselType") SELECT "code", "createdAt", "flag", "id", "imo", "name", "status", "updatedAt", "vesselType" FROM "Vessel";
DROP TABLE "Vessel";
ALTER TABLE "new_Vessel" RENAME TO "Vessel";
CREATE UNIQUE INDEX "Vessel_code_key" ON "Vessel"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
