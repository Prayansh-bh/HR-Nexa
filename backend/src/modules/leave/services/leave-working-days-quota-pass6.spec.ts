import { LeaveService } from './leave.service';
import { calculateWorkingDaysInRange } from '../../../common/utils/week-off.util';

describe('Leave Service Working-Day Quota Semantics (Pass 6)', () => {
  let leaveService: LeaveService;
  let mockPrisma: any;
  let mockLeaveRepository: any;

  beforeEach(() => {
    mockLeaveRepository = {
      createRequest: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'REQ-1', ...data })),
      findRequestByIdAndTenant: jest.fn(),
      findManyRequests: jest.fn(),
    };

    mockPrisma = {
      employee: { findUnique: jest.fn(), findFirst: jest.fn() },
      systemConfig: { findUnique: jest.fn() },
      attendanceSetting: { findFirst: jest.fn() },
      leaveQuota: { findFirst: jest.fn(), update: jest.fn() },
      leaveRequest: { update: jest.fn() },
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    leaveService = new LeaveService(
      mockLeaveRepository as any,
      {} as any,
      {} as any,
      mockPrisma as any,
    );
  });

  const mockUser = {
    id: 'USR-1',
    role: 'Employee',
    companyId: 'COMP-A',
    employee: { id: 'EMP-001' },
  };

  const tenantScope = { isPlatformBypass: false, companyId: 'COMP-A' };

  it('1. Monday → Monday = 1 working day', () => {
    // 2026-08-03 is Monday
    const count = calculateWorkingDaysInRange('2026-08-03', '2026-08-03', 'Saturday,Sunday', []);
    expect(count).toBe(1);
  });

  it('2. Friday → Monday = 2 working days (Sat & Sun excluded)', () => {
    // Aug 7 = Fri, Aug 8 = Sat, Aug 9 = Sun, Aug 10 = Mon
    const count = calculateWorkingDaysInRange('2026-08-07', '2026-08-10', 'Saturday,Sunday', []);
    expect(count).toBe(2);
  });

  it('3. Friday → Tuesday = 3 working days (Fri, Mon, Tue)', () => {
    const count = calculateWorkingDaysInRange('2026-08-07', '2026-08-11', 'Saturday,Sunday', []);
    expect(count).toBe(3);
  });

  it('4. Thursday → Monday = 3 working days (Thu, Fri, Mon)', () => {
    const count = calculateWorkingDaysInRange('2026-08-06', '2026-08-10', 'Saturday,Sunday', []);
    expect(count).toBe(3);
  });

  it('5. Saturday → Sunday = 0 working days', () => {
    const count = calculateWorkingDaysInRange('2026-08-08', '2026-08-09', 'Saturday,Sunday', []);
    expect(count).toBe(0);
  });

  it('6. Leave containing one holiday = holiday excluded', () => {
    // Aug 14 (Fri), Aug 15 (Sat - Holiday), Aug 17 (Mon)
    const count = calculateWorkingDaysInRange('2026-08-14', '2026-08-17', 'Saturday,Sunday', ['2026-08-15']);
    expect(count).toBe(2); // Fri & Mon
  });

  it('7. Leave containing weekend + holiday = all non-working dates excluded', () => {
    // Aug 14 (Fri), Aug 15 (Sat - Holiday), Aug 16 (Sun), Aug 17 (Mon - Holiday)
    const count = calculateWorkingDaysInRange('2026-08-14', '2026-08-17', 'Saturday,Sunday', ['2026-08-15', '2026-08-17']);
    expect(count).toBe(1); // Only Fri
  });

  it('8. Single working day = 1', () => {
    const count = calculateWorkingDaysInRange('2026-08-12', '2026-08-12', 'Saturday,Sunday', []);
    expect(count).toBe(1);
  });

  it('9. Custom weekOff configuration (Friday, Saturday)', () => {
    // Aug 6 (Thu) to Aug 9 (Sun). Weekoffs: Fri & Sat
    // Thu (1), Fri (0), Sat (0), Sun (1) -> 2 working days
    const count = calculateWorkingDaysInRange('2026-08-06', '2026-08-09', 'Friday,Saturday', []);
    expect(count).toBe(2);
  });

  it('10. LeaveService.applyLeave calculates days as working days (2 for Fri-Mon)', async () => {
    mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday' });
    mockPrisma.systemConfig.findUnique.mockResolvedValue({ value: '2026-08-15' });

    const result = await leaveService.applyLeave(
      mockUser,
      { type: 'Casual Leave', startDate: '2026-08-07', endDate: '2026-08-10', reason: 'Personal' },
      tenantScope as any,
    );

    expect(mockLeaveRepository.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        days: 2, // Fri & Mon
        from: '2026-08-07',
        to: '2026-08-10',
      }),
    );
  });

  it('11. Insufficient quota evaluates based on working days (2 working days fits 3 remaining balance)', async () => {
    mockLeaveRepository.findRequestByIdAndTenant.mockResolvedValue({
      id: 'REQ-100',
      employeeId: 'EMP-001',
      type: 'Casual Leave',
      days: 2, // 2 working days (Fri to Mon)
      status: 'PENDING',
    });

    mockPrisma.leaveQuota.findFirst.mockResolvedValue({
      id: 'QUOTA-1',
      totalDays: 12,
      usedDays: 9, // Remaining = 3 days
    });

    const managerUser = { id: 'MGR-1', role: 'Manager', employee: { id: 'EMP-999' } };

    await leaveService.updateLeaveStatus('REQ-100', 'Approved', managerUser, tenantScope as any);

    expect(mockPrisma.leaveQuota.update).toHaveBeenCalledWith({
      where: { id: 'QUOTA-1' },
      data: { usedDays: { increment: 2 } }, // Increments by 2 working days, not 4 calendar days
    });
  });

  it('12. Tenant A holidays/weekoffs do not affect Tenant B', async () => {
    const userA = { id: 'U1', role: 'Employee', companyId: 'COMP-A', employee: { id: 'EMP-A' } };
    const userB = { id: 'U2', role: 'Employee', companyId: 'COMP-B', employee: { id: 'EMP-B' } };

    mockPrisma.attendanceSetting.findFirst.mockImplementation(({ where }: any) => {
      if (where.companyId === 'COMP-A') return Promise.resolve({ weekOffs: 'Saturday,Sunday' });
      if (where.companyId === 'COMP-B') return Promise.resolve({ weekOffs: 'Saturday,Sunday' });
      return Promise.resolve(null);
    });

    mockPrisma.systemConfig.findUnique.mockImplementation(({ where }: any) => {
      // Company A has Aug 14 as public holiday, Company B has Aug 17 as public holiday
      if (where.key === 'payroll_holidays_COMP-A') return Promise.resolve({ value: '2026-08-14' });
      if (where.key === 'payroll_holidays_COMP-B') return Promise.resolve({ value: '2026-08-17' });
      return Promise.resolve(null);
    });

    mockPrisma.calendarEvent = { findMany: jest.fn().mockResolvedValue([]) };

    // Aug 14 (Fri) to Aug 17 (Mon) -> 4 calendar days (Fri, Sat, Sun, Mon)
    // Tenant A (Fri is Holiday, Sat/Sun Weekend, Mon Working Day) -> days = 1 (Mon)
    await leaveService.applyLeave(
      userA,
      { type: 'Casual Leave', startDate: '2026-08-14', endDate: '2026-08-17', reason: 'Trip' },
      { isPlatformBypass: false, companyId: 'COMP-A' } as any,
    );

    expect(mockLeaveRepository.createRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({ days: 1 }),
    );

    // Tenant B (Fri Working Day, Sat/Sun Weekend, Mon is Holiday) -> days = 1 (Fri)
    await leaveService.applyLeave(
      userB,
      { type: 'Casual Leave', startDate: '2026-08-14', endDate: '2026-08-17', reason: 'Trip' },
      { isPlatformBypass: false, companyId: 'COMP-B' } as any,
    );

    expect(mockLeaveRepository.createRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({ days: 1 }),
    );
  });

  it('13. Supports frontend { from, to } payload format seamlessly', async () => {
    await leaveService.applyLeave(
      mockUser,
      { type: 'Casual Leave', from: '2026-08-03', to: '2026-08-04', reason: 'Medical appointment' } as any,
      tenantScope as any,
    );

    expect(mockLeaveRepository.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'EMP-001',
        from: '2026-08-03',
        to: '2026-08-04',
        days: 2,
      }),
    );
  });

  it('14. Allows HRAdmin/Manager to apply leave on behalf of another employee via employeeId', async () => {
    const adminUser = {
      id: 'ADMIN-1',
      role: 'HRAdmin',
      companyId: 'COMP-A',
      employee: { id: 'EMP-ADMIN' },
    };

    await leaveService.applyLeave(
      adminUser,
      {
        type: 'Sick Leave',
        from: '2026-08-05',
        to: '2026-08-05',
        reason: 'Employee sick on phone request',
        employeeId: 'EMP-TARGET-99',
      } as any,
      tenantScope as any,
    );

    expect(mockLeaveRepository.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'EMP-TARGET-99',
        days: 1,
      }),
    );
  });
});

