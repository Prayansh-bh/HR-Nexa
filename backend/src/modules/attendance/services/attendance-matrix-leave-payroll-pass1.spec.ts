import { AttendanceMatrixService } from './attendance-matrix.service';
import { PayrollEngineService } from '../../payroll/services/payroll-engine.service';
import { SalaryComponentCalculatorService } from '../../payroll/services/salary-component-calculator.service';
import { LopPolicyResult } from '../../payroll/services/lop-policy.service';
import * as dateUtil from '../../../common/utils/date.util';

describe('AttendanceMatrixService & Payroll Engine Integration (Pass 1, 2 & 3 - Complete Audit)', () => {
  let matrixService: AttendanceMatrixService;
  let payrollEngine: PayrollEngineService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      employee: { findMany: jest.fn(), findFirst: jest.fn() },
      attendance: { findMany: jest.fn() },
      leaveRequest: { findMany: jest.fn() },
      systemConfig: { findUnique: jest.fn() },
      attendanceSetting: { findFirst: jest.fn() },
      leaveType: { findMany: jest.fn() },
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
    };

    matrixService = new AttendanceMatrixService(mockPrisma);
    payrollEngine = new PayrollEngineService(new SalaryComponentCalculatorService());
  });

  const baseEmployee: any = {
    id: 'EMP-001',
    name: 'Test User',
    avatar: 'TU',
    salary: 30000,
    department: { name: 'Engineering' },
    designation: { name: 'Developer' },
  };

  const defaultUser = { role: 'SuperAdmin' };

  it('1. Today + clockIn + no clockOut + shift ongoing → Present/Late (0 LOP)', async () => {
    jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue('2026-08-03');
    jest.spyOn(dateUtil, 'getBusinessTimeString').mockReturnValue('14:00'); // Shift end is 18:00

    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);
    mockPrisma.attendance.findMany.mockResolvedValue([
      { employeeId: 'EMP-001', date: '2026-08-03', status: 'Present', inTime: '09:00', outTime: null },
    ]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
    mockPrisma.systemConfig.findUnique.mockResolvedValue(null);
    mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday', shiftEnd: '18:00' });
    mockPrisma.leaveType.findMany.mockResolvedValue([]);

    const result = await matrixService.getMatrix('2026-08', undefined, undefined, defaultUser);
    const empRow = result.records[0];

    expect(empRow.attendance[3].status).toBe('Present');
    expect(empRow.summary.present).toBe(1);
    expect(empRow.summary.halfDay).toBe(0);
  });

  it('2. Past date + clockIn + no clockOut → Half Day (0.5 LOP)', async () => {
    jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue('2026-08-16');
    jest.spyOn(dateUtil, 'getBusinessTimeString').mockReturnValue('10:00');

    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);
    mockPrisma.attendance.findMany.mockResolvedValue([
      { employeeId: 'EMP-001', date: '2026-08-03', status: 'Present', inTime: '09:00', outTime: null },
    ]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
    mockPrisma.systemConfig.findUnique.mockResolvedValue(null);
    mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday', shiftEnd: '18:00' });
    mockPrisma.leaveType.findMany.mockResolvedValue([]);

    const result = await matrixService.getMatrix('2026-08', undefined, undefined, defaultUser);
    const empRow = result.records[0];

    expect(empRow.attendance[3].status).toBe('Half Day');
    expect(empRow.attendance[3].remarks).toBe('Incomplete Attendance / Missing Clock-Out');
    expect(empRow.summary.halfDay).toBe(1);
  });

  it('3. Today + clockIn + no clockOut + shift already ended (19:00 > 18:00) → Half Day (0.5 LOP)', async () => {
    jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue('2026-08-03');
    jest.spyOn(dateUtil, 'getBusinessTimeString').mockReturnValue('19:00'); // Shift end is 18:00

    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);
    mockPrisma.attendance.findMany.mockResolvedValue([
      { employeeId: 'EMP-001', date: '2026-08-03', status: 'Present', inTime: '09:00', outTime: null },
    ]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
    mockPrisma.systemConfig.findUnique.mockResolvedValue(null);
    mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday', shiftEnd: '18:00' });
    mockPrisma.leaveType.findMany.mockResolvedValue([]);

    const result = await matrixService.getMatrix('2026-08', undefined, undefined, defaultUser);
    const empRow = result.records[0];

    expect(empRow.attendance[3].status).toBe('Half Day');
    expect(empRow.summary.halfDay).toBe(1);
  });

  it('4. Past date + valid clockOut + 239 minutes → Half Day (0.5 LOP)', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);
    mockPrisma.attendance.findMany.mockResolvedValue([
      { employeeId: 'EMP-001', date: '2026-08-03', status: 'Half Day', inTime: '09:00', outTime: '12:59' },
    ]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
    mockPrisma.systemConfig.findUnique.mockResolvedValue(null);
    mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday' });
    mockPrisma.leaveType.findMany.mockResolvedValue([]);

    const result = await matrixService.getMatrix('2026-08', undefined, undefined, defaultUser);
    const empRow = result.records[0];

    expect(empRow.attendance[3].status).toBe('Half Day');
    expect(empRow.summary.halfDay).toBe(1);
  });

  it('5. Past date + valid clockOut + exactly 240 minutes → Present (0 LOP)', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);
    mockPrisma.attendance.findMany.mockResolvedValue([
      { employeeId: 'EMP-001', date: '2026-08-03', status: 'Present', inTime: '09:00', outTime: '13:00' },
    ]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
    mockPrisma.systemConfig.findUnique.mockResolvedValue(null);
    mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday' });
    mockPrisma.leaveType.findMany.mockResolvedValue([]);

    const result = await matrixService.getMatrix('2026-08', undefined, undefined, defaultUser);
    const empRow = result.records[0];

    expect(empRow.attendance[3].status).toBe('Present');
    expect(empRow.summary.present).toBe(1);
  });

  it('6. Past date + valid clockOut + 241 minutes → Present (0 LOP)', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);
    mockPrisma.attendance.findMany.mockResolvedValue([
      { employeeId: 'EMP-001', date: '2026-08-03', status: 'Present', inTime: '09:00', outTime: '13:01' },
    ]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
    mockPrisma.systemConfig.findUnique.mockResolvedValue(null);
    mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday' });
    mockPrisma.leaveType.findMany.mockResolvedValue([]);

    const result = await matrixService.getMatrix('2026-08', undefined, undefined, defaultUser);
    const empRow = result.records[0];

    expect(empRow.attendance[3].status).toBe('Present');
  });

  it('7. Sunday / Holiday + missing clock-out → Weekend / Holiday (0 LOP)', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);
    mockPrisma.attendance.findMany.mockResolvedValue([
      { employeeId: 'EMP-001', date: '2026-08-02', status: 'Present', inTime: '09:00', outTime: null }, // Aug 2 = Sunday
      { employeeId: 'EMP-001', date: '2026-08-15', status: 'Present', inTime: '09:00', outTime: null }, // Aug 15 = Holiday
    ]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
    mockPrisma.systemConfig.findUnique.mockResolvedValue({ value: '2026-08-15' });
    mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday' });
    mockPrisma.leaveType.findMany.mockResolvedValue([]);

    const result = await matrixService.getMatrix('2026-08', undefined, undefined, defaultUser);
    const empRow = result.records[0];

    expect(empRow.attendance[2].status).toBe('Weekend');
    expect(empRow.attendance[15].status).toBe('Holiday');
    expect(empRow.summary.halfDay).toBe(0);
  });

  it('8. PASS 1 & 2: Approved Unpaid Leave on working day → 1.0 LOP per day', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);
    mockPrisma.attendance.findMany.mockResolvedValue([]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([
      { id: 'L2', employeeId: 'EMP-001', type: 'Unpaid Leave', from: '2026-08-03', to: '2026-08-05', days: 3, reason: 'Personal', status: 'APPROVED' },
    ]);
    mockPrisma.systemConfig.findUnique.mockResolvedValue(null);
    mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday' });
    mockPrisma.leaveType.findMany.mockResolvedValue([
      { name: 'Unpaid Leave', paid: false },
    ]);

    const result = await matrixService.getMatrix('2026-08', undefined, undefined, defaultUser);
    const empRow = result.records[0];

    expect(empRow.attendance[3].status).toBe('On Leave (Unpaid)');
    expect(empRow.attendance[4].status).toBe('On Leave (Unpaid)');
    expect(empRow.attendance[5].status).toBe('On Leave (Unpaid)');
    expect(empRow.summary.unpaidLeave).toBe(3);
  });

  it('9. PASS 2: Unpaid Leave Friday to Monday (Aug 7 to Aug 10) → Weekend on Sat/Sun (0 LOP), exactly 2.0 LOP', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);
    mockPrisma.attendance.findMany.mockResolvedValue([]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([
      { id: 'L3', employeeId: 'EMP-001', type: 'Loss of Pay', from: '2026-08-07', to: '2026-08-10', days: 4, reason: 'Personal', status: 'APPROVED' },
    ]);
    mockPrisma.systemConfig.findUnique.mockResolvedValue(null);
    mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday' });
    mockPrisma.leaveType.findMany.mockResolvedValue([
      { name: 'Loss of Pay', paid: false },
    ]);

    const result = await matrixService.getMatrix('2026-08', undefined, undefined, defaultUser);
    const empRow = result.records[0];

    expect(empRow.attendance[7].status).toBe('On Leave (Unpaid)'); // Friday
    expect(empRow.attendance[8].status).toBe('Weekend');          // Saturday
    expect(empRow.attendance[9].status).toBe('Weekend');          // Sunday
    expect(empRow.attendance[10].status).toBe('On Leave (Unpaid)'); // Monday

    expect(empRow.summary.unpaidLeave).toBe(2);
  });

  it('10. PayrollEngine Integration — Historical missing clock-out (0.5 LOP) correctly deducted', () => {
    const fixedBaseSalary = 30000;

    const lopCalendar: LopPolicyResult = { mode: 'CALENDAR_DAYS', divisor: 30 };
    const calcCalendar = payrollEngine.calculateEmployeePayroll(
      { salary: fixedBaseSalary } as any,
      { workingDays: 22, presentDays: 20, halfDays: 1, absentDays: 0, lopDays: 0.5 } as any, // 1 missing clock-out past date
      {} as any,
      undefined,
      [],
      undefined,
      lopCalendar,
    );
    expect(calcCalendar.lopDeductDays).toBe(0.5);
    expect(calcCalendar.lopDeductAmount).toBe(Math.round((30000 / 30) * 0.5)); // ₹500 deduction
  });
});
