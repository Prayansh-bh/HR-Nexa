-- CreateEnum
CREATE TYPE "ExitStage" AS ENUM ('SUBMITTED', 'MANAGER_APPROVED', 'HR_APPROVED', 'NOTICE_PERIOD', 'CHECKLIST', 'INTERVIEW', 'PAYROLL_SETTLEMENT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ExitStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChecklistDepartment" AS ENUM ('IT', 'HR', 'FINANCE', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ExitAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CHECKLIST_COMPLETED', 'INTERVIEW_COMPLETED', 'SETTLEMENT_GENERATED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Exit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "proposedLastWorkingDay" TIMESTAMP(3) NOT NULL,
    "noticeBuyoutRequest" BOOLEAN NOT NULL DEFAULT false,
    "additionalComments" TEXT,
    "stage" "ExitStage" NOT NULL DEFAULT 'SUBMITTED',
    "status" "ExitStatus" NOT NULL DEFAULT 'PENDING',
    "approvedLastWorkingDay" TIMESTAMP(3),
    "noticePeriodDays" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitApproval" (
    "id" TEXT NOT NULL,
    "exitId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExitApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitChecklistItem" (
    "id" TEXT NOT NULL,
    "exitId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "department" "ChecklistDepartment" NOT NULL,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExitChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitInterview" (
    "id" TEXT NOT NULL,
    "exitId" TEXT NOT NULL,
    "reasonForLeaving" TEXT NOT NULL,
    "managerFeedback" TEXT NOT NULL,
    "workEnvironmentRating" INTEGER NOT NULL,
    "suggestions" TEXT,
    "wouldRejoin" BOOLEAN NOT NULL,
    "additionalNotes" TEXT,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExitInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitTimeline" (
    "id" TEXT NOT NULL,
    "exitId" TEXT NOT NULL,
    "action" "ExitAction" NOT NULL,
    "description" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExitTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitDocument" (
    "id" TEXT NOT NULL,
    "exitId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExitDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitSettlement" (
    "id" TEXT NOT NULL,
    "exitId" TEXT NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "deductions" DOUBLE PRECISION NOT NULL,
    "leaveEncashment" DOUBLE PRECISION NOT NULL,
    "bonus" DOUBLE PRECISION NOT NULL,
    "recoveries" DOUBLE PRECISION NOT NULL,
    "netPayable" DOUBLE PRECISION NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'Pending',
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExitSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exit_companyId_idx" ON "Exit"("companyId");

-- CreateIndex
CREATE INDEX "Exit_employeeId_idx" ON "Exit"("employeeId");

-- CreateIndex
CREATE INDEX "Exit_stage_idx" ON "Exit"("stage");

-- CreateIndex
CREATE INDEX "Exit_status_idx" ON "Exit"("status");

-- CreateIndex
CREATE INDEX "Exit_createdAt_idx" ON "Exit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExitInterview_exitId_key" ON "ExitInterview"("exitId");

-- CreateIndex
CREATE UNIQUE INDEX "ExitSettlement_exitId_key" ON "ExitSettlement"("exitId");

-- AddForeignKey
ALTER TABLE "Exit" ADD CONSTRAINT "Exit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exit" ADD CONSTRAINT "Exit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitApproval" ADD CONSTRAINT "ExitApproval_exitId_fkey" FOREIGN KEY ("exitId") REFERENCES "Exit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitApproval" ADD CONSTRAINT "ExitApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitChecklistItem" ADD CONSTRAINT "ExitChecklistItem_exitId_fkey" FOREIGN KEY ("exitId") REFERENCES "Exit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitChecklistItem" ADD CONSTRAINT "ExitChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitInterview" ADD CONSTRAINT "ExitInterview_exitId_fkey" FOREIGN KEY ("exitId") REFERENCES "Exit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitTimeline" ADD CONSTRAINT "ExitTimeline_exitId_fkey" FOREIGN KEY ("exitId") REFERENCES "Exit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitDocument" ADD CONSTRAINT "ExitDocument_exitId_fkey" FOREIGN KEY ("exitId") REFERENCES "Exit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitSettlement" ADD CONSTRAINT "ExitSettlement_exitId_fkey" FOREIGN KEY ("exitId") REFERENCES "Exit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
