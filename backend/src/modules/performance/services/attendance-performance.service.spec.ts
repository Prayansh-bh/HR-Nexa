import { AttendancePerformanceService } from './attendance-performance.service';

describe('AttendancePerformanceService - Production Performance Attendance Rating Engine', () => {
  let service: AttendancePerformanceService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      employee: {
        findUnique: jest.fn(),
      },
      attendanceSetting: {
        findFirst: jest.fn(),
      },
      systemConfig: {
        findUnique: jest.fn(),
      },
      holiday: {
        findMany: jest.fn(),
      },
      leaveRequest: {
        findMany: jest.fn(),
      },
      attendance: {
        findMany: jest.fn(),
      },
    };

    service = new AttendancePerformanceService(mockPrisma);
  });

  const setupDefaults = (overrides?: {
    employee?: any;
    setting?: any;
    holidays?: any[];
    leaves?: any[];
    logs?: any[];
  }) => {
    mockPrisma.employee.findUnique.mockResolvedValue(
      overrides?.employee || {
        id: 'EMP-1',
        name: 'Jane Doe',
        companyId: 'COMP-1',
        joined: '2026-01-01',
        status: 'Active',
      },
    );

    mockPrisma.attendanceSetting.findFirst.mockResolvedValue(
      overrides?.setting || {
        companyId: 'COMP-1',
        weekOffs: 'Saturday,Sunday',
      },
    );

    mockPrisma.systemConfig.findUnique.mockResolvedValue(null);
    mockPrisma.holiday.findMany.mockResolvedValue(overrides?.holidays || []);
    mockPrisma.leaveRequest.findMany.mockResolvedValue(overrides?.leaves || []);
    mockPrisma.attendance.findMany.mockResolvedValue(overrides?.logs || []);
  };

  describe('1. Basic Attendance Calculations & Status Weighting', () => {
    it('calculates 5.0 for 100% Present on expected working days', async () => {
      setupDefaults({
        logs: [
          { date: '2026-08-24', status: 'Present' },
          { date: '2026-08-25', status: 'Present' },
          { date: '2026-08-26', status: 'Present' },
          { date: '2026-08-27', status: 'Present' },
          { date: '2026-08-28', status: 'Present' },
        ],
      });

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-08-24',
        '2026-08-28',
        'COMP-1',
      );

      expect(score).toBe(5.0);
    });

    it('calculates 1.0 (Unsatisfactory) for 0% attendance on expected working days', async () => {
      setupDefaults({ logs: [] });

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-08-24',
        '2026-08-28',
        'COMP-1',
      );

      expect(score).toBe(1.0);
    });

    it('counts Half Day as 0.5 contribution', async () => {
      setupDefaults({
        logs: [{ date: '2026-08-28', status: 'Half Day' }],
      });

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-08-28',
        '2026-08-28',
        'COMP-1',
      );

      // Expected = 1, Attended = 0.5 -> Rate = 0.5 -> Score = 1.0 + 4.0(0.5) = 3.0
      expect(score).toBe(3.0);
    });

    it('counts Late as 1.0 full present contribution', async () => {
      setupDefaults({
        logs: [{ date: '2026-08-28', status: 'Late' }],
      });

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-08-28',
        '2026-08-28',
        'COMP-1',
      );

      expect(score).toBe(5.0);
    });

    it('calculates correct weighted score for mixed attendance records', async () => {
      setupDefaults({
        logs: [
          { date: '2026-08-24', status: 'Present' },
          { date: '2026-08-25', status: 'Late' },
          { date: '2026-08-26', status: 'Half Day' },
          { date: '2026-08-27', status: 'Present' },
          { date: '2026-08-28', status: 'Absent' },
        ],
      });

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-08-24',
        '2026-08-28',
        'COMP-1',
      );

      // 5 days, 3.5 weight -> 0.70 rate -> 3.8 score
      expect(score).toBe(3.8);
    });
  });

  describe('2. F-01 Precedence: Attendance Records vs Approved Leave & Holidays', () => {
    it('1. Approved leave with NO attendance record is excluded from denominator', async () => {
      // 2026-08-24 (Monday) on approved leave with no clock in
      setupDefaults({
        leaves: [{ from: '2026-08-24', to: '2026-08-24', status: 'APPROVED' }],
        logs: [],
      });

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-08-24',
        '2026-08-24',
        'COMP-1',
      );

      // Expected working days = 0 -> returns neutral 5.0
      expect(score).toBe(5.0);
    });

    it('2. Approved leave + Present attendance contributes 1.0 and counts in denominator', async () => {
      // 2026-08-24 on approved leave, but employee clocked in as Present
      setupDefaults({
        leaves: [{ from: '2026-08-24', to: '2026-08-24', status: 'APPROVED' }],
        logs: [{ date: '2026-08-24', status: 'Present' }],
      });

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-08-24',
        '2026-08-24',
        'COMP-1',
      );

      // Expected = 1, Attended = 1.0 -> Rate = 1.0 -> Score = 5.0
      expect(score).toBe(5.0);
    });

    it('3. Approved leave + Late attendance contributes 1.0', async () => {
      setupDefaults({
        leaves: [{ from: '2026-08-24', to: '2026-08-24', status: 'APPROVED' }],
        logs: [{ date: '2026-08-24', status: 'Late' }],
      });

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-08-24',
        '2026-08-24',
        'COMP-1',
      );

      expect(score).toBe(5.0);
    });

    it('4. Approved leave + Half Day attendance contributes 0.5', async () => {
      // Jane Kumari scenario on 2026-08-28
      setupDefaults({
        leaves: [{ from: '2026-08-28', to: '2026-08-28', status: 'APPROVED' }],
        logs: [{ date: '2026-08-28', status: 'Half Day' }],
      });

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-08-28',
        '2026-08-28',
        'COMP-1',
      );

      // Expected = 1, Attended = 0.5 -> Rate = 0.5 -> Score = 3.0
      expect(score).toBe(3.0);
    });

    it('5. Approved leave + explicit Absent log contributes 0.0', async () => {
      setupDefaults({
        leaves: [{ from: '2026-08-28', to: '2026-08-28', status: 'APPROVED' }],
        logs: [{ date: '2026-08-28', status: 'Absent' }],
      });

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-08-28',
        '2026-08-28',
        'COMP-1',
      );

      // Expected = 1, Attended = 0.0 -> Rate = 0.0 -> Score = 1.0
      expect(score).toBe(1.0);
    });

    it('6. Holiday + attendance record takes precedence and avoids double-counting', async () => {
      // 2026-08-26 is a public holiday, employee worked Present
      setupDefaults({
        holidays: [{ date: '2026-08-26' }],
        logs: [{ date: '2026-08-26', status: 'Present' }],
      });

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-08-26',
        '2026-08-26',
        'COMP-1',
      );

      // Expected = 1, Attended = 1.0 -> Rate = 1.0 -> Score = 5.0
      expect(score).toBe(5.0);
    });

    it('7. Weekly off + attendance record takes precedence and counts as attended day', async () => {
      // 2026-08-23 (Sunday) is a weekend, employee worked Present
      setupDefaults({
        logs: [{ date: '2026-08-23', status: 'Present' }],
      });

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-08-23',
        '2026-08-23',
        'COMP-1',
      );

      expect(score).toBe(5.0);
    });

    it('8. Evaluates complex mixed scenario deterministically', async () => {
      // 7 calendar days (2026-08-22 to 2026-08-28):
      // - 2026-08-22 (Sat): Weekly off, no log -> EXCLUDED
      // - 2026-08-23 (Sun): Weekly off, Present log -> COUNTED (1.0)
      // - 2026-08-24 (Mon): Approved Leave, no log -> EXCLUDED
      // - 2026-08-25 (Tue): Approved Leave, Half Day log -> COUNTED (0.5)
      // - 2026-08-26 (Wed): Public Holiday, no log -> EXCLUDED
      // - 2026-08-27 (Thu): Expected working day, Present log -> COUNTED (1.0)
      // - 2026-08-28 (Fri): Expected working day, NO log -> COUNTED AS ABSENT (0.0)
      //
      // Total Expected Working Days = 4 (Sun worked + Tue leave worked + Thu worked + Fri missing)
      // Total Attended Weight = 1.0 + 0.5 + 1.0 + 0.0 = 2.5
      // Rate = 2.5 / 4 = 0.625
      // Score = 1.0 + 4.0 * 0.625 = 3.5
      setupDefaults({
        holidays: [{ date: '2026-08-26' }],
        leaves: [{ from: '2026-08-24', to: '2026-08-25', status: 'APPROVED' }],
        logs: [
          { date: '2026-08-23', status: 'Present' },
          { date: '2026-08-25', status: 'Half Day' },
          { date: '2026-08-27', status: 'Present' },
        ],
      });

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-08-22',
        '2026-08-28',
        'COMP-1',
      );

      expect(score).toBe(3.5);
    });
  });

  describe('3. Employment Period & Future-Date Boundaries', () => {
    it('respects employee joining date midway through cycle', async () => {
      setupDefaults({
        employee: {
          id: 'EMP-NEW',
          name: 'New Joiner',
          companyId: 'COMP-1',
          joined: '2026-08-27',
          status: 'Active',
        },
        logs: [
          { date: '2026-08-27', status: 'Present' },
          { date: '2026-08-28', status: 'Present' },
        ],
      });

      const score = await service.calculateAttendanceScore(
        'EMP-NEW',
        '2026-08-24',
        '2026-08-28',
        'COMP-1',
      );

      expect(score).toBe(5.0);
    });

    it('returns neutral 5.0 when entire cycle is in the future', async () => {
      setupDefaults();

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-11-01',
        '2026-12-01',
        'COMP-1',
      );

      expect(score).toBe(5.0);
    });
  });

  describe('4. Tenant Isolation', () => {
    it('isolates company settings and holidays strictly by companyId', async () => {
      setupDefaults({
        setting: {
          companyId: 'COMP-A',
          weekOffs: 'Friday,Saturday',
        },
        holidays: [{ date: '2026-08-24', companyId: 'COMP-A' }],
      });

      const score = await service.calculateAttendanceScore(
        'EMP-1',
        '2026-08-24',
        '2026-08-25',
        'COMP-A',
      );

      expect(mockPrisma.attendanceSetting.findFirst).toHaveBeenCalledWith({
        where: { companyId: 'COMP-A' },
      });
      expect(mockPrisma.holiday.findMany).toHaveBeenCalledWith({
        where: { companyId: 'COMP-A' },
      });
    });
  });
});
