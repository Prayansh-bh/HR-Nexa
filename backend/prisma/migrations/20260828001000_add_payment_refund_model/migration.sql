-- AlterTable
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "refundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "gatewayPaymentId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentRecord_gatewayPaymentId_idx" ON "PaymentRecord"("gatewayPaymentId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentRefund" (
    "id" TEXT NOT NULL,
    "paymentRecordId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "gatewayPaymentId" TEXT NOT NULL,
    "gatewayRefundId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "receipt" TEXT,
    "requestedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRefund_gatewayRefundId_key" ON "PaymentRefund"("gatewayRefundId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentRefund_paymentRecordId_idx" ON "PaymentRefund"("paymentRecordId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentRefund_gatewayPaymentId_idx" ON "PaymentRefund"("gatewayPaymentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentRefund_status_idx" ON "PaymentRefund"("status");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PaymentRefund_paymentRecordId_fkey'
    ) THEN
        ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentRecordId_fkey" FOREIGN KEY ("paymentRecordId") REFERENCES "PaymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
