import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { AttendanceSettingsRepository } from '../repositories/settings.repository';
import { ZonesRepository } from '../repositories/zones.repository';
import { DevicesRepository } from '../repositories/devices.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { BadRequestException } from '@nestjs/common';
import { AttendanceSource } from '@prisma/client';

describe('Attendance Geofencing Engine', () => {
  let service: AttendanceService;
  let attendanceRepoMock: any;
  let settingsRepoMock: any;
  let zonesRepoMock: any;
  let devicesRepoMock: any;
  let prismaMock: any;
  let eventEmitterMock: any;
  let auditLoggerMock: any;

  const tenantA = 'tenant-a-company-id';
  const tenantB = 'tenant-b-company-id';

  const employeeUser = {
    id: 'user-emp-1',
    name: 'John Doe',
    email: 'john@acme.com',
    role: 'Employee',
    employeeId: 'emp-1',
    companyId: tenantA,
    permissions: ['employees:attendance:clock'],
  };

  const adminBypassUser = {
    id: 'user-admin-1',
    name: 'Admin User',
    email: 'admin@acme.com',
    role: 'HRAdmin',
    employeeId: 'emp-1',
    companyId: tenantA,
    permissions: ['employees:attendance:clock', 'attendance:geo:bypass'],
  };

  // Center coordinate: Bangalore Vidhana Soudha (12.9797, 77.5907)
  const zoneCenterLat = 12.9797;
  const zoneCenterLon = 77.5907;
  const zoneRadiusMeters = 100;

  beforeEach(() => {
    attendanceRepoMock = {
      findByEmployeeAndDate: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({ id: 'att-1', ...data }),
      ),
      update: jest.fn().mockImplementation((id, data) =>
        Promise.resolve({ id, ...data }),
      ),
    };

    settingsRepoMock = {
      get: jest.fn().mockResolvedValue({
        enableGeofencing: false,
        geofenceOnClockOut: false,
        shiftStart: '09:00',
        shiftEnd: '18:00',
        gracePeriod: 15,
        halfDayThreshold: 240,
      }),
    };

    zonesRepoMock = {
      findActiveValid: jest.fn().mockResolvedValue([
        {
          id: 'zone-1',
          name: 'HQ Office Zone',
          companyId: tenantA,
          latitude: zoneCenterLat,
          longitude: zoneCenterLon,
          radiusMeters: zoneRadiusMeters,
          enabled: true,
        },
      ]),
    };

    devicesRepoMock = {};

    prismaMock = {
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'emp-1',
          companyId: tenantA,
        }),
      },
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    auditLoggerMock = {
      logAction: jest.fn().mockResolvedValue(undefined),
    };

    service = new AttendanceService(
      attendanceRepoMock as unknown as AttendanceRepository,
      devicesRepoMock as unknown as DevicesRepository,
      zonesRepoMock as unknown as ZonesRepository,
      settingsRepoMock as unknown as AttendanceSettingsRepository,
      prismaMock as unknown as PrismaService,
      eventEmitterMock as unknown as EventEmitter2,
      undefined,
      auditLoggerMock as unknown as AuditLoggerService,
    );
  });

  describe('1. Geofencing Disabled', () => {
    it('allows clock-in without GPS coordinates when geofencing is disabled', async () => {
      settingsRepoMock.get.mockResolvedValue({
        enableGeofencing: false,
        geofenceOnClockOut: false,
      });

      const result = await service.clockInOrOut(employeeUser, {
        date: '2026-08-26',
        inTime: '09:00',
      });

      expect(result).toBeDefined();
      expect(attendanceRepoMock.create).toHaveBeenCalled();
      expect(zonesRepoMock.findActiveValid).not.toHaveBeenCalled();
    });
  });

  describe('2. Geofencing Enabled (Clock-In Verification)', () => {
    beforeEach(() => {
      settingsRepoMock.get.mockResolvedValue({
        enableGeofencing: true,
        geofenceOnClockOut: false,
      });
    });

    it('allows clock-in when employee is inside active geofence radius', async () => {
      // 20 meters offset
      const empLat = zoneCenterLat + 0.00018;
      const empLon = zoneCenterLon;

      const result = await service.clockInOrOut(employeeUser, {
        date: '2026-08-26',
        inTime: '09:00',
        latitude: empLat,
        longitude: empLon,
        accuracy: 15,
      });

      expect(result).toBeDefined();
      expect(attendanceRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: String(empLat),
          longitude: String(empLon),
          source: AttendanceSource.ONLINE,
        }),
      );
    });

    it('rejects clock-in when employee is outside the active geofence radius', async () => {
      // ~2 km away (MG Road)
      const empLat = 12.9756;
      const empLon = 77.6066;

      await expect(
        service.clockInOrOut(employeeUser, {
          date: '2026-08-26',
          inTime: '09:00',
          latitude: empLat,
          longitude: empLon,
          accuracy: 20,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(attendanceRepoMock.create).not.toHaveBeenCalled();
    });

    it('rejects clock-in when coordinates are missing and geofencing is enabled', async () => {
      await expect(
        service.clockInOrOut(employeeUser, {
          date: '2026-08-26',
          inTime: '09:00',
        }),
      ).rejects.toThrow('Location verification is required to clock in');
    });

    it('fail-closed: rejects clock-in when geofencing is enabled but no active valid zones exist', async () => {
      zonesRepoMock.findActiveValid.mockResolvedValue([]);

      await expect(
        service.clockInOrOut(employeeUser, {
          date: '2026-08-26',
          inTime: '09:00',
          latitude: zoneCenterLat,
          longitude: zoneCenterLon,
        }),
      ).rejects.toThrow('Attendance location verification is enabled, but no active work location is configured');
    });

    it('rejects clock-in when GPS accuracy is too poor (> 500m)', async () => {
      await expect(
        service.clockInOrOut(employeeUser, {
          date: '2026-08-26',
          inTime: '09:00',
          latitude: zoneCenterLat,
          longitude: zoneCenterLon,
          accuracy: 650, // 650m error
        }),
      ).rejects.toThrow('Your GPS accuracy is too low');
    });
  });

  describe('3. Multiple Active GeoZones', () => {
    it('allows clock-in if employee is inside ANY of the active company zones', async () => {
      settingsRepoMock.get.mockResolvedValue({
        enableGeofencing: true,
        geofenceOnClockOut: false,
      });

      // Zone 1: Vidhana Soudha, Zone 2: Whitefield (12.9698, 77.7500)
      zonesRepoMock.findActiveValid.mockResolvedValue([
        {
          id: 'zone-1',
          name: 'Vidhana Soudha HQ',
          companyId: tenantA,
          latitude: 12.9797,
          longitude: 77.5907,
          radiusMeters: 100,
          enabled: true,
        },
        {
          id: 'zone-2',
          name: 'Whitefield Branch',
          companyId: tenantA,
          latitude: 12.9698,
          longitude: 77.75,
          radiusMeters: 150,
          enabled: true,
        },
      ]);

      // Employee is at Whitefield Branch (inside Zone 2, far from Zone 1)
      const empLat = 12.9698;
      const empLon = 77.75;

      const result = await service.clockInOrOut(employeeUser, {
        date: '2026-08-26',
        inTime: '09:00',
        latitude: empLat,
        longitude: empLon,
      });

      expect(result).toBeDefined();
      expect(attendanceRepoMock.create).toHaveBeenCalled();
    });
  });

  describe('4. Clock-Out Geofence Enforcement Policy', () => {
    it('allows clock-out without GPS when geofenceOnClockOut is false (default)', async () => {
      settingsRepoMock.get.mockResolvedValue({
        enableGeofencing: true,
        geofenceOnClockOut: false,
      });

      attendanceRepoMock.findByEmployeeAndDate.mockResolvedValue({
        id: 'att-1',
        inTime: '09:00',
        outTime: null,
        status: 'Present',
      });

      const result = await service.clockInOrOut(employeeUser, {
        date: '2026-08-26',
        outTime: '18:00',
      });

      expect(result).toBeDefined();
      expect(attendanceRepoMock.update).toHaveBeenCalled();
    });

    it('enforces geofence on clock-out when geofenceOnClockOut is true and rejects out-of-bounds', async () => {
      settingsRepoMock.get.mockResolvedValue({
        enableGeofencing: true,
        geofenceOnClockOut: true,
      });

      attendanceRepoMock.findByEmployeeAndDate.mockResolvedValue({
        id: 'att-1',
        inTime: '09:00',
        outTime: null,
        status: 'Present',
      });

      // Employee is 2km away at time of clock-out
      await expect(
        service.clockInOrOut(employeeUser, {
          date: '2026-08-26',
          outTime: '18:00',
          latitude: 12.9756,
          longitude: 77.6066,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(attendanceRepoMock.update).not.toHaveBeenCalled();
    });
  });

  describe('5. Administrative Bypass & Escalation Hardening', () => {
    beforeEach(() => {
      settingsRepoMock.get.mockResolvedValue({
        enableGeofencing: true,
        geofenceOnClockOut: false,
      });
    });

    it('allows authorized HRAdmin with bypass permission to clock in outside zone and emits audit log', async () => {
      const hrAdminUser = {
        id: 'user-hr-1',
        name: 'HR Admin',
        role: 'HRAdmin',
        employeeId: 'emp-1',
        companyId: tenantA,
        permissions: ['employees:attendance:clock', 'attendance:geo:bypass'],
      };

      const result = await service.clockInOrOut(hrAdminUser, {
        date: '2026-08-26',
        inTime: '09:00',
        latitude: 12.9100, // 5km away
        longitude: 77.5000,
      });

      expect(result).toBeDefined();
      expect(attendanceRepoMock.create).toHaveBeenCalled();
      expect(auditLoggerMock.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GEO_FENCE_BYPASS',
          companyId: tenantA,
          userId: 'user-hr-1',
        }),
      );
    });

    it('allows authorized CompanyOwner with bypass permission to clock in outside zone and emits audit log', async () => {
      const ownerUser = {
        id: 'user-owner-1',
        name: 'Owner User',
        role: 'CompanyOwner',
        employeeId: 'emp-1',
        companyId: tenantA,
        permissions: ['employees:attendance:clock', 'attendance:geo:bypass'],
      };

      const result = await service.clockInOrOut(ownerUser, {
        date: '2026-08-26',
        inTime: '09:00',
        latitude: 12.9100,
        longitude: 77.5000,
      });

      expect(result).toBeDefined();
      expect(attendanceRepoMock.create).toHaveBeenCalled();
      expect(auditLoggerMock.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GEO_FENCE_BYPASS',
          companyId: tenantA,
          userId: 'user-owner-1',
        }),
      );
    });

    it('denies bypass to Employee role even if permission key attendance:geo:bypass is maliciously attached', async () => {
      const escalatedEmployee = {
        id: 'user-emp-2',
        name: 'Sneaky Employee',
        role: 'Employee',
        employeeId: 'emp-1',
        companyId: tenantA,
        permissions: ['employees:attendance:clock', 'attendance:geo:bypass'],
      };

      await expect(
        service.clockInOrOut(escalatedEmployee, {
          date: '2026-08-26',
          inTime: '09:00',
          latitude: 12.9100, // 5km away
          longitude: 77.5000,
        }),
      ).rejects.toThrow('Clock-in rejected: You are outside the authorized office location');

      expect(auditLoggerMock.logAction).not.toHaveBeenCalled();
    });

    it('denies bypass to Manager role even if permission key attendance:geo:bypass is attached', async () => {
      const escalatedManager = {
        id: 'user-mgr-1',
        name: 'Team Manager',
        role: 'Manager',
        employeeId: 'emp-1',
        companyId: tenantA,
        permissions: ['employees:attendance:clock', 'attendance:geo:bypass'],
      };

      await expect(
        service.clockInOrOut(escalatedManager, {
          date: '2026-08-26',
          inTime: '09:00',
          latitude: 12.9100,
          longitude: 77.5000,
        }),
      ).rejects.toThrow('Clock-in rejected: You are outside the authorized office location');

      expect(auditLoggerMock.logAction).not.toHaveBeenCalled();
    });

    it('denies bypass to arbitrary custom role even if permission key attendance:geo:bypass is attached', async () => {
      const customRoleUser = {
        id: 'user-custom-1',
        name: 'Custom Role User',
        role: 'FieldAuditorCustom',
        employeeId: 'emp-1',
        companyId: tenantA,
        permissions: ['employees:attendance:clock', 'attendance:geo:bypass'],
      };

      await expect(
        service.clockInOrOut(customRoleUser, {
          date: '2026-08-26',
          inTime: '09:00',
          latitude: 12.9100,
          longitude: 77.5000,
        }),
      ).rejects.toThrow('Clock-in rejected: You are outside the authorized office location');

      expect(auditLoggerMock.logAction).not.toHaveBeenCalled();
    });
  });

  describe('6. Multi-Tenant Isolation', () => {
    it('scopes active zone lookup strictly to the authenticated employee tenant', async () => {
      settingsRepoMock.get.mockResolvedValue({
        enableGeofencing: true,
      });

      await service.clockInOrOut(employeeUser, {
        date: '2026-08-26',
        inTime: '09:00',
        latitude: zoneCenterLat,
        longitude: zoneCenterLon,
      });

      expect(zonesRepoMock.findActiveValid).toHaveBeenCalledWith(tenantA);
      expect(zonesRepoMock.findActiveValid).not.toHaveBeenCalledWith(tenantB);
    });
  });
});
