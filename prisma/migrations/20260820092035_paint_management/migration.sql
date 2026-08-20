-- CreateTable
CREATE TABLE "PaintProduct" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maker" TEXT,
    "paintType" TEXT NOT NULL DEFAULT 'OTHER',
    "colorCode" TEXT,
    "colorName" TEXT,
    "uom" TEXT NOT NULL DEFAULT 'L',
    "packSize" REAL NOT NULL DEFAULT 0,
    "coverage" REAL NOT NULL DEFAULT 0,
    "dftPerCoat" REAL NOT NULL DEFAULT 0,
    "thinner" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PaintArea" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vesselId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "areaM2" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaintArea_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaintSchemeLayer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "areaId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "layerNo" INTEGER NOT NULL DEFAULT 1,
    "coats" INTEGER NOT NULL DEFAULT 1,
    "dft" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaintSchemeLayer_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "PaintArea" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaintSchemeLayer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PaintProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaintStock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vesselId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "minQty" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaintStock_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaintStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PaintProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaintTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vesselId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "jobId" INTEGER,
    "note" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaintTransaction_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaintTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PaintProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaintTransaction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PaintJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaintJob" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vesselId" INTEGER NOT NULL,
    "areaId" INTEGER,
    "jobDate" DATETIME NOT NULL,
    "paintedM2" REAL NOT NULL DEFAULT 0,
    "coats" INTEGER NOT NULL DEFAULT 1,
    "weather" TEXT,
    "airTemp" REAL,
    "humidity" REAL,
    "surfaceTemp" REAL,
    "performedBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaintJob_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaintJob_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "PaintArea" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaintJobLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    "note" TEXT,
    CONSTRAINT "PaintJobLine_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PaintJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaintJobLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PaintProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PaintProduct_code_key" ON "PaintProduct"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaintArea_vesselId_name_key" ON "PaintArea"("vesselId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PaintStock_vesselId_productId_key" ON "PaintStock"("vesselId", "productId");
