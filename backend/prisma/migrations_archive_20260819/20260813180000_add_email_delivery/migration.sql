-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "messageId" TEXT,
    "processingOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailDelivery_eventId_key" ON "EmailDelivery"("eventId");

-- CreateIndex
CREATE INDEX "EmailDelivery_recipient_idx" ON "EmailDelivery"("recipient");

-- CreateIndex
CREATE INDEX "EmailDelivery_sentAt_idx" ON "EmailDelivery"("sentAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_eventId_status_idx" ON "EmailDelivery"("eventId", "status");

-- CreateIndex
CREATE INDEX "EmailDelivery_status_leaseExpiresAt_idx" ON "EmailDelivery"("status", "leaseExpiresAt");
