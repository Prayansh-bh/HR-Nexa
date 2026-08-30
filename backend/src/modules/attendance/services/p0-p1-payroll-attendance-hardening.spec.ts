import { AttendanceMatrixService } from './attendance-matrix.service';
import { AttendanceSettingsRepository, DEFAULT_ATTENDANCE_SETTING } from '../repositories/settings.repository';
import { hasShiftEnded } from '../../../common/utils/attendance-rules.util';
import { calculateWorkingDaysInRange } from '../../../common/utils/week-off.util';
import { LeaveService } from '../../leave/services/leave.service';
import { PayrollEngineService } from '../../payroll/services/payroll-engine.service';
import { SalaryComponentCalculatorService } from '../../payroll/services/salary-component-calculator.service';
import * as dateUtil from '../../../common/utils/date.util';

describe('HR NEXA — P0/P1 Payroll & Attendance Hardening Regression Specs', () => {
  let matrixService: AttendanceMatrixService;
  let settingsRepo: AttendanceSettingsRepository;
  let leaveService: LeaveService;
  let mockPrisma: any;
  let mockLeaveRepo: any;

  beforeEach(() => {
    mockPrisma = {
      employee: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
      attendance: { findMany: jest.fn() },
      leaveRequest: { findMany: jest.fn(), update: jest.fn() },
      systemConfig: { findUnique: jest.fn() },
      calendarEvent: { findMany: jest.fn() },
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
      attendanceSetting: {
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'SETTING-' + (data.companyId || 'anon'), ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      },
      leaveType: { findMany: jest.fn() },
      leaveQuota: { findFirst: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockLeaveRepo = {
      createRequest: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'REQ-1', ...data })),
      findRequestByIdAndTenant: jest.fn(),
      findManyRequests: jest.fn(),
    };

    matrixService = new AttendanceMatrixService(mockPrisma);
    settingsRepo = new AttendanceSettingsRepository(mockPrisma);
    leaveService = new LeaveService(mockLeaveRepo, {} as any, {} as any, mockPrisma);
  });

  // =========================================================================
  // 1. P0-1: TENANT-SAFE HOLIDAY CONFIGURATION
  // =========================================================================
  describe('P0-1: Tenant-Safe Holiday Configuration', () => {
    const empA = { id: 'EMP-A', name: 'Employee A', companyId: 'COMP-A', department: { name: 'IT' }, designation: { name: 'Eng' } };
    const empB = { id: 'EMP-B', name: 'Employee B', companyId: 'COMP-B', department: { name: 'Sales' }, designation: { name: 'Rep' } };

    it('1. Company A sees Aug 15 as holiday, while Company B sees Aug 15 as working day', async () => {
      // Setup distinct holiday configs per tenant
      mockPrisma.systemConfig.findUnique.mockImplementation(({ where }: any) => {
        if (where.key === 'payroll_holidays_COMP-A') return Promise.resolve({ value: '2026-08-15' });
        if (where.key === 'payroll_holidays_COMP-B') return Promise.resolve({ value: '2026-08-20' });
        return Promise.resolve(null);
      });
      mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
      mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Sunday' });
      mockPrisma.leaveType.findMany.mockResolvedValue([]);

      // Matrix for Company A (Aug 15 is Sat, Aug 20 is Thu)
      mockPrisma.employee.findMany.mockResolvedValue([empA]);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
      jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue('2026-08-31');

      const matrixA = await matrixService.getMatrix('2026-08', undefined, undefined, { companyId: 'COMP-A' });
      expect(matrixA.records[0].attendance[15].status).toBe('Holiday');
      expect(matrixA.records[0].attendance[20].status).toBe('Absent'); // Working day for A

      // Matrix for Company B
      mockPrisma.employee.findMany.mockResolvedValue([empB]);
      const matrixB = await matrixService.getMatrix('2026-08', undefined, undefined, { companyId: 'COMP-B' });
      expect(matrixB.records[0].attendance[15].status).toBe('Absent'); // Working day for B!
      expect(matrixB.records[0].attendance[20].status).toBe('Holiday'); // Holiday for B!
    });

    it('2. LeaveService.applyLeave excludes only tenant-configured holiday dates', async () => {
      mockPrisma.systemConfig.findUnique.mockImplementation(({ where }: any) => {
        if (where.key === 'payroll_holidays_COMP-A') return Promise.resolve({ value: '2026-08-14' }); // Fri holiday for A
        if (where.key === 'payroll_holidays_COMP-B') return Promise.resolve({ value: '2026-08-17' }); // Mon holiday for B
        return Promise.resolve(null);
      });
      mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
      mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday' });

      // Leave for Aug 14 (Fri) to Aug 17 (Mon) -> 4 calendar days (Fri, Sat, Sun, Mon)
      // Company A (Fri is holiday, Mon is work): working days = 1 (Mon)
      const userA = { id: 'U-A', role: 'Employee', companyId: 'COMP-A', employee: { id: 'EMP-A' } };
      await leaveService.applyLeave(
        userA,
        { type: 'Casual Leave', startDate: '2026-08-14', endDate: '2026-08-17', reason: 'Trip' },
        { isPlatformBypass: false, companyId: 'COMP-A' } as any,
      );
      expect(mockLeaveRepo.createRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({ days: 1 }),
      );

      // Company B (Fri is work, Mon is holiday): working days = 1 (Fri)
      const userB = { id: 'U-B', role: 'Employee', companyId: 'COMP-B', employee: { id: 'EMP-B' } };
      await leaveService.applyLeave(
        userB,
        { type: 'Casual Leave', startDate: '2026-08-14', endDate: '2026-08-17', reason: 'Trip' },
        { isPlatformBypass: false, companyId: 'COMP-B' } as any,
      );
      expect(mockLeaveRepo.createRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({ days: 1 }),
      );
    });
  });

  // =========================================================================
  // 2. P0-2: HISTORICAL UNPAID LEAVE PRESERVATION
  // =========================================================================
  describe('P0-2: Historical Unpaid Leave Classification', () => {
    const baseEmp = { id: 'EMP-01', name: 'Dev', companyId: 'COMP-1', department: { name: 'IT' }, designation: { name: 'Eng' } };

    beforeEach(() => {
      mockPrisma.employee.findMany.mockResolvedValue([baseEmp]);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.systemConfig.findUnique.mockResolvedValue(null);
      mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
      mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday' });
      jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue('2026-08-31');
    });

    it('1. Active unpaid LeaveType resolves as On Leave (Unpaid) -> 1.0 LOP per day', async () => {
      mockPrisma.leaveType.findMany.mockResolvedValue([
        { id: 'LT-1', name: 'Unpaid Leave', paid: false, companyId: 'COMP-1', deletedAt: null },
      ]);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'LR-1', employeeId: 'EMP-01', type: 'Unpaid Leave', from: '2026-08-03', to: '2026-08-05', status: 'APPROVED' },
      ]);

      const matrix = await matrixService.getMatrix('2026-08', undefined, undefined, { companyId: 'COMP-1' });
      const row = matrix.records[0];
      expect(row.attendance[3].status).toBe('On Leave (Unpaid)');
      expect(row.attendance[4].status).toBe('On Leave (Unpaid)');
      expect(row.attendance[5].status).toBe('On Leave (Unpaid)');
      expect(row.summary.unpaidLeave).toBe(3);
      expect(row.summary.lopDays).toBe(21); // 31 total - 10 weekends (18 absent + 3 unpaid = 21)
    });

    it('2. Soft-deleted unpaid LeaveType STILL resolves as On Leave (Unpaid) -> 1.0 LOP per day', async () => {
      // Policy soft deleted in the past
      mockPrisma.leaveType.findMany.mockResolvedValue([
        { id: 'LT-1', name: 'Loss of Pay', paid: false, companyId: 'COMP-1', deletedAt: new Date('2026-08-01') },
      ]);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'LR-2', employeeId: 'EMP-01', type: 'Loss of Pay', from: '2026-08-03', to: '2026-08-04', status: 'APPROVED' },
      ]);

      const matrix = await matrixService.getMatrix('2026-08', undefined, undefined, { companyId: 'COMP-1' });
      const row = matrix.records[0];
      expect(row.attendance[3].status).toBe('On Leave (Unpaid)');
      expect(row.attendance[4].status).toBe('On Leave (Unpaid)');
      expect(row.summary.unpaidLeave).toBe(2);
    });

    it('3. Soft-deleted paid LeaveType remains On Leave -> 0 LOP', async () => {
      mockPrisma.leaveType.findMany.mockResolvedValue([
        { id: 'LT-2', name: 'Legacy Annual Leave', paid: true, companyId: 'COMP-1', deletedAt: new Date('2026-08-01') },
      ]);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'LR-3', employeeId: 'EMP-01', type: 'Legacy Annual Leave', from: '2026-08-03', to: '2026-08-04', status: 'APPROVED' },
      ]);

      const matrix = await matrixService.getMatrix('2026-08', undefined, undefined, { companyId: 'COMP-1' });
      const row = matrix.records[0];
      expect(row.attendance[3].status).toBe('On Leave');
      expect(row.summary.onLeave).toBe(2);
      expect(row.summary.unpaidLeave).toBe(0);
    });

    it('4. Unmapped leave type with "unpaid" keyword in name falls back safely to unpaid (1.0 LOP)', async () => {
      mockPrisma.leaveType.findMany.mockResolvedValue([]); // No matching LeaveType in DB
      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'LR-4', employeeId: 'EMP-01', type: 'Special Unpaid Sabbatical', from: '2026-08-03', to: '2026-08-03', status: 'APPROVED' },
      ]);

      const matrix = await matrixService.getMatrix('2026-08', undefined, undefined, { companyId: 'COMP-1' });
      expect(matrix.records[0].attendance[3].status).toBe('On Leave (Unpaid)');
      expect(matrix.records[0].summary.unpaidLeave).toBe(1);
    });

    it('5. Company A LeaveType never classifies Company B leave requests', async () => {
      mockPrisma.leaveType.findMany.mockImplementation(({ where }: any) => {
        if (where.companyId === 'COMP-A') return Promise.resolve([{ name: 'Special Leave', paid: false, companyId: 'COMP-A' }]);
        if (where.companyId === 'COMP-B') return Promise.resolve([{ name: 'Special Leave', paid: true, companyId: 'COMP-B' }]);
        return Promise.resolve([]);
      });

      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'LR-5', employeeId: 'EMP-01', type: 'Special Leave', from: '2026-08-03', to: '2026-08-03', status: 'APPROVED' },
      ]);

      // Under Company A: Special Leave is unpaid
      const matrixA = await matrixService.getMatrix('2026-08', undefined, undefined, { companyId: 'COMP-A' });
      expect(matrixA.records[0].attendance[3].status).toBe('On Leave (Unpaid)');

      // Under Company B: Special Leave is paid
      const matrixB = await matrixService.getMatrix('2026-08', undefined, undefined, { companyId: 'COMP-B' });
      expect(matrixB.records[0].attendance[3].status).toBe('On Leave');
    });
  });

  // =========================================================================
  // 3. P0/P1: ATTENDANCE SETTINGS ISOLATION
  // =========================================================================
  describe('P0/P1: Attendance Settings Isolation & Safety', () => {
    it('1. Company A get() returns Company A settings and creates isolated record if absent', async () => {
      mockPrisma.attendanceSetting.findFirst.mockResolvedValue(null);
      const res = await settingsRepo.get('COMP-A');
      expect(mockPrisma.attendanceSetting.create).toHaveBeenCalledWith({
        data: { companyId: 'COMP-A' },
      });
      expect(res.companyId).toBe('COMP-A');
    });

    it('2. Missing companyId get() returns safe static defaults without querying or mutating DB', async () => {
      const res = await settingsRepo.get(null);
      expect(mockPrisma.attendanceSetting.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.attendanceSetting.create).not.toHaveBeenCalled();
      expect(res.shiftStart).toBe('09:00');
      expect(res.shiftEnd).toBe('18:00');
      expect(res.weekOffs).toBe('Saturday,Sunday');
    });

    it('3. Missing companyId update() does NOT mutate any existing tenant row', async () => {
      const res = await settingsRepo.update(null, { shiftEnd: '19:00' });
      expect(mockPrisma.attendanceSetting.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.attendanceSetting.update).not.toHaveBeenCalled();
      expect(res.shiftEnd).toBe('19:00');
    });

    it('4. Updating Company B settings mutates only Company B record', async () => {
      mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ id: 'SETTING-B', companyId: 'COMP-B' });
      await settingsRepo.update('COMP-B', { weekOffs: 'Sunday' });
      expect(mockPrisma.attendanceSetting.update).toHaveBeenCalledWith({
        where: { id: 'SETTING-B' },
        data: { weekOffs: 'Sunday' },
      });
    });

    it('5. SuperAdmin multi-company matrix view resolves settings and holidays per employee company without arbitrary findFirst fallback', async () => {
      const empA = { id: 'EMP-A', name: 'Emp A', companyId: 'COMP-A', department: { name: 'IT' }, designation: { name: 'Eng' } };
      const empB = { id: 'EMP-B', name: 'Emp B', companyId: 'COMP-B', department: { name: 'Sales' }, designation: { name: 'Rep' } };

      mockPrisma.employee.findMany.mockResolvedValue([empA, empB]);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
      mockPrisma.leaveType.findMany.mockResolvedValue([]);
      mockPrisma.systemConfig.findUnique.mockResolvedValue(null);
      mockPrisma.holiday.findMany.mockResolvedValue([
        { id: 'CAL-A', companyId: 'COMP-A', date: new Date('2026-08-14'), occasion: 'Holiday', type: 'NATIONAL' },
        { id: 'CAL-B', companyId: 'COMP-B', date: new Date('2026-08-17'), occasion: 'Holiday', type: 'NATIONAL' },
      ]);

      mockPrisma.attendanceSetting = {
        findMany: jest.fn().mockResolvedValue([
          { id: 'S-A', companyId: 'COMP-A', weekOffs: 'Saturday,Sunday' },
          { id: 'S-B', companyId: 'COMP-B', weekOffs: 'Sunday' },
        ]),
      };

      jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue('2026-08-31');

      // SuperAdmin viewing with no companyId (platform bypass)
      const matrix = await matrixService.getMatrix('2026-08', undefined, undefined, { role: 'SuperAdmin' });

      const rowA = matrix.records.find((r) => r.employeeId === 'EMP-A')!;
      const rowB = matrix.records.find((r) => r.employeeId === 'EMP-B')!;

      // On Aug 14 (Fri): A has holiday, B is working day (Absent)
      expect(rowA.attendance[14].status).toBe('Holiday');
      expect(rowB.attendance[14].status).toBe('Absent');

      // On Aug 15 (Sat): A has Saturday Weekend, B is working day (Absent)
      expect(rowA.attendance[15].status).toBe('Weekend');
      expect(rowB.attendance[15].status).toBe('Absent');

      // On Aug 17 (Mon): A is working day (Absent), B has holiday
      expect(rowA.attendance[17].status).toBe('Absent');
      expect(rowB.attendance[17].status).toBe('Holiday');
    });
  });

  // =========================================================================
  // 4. P1: OVERNIGHT SHIFT MISSING CLOCK-OUT SAFETY
  // =========================================================================
  describe('P1: Overnight Shift & Shift End Boundary Evaluation', () => {
    it('1. Standard Day Shift (09:00 -> 18:00): ongoing before 18:00, ended at 18:01', () => {
      expect(hasShiftEnded('09:00', '18:00', '14:00')).toBe(false);
      expect(hasShiftEnded('09:00', '18:00', '17:59')).toBe(false);
      expect(hasShiftEnded('09:00', '18:00', '18:00')).toBe(false);
      expect(hasShiftEnded('09:00', '18:00', '18:01')).toBe(true);
      expect(hasShiftEnded('09:00', '18:00', '20:00')).toBe(true);
    });

    it('2. Overnight Shift (22:00 -> 06:00): ongoing at night and early morning, ended only after 06:00 and before 22:00', () => {
      // Active night work (22:00 -> 23:59)
      expect(hasShiftEnded('22:00', '06:00', '22:00')).toBe(false);
      expect(hasShiftEnded('22:00', '06:00', '23:00')).toBe(false);
      expect(hasShiftEnded('22:00', '06:00', '23:59')).toBe(false);

      // Active early morning work (00:00 -> 06:00)
      expect(hasShiftEnded('22:00', '06:00', '00:00')).toBe(false);
      expect(hasShiftEnded('22:00', '06:00', '02:00')).toBe(false);
      expect(hasShiftEnded('22:00', '06:00', '05:59')).toBe(false);
      expect(hasShiftEnded('22:00', '06:00', '06:00')).toBe(false);

      // Ended after 06:00 during daylight hours
      expect(hasShiftEnded('22:00', '06:00', '06:01')).toBe(true);
      expect(hasShiftEnded('22:00', '06:00', '10:00')).toBe(true);
      expect(hasShiftEnded('22:00', '06:00', '14:00')).toBe(true);
    });

    it('3. Attendance Matrix: Night shift worker clocked in today at 22:00 is NOT prematurely marked Half Day at 23:00', async () => {
      jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue('2026-08-03');
      jest.spyOn(dateUtil, 'getBusinessTimeString').mockReturnValue('23:00');

      const emp = { id: 'EMP-N', name: 'Night Worker', companyId: 'COMP-1', department: { name: 'Ops' }, designation: { name: 'Nurse' } };
      mockPrisma.employee.findMany.mockResolvedValue([emp]);
      mockPrisma.attendance.findMany.mockResolvedValue([
        { employeeId: 'EMP-N', date: '2026-08-03', status: 'Present', inTime: '22:00', outTime: null },
      ]);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
      mockPrisma.systemConfig.findUnique.mockResolvedValue(null);
      mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
      mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ shiftStart: '22:00', shiftEnd: '06:00', weekOffs: 'Sunday' });
      mockPrisma.leaveType.findMany.mockResolvedValue([]);

      const matrix = await matrixService.getMatrix('2026-08', undefined, undefined, { companyId: 'COMP-1' });
      const row = matrix.records[0];

      // At 23:00, shift is actively in progress -> 0 LOP, Present
      expect(row.attendance[3].status).toBe('Present');
      expect(row.summary.halfDay).toBe(0);
      expect(row.summary.present).toBe(1);
    });
  });

  // =========================================================================
  // 5. P1: DATE RANGE TIMEZONE SAFETY
  // =========================================================================
  describe('P1: Date Range Timezone Safety', () => {
    it('1. Friday to Monday calculation is always exactly 2 working days regardless of server timezone', () => {
      // Aug 7 = Fri, Aug 8 = Sat, Aug 9 = Sun, Aug 10 = Mon
      const count = calculateWorkingDaysInRange('2026-08-07', '2026-08-10', 'Saturday,Sunday', []);
      expect(count).toBe(2);
    });

    it('2. Leap year month boundary (2024-02-28 to 2024-03-01) calculates correctly', () => {
      // 2024-02-28 (Wed), 2024-02-29 (Thu - Leap Day), 2024-03-01 (Fri) -> 3 working days
      const count = calculateWorkingDaysInRange('2024-02-28', '2024-03-01', 'Saturday,Sunday', []);
      expect(count).toBe(3);
    });

    it('3. Year boundary (2026-12-31 to 2027-01-04) calculates correctly', () => {
      // 2026-12-31 (Thu), 2027-01-01 (Fri - Holiday), 2027-01-02 (Sat), 2027-01-03 (Sun), 2027-01-04 (Mon)
      // Exclude Sat, Sun, and Jan 1 holiday -> 2 working days (Dec 31 & Jan 4)
      const count = calculateWorkingDaysInRange('2026-12-31', '2027-01-04', 'Saturday,Sunday', ['2027-01-01']);
      expect(count).toBe(2);
    });
  });
});
