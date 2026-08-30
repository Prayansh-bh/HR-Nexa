/*
  Warnings:

  - Added the required column `updatedAt` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('EMPLOYEE', 'HR_LETTER', 'COMPLIANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('VALID', 'EXPIRING', 'EXPIRED');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "category" "DocumentCategory" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "filePath" TEXT,
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'VALID',
ADD COLUMN     "title" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "uploadedById" TEXT,
ALTER COLUMN "employeeId" DROP NOT NULL,
ALTER COLUMN "uploaded" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payroll" ADD COLUMN     "adjustments" JSONB,
ADD COLUMN     "calculationVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "components" JSONB,
ALTER COLUMN "payDate" DROP NOT NULL,
ALTER COLUMN "status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "storageLimitMB" INTEGER DEFAULT 10240,
ADD COLUMN     "storageUsedMB" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "ReviewCycleParticipant" (
    "id" TEXT NOT NULL,
    "reviewCycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewCycleParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewCycleParticipant_reviewCycleId_employeeId_key" ON "ReviewCycleParticipant"("reviewCycleId", "employeeId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCycleParticipant" ADD CONSTRAINT "ReviewCycleParticipant_reviewCycleId_fkey" FOREIGN KEY ("reviewCycleId") REFERENCES "ReviewCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCycleParticipant" ADD CONSTRAINT "ReviewCycleParticipant_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
