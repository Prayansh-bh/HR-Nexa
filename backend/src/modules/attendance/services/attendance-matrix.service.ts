import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  getBusinessDateString,
  getBusinessTimeString,
  parsePayrollMonth,
} from '../../../common/utils/date.util';
import {
  parseWeekOffDays,
  INDEX_TO_FULL_DAY_NAME,
} from '../../../common/utils/week-off.util';
import { hasShiftEnded } from '../../../common/utils/attendance-rules.util';

export type MatrixDayDetail = {
  status: string;
  checkIn?: string;
  checkOut?: string;
  hours?: string;
  method?: string;
  remarks?: string;
  latitude?: string;
  longitude?: string;
  deviceId?: string;
  ipAddress?: string;
};

export type EmployeeAttendanceSummary = {
  present: number;
  absent: number;
  halfDay: number;
  late: number;
  onLeave: number;
  unpaidLeave: number;
  weekend: number;
  holiday: number;
  upcoming: number;
  lopDays: number; // absentDays + unpaidLeaveDays + (halfDays * 0.5)
};

export type EmployeeMatrixRow = {
  employeeId: string;
  employeeName: string;
  avatar: string;
  designation: string;
  department: string;
  attendance: Record<number, MatrixDayDetail>;
  summary: EmployeeAttendanceSummary;
};

export type AttendanceMatrixResponse = {
  daysInMonth: number;
  month: string;
  holidays: string[];
  sundays: string[];
  records: EmployeeMatrixRow[];
};

@Injectable()
export class AttendanceMatrixService {
  constructor(private readonly prisma: PrismaService) {}

