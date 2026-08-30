import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { AttendanceSettingsRepository } from '../repositories/settings.repository';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

const AttendanceSource = {
  ONLINE: 'ONLINE',
  MOBILE: 'MOBILE',
  BIOMETRIC: 'BIOMETRIC',
  MANUAL: 'MANUAL',
  IMPORT: 'IMPORT',
  API: 'API',
  UNKNOWN: 'UNKNOWN',
} as const;
type AttendanceSource = (typeof AttendanceSource)[keyof typeof AttendanceSource];

describe('Attendance Scoping and Provenance Redesign Tests', () => {
  let attendanceService: AttendanceService;
  let mockPrisma: any;
  let mockAttendanceRepository: AttendanceRepository;
  let mockSettingsRepository: AttendanceSettingsRepository;

  const employeeUser = {
    id: 'user-employee-1',
    role: 'Employee',
    employeeId: 'EMP-001',
    employee: { id: 'EMP-001', companyId: 'COMP-A' },
    companyId: 'COMP-A',
  };

  const managerUser = {
    id: 'user-manager-1',
    role: 'Manager',
    employeeId: 'EMP-MGR',
    employee: { id: 'EMP-MGR', companyId: 'COMP-A' },
    companyId: 'COMP-A',
  };

  const hrAdminUser = {
    id: 'user-hr-1',
    role: 'HRAdmin',
    employeeId: 'EMP-HR',
    employee: { id: 'EMP-HR', companyId: 'COMP-A' },
    companyId: 'COMP-A',
  };

  const superAdminUser = {
    id: 'user-super-1',
    role: 'SuperAdmin',
  };

  beforeEach(() => {
    mockPrisma = {
      employee: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      attendance: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      attendanceSetting: {
        findFirst: jest.fn(),
      },
      attendanceRegularizationRequest: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    // Extended mock prisma client
    mockPrisma.extended = {
      attendance: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    mockAttendanceRepository = new AttendanceRepository(mockPrisma);
    mockSettingsRepository = new AttendanceSettingsRepository(mockPrisma);

    attendanceService = new AttendanceService(
      mockAttendanceRepository,
      {} as any, // Mock devices repository
      {} as any, // Mock zones repository
      mockSettingsRepository,
      mockPrisma,
      { emit: jest.fn() } as any, // Mock event emitter
    );
  });

  describe('1. Provenance Assignment Server-Side Rules', () => {
    it('should assign ONLINE source for standard web clock-ins', async () => {
      mockPrisma.extended.attendance.findFirst.mockResolvedValue(null);
      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'EMP-001', companyId: 'COMP-A' });
      mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday' });

      const spyCreate = jest.spyOn(mockAttendanceRepository, 'create').mockResolvedValue({
        id: 'new-att-id',
        employeeId: 'EMP-001',
        date: '2026-08-21',
        source: AttendanceSource.ONLINE,
      } as any);

      const result = await attendanceService.clockInOrOut(employeeUser, {
        date: '2026-08-21',
        inTime: '09:00',
      });

      expect(spyCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          source: AttendanceSource.ONLINE,
        }),
      );
      expect((result as any).source).toBe(AttendanceSource.ONLINE);
    });

    it('should assign MOBILE source if mobile device is supplied', async () => {
      mockPrisma.extended.attendance.findFirst.mockResolvedValue(null);
      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'EMP-001', companyId: 'COMP-A' });
      mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday' });

      const spyCreate = jest.spyOn(mockAttendanceRepository, 'create').mockResolvedValue({
        id: 'new-att-id',
        employeeId: 'EMP-001',
        date: '2026-08-21',
        source: AttendanceSource.MOBILE,
      } as any);

      await attendanceService.clockInOrOut(employeeUser, {
        date: '2026-08-21',
        inTime: '09:00',
        latitude: '12.9716',
        longitude: '77.5946',
        deviceId: 'MOBILE_APP',
      });

      expect(spyCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          source: AttendanceSource.MOBILE,
        }),
      );
    });

    it('should assign MANUAL source if HRAdmin clocks in manually for another employee', async () => {
      mockPrisma.extended.attendance.findFirst.mockResolvedValue(null);
      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'EMP-002', companyId: 'COMP-A' });
      mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday' });

      const spyCreate = jest.spyOn(mockAttendanceRepository, 'create').mockResolvedValue({
        id: 'new-att-id',
        employeeId: 'EMP-002',
        date: '2026-08-21',
        source: AttendanceSource.MANUAL,
      } as any);

      await attendanceService.clockInOrOut(hrAdminUser, {
        employeeId: 'EMP-002',
        date: '2026-08-21',
        inTime: '09:00',
      });

      expect(spyCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          source: AttendanceSource.MANUAL,
        }),
      );
    });

    it('should NOT overwrite source on existing updates (preserves provenance)', async () => {
      // Mock existing attendance check-in that has ONLINE source
      mockPrisma.extended.attendance.findFirst.mockResolvedValue({
        id: 'existing-id',
        employeeId: 'EMP-001',
        date: '2026-08-21',
        inTime: '09:00',
        outTime: null,
        source: AttendanceSource.ONLINE,
      });
      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'EMP-001', companyId: 'COMP-A' });
      mockPrisma.attendanceSetting.findFirst.mockResolvedValue({ weekOffs: 'Saturday,Sunday' });

      const spyUpdate = jest.spyOn(mockAttendanceRepository, 'update').mockResolvedValue({
        id: 'existing-id',
        employeeId: 'EMP-001',
        date: '2026-08-21',
        inTime: '09:00',
        outTime: '18:00',
        source: AttendanceSource.ONLINE, // Preserved source
      } as any);

      await attendanceService.clockInOrOut(employeeUser, {
        date: '2026-08-21',
        outTime: '18:00',
      });

      // Assert that update does NOT include source parameter (thus preserving original source)
      expect(spyUpdate).toHaveBeenCalledWith(
        'existing-id',
        expect.not.objectContaining({ source: expect.any(String) }),
      );
    });
  });

  describe('2. Scoping and RBAC Filtering Rules', () => {
    it('Employee → should successfully query own logs and throw on other logs', async () => {
      const spyFindMany = jest.spyOn(mockAttendanceRepository, 'findMany').mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      } as any);

      // Querying own logs should succeed
      await attendanceService.findAll(employeeUser, 'EMP-001');
      expect(spyFindMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          employeeId: 'EMP-001',
        }),
      );

      // Querying another employee's logs should fail with 403 Forbidden
      await expect(
        attendanceService.findAll(employeeUser, 'EMP-002'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Manager → should query subordinates and throw on unrelated employees', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce({
        id: 'EMP-002',
        managerId: 'EMP-MGR',
      }); // subordinate
      mockPrisma.employee.findFirst.mockResolvedValueOnce({
        id: 'EMP-OTHER',
        managerId: 'EMP-OTHER-MGR',
      }); // unrelated

      const spyFindMany = jest.spyOn(mockAttendanceRepository, 'findMany').mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      } as any);

      // Querying self should succeed
      await attendanceService.findAll(managerUser, 'EMP-MGR');
      expect(spyFindMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ employeeId: 'EMP-MGR' }),
      );

      // Querying subordinate employee should succeed
      await attendanceService.findAll(managerUser, 'EMP-002');
      expect(spyFindMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ employeeId: 'EMP-002' }),
      );

      // Querying unrelated employee should throw 403 Forbidden
      await expect(
        attendanceService.findAll(managerUser, 'EMP-OTHER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Manager → querying without specific employeeId should fetch all subordinates + manager self', async () => {
      // Mock employee list for direct report managerId check
      mockPrisma.employee.findMany.mockResolvedValue([
        { id: 'EMP-SUB-1' },
        { id: 'EMP-SUB-2' },
      ]);

      const spyFindMany = jest.spyOn(mockAttendanceRepository, 'findMany').mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      } as any);

      await attendanceService.findAll(managerUser, undefined);

      expect(spyFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: {
            in: ['EMP-SUB-1', 'EMP-SUB-2', 'EMP-MGR'],
          },
        }),
      );
    });

    it('HRAdmin → should succeed within tenant and throw 403 on unrelated tenant employee', async () => {
      // Mock employee from the same company
      mockPrisma.employee.findFirst.mockResolvedValueOnce({
        id: 'EMP-002',
        companyId: 'COMP-A',
      });
      // Mock employee from another company
      mockPrisma.employee.findFirst.mockResolvedValueOnce(null);

      const spyFindMany = jest.spyOn(mockAttendanceRepository, 'findMany').mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      } as any);

      // Same tenant should succeed
      await attendanceService.findAll(hrAdminUser, 'EMP-002');
      expect(spyFindMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          employeeId: 'EMP-002',
          companyId: 'COMP-A',
        }),
      );

      // Querying cross-tenant employee should throw 403 Forbidden
      await expect(
        attendanceService.findAll(hrAdminUser, 'EMP-CROSS-TENANT'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
