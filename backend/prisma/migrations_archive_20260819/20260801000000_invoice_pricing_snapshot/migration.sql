-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "planName" TEXT,
ADD COLUMN     "planVersion" INTEGER,
ADD COLUMN     "seatCount" INTEGER,
ADD COLUMN     "storageGB" DOUBLE PRECISION,
ADD COLUMN     "unitPrice" DECIMAL(65,30);
