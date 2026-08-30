-- AlterTable
ALTER TABLE "CompanyAsset" ADD COLUMN IF NOT EXISTS "assetTag" TEXT,
ADD COLUMN IF NOT EXISTS "brand" TEXT,
ADD COLUMN IF NOT EXISTS "modelNumber" TEXT,
ADD COLUMN IF NOT EXISTS "purchaseDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "purchaseCost" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS "warrantyExpiry" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "vendor" TEXT,
ADD COLUMN IF NOT EXISTS "condition" TEXT DEFAULT 'New',
ADD COLUMN IF NOT EXISTS "notes" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyAsset_companyId_assetTag_key" ON "CompanyAsset"("companyId", "assetTag");

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssetHistory" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "action" TEXT NOT NULL,
    "condition" TEXT,
    "remarks" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssetHistory_companyId_assetId_idx" ON "AssetHistory"("companyId", "assetId");
CREATE INDEX IF NOT EXISTS "AssetHistory_companyId_employeeId_idx" ON "AssetHistory"("companyId", "employeeId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AssetHistory_assetId_fkey'
    ) THEN
        ALTER TABLE "AssetHistory" ADD CONSTRAINT "AssetHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CompanyAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AssetHistory_employeeId_fkey'
    ) THEN
        ALTER TABLE "AssetHistory" ADD CONSTRAINT "AssetHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
