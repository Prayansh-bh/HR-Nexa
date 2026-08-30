-- AlterTable
ALTER TABLE "SystemNotification" ADD COLUMN IF NOT EXISTS "dedupKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SystemNotification_dedupKey_key" ON "SystemNotification"("dedupKey");
