-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'Notice';
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3);
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "duration" TEXT;
