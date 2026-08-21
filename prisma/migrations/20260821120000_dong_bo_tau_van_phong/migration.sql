-- CreateTable
CREATE TABLE "SyncState" (
    "id" SERIAL NOT NULL,
    "huong" TEXT NOT NULL,
    "vesselCode" TEXT,
    "lastSyncAt" TIMESTAMP(3) NOT NULL,
    "lastCount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "vesselCode" TEXT,
    "idRangeStart" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_huong_vesselCode_key" ON "SyncState"("huong", "vesselCode");

