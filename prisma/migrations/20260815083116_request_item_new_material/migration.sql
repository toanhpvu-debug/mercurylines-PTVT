-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MaterialRequestItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requestId" INTEGER NOT NULL,
    "materialId" INTEGER,
    "itemName" TEXT,
    "itemCode" TEXT,
    "itemUom" TEXT,
    "quantity" REAL NOT NULL,
    "robSnapshot" REAL NOT NULL DEFAULT 0,
    "approvedQuantity" REAL NOT NULL DEFAULT 0,
    "suppliedQuantity" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    CONSTRAINT "MaterialRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaterialRequestItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MaterialRequestItem" ("approvedQuantity", "id", "materialId", "note", "quantity", "requestId", "robSnapshot", "suppliedQuantity") SELECT "approvedQuantity", "id", "materialId", "note", "quantity", "requestId", "robSnapshot", "suppliedQuantity" FROM "MaterialRequestItem";
DROP TABLE "MaterialRequestItem";
ALTER TABLE "new_MaterialRequestItem" RENAME TO "MaterialRequestItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
