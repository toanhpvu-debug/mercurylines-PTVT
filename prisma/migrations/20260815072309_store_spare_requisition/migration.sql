-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Material" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "nameVn" TEXT NOT NULL,
    "nameEn" TEXT,
    "impa" TEXT,
    "issa" TEXT,
    "partNumber" TEXT,
    "manufacturer" TEXT,
    "uom" TEXT NOT NULL DEFAULT 'PCS',
    "materialType" TEXT NOT NULL DEFAULT 'STORE',
    "equipment" TEXT,
    "categoryId" INTEGER,
    "minStock" REAL NOT NULL DEFAULT 0,
    "maxStock" REAL NOT NULL DEFAULT 0,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Material_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Material" ("categoryId", "code", "createdAt", "id", "impa", "isActive", "isCritical", "issa", "manufacturer", "maxStock", "minStock", "nameEn", "nameVn", "partNumber", "uom", "updatedAt") SELECT "categoryId", "code", "createdAt", "id", "impa", "isActive", "isCritical", "issa", "manufacturer", "maxStock", "minStock", "nameEn", "nameVn", "partNumber", "uom", "updatedAt" FROM "Material";
DROP TABLE "Material";
ALTER TABLE "new_Material" RENAME TO "Material";
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");
CREATE TABLE "new_MaterialRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requestNo" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'STORE',
    "vesselId" INTEGER NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "requiredDate" DATETIME,
    "purpose" TEXT,
    "notes" TEXT,
    "equipment" TEXT,
    "maker" TEXT,
    "serialNo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaterialRequest_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MaterialRequest" ("createdAt", "department", "id", "notes", "priority", "purpose", "requestNo", "requestedBy", "requiredDate", "status", "updatedAt", "vesselId") SELECT "createdAt", "department", "id", "notes", "priority", "purpose", "requestNo", "requestedBy", "requiredDate", "status", "updatedAt", "vesselId" FROM "MaterialRequest";
DROP TABLE "MaterialRequest";
ALTER TABLE "new_MaterialRequest" RENAME TO "MaterialRequest";
CREATE UNIQUE INDEX "MaterialRequest_requestNo_key" ON "MaterialRequest"("requestNo");
CREATE TABLE "new_MaterialRequestItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requestId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    "robSnapshot" REAL NOT NULL DEFAULT 0,
    "approvedQuantity" REAL NOT NULL DEFAULT 0,
    "suppliedQuantity" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    CONSTRAINT "MaterialRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaterialRequestItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MaterialRequestItem" ("id", "materialId", "note", "quantity", "requestId", "suppliedQuantity") SELECT "id", "materialId", "note", "quantity", "requestId", "suppliedQuantity" FROM "MaterialRequestItem";
DROP TABLE "MaterialRequestItem";
ALTER TABLE "new_MaterialRequestItem" RENAME TO "MaterialRequestItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
