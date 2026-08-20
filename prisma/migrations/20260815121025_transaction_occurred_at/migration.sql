-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "materialId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    "note" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_InventoryTransaction" ("createdAt", "id", "materialId", "note", "quantity", "type", "vesselId", "warehouseId") SELECT "createdAt", "id", "materialId", "note", "quantity", "type", "vesselId", "warehouseId" FROM "InventoryTransaction";
DROP TABLE "InventoryTransaction";
ALTER TABLE "new_InventoryTransaction" RENAME TO "InventoryTransaction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
