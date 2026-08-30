import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { parseWeekOffDays } from '../../../common/utils/week-off.util';
import { getBusinessDateString } from '../../../common/utils/date.util';

@Injectable()
export class AttendancePerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateAttendanceScore(
    employeeId: string,
    startDateStr: string,
    endDateStr: string,
    companyId?: string | null,
  ): Promise<number> {
    const todayStr = getBusinessDateString();

    // 1. Fetch employee details (to respect joining date & tenant boundary)
    const emp = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!emp) {
      return 5.0;
    }

    // 2. Determine authoritative elapsed evaluation window
    // Start from max(cycle.startDate, employee.joined)
    const effectiveStart =
      emp.joined && emp.joined > startDateStr ? emp.joined : startDateStr;

    // End at min(cycle.endDate, today) to avoid treating future unelapsed dates as absences
    const effectiveEnd = endDateStr < todayStr ? endDateStr : todayStr;

    if (effectiveStart > effectiveEnd) {
      // Future review cycle or future employee joining date: no elapsed days
      return 5.0;
    }

    // 3. Resolve tenant settings (weekOffs, holidays)
    const tenantId = companyId || emp.companyId || emp.subscriptionId || null;

    const attendanceSetting = tenantId
      ? await (this.prisma as any).attendanceSetting?.findFirst({
          where: { companyId: tenantId },
        })
      : await (this.prisma as any).attendanceSetting?.findFirst();

    const weekOffSet = parseWeekOffDays(attendanceSetting?.weekOffs);

    // Resolve company holidays (both system config and holiday table entries)
    const holidayConfigKey = tenantId
      ? `payroll_holidays_${tenantId}`
      : 'payroll_holidays';

    const [sysConfig, calendarHolidays] = await Promise.all([
      this.prisma.systemConfig.findUnique({
        where: { key: holidayConfigKey },
      }),
      (this.prisma as any).holiday?.findMany
        ? (this.prisma as any).holiday.findMany({
            where: { ...(tenantId ? { companyId: tenantId } : {}) },
          })
        : Promise.resolve([]),
    ]);

    const holidaysSet = new Set<string>();
    if (sysConfig?.value) {
      sysConfig.value
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .forEach((d: string) => holidaysSet.add(d));
    }

    for (const h of calendarHolidays || []) {
      if (h.date) {
        const dateStr =
          h.date instanceof Date
            ? h.date.toISOString().slice(0, 10)
            : String(h.date).slice(0, 10);
        holidaysSet.add(dateStr);
      }
    }

    // 4. Retrieve approved leave requests overlapping the evaluation window
    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        OR: [
          {
            from: { lte: effectiveEnd },
            to: { gte: effectiveStart },
          },
        ],
      },
    });

    // 5. Retrieve actual logged attendance records for the employee
    const attendanceLogs = await this.prisma.attendance.findMany({
      where: {
        employeeId,
        date: {
          gte: effectiveStart,
          lte: effectiveEnd,
        },
      },
    });

    // 6. Iterate through elapsed dates to calculate Expected Working Days and Attended Weight
    let expectedWorkingDays = 0;
    let presentWeightCount = 0;

    const cur = new Date(effectiveStart + 'T00:00:00Z');
    const end = new Date(effectiveEnd + 'T00:00:00Z');

    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      const dayOfWeek = cur.getUTCDay(); // 0 = Sunday, 6 = Saturday

      const isWeekend = weekOffSet.has(dayOfWeek);
      const isHoliday = holidaysSet.has(dateStr);
      const isApprovedLeave = leaveRequests.some(
        (l) => l.from && l.to && l.from <= dateStr && l.to >= dateStr,
      );

      const log = attendanceLogs.find((l) => l.date === dateStr);

      if (log) {
        // Precedence 1: Attendance record exists -> Evaluated working/attendance day
        expectedWorkingDays++;
        if (log.status === 'Present' || log.status === 'Late') {
          presentWeightCount += 1.0;
        } else if (log.status === 'Half Day') {
          presentWeightCount += 0.5;
        }
        // 'Absent' or other non-attendance status adds 0.0
      } else if (isApprovedLeave || isHoliday || isWeekend) {
        // Precedence 2: No attendance record + (Approved Leave / Holiday / Weekly Off) -> Exclude from denominator
        // 0 contribution, 0 expected working days
      } else {
        // Precedence 3: No attendance record on expected working day -> Unexcused missing attendance (Absent)
        expectedWorkingDays++;
        presentWeightCount += 0.0;
      }

      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    // 7. Handle zero expected working days (e.g. entire period was on approved leave or weekend/holidays)
    if (expectedWorkingDays === 0) {
      return 5.0; // Neutral default score when no working days were expected
    }

    // 8. Compute attendance rate and linear score (1.0 to 5.0)
    const rate = presentWeightCount / expectedWorkingDays;
    const rawScore = 1.0 + 4.0 * rate;
    const clampedScore = Math.max(1.0, Math.min(5.0, rawScore));

    return Math.round(clampedScore * 10) / 10;
  }
}
