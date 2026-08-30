-- CreatePartialUniqueIndex for Platform Credentials (companyId IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationCredential_provider_platform_key"
ON "IntegrationCredential"("provider")
WHERE "companyId" IS NULL;

-- CreatePartialUniqueIndex for Tenant Credentials (companyId IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationCredential_provider_company_key"
ON "IntegrationCredential"("provider", "companyId")
WHERE "companyId" IS NOT NULL;
