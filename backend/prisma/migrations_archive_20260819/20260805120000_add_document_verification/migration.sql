-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "Document"
ADD COLUMN "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "verificationNote" TEXT,
ADD COLUMN "verifiedById" TEXT,
ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Document_companyId_verificationStatus_idx" ON "Document"("companyId", "verificationStatus");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
