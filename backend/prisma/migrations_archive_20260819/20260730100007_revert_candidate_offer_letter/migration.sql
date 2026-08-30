/*
  Warnings:

  - You are about to drop the column `candidateId` on the `Document` table. All the data in the column will be lost.
  - Made the column `employeeId` on table `Document` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_candidateId_fkey";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "candidateId",
ALTER COLUMN "employeeId" SET NOT NULL;
