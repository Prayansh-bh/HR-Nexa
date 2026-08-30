import { PrismaClient, AttendanceSource } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting attendance source backfill...');
  const records = await prisma.attendance.findMany();
  console.log(`Found ${records.length} attendance records to process.`);

  let updatedCount = 0;

  for (const record of records) {
    let resolvedSource: AttendanceSource = AttendanceSource.UNKNOWN;

    // Rule 1: Geolocation coordinates indicate MOBILE punch
    if (
      (record.latitude && record.latitude.trim() !== '' && record.latitude.trim() !== '—') ||
      (record.longitude && record.longitude.trim() !== '' && record.longitude.trim() !== '—')
    ) {
      resolvedSource = AttendanceSource.MOBILE;
    }
    // Rule 2: Remarks matching manual administrative patterns indicate MANUAL entry
    else if (record.remarks) {
      const lowerRemarks = record.remarks.toLowerCase();
      if (
        lowerRemarks.includes('manual') ||
        lowerRemarks.includes('approved') ||
        lowerRemarks.includes('leave') ||
        lowerRemarks.includes('holiday') ||
        lowerRemarks.includes('weekly off') ||
        lowerRemarks.includes('absent') ||
        lowerRemarks.includes('not joined') ||
        lowerRemarks.includes('incomplete') ||
        lowerRemarks.includes('missing clock-out') ||
        lowerRemarks.includes('reason:') ||
        lowerRemarks.includes('sabbatical') ||
        lowerRemarks.includes('joined after')
      ) {
        resolvedSource = AttendanceSource.MANUAL;
      }
    }
    // Rule 3: Explicit device id 'WEB_APP' indicates ONLINE web punch
    else if (record.deviceId === 'WEB_APP') {
      resolvedSource = AttendanceSource.ONLINE;
    }

    // Update record if it is not already resolved to UNKNOWN
    if (resolvedSource !== AttendanceSource.UNKNOWN) {
      await prisma.attendance.update({
        where: { id: record.id },
        data: { source: resolvedSource },
      });
      updatedCount++;
    }
  }

  console.log(`Backfill completed. Updated ${updatedCount} records out of ${records.length}.`);
}

main()
  .catch((e) => {
    console.error('Error during backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
