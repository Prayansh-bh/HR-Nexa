-- AlterTable
ALTER TABLE "Candidate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CandidateEvaluation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JobRequisition" ALTER COLUMN "updatedAt" DROP DEFAULT;
