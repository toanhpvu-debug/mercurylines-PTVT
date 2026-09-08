-- CreateTable
CREATE TABLE "FleetAssignment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "vesselId" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FleetAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delegation" (
    "id" SERIAL NOT NULL,
    "delegatorId" INTEGER NOT NULL,
    "delegateId" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "email" TEXT,
    "role" TEXT,
    "vesselId" INTEGER,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "action" TEXT,
    "ketQua" TEXT NOT NULL DEFAULT 'OK',
    "onBehalfOfId" INTEGER,
    "detail" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FleetAssignment_vesselId_idx" ON "FleetAssignment"("vesselId");

-- CreateIndex
CREATE UNIQUE INDEX "FleetAssignment_userId_vesselId_key" ON "FleetAssignment"("userId", "vesselId");

-- CreateIndex
CREATE INDEX "Delegation_delegateId_idx" ON "Delegation"("delegateId");

-- CreateIndex
CREATE INDEX "Delegation_delegatorId_idx" ON "Delegation"("delegatorId");

-- CreateIndex
CREATE INDEX "Delegation_endAt_idx" ON "Delegation"("endAt");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_vesselId_idx" ON "AuditLog"("vesselId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "FleetAssignment" ADD CONSTRAINT "FleetAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetAssignment" ADD CONSTRAINT "FleetAssignment_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_delegatorId_fkey" FOREIGN KEY ("delegatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

