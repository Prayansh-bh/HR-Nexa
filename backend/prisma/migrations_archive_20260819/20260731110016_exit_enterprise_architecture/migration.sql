/*
  Warnings:

  - You are about to drop the column `noticePeriodDays` on the `Exit` table. All the data in the column will be lost.
  - You are about to alter the column `grossAmount` on the `ExitSettlement` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `deductions` on the `ExitSettlement` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `leaveEncashment` on the `ExitSettlement` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `bonus` on the `ExitSettlement` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `recoveries` on the `ExitSettlement` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `netPayable` on the `ExitSettlement` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - The `paymentStatus` column on the `ExitSettlement` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `role` on the `ExitApproval` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `action` on the `ExitApproval` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `ExitDocument` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ExitApproverRole" AS ENUM ('MANAGER', 'HR_ADMIN', 'FINANCE', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ExitDocumentType" AS ENUM ('RESIGNATION', 'ACCEPTANCE', 'RELIEVING', 'EXPERIENCE', 'SETTLEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "SettlementPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'FAILED');

-- AlterTable
ALTER TABLE "Exit" DROP COLUMN "noticePeriodDays",
ADD COLUMN     "noticeEndDate" TIMESTAMP(3),
ADD COLUMN     "noticeStartDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ExitApproval" DROP COLUMN "role",
ADD COLUMN     "role" "ExitApproverRole" NOT NULL,
DROP COLUMN "action",
ADD COLUMN     "action" "ExitAction" NOT NULL;

-- AlterTable
ALTER TABLE "ExitDocument" DROP COLUMN "type",
ADD COLUMN     "type" "ExitDocumentType" NOT NULL;

-- AlterTable
ALTER TABLE "ExitInterview" ADD COLUMN     "eligibleForRehire" BOOLEAN,
ADD COLUMN     "interviewerId" TEXT;

-- AlterTable
ALTER TABLE "ExitSettlement" ALTER COLUMN "grossAmount" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "deductions" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "leaveEncashment" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "bonus" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "recoveries" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "netPayable" SET DATA TYPE DECIMAL(65,30),
DROP COLUMN "paymentStatus",
ADD COLUMN     "paymentStatus" "SettlementPaymentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "ExitTimeline" ADD COLUMN     "newStage" "ExitStage",
ADD COLUMN     "oldStage" "ExitStage";

-- CreateTable
CREATE TABLE "ExitChecklistTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "department" "ChecklistDepartment" NOT NULL,
    "task" TEXT NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExitChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExitInterview" ADD CONSTRAINT "ExitInterview_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitChecklistTemplate" ADD CONSTRAINT "ExitChecklistTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
