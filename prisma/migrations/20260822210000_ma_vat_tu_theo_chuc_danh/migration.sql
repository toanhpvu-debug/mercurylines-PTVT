-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "department" TEXT,
ADD COLUMN     "equipGroup" TEXT,
ADD COLUMN     "responsibleRank" TEXT;

-- CreateIndex
CREATE INDEX "Material_responsibleRank_idx" ON "Material"("responsibleRank");

-- CreateIndex
CREATE INDEX "Material_department_equipGroup_idx" ON "Material"("department", "equipGroup");
