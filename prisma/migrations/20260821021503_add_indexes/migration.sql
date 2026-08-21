-- CreateIndex
CREATE INDEX "Inventory_vesselId_idx" ON "Inventory"("vesselId");

-- CreateIndex
CREATE INDEX "Inventory_warehouseId_idx" ON "Inventory"("warehouseId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_vesselId_idx" ON "InventoryTransaction"("vesselId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_materialId_idx" ON "InventoryTransaction"("materialId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_warehouseId_idx" ON "InventoryTransaction"("warehouseId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_occurredAt_idx" ON "InventoryTransaction"("occurredAt");

-- CreateIndex
CREATE INDEX "LashingReport_vesselId_idx" ON "LashingReport"("vesselId");

-- CreateIndex
CREATE INDEX "LashingReportLine_reportId_idx" ON "LashingReportLine"("reportId");

-- CreateIndex
CREATE INDEX "LashingReportLine_gearId_idx" ON "LashingReportLine"("gearId");

-- CreateIndex
CREATE INDEX "Material_categoryId_idx" ON "Material"("categoryId");

-- CreateIndex
CREATE INDEX "Material_materialType_idx" ON "Material"("materialType");

-- CreateIndex
CREATE INDEX "Material_isActive_idx" ON "Material"("isActive");

-- CreateIndex
CREATE INDEX "MaterialRequest_vesselId_idx" ON "MaterialRequest"("vesselId");

-- CreateIndex
CREATE INDEX "MaterialRequest_status_idx" ON "MaterialRequest"("status");

-- CreateIndex
CREATE INDEX "MaterialRequestEvent_requestId_idx" ON "MaterialRequestEvent"("requestId");

-- CreateIndex
CREATE INDEX "MaterialRequestItem_requestId_idx" ON "MaterialRequestItem"("requestId");

-- CreateIndex
CREATE INDEX "MaterialRequestItem_materialId_idx" ON "MaterialRequestItem"("materialId");

-- CreateIndex
CREATE INDEX "PaintJob_vesselId_idx" ON "PaintJob"("vesselId");

-- CreateIndex
CREATE INDEX "PaintJob_areaId_idx" ON "PaintJob"("areaId");

-- CreateIndex
CREATE INDEX "PaintJobLine_jobId_idx" ON "PaintJobLine"("jobId");

-- CreateIndex
CREATE INDEX "PaintJobLine_productId_idx" ON "PaintJobLine"("productId");

-- CreateIndex
CREATE INDEX "PaintSchemeLayer_areaId_idx" ON "PaintSchemeLayer"("areaId");

-- CreateIndex
CREATE INDEX "PaintSchemeLayer_productId_idx" ON "PaintSchemeLayer"("productId");

-- CreateIndex
CREATE INDEX "PaintStock_productId_idx" ON "PaintStock"("productId");

-- CreateIndex
CREATE INDEX "PaintTransaction_vesselId_idx" ON "PaintTransaction"("vesselId");

-- CreateIndex
CREATE INDEX "PaintTransaction_productId_idx" ON "PaintTransaction"("productId");

-- CreateIndex
CREATE INDEX "PaintTransaction_jobId_idx" ON "PaintTransaction"("jobId");

-- CreateIndex
CREATE INDEX "PaintTransaction_occurredAt_idx" ON "PaintTransaction"("occurredAt");

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
CREATE INDEX "ReportDocument_vesselId_idx" ON "ReportDocument"("vesselId");

-- CreateIndex
CREATE INDEX "ReportDocument_uploadedById_idx" ON "ReportDocument"("uploadedById");

-- CreateIndex
CREATE INDEX "User_vesselId_idx" ON "User"("vesselId");

-- CreateIndex
CREATE INDEX "VesselMaterial_materialId_idx" ON "VesselMaterial"("materialId");

-- CreateIndex
CREATE INDEX "Warehouse_vesselId_idx" ON "Warehouse"("vesselId");
