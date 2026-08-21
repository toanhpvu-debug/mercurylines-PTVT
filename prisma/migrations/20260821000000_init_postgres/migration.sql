-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CREW',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "vesselId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportDocument" (
    "id" SERIAL NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vessel" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imo" TEXT,
    "flag" TEXT,
    "vesselType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "formStandard" TEXT NOT NULL DEFAULT 'MLS',
    "hullNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vessel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warehouseType" TEXT NOT NULL,
    "vesselId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" SERIAL NOT NULL,
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
    "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VesselMaterial" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VesselMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormStandard" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "repAddress" TEXT,
    "tel" TEXT,
    "email" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" SERIAL NOT NULL,
    "materialId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reservedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "materialId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequest" (
    "id" SERIAL NOT NULL,
    "requestNo" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'STORE',
    "vesselId" INTEGER NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "requiredDate" TIMESTAMP(3),
    "purpose" TEXT,
    "notes" TEXT,
    "equipment" TEXT,
    "maker" TEXT,
    "serialNo" TEXT,
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequestEvent" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LashingGear" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "partNo" TEXT,
    "minQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "standardQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LashingGear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LashingReport" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "voyageNo" TEXT,
    "position" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LashingReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LashingReportLine" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "gearId" INTEGER NOT NULL,
    "gearName" TEXT NOT NULL DEFAULT '',
    "partNo" TEXT,
    "minQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "standardQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outOfOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "LashingReportLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequestItem" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "materialId" INTEGER,
    "itemName" TEXT,
    "itemCode" TEXT,
    "itemUom" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "robSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approvedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "suppliedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "MaterialRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" SERIAL NOT NULL,
    "poNo" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "orderDate" TIMESTAMP(3),
    "expectedDate" TIMESTAMP(3),
    "notes" TEXT,
    "subject" TEXT,
    "supplierRef" TEXT,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transportFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" SERIAL NOT NULL,
    "poId" INTEGER NOT NULL,
    "requestItemId" INTEGER,
    "materialId" INTEGER,
    "description" TEXT NOT NULL,
    "partNo" TEXT,
    "uom" TEXT NOT NULL DEFAULT 'PCS',
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantityReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warehouseId" INTEGER,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaintProduct" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maker" TEXT,
    "paintType" TEXT NOT NULL DEFAULT 'OTHER',
    "colorCode" TEXT,
    "colorName" TEXT,
    "uom" TEXT NOT NULL DEFAULT 'L',
    "packSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dftPerCoat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thinner" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaintProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaintArea" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "areaM2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaintArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaintSchemeLayer" (
    "id" SERIAL NOT NULL,
    "areaId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "layerNo" INTEGER NOT NULL DEFAULT 1,
    "coats" INTEGER NOT NULL DEFAULT 1,
    "dft" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaintSchemeLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaintStock" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaintStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaintTransaction" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "jobId" INTEGER,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaintTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaintJob" (
    "id" SERIAL NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "areaId" INTEGER,
    "jobDate" TIMESTAMP(3) NOT NULL,
    "paintedM2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coats" INTEGER NOT NULL DEFAULT 1,
    "weather" TEXT,
    "airTemp" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "surfaceTemp" DOUBLE PRECISION,
    "performedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaintJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaintJobLine" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,

    CONSTRAINT "PaintJobLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_vesselId_idx" ON "User"("vesselId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportDocument_storedName_key" ON "ReportDocument"("storedName");

-- CreateIndex
CREATE INDEX "ReportDocument_vesselId_idx" ON "ReportDocument"("vesselId");

-- CreateIndex
CREATE INDEX "ReportDocument_uploadedById_idx" ON "ReportDocument"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "Vessel_code_key" ON "Vessel"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "Warehouse_vesselId_idx" ON "Warehouse"("vesselId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");

-- CreateIndex
CREATE INDEX "Material_categoryId_idx" ON "Material"("categoryId");

-- CreateIndex
CREATE INDEX "Material_materialType_idx" ON "Material"("materialType");

-- CreateIndex
CREATE INDEX "Material_isActive_idx" ON "Material"("isActive");

-- CreateIndex
CREATE INDEX "VesselMaterial_materialId_idx" ON "VesselMaterial"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "VesselMaterial_vesselId_materialId_key" ON "VesselMaterial"("vesselId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "FormStandard_code_key" ON "FormStandard"("code");

-- CreateIndex
CREATE INDEX "Inventory_vesselId_idx" ON "Inventory"("vesselId");

-- CreateIndex
CREATE INDEX "Inventory_warehouseId_idx" ON "Inventory"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_materialId_warehouseId_key" ON "Inventory"("materialId", "warehouseId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_vesselId_idx" ON "InventoryTransaction"("vesselId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_materialId_idx" ON "InventoryTransaction"("materialId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_warehouseId_idx" ON "InventoryTransaction"("warehouseId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_occurredAt_idx" ON "InventoryTransaction"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialRequest_requestNo_key" ON "MaterialRequest"("requestNo");

-- CreateIndex
CREATE INDEX "MaterialRequest_vesselId_idx" ON "MaterialRequest"("vesselId");

-- CreateIndex
CREATE INDEX "MaterialRequest_status_idx" ON "MaterialRequest"("status");

-- CreateIndex
CREATE INDEX "MaterialRequestEvent_requestId_idx" ON "MaterialRequestEvent"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "LashingGear_vesselId_name_key" ON "LashingGear"("vesselId", "name");

-- CreateIndex
CREATE INDEX "LashingReport_vesselId_idx" ON "LashingReport"("vesselId");

-- CreateIndex
CREATE INDEX "LashingReportLine_reportId_idx" ON "LashingReportLine"("reportId");

-- CreateIndex
CREATE INDEX "LashingReportLine_gearId_idx" ON "LashingReportLine"("gearId");

-- CreateIndex
CREATE INDEX "MaterialRequestItem_requestId_idx" ON "MaterialRequestItem"("requestId");

-- CreateIndex
CREATE INDEX "MaterialRequestItem_materialId_idx" ON "MaterialRequestItem"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNo_key" ON "PurchaseOrder"("poNo");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vesselId_idx" ON "PurchaseOrder"("vesselId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_poId_idx" ON "PurchaseOrderItem"("poId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_requestItemId_idx" ON "PurchaseOrderItem"("requestItemId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_materialId_idx" ON "PurchaseOrderItem"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "PaintProduct_code_key" ON "PaintProduct"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaintArea_vesselId_name_key" ON "PaintArea"("vesselId", "name");

-- CreateIndex
CREATE INDEX "PaintSchemeLayer_areaId_idx" ON "PaintSchemeLayer"("areaId");

-- CreateIndex
CREATE INDEX "PaintSchemeLayer_productId_idx" ON "PaintSchemeLayer"("productId");

-- CreateIndex
CREATE INDEX "PaintStock_productId_idx" ON "PaintStock"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PaintStock_vesselId_productId_key" ON "PaintStock"("vesselId", "productId");

-- CreateIndex
CREATE INDEX "PaintTransaction_vesselId_idx" ON "PaintTransaction"("vesselId");

-- CreateIndex
CREATE INDEX "PaintTransaction_productId_idx" ON "PaintTransaction"("productId");

-- CreateIndex
CREATE INDEX "PaintTransaction_jobId_idx" ON "PaintTransaction"("jobId");

-- CreateIndex
CREATE INDEX "PaintTransaction_occurredAt_idx" ON "PaintTransaction"("occurredAt");

-- CreateIndex
CREATE INDEX "PaintJob_vesselId_idx" ON "PaintJob"("vesselId");

-- CreateIndex
CREATE INDEX "PaintJob_areaId_idx" ON "PaintJob"("areaId");

-- CreateIndex
CREATE INDEX "PaintJobLine_jobId_idx" ON "PaintJobLine"("jobId");

-- CreateIndex
CREATE INDEX "PaintJobLine_productId_idx" ON "PaintJobLine"("productId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDocument" ADD CONSTRAINT "ReportDocument_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDocument" ADD CONSTRAINT "ReportDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VesselMaterial" ADD CONSTRAINT "VesselMaterial_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VesselMaterial" ADD CONSTRAINT "VesselMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestEvent" ADD CONSTRAINT "MaterialRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LashingGear" ADD CONSTRAINT "LashingGear_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LashingReport" ADD CONSTRAINT "LashingReport_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LashingReportLine" ADD CONSTRAINT "LashingReportLine_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "LashingReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LashingReportLine" ADD CONSTRAINT "LashingReportLine_gearId_fkey" FOREIGN KEY ("gearId") REFERENCES "LashingGear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestItem" ADD CONSTRAINT "MaterialRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestItem" ADD CONSTRAINT "MaterialRequestItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_requestItemId_fkey" FOREIGN KEY ("requestItemId") REFERENCES "MaterialRequestItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintArea" ADD CONSTRAINT "PaintArea_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintSchemeLayer" ADD CONSTRAINT "PaintSchemeLayer_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "PaintArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintSchemeLayer" ADD CONSTRAINT "PaintSchemeLayer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PaintProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintStock" ADD CONSTRAINT "PaintStock_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintStock" ADD CONSTRAINT "PaintStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PaintProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintTransaction" ADD CONSTRAINT "PaintTransaction_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintTransaction" ADD CONSTRAINT "PaintTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PaintProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintTransaction" ADD CONSTRAINT "PaintTransaction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PaintJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintJob" ADD CONSTRAINT "PaintJob_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintJob" ADD CONSTRAINT "PaintJob_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "PaintArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintJobLine" ADD CONSTRAINT "PaintJobLine_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PaintJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintJobLine" ADD CONSTRAINT "PaintJobLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PaintProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

