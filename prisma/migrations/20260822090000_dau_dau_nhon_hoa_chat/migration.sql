-- CreateTable
CREATE TABLE "ConsumableProduct" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "category" TEXT NOT NULL,
    "grade" TEXT NOT NULL DEFAULT 'OTHER',
    "maker" TEXT,
    "uom" TEXT NOT NULL DEFAULT 'MT',
    "packSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sulphurMax" DOUBLE PRECISION,
    "viscosity" DOUBLE PRECISION,
    "density" DOUBLE PRECISION,
    "bnValue" DOUBLE PRECISION,
    "hazardClass" TEXT,
    "shelfLifeMonths" INTEGER,
    "msdsNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConsumableProduct_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "ConsumableStock" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConsumableStock_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "ConsumableReceipt" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "docNo" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "port" TEXT,
    "supplier" TEXT,
    "barge" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "density" DOUBLE PRECISION,
    "viscosity" DOUBLE PRECISION,
    "sulphur" DOUBLE PRECISION,
    "waterContent" DOUBLE PRECISION,
    "flashPoint" DOUBLE PRECISION,
    "bnValue" DOUBLE PRECISION,
    "expiryDate" TIMESTAMP(3),
    "sampleSealNo" TEXT,
    "sampleKeepUntil" TIMESTAMP(3),
    "unitPrice" DOUBLE PRECISION,
    "currency" TEXT,
    "note" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConsumableReceipt_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "ConsumableTransaction" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "consumer" TEXT,
    "receiptId" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsumableTransaction_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "ConsumableProduct_code_key" ON "ConsumableProduct"("code");
-- CreateIndex
CREATE INDEX "ConsumableProduct_category_idx" ON "ConsumableProduct"("category");
-- CreateIndex
CREATE INDEX "ConsumableStock_productId_idx" ON "ConsumableStock"("productId");
-- CreateIndex
CREATE UNIQUE INDEX "ConsumableStock_vesselId_productId_key" ON "ConsumableStock"("vesselId", "productId");
-- CreateIndex
CREATE INDEX "ConsumableReceipt_vesselId_idx" ON "ConsumableReceipt"("vesselId");
-- CreateIndex
CREATE INDEX "ConsumableReceipt_productId_idx" ON "ConsumableReceipt"("productId");
-- CreateIndex
CREATE INDEX "ConsumableReceipt_receivedAt_idx" ON "ConsumableReceipt"("receivedAt");
-- CreateIndex
CREATE INDEX "ConsumableTransaction_vesselId_idx" ON "ConsumableTransaction"("vesselId");
-- CreateIndex
CREATE INDEX "ConsumableTransaction_productId_idx" ON "ConsumableTransaction"("productId");
-- CreateIndex
CREATE INDEX "ConsumableTransaction_occurredAt_idx" ON "ConsumableTransaction"("occurredAt");
-- CreateIndex
CREATE INDEX "ConsumableTransaction_receiptId_idx" ON "ConsumableTransaction"("receiptId");
-- AddForeignKey
ALTER TABLE "ConsumableStock" ADD CONSTRAINT "ConsumableStock_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ConsumableStock" ADD CONSTRAINT "ConsumableStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ConsumableProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ConsumableReceipt" ADD CONSTRAINT "ConsumableReceipt_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ConsumableReceipt" ADD CONSTRAINT "ConsumableReceipt_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ConsumableProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ConsumableTransaction" ADD CONSTRAINT "ConsumableTransaction_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ConsumableTransaction" ADD CONSTRAINT "ConsumableTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ConsumableProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ConsumableTransaction" ADD CONSTRAINT "ConsumableTransaction_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "ConsumableReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
