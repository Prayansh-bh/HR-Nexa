-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantFeatureOverride" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "grantedBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantFeatureOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TenantFeatureOverride_companyId_featureKey_key" ON "TenantFeatureOverride"("companyId", "featureKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TenantFeatureOverride_companyId_idx" ON "TenantFeatureOverride"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TenantFeatureOverride_featureKey_idx" ON "TenantFeatureOverride"("featureKey");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TenantFeatureOverride_companyId_fkey'
    ) THEN
        ALTER TABLE "TenantFeatureOverride" ADD CONSTRAINT "TenantFeatureOverride_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