  async getMatrix(
    month: string,
    department?: string,
    search?: string,
    currentUser?: any,
  ): Promise<AttendanceMatrixResponse> {
    const { year, monthIndex: monthIdx, daysInMonth } = parsePayrollMonth(month);

    const startDateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    // ── Tenant isolation ───────────────────────────────────────────────────
    // Extract companyId from the JWT. SuperAdmin has no companyId → platform-wide view.
    const companyId: string | undefined =
      currentUser?.companyId || currentUser?.subscriptionId || undefined;

    // No status filter — the matrix shows all employees (Active, On Leave, Inactive)
    // so historical attendance records are always visible.
    const whereClause: any = {};

    // Scope to the current tenant. SuperAdmin sees all companies (companyId is undefined).
    if (companyId) {
      whereClause.companyId = companyId;
    }

    if (currentUser.role === 'Manager') {
      const mgrEmp = await this.prisma.employee.findFirst({
        where: {
          email: currentUser.email,
          ...(companyId ? { companyId } : {}),
        },
      });
      if (mgrEmp?.departmentId) {
        whereClause.departmentId = mgrEmp.departmentId;
      }
    } else if (currentUser.role === 'Employee') {
      const emp = await this.prisma.employee.findFirst({
        where: {
          email: currentUser.email,
          ...(companyId ? { companyId } : {}),
        },
      });
      if (emp) {
        whereClause.id = emp.id;
      } else {
        whereClause.id = 'none';
      }
    }

    if (department && department !== 'All') {
      whereClause.department = {
        name: department,
      };
    }

    if (search) {
      whereClause.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const holidayConfigKey = companyId ? `payroll_holidays_${companyId}` : 'payroll_holidays';

    const [employees, allAttendance, leaveRequests, holidaysConfig, calendarHolidays, attendanceSettingsList, leaveTypes] =
      await Promise.all([
        this.prisma.employee.findMany({
          where: whereClause,
          include: {
            department: true,
            designation: true,
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.attendance.findMany({
          where: {
            date: {
              gte: startDateStr,
              lte: endDateStr,
            },
            // Scope attendance records to only this tenant's employees
            employee: companyId ? { companyId } : undefined,
          },
        }),
        this.prisma.leaveRequest.findMany({
          where: {
            status: 'APPROVED',
            OR: [
              {
                from: { lte: endDateStr },
                to: { gte: startDateStr },
              },
            ],
            // Scope leave requests to only this tenant's employees
            employee: companyId ? { companyId } : undefined,
          },
        }),
        this.prisma.systemConfig.findUnique({
          where: { key: holidayConfigKey },
        }),
        this.prisma.holiday.findMany({
          where: {
            ...(companyId ? { companyId } : {}),
            date: {
              gte: new Date(startDateStr),
              lte: new Date(endDateStr),
            },
          },
        }),
        companyId
          ? ((this.prisma as any).attendanceSetting?.findMany
              ? (this.prisma as any).attendanceSetting.findMany({ where: { companyId } })
              : (this.prisma as any).attendanceSetting?.findFirst
                ? (this.prisma as any).attendanceSetting.findFirst({ where: { companyId } }).then((s: any) => (s ? [s] : []))
                : Promise.resolve([]))
          : ((this.prisma as any).attendanceSetting?.findMany
              ? (this.prisma as any).attendanceSetting.findMany({})
              : Promise.resolve([])),
        // Include all historical leave types for the tenant (including soft-deleted)
        this.prisma.leaveType.findMany({
          where: companyId ? { companyId } : {},
        }),
      ]);

    // Build per-company settings map so SuperAdmin multi-company view never mixes tenant shift/week-off rules
    const settingsMap = new Map<string, any>();
    for (const s of (attendanceSettingsList || [])) {
      if (s) {
        const cId = s.companyId || (companyId || 'default');
        settingsMap.set(cId, s);
        if (s.companyId) {
          settingsMap.set(s.companyId, s);
        }
      }
    }

    // Build per-company calendar holidays map
    const companyHolidaysMap = new Map<string, Set<string>>();
    const sysHolidays = holidaysConfig
      ? holidaysConfig.value.split(',').map((s: string) => s.trim())
      : [];

    for (const cal of (calendarHolidays || [])) {
      const cId = cal.companyId || (companyId || 'global');
      if (!companyHolidaysMap.has(cId)) {
        companyHolidaysMap.set(cId, new Set<string>());
      }
      const dateStr = cal.date instanceof Date 
        ? cal.date.toISOString().slice(0, 10) 
        : typeof cal.date === 'string' 
          ? cal.date 
          : new Date(cal.date).toISOString().slice(0, 10);
      companyHolidaysMap.get(cId)!.add(dateStr);
    }

    // Add sysHolidays to target tenant's holidays
    const targetTenantKey = companyId || 'global';
    if (!companyHolidaysMap.has(targetTenantKey)) {
      companyHolidaysMap.set(targetTenantKey, new Set<string>());
    }
    for (const sh of sysHolidays) {
      companyHolidaysMap.get(targetTenantKey)!.add(sh);
    }

    // Single tenant or default calendar for top-level response headers
    const defaultSetting = companyId ? (settingsMap.get(companyId) || settingsMap.get('default')) : null;
    const defaultWeekOffSet = parseWeekOffDays(defaultSetting?.weekOffs);
    const sundays: string[] = [];
    const holidaysList: string[] = [];

    const defaultHolidaysSet = companyHolidaysMap.get(targetTenantKey) || new Set<string>();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, monthIdx, day);
      const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (defaultWeekOffSet.has(dateObj.getDay())) {
        sundays.push(dateStr);
      }
      if (defaultHolidaysSet.has(dateStr)) {
        holidaysList.push(dateStr);
      }
    }

    // Map leave types to their paid status (case-insensitive lookup, tenant-isolated)
    const leaveTypePaidMap = new Map<string, boolean>();
    for (const lt of leaveTypes) {
      if (lt && lt.name) {
        const key = lt.companyId
          ? `${lt.companyId}_${lt.name.toLowerCase().trim()}`
          : lt.name.toLowerCase().trim();
        leaveTypePaidMap.set(key, lt.paid ?? true);
        // Also register base name for single-tenant lookup
        leaveTypePaidMap.set(lt.name.toLowerCase().trim(), lt.paid ?? true);
      }
    }

    const todayStr = getBusinessDateString();
    const nowTimeStr = getBusinessTimeString();

    const calcHours = (inT: string | null, outT: string | null): string => {
      if (!inT || !outT || inT === '—' || outT === '—') return '–';
      const [ih, im] = inT.split(':').map(Number);
      const [oh, om] = outT.split(':').map(Number);
      const diff = oh * 60 + om - (ih * 60 + im);
      if (diff <= 0) return '–';
      return `${Math.floor(diff / 60)}h ${diff % 60}m`;
    };

    const records: EmployeeMatrixRow[] = employees.map((emp) => {
      const empCompanyId = emp.companyId || companyId || undefined;
      const empSettings = empCompanyId
        ? (settingsMap.get(empCompanyId) || (companyId ? settingsMap.get(companyId) : undefined) || settingsMap.get('default'))
        : defaultSetting;
      const empWeekOffSet = parseWeekOffDays(empSettings?.weekOffs);
      const empHolidaysSet = empCompanyId
        ? (companyHolidaysMap.get(empCompanyId) || new Set<string>())
        : defaultHolidaysSet;

      const empAttendance = allAttendance.filter(
        (r) => r.employeeId === emp.id,
      );
      const empLeaves = leaveRequests.filter((l) => l.employeeId === emp.id);
      const attendanceGrid: Record<number, MatrixDayDetail> = {};

      for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, monthIdx, day);
        const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isWeekend = empWeekOffSet.has(dateObj.getDay());
        const isHoliday = empHolidaysSet.has(dateStr);

        const record = empAttendance.find((r) => r.date === dateStr);
        const leave = empLeaves.find((l) => {
          if (!l.from || !l.to) return false;
          return l.from <= dateStr && l.to >= dateStr;
        });

        if (record) {
          const hasIn = Boolean(record.inTime && record.inTime !== '—');
          const hasOut = Boolean(record.outTime && record.outTime !== '—');

          let finalStatus = record.status;
          let customRemarks = record.remarks || 'No remarks';

          if (hasIn && !hasOut) {
            if (isHoliday) {
              finalStatus = 'Holiday';
              customRemarks = 'Public Holiday';
            } else if (isWeekend) {
              const dayName = INDEX_TO_FULL_DAY_NAME[dateObj.getDay()] || 'Weekly Off';
              finalStatus = 'Weekend';
              customRemarks = `${dayName} Weekly Off`;
            } else {
              const isPastDate = dateStr < todayStr;
              const isShiftEndedToday =
                dateStr === todayStr &&
                hasShiftEnded(
                  empSettings?.shiftStart,
                  empSettings?.shiftEnd,
                  nowTimeStr,
                );

              if (isPastDate || isShiftEndedToday) {
                finalStatus = 'Half Day';
                customRemarks = 'Incomplete Attendance / Missing Clock-Out';
              }
            }
          }

          attendanceGrid[day] = {
            status: finalStatus,
            checkIn: record.inTime || '—',
            checkOut: record.outTime || '—',
            hours: calcHours(record.inTime, record.outTime),
            method: record.source === 'ONLINE'
              ? 'Online Web'
              : record.source === 'MOBILE'
                ? 'Mobile Check-In'
                : record.source === 'BIOMETRIC'
                  ? 'Biometric Sync'
                  : record.source === 'MANUAL'
                    ? 'Manual Entry'
                    : 'Unknown',
            remarks: customRemarks,
            latitude: record.latitude || undefined,
            longitude: record.longitude || undefined,
            deviceId: record.deviceId || undefined,
            ipAddress: record.ipAddress || undefined,
          };
        } else if (isHoliday) {
          attendanceGrid[day] = {
            status: 'Holiday',
            remarks: 'Public Holiday',
          };
        } else if (isWeekend) {
          const dayName = INDEX_TO_FULL_DAY_NAME[dateObj.getDay()] || 'Weekly Off';
          attendanceGrid[day] = {
            status: 'Weekend',
            remarks: `${dayName} Weekly Off`,
          };
        } else if (leave) {
          const ltKey = (leave.type || '').toLowerCase().trim();
          let isPaid: boolean;
          if (leaveTypePaidMap.has(ltKey)) {
            isPaid = leaveTypePaidMap.get(ltKey)!;
          } else {
            // Safe fallback: classify as unpaid if leave type name contains unpaid indicators
            const isUnpaidByName =
              ltKey.includes('unpaid') ||
              ltKey.includes('lop') ||
              ltKey.includes('loss of pay') ||
              ltKey.includes('without pay');
            isPaid = !isUnpaidByName;
          }

          if (isPaid) {
            attendanceGrid[day] = {
              status: 'On Leave',
              remarks: `Approved Leave: ${leave.type} - ${leave.reason}`,
            };
          } else {
            attendanceGrid[day] = {
              status: 'On Leave (Unpaid)',
              remarks: `Approved Unpaid Leave: ${leave.type} - ${leave.reason}`,
            };
          }
        } else if (emp.joined && dateStr < emp.joined) {
          attendanceGrid[day] = {
            status: 'Not Joined',
            remarks: 'Joined after this date',
          };
        } else if (dateStr > todayStr) {
          attendanceGrid[day] = {
            status: 'Upcoming',
            remarks: 'Future date — no record yet',
          };
        } else {
          attendanceGrid[day] = {
            status: 'Absent',
            remarks: 'Absent / No attendance recorded',
          };
        }
      }

      // Derive summary counts from the finalised grid — single source of truth.
      // This guarantees counts always match what the grid cells display.
      const summary: EmployeeAttendanceSummary = {
        present: 0,
        absent: 0,
        halfDay: 0,
        late: 0,
        onLeave: 0,
        unpaidLeave: 0,
        weekend: 0,
        holiday: 0,
        upcoming: 0,
        lopDays: 0,
      };
      for (const dayNum of Object.keys(attendanceGrid)) {
        const s = attendanceGrid[Number(dayNum)].status;
        if (s === 'Present') summary.present++;
        else if (s === 'Absent') summary.absent++;
        else if (s === 'Half Day') summary.halfDay++;
        else if (s === 'Late') summary.late++;
        else if (s === 'On Leave') summary.onLeave++;
        else if (s === 'On Leave (Unpaid)') summary.unpaidLeave++;
        else if (s === 'Weekend') summary.weekend++;
        else if (s === 'Holiday') summary.holiday++;
        else if (s === 'Upcoming') summary.upcoming++;
      }
      // LOP = absent days + unpaid leave days + 0.5 per half-day
      summary.lopDays = summary.absent + summary.unpaidLeave + summary.halfDay * 0.5;

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        avatar: emp.avatar,
        designation: emp.designation?.name || '—',
        department: emp.department?.name || '—',
        attendance: attendanceGrid,
        summary,
      };
    });

    return {
      daysInMonth,
      month,
      holidays: holidaysList,
      sundays,
      records,
    };
  }
}
