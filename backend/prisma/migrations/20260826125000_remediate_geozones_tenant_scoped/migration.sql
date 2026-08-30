-- AlterTable: AttendanceSetting
ALTER TABLE "AttendanceSetting"
ADD COLUMN IF NOT EXISTS "enableGeofencing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "geofenceOnClockOut" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: GeoZone
ALTER TABLE "GeoZone"
ADD COLUMN IF NOT EXISTS "companyId" TEXT,
ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "radiusMeters" DOUBLE PRECISION NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;

-- Backfill legacy records: link to Acme Corp ('C1'), parse numeric latitude and radius, preserve missing longitude as NULL, disable zone
UPDATE "GeoZone"
SET "companyId" = 'C1',
    "latitude" = CASE
      WHEN "lat" IS NOT NULL AND "lat" ~ '^-?[0-9]+(\.[0-9]+)?$' THEN CAST("lat" AS DOUBLE PRECISION)
      ELSE NULL
    END,
    "longitude" = NULL,
    "radiusMeters" = CASE
      WHEN "radius" IS NOT NULL AND REPLACE("radius", 'm', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN CAST(REPLACE("radius", 'm', '') AS DOUBLE PRECISION)
      ELSE 100.0
    END,
    "enabled" = false
WHERE "companyId" IS NULL;

-- Enforce NOT NULL on companyId
ALTER TABLE "GeoZone" ALTER COLUMN "companyId" SET NOT NULL;

-- Drop legacy columns
ALTER TABLE "GeoZone"
DROP COLUMN IF EXISTS "lat",
DROP COLUMN IF EXISTS "radius",
DROP COLUMN IF EXISTS "employees";

-- Drop legacy global name unique constraint
DROP INDEX IF EXISTS "GeoZone_name_key";

-- Create new tenant-scoped unique index & company index
CREATE UNIQUE INDEX IF NOT EXISTS "GeoZone_name_companyId_key" ON "GeoZone"("name", "companyId");
CREATE INDEX IF NOT EXISTS "GeoZone_companyId_idx" ON "GeoZone"("companyId");

-- Add ForeignKey to Company
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GeoZone_companyId_fkey'
    ) THEN
        ALTER TABLE "GeoZone" ADD CONSTRAINT "GeoZone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
