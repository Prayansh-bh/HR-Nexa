-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('ONLINE', 'MOBILE', 'BIOMETRIC', 'MANUAL', 'IMPORT', 'API', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "source" "AttendanceSource" NOT NULL DEFAULT 'UNKNOWN';
