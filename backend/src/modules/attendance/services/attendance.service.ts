import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClockInDto } from '../dto/clock-in.dto';
import { CreateRegularizationRequestDto } from '../dto/create-regularization-request.dto';
import { ReviewRegularizationRequestDto } from '../dto/review-regularization-request.dto';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { DevicesRepository } from '../repositories/devices.repository';
import { ZonesRepository } from '../repositories/zones.repository';
import { AttendanceSettingsRepository } from '../repositories/settings.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import {
  AttendanceMarkedEvent,
  AttendanceUpdatedEvent,
  ATTENDANCE_EVENTS,
} from '../../../common/events/attendance.events';

import { resolveEmployeeId } from '../../auth/utils/employee-identity.util';
import { AttendanceSource } from '@prisma/client';
import {
  getBusinessDateString,
  getBusinessTimeString,
} from '../../../common/utils/date.util';
import { calculateAttendanceStatus } from '../../../common/utils/attendance-rules.util';
import {
  calculateDistanceMeters,
  isWithinGeofence,
  isValidCoordinate,
} from '../../../common/utils/geo.util';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

import { Optional } from '@nestjs/common';
import { OutboxPublisherService } from '../../../common/queue/outbox-publisher.service';

@Injectable()
export class AttendanceService {
  constructor(
    private attendanceRepository: AttendanceRepository,
    private devicesRepository: DevicesRepository,
    private zonesRepository: ZonesRepository,
    private settingsRepository: AttendanceSettingsRepository,
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    @Optional() private readonly outboxPublisher?: OutboxPublisherService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  private getTenantId(currentUser: any): string | null {
    if (currentUser?.role === 'SuperAdmin') return null;
    return currentUser?.companyId || currentUser?.subscriptionId || null;
  }

  async clockInOrOut(currentUser: any, dto: ClockInDto) {
    const resolvedEmployeeId = resolveEmployeeId(dto.employeeId, currentUser);

    if (!resolvedEmployeeId) {
      throw new BadRequestException(
        'Employee record ID could not be resolved for attendance logging',
      );
    }

    const tenantId = this.getTenantId(currentUser);
    if (tenantId) {
      const emp = await this.prisma.employee.findUnique({
        where: { id: resolvedEmployeeId },
      });
      if (
        !emp ||
        (emp.companyId !== tenantId && emp.subscriptionId !== tenantId)
      ) {
        throw new ForbiddenException(
          'You do not have permission to modify this employee record',
        );
      }
    }

    const existing = await this.attendanceRepository.findByEmployeeAndDate(
      resolvedEmployeeId,
      dto.date,
    );

    const settings = await this.settingsRepository.get(tenantId);

    // ── Geofence Policy Verification ──────────────────────────────────────────
    const isClockOut = Boolean(dto.outTime && !dto.inTime);
    const isGeofenceRequired = isClockOut
      ? Boolean(settings.enableGeofencing && settings.geofenceOnClockOut)
      : Boolean(settings.enableGeofencing);

    if (isGeofenceRequired) {
      const role = currentUser?.role;
      const userPermissions: string[] = currentUser?.permissions || [];
      const isPrivilegedAdminRole =
        role === 'SuperAdmin' ||
        role === 'HRAdmin' ||
        role === 'CompanyOwner';

      // Security hardening: Only explicitly authorized administrative roles (HRAdmin, CompanyOwner, SuperAdmin)
      // can execute geofence bypass. Arbitrary custom roles, Employee, and Manager cannot escalate into bypass
      // merely because the permission key is present in userPermissions.
      const isAdministrativeBypass =
        isPrivilegedAdminRole &&
        (role === 'SuperAdmin' || userPermissions.includes('attendance:geo:bypass'));

      if (isAdministrativeBypass) {
        if (this.auditLogger) {
          await this.auditLogger.logAction({
            userId: currentUser?.id,
            userName: currentUser?.name || currentUser?.email,
            companyId: tenantId || 'PLATFORM',
            action: 'GEO_FENCE_BYPASS',
            details: `Administrative geofence bypass granted by ${role} for employee ID "${resolvedEmployeeId}" on ${dto.date}`,
            ip: dto.ipAddress || '127.0.0.1',
          });
        }
      } else {
        if (
          dto.latitude === undefined ||
          dto.latitude === null ||
          dto.longitude === undefined ||
          dto.longitude === null
        ) {
          throw new BadRequestException(
            'Location verification is required to clock in because your company has enabled attendance geofencing.',
          );
        }

        const empLat =
          typeof dto.latitude === 'string' ? parseFloat(dto.latitude) : dto.latitude;
        const empLon =
          typeof dto.longitude === 'string' ? parseFloat(dto.longitude) : dto.longitude;

        if (!isValidCoordinate(empLat, empLon)) {
          throw new BadRequestException(
            'Invalid GPS coordinates received. Please enable high-accuracy location and try again.',
          );
        }

        if (
          typeof dto.accuracy === 'number' &&
          Number.isFinite(dto.accuracy) &&
          dto.accuracy > 500
        ) {
          throw new BadRequestException(
            `Your GPS accuracy is too low (±${Math.round(dto.accuracy)}m). Please move to an open area or connect to office Wi-Fi and try again.`,
          );
        }

        const activeZones = await this.zonesRepository.findActiveValid(tenantId || 'C1');

        if (!activeZones || activeZones.length === 0) {
          throw new BadRequestException(
            'Attendance location verification is enabled, but no active work location is configured. Please contact HR.',
          );
        }

        let insideAnyZone = false;
        let minDistance = Infinity;

        for (const zone of activeZones) {
          if (zone.latitude !== null && zone.longitude !== null) {
            const dist = calculateDistanceMeters(empLat, empLon, zone.latitude, zone.longitude);
            if (dist < minDistance) {
              minDistance = dist;
            }
            if (dist <= zone.radiusMeters) {
              insideAnyZone = true;
              break;
            }
          }
        }

        if (!insideAnyZone) {
          const roundedDist = Math.round(minDistance);
          throw new BadRequestException(
            `Clock-in rejected: You are outside the authorized office location (${roundedDist}m away).`,
          );
        }
      }
    }

    try {
      if (existing) {
        let resolvedInTime = existing.inTime;
        let resolvedOutTime = existing.outTime;
        let resolvedStatus = existing.status;

        if (dto.outTime) {
          // Explicit Clock Out action
          if (!existing.inTime && !dto.inTime) {
            throw new BadRequestException('Cannot Clock Out before Clocking In for today.');
          }
          if (existing.outTime) {
            throw new BadRequestException('You have already Clocked Out for today.');
          }
          resolvedOutTime = dto.outTime;
          resolvedInTime = existing.inTime || dto.inTime || null;
          resolvedStatus =
            dto.status ||
            calculateAttendanceStatus(
              resolvedInTime,
              resolvedOutTime,
              settings,
              existing.status,
            );
        } else if (dto.inTime) {
          // Explicit Clock In action
          if (existing.inTime && existing.outTime) {
            throw new BadRequestException('Attendance for today is already completed.');
          }
          if (existing.inTime && !existing.outTime) {
            throw new BadRequestException('You have already Clocked In today.');
          }
          resolvedInTime = dto.inTime;
          resolvedOutTime = existing.outTime;
          resolvedStatus =
            dto.status ||
            calculateAttendanceStatus(
              resolvedInTime,
              resolvedOutTime,
              settings,
              existing.status,
            );
        } else {
          // Administrative / status update
          resolvedStatus = dto.status || existing.status;
        }

        const updated = await this.attendanceRepository.update(existing.id, {
          inTime: resolvedInTime,
          outTime: resolvedOutTime,
          remarks: dto.remarks !== undefined ? dto.remarks : existing.remarks,
          status: resolvedStatus,
          verified: dto.verified !== undefined ? dto.verified : existing.verified,
        });

        this.eventEmitter.emit(
          ATTENDANCE_EVENTS.UPDATED,
          new AttendanceUpdatedEvent(
            updated.id,
            updated.employeeId,
            updated.status,
            updated.date,
          ),
        );

        return updated;
      } else {
        if (dto.outTime && !dto.inTime) {
          throw new BadRequestException('Cannot Clock Out before Clocking In for today.');
        }

        const currentTime = getBusinessTimeString(new Date());
        const isAbsentOrLeave = dto.status === 'Absent' || dto.status === 'On Leave' || dto.status === 'Holiday';
        const defaultInTime = isAbsentOrLeave ? null : currentTime;
        const resolvedInTime = dto.inTime || (dto.outTime ? null : defaultInTime);
        const resolvedOutTime = dto.outTime || null;
        const resolvedStatus =
          dto.status ||
          calculateAttendanceStatus(
            resolvedInTime,
            resolvedOutTime,
            settings,
          );

        let resolvedSource: AttendanceSource = AttendanceSource.ONLINE;
        const isAdminOrHR = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'HRAdmin' || currentUser?.role === 'Admin';
        const selfEmployeeId = currentUser?.employee?.id || currentUser?.employeeId;

        if (isAdminOrHR && resolvedEmployeeId !== selfEmployeeId) {
          resolvedSource = AttendanceSource.MANUAL;
        } else if (dto.deviceId === 'MOBILE_APP' || (dto.deviceId && dto.deviceId.toLowerCase().includes('mobile'))) {
          resolvedSource = AttendanceSource.MOBILE;
        } else {
          resolvedSource = AttendanceSource.ONLINE;
        }

        const strLat = dto.latitude !== undefined && dto.latitude !== null ? String(dto.latitude) : undefined;
        const strLon = dto.longitude !== undefined && dto.longitude !== null ? String(dto.longitude) : undefined;

        const created = await this.attendanceRepository.create({
          employeeId: resolvedEmployeeId,
          date: dto.date,
          inTime: resolvedInTime,
          outTime: resolvedOutTime,
          status: resolvedStatus,
          remarks: dto.remarks,
          latitude: strLat,
          longitude: strLon,
          deviceId: dto.deviceId,
          ipAddress: dto.ipAddress,
          verified: dto.verified || false,
          source: resolvedSource,
        });

        this.eventEmitter.emit(
          ATTENDANCE_EVENTS.MARKED,
          new AttendanceMarkedEvent(
            created.id,
            created.employeeId,
            created.status,
            created.date,
          ),
        );

        return created;
      }
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof ForbiddenException) {
        throw err;
      }
      if (err.code === 'P2002' || err.message?.includes('Unique constraint')) {
        const raceExisting = await this.attendanceRepository.findByEmployeeAndDate(
          resolvedEmployeeId,
          dto.date,
        );
        if (raceExisting) {
          const resolvedOut = dto.outTime || raceExisting.outTime;
          const resolvedIn = dto.inTime || raceExisting.inTime;
          return this.attendanceRepository.update(raceExisting.id, {
            inTime: resolvedIn,
            outTime: resolvedOut,
            remarks: dto.remarks || raceExisting.remarks,
            status: dto.status || raceExisting.status,
            verified: dto.verified !== undefined ? dto.verified : raceExisting.verified,
          });
        }
      }
      throw err;
    }
  }

  async findAll(
    currentUser: any,
    employeeId?: string,
    date?: string,
    status?: string,
    optionsParam?: { page?: number; limit?: number; search?: string },
  ) {
    const tenantId = this.getTenantId(currentUser);
    const selfEmployeeId = currentUser?.employee?.id || currentUser?.employeeId;
    const isManager = currentUser?.role === 'Manager';
    const isAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'HRAdmin';

    let targetEmployeeId: string | undefined | { in: string[] } = undefined;

    if (isAdmin) {
      if (employeeId) {
        if (tenantId) {
          const emp = await this.prisma.employee.findFirst({
            where: {
              id: employeeId,
              OR: [
                { companyId: tenantId },
                { subscriptionId: tenantId },
              ],
            },
          });
          if (!emp) {
            throw new ForbiddenException('Target employee belongs to another tenant company.');
          }
        }
        targetEmployeeId = employeeId;
      }
    } else if (isManager && selfEmployeeId) {
      if (employeeId) {
        if (employeeId === selfEmployeeId) {
          targetEmployeeId = employeeId;
        } else {
          const emp = await this.prisma.employee.findFirst({
            where: { id: employeeId },
          });
          if (!emp || emp.managerId !== selfEmployeeId) {
            throw new ForbiddenException('You do not have permission to view this employee\'s attendance history');
          }
          targetEmployeeId = employeeId;
        }
      } else {
        const subOrds = await this.prisma.employee.findMany({
          where: { managerId: selfEmployeeId },
          select: { id: true },
        });
        const subOrdIds = subOrds.map((s) => s.id);
        targetEmployeeId = { in: [...subOrdIds, selfEmployeeId] };
      }
    } else if (selfEmployeeId) {
      if (employeeId && employeeId !== selfEmployeeId) {
        throw new ForbiddenException('You do not have permission to view other employees\' attendance history');
      }
      targetEmployeeId = selfEmployeeId;
    } else {
      throw new ForbiddenException('User context missing or insufficient privileges');
    }

    const page = optionsParam?.page && optionsParam.page > 0 ? optionsParam.page : 1;
    const limit = Math.min(
      optionsParam?.limit && optionsParam.limit > 0 ? optionsParam.limit : 50,
      100,
    );

    return this.attendanceRepository.findMany({
      companyId: tenantId,
      employeeId: targetEmployeeId as any,
      date,
      status,
      search: optionsParam?.search,
      page,
      limit,
    });
  }

  private get requestModel(): any {
    return (this.prisma as any).attendanceRegularizationRequest;
  }

  private async getEmployeeForUser(currentUser: any): Promise<any> {
    const selfEmpId = currentUser?.employee?.id || currentUser?.employeeId;
    if (selfEmpId) {
      const emp = await this.prisma.employee.findUnique({ where: { id: selfEmpId } });
      if (emp) return emp;
    }
    if (currentUser?.email) {
      const emp = await this.prisma.employee.findFirst({
        where: { email: currentUser.email },
      });
      if (emp) return emp;
    }
    if (currentUser?.id) {
      const emp = await this.prisma.employee.findFirst({
        where: { userId: currentUser.id },
      });
      if (emp) return emp;
    }
    return null;
  }

  async createRegularizationRequest(
    currentUser: any,
    dto: CreateRegularizationRequestDto,
  ) {
    const tenantId = this.getTenantId(currentUser);
    const settings = await this.settingsRepository.get(tenantId);

    if (!settings || !settings.enableRegularization) {
      throw new ForbiddenException(
        'Attendance regularization is currently disabled by organization policy.',
      );
    }

    const emp = await this.getEmployeeForUser(currentUser);
    if (!emp) {
      throw new BadRequestException(
        'Employee profile could not be found for authenticated user.',
      );
    }

    // Attendance record check
    const attendance = await this.attendanceRepository.findByIdAndTenant(
      dto.attendanceId,
      tenantId,
    );

    if (!attendance) {
      throw new NotFoundException(
        `Attendance record with ID "${dto.attendanceId}" not found`,
      );
    }

    // Ownership check: regular employees can only request regularization for their own attendance
    const isAdminOrHR =
      currentUser?.role === 'SuperAdmin' ||
      currentUser?.role === 'HRAdmin' ||
      currentUser?.role === 'Admin';
    if (!isAdminOrHR && attendance.employeeId !== emp.id) {
      throw new ForbiddenException(
        'You are not authorized to submit regularization requests for other employees.',
      );
    }

    // Time validation
    const [inH, inM] = dto.requestedInTime.split(':').map(Number);
    const [outH, outM] = dto.requestedOutTime.split(':').map(Number);
    if (
      isNaN(inH) ||
      isNaN(inM) ||
      isNaN(outH) ||
      isNaN(outM) ||
      outH < inH ||
      (outH === inH && outM <= inM)
    ) {
      throw new BadRequestException(
        'Requested check-out time must be strictly after check-in time.',
      );
    }

    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('A reason for regularization is required.');
    }

    // Duplicate check: prevent multiple PENDING requests for same attendance record
    const existingPending = await this.requestModel.findFirst({
      where: {
        attendanceId: dto.attendanceId,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      throw new ConflictException(
        'A regularization request is already pending for this attendance record.',
      );
    }

    const companyId = tenantId || emp.companyId || attendance.employee?.companyId || null;

    // Self Regularization Auto-Approval branch
    if (settings.selfRegularization) {
      const result = await this.prisma.$transaction(async (tx: any) => {
        const req = await tx.attendanceRegularizationRequest.create({
          data: {
            attendanceId: dto.attendanceId,
            employeeId: attendance.employeeId,
            companyId,
            originalInTime: attendance.inTime,
            originalOutTime: attendance.outTime,
            requestedInTime: dto.requestedInTime,
            requestedOutTime: dto.requestedOutTime,
            reason: dto.reason.trim(),
            status: 'APPROVED',
            reviewerId: emp.id,
            reviewerRemark: 'Auto-approved by self-regularization policy',
            reviewedAt: new Date(),
          },
        });

        await tx.attendance.update({
          where: { id: dto.attendanceId },
          data: {
            inTime: dto.requestedInTime,
            outTime: dto.requestedOutTime,
            status: 'Present',
            remarks: dto.reason.trim(),
            verified: true,
          },
        });

        return req;
      });

      if (this.auditLogger) {
        await this.auditLogger.logAction({
          userId: currentUser.id,
          userName: currentUser.name || emp.name,
          companyId: companyId || 'PLATFORM',
          action: 'REGULARIZATION_AUTO_APPROVED',
          details: `Attendance for date ${attendance.date} auto-approved for ${emp.name}`,
        });
      }

      this.eventEmitter.emit(
        ATTENDANCE_EVENTS.UPDATED,
        new AttendanceUpdatedEvent(
          attendance.id,
          attendance.employeeId,
          'Present',
          attendance.date,
        ),
      );

      return result;
    }

    // Normal Pending Request branch
    const pendingRequest = await this.requestModel.create({
      data: {
        attendanceId: dto.attendanceId,
        employeeId: attendance.employeeId,
        companyId,
        originalInTime: attendance.inTime,
        originalOutTime: attendance.outTime,
        requestedInTime: dto.requestedInTime,
        requestedOutTime: dto.requestedOutTime,
        reason: dto.reason.trim(),
        status: 'PENDING',
      },
    });

    if (this.auditLogger) {
      await this.auditLogger.logAction({
        userId: currentUser.id,
        userName: currentUser.name || emp.name,
        companyId: companyId || 'PLATFORM',
        action: 'REGULARIZATION_REQUESTED',
        details: `Regularization requested for attendance on ${attendance.date}`,
      });
    }

    return pendingRequest;
  }

  async getRegularizationRequests(
    currentUser: any,
    options?: { status?: string; employeeId?: string; page?: number; limit?: number },
  ) {
    const tenantId = this.getTenantId(currentUser);
    const emp = await this.getEmployeeForUser(currentUser);
    const isManager = currentUser?.role === 'Manager';

    const where: any = {};
    if (tenantId) {
      where.companyId = tenantId;
    }

    // Role-based visibility scoping
    if (currentUser?.role === 'Employee') {
      if (!emp) return { data: [], total: 0, page: 1, limit: 50 };
      where.employeeId = emp.id;
    } else if (isManager && emp) {
      if (options?.employeeId) {
        where.employeeId = options.employeeId;
      } else {
        const subOrds = await this.prisma.employee.findMany({
          where: { managerId: emp.id },
          select: { id: true },
        });
        const subOrdIds = subOrds.map((s) => s.id);
        where.employeeId = { in: [...subOrdIds, emp.id] };
      }
    } else if (options?.employeeId) {
      where.employeeId = options.employeeId;
    }

    if (options?.status) {
      where.status = options.status as any;
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const limit = Math.min(options?.limit && options.limit > 0 ? options.limit : 50, 100);

    const [total, data] = await Promise.all([
      this.requestModel.count({ where }),
      this.requestModel.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              departmentId: true,
              designationId: true,
            },
          },
          attendance: true,
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }

  async approveRegularizationRequest(
    currentUser: any,
    requestId: string,
    dto?: ReviewRegularizationRequestDto,
  ) {
    const tenantId = this.getTenantId(currentUser);
    const request = await this.requestModel.findUnique({
      where: { id: requestId },
      include: { attendance: true, employee: true },
    });

    if (!request) {
      throw new NotFoundException(`Regularization request with ID "${requestId}" not found`);
    }

    if (tenantId && request.companyId && request.companyId !== tenantId) {
      throw new NotFoundException(`Regularization request with ID "${requestId}" not found`);
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `Regularization request has already been processed with status "${request.status}".`,
      );
    }

    // Reviewer Employee Resolution & Self-Approval Prevention
    const reviewerEmp = await this.getEmployeeForUser(currentUser);
    const settings = await this.settingsRepository.get(tenantId);

    if (
      (!settings || !settings.selfRegularization) &&
      reviewerEmp &&
      reviewerEmp.id === request.employeeId
    ) {
      throw new ForbiddenException(
        'Self-approval is prohibited. Managers and HR cannot approve their own regularization requests.',
      );
    }

    if (!request.attendance) {
      throw new NotFoundException('Associated attendance record no longer exists.');
    }

    const recomputedStatus = calculateAttendanceStatus(
      request.requestedInTime,
      request.requestedOutTime,
      settings,
    );

    const approved = await this.prisma.$transaction(async (tx: any) => {
      const updatedReq = await tx.attendanceRegularizationRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewerId: reviewerEmp?.id || null,
          reviewerRemark: dto?.reviewerRemark?.trim() || 'Approved',
          reviewedAt: new Date(),
        },
      });

      await tx.attendance.update({
        where: { id: request.attendanceId },
        data: {
          inTime: request.requestedInTime,
          outTime: request.requestedOutTime,
          status: recomputedStatus,
          remarks: request.reason,
          verified: true,
        },
      });

      return updatedReq;
    });

    if (this.auditLogger) {
      await this.auditLogger.logAction({
        userId: currentUser.id,
        userName: currentUser.name || reviewerEmp?.name,
        companyId: tenantId || request.companyId || 'PLATFORM',
        action: 'REGULARIZATION_APPROVED',
        details: `Regularization request ${requestId} approved for employee ${request.employee?.name}`,
      });
    }

    this.eventEmitter.emit(
      ATTENDANCE_EVENTS.APPROVED,
      new AttendanceUpdatedEvent(
        request.attendanceId,
        request.employeeId,
        'Present',
        request.attendance.date,
      ),
    );

    return approved;
  }

  async rejectRegularizationRequest(
    currentUser: any,
    requestId: string,
    dto?: ReviewRegularizationRequestDto,
  ) {
    const tenantId = this.getTenantId(currentUser);
    const request = await this.requestModel.findUnique({
      where: { id: requestId },
      include: { attendance: true, employee: true },
    });

    if (!request) {
      throw new NotFoundException(`Regularization request with ID "${requestId}" not found`);
    }

    if (tenantId && request.companyId && request.companyId !== tenantId) {
      throw new NotFoundException(`Regularization request with ID "${requestId}" not found`);
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `Regularization request has already been processed with status "${request.status}".`,
      );
    }

    if (!dto?.reviewerRemark || !dto.reviewerRemark.trim()) {
      throw new BadRequestException(
        'A reviewer remark/reason is required when rejecting a regularization request.',
      );
    }

    const reviewerEmp = await this.getEmployeeForUser(currentUser);
    const settings = await this.settingsRepository.get(tenantId);

    if (
      (!settings || !settings.selfRegularization) &&
      reviewerEmp &&
      reviewerEmp.id === request.employeeId
    ) {
      throw new ForbiddenException(
        'Self-review is prohibited. Managers and HR cannot reject/review their own regularization requests.',
      );
    }

    const rejected = await this.requestModel.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewerId: reviewerEmp?.id || null,
        reviewerRemark: dto.reviewerRemark.trim(),
        reviewedAt: new Date(),
      },
    });

    if (this.auditLogger) {
      await this.auditLogger.logAction({
        userId: currentUser.id,
        userName: currentUser.name || reviewerEmp?.name,
        companyId: tenantId || request.companyId || 'PLATFORM',
        action: 'REGULARIZATION_REJECTED',
        details: `Regularization request ${requestId} rejected for employee ${request.employee?.name}`,
      });
    }

    return rejected;
  }

  async regularize(
    currentUser: any,
    id: string,
    updateData: { inTime?: string; outTime?: string; remarks?: string },
  ) {
    const tenantId = this.getTenantId(currentUser);
    const record = await this.attendanceRepository.findByIdAndTenant(
      id,
      tenantId,
    );
    if (!record) {
      throw new NotFoundException(`Attendance record with ID "${id}" not found`);
    }

    const emp = await this.getEmployeeForUser(currentUser);
    const isAdminOrHR =
      currentUser?.role === 'SuperAdmin' ||
      currentUser?.role === 'HRAdmin' ||
      currentUser?.role === 'Admin';

    // If regular employee attempts direct manual mutation when regularization policy is active
    if (!isAdminOrHR) {
      const settings = await this.settingsRepository.get(tenantId);
      if (settings?.enableRegularization) {
        throw new ForbiddenException(
          'Regular employees cannot directly mutate attendance records. Please submit a request via POST /attendance/regularize-requests',
        );
      }
    }

    const updated = await this.attendanceRepository.update(id, {
      inTime: updateData.inTime ?? record.inTime,
      outTime: updateData.outTime ?? record.outTime,
      remarks: updateData.remarks ?? record.remarks,
      verified: false,
    });

    if (this.auditLogger) {
      await this.auditLogger.logAction({
        userId: currentUser.id,
        userName: currentUser.name,
        companyId: tenantId || 'PLATFORM',
        action: 'ATTENDANCE_MANUALLY_EDITED',
        details: `Administrative manual attendance update for record ${id}`,
      });
    }

    this.eventEmitter.emit(
      ATTENDANCE_EVENTS.UPDATED,
      new AttendanceUpdatedEvent(
        updated.id,
        updated.employeeId,
        updated.status,
        updated.date,
      ),
    );

    return updated;
  }

  async verify(currentUser: any, id: string) {
    const tenantId = this.getTenantId(currentUser);
    const record = await this.attendanceRepository.findByIdAndTenant(
      id,
      tenantId,
    );
    if (!record) {
      throw new NotFoundException(`Attendance record with ID "${id}" not found`);
    }

    const updated = await this.attendanceRepository.update(id, {
      verified: true,
    });

    this.eventEmitter.emit(
      ATTENDANCE_EVENTS.APPROVED,
      new AttendanceUpdatedEvent(
        updated.id,
        updated.employeeId,
        updated.status,
        updated.date,
      ),
    );

    return updated;
  }

  // ── Biometric Devices ───────────────────────────────────────────────────
  async getDevices(currentUser: any) {
    const tenantId = this.getTenantId(currentUser);
    return (this.devicesRepository as any).findAll ? (this.devicesRepository as any).findAll(tenantId) : [];
  }

  async createDevice(currentUser: any, device: any) {
    const tenantId = this.getTenantId(currentUser);
    return (this.devicesRepository as any).create ? (this.devicesRepository as any).create({ ...device, companyId: tenantId }) : { id: 'dev-1', ...device };
  }

  async syncDevice(currentUser: any, id: string) {
    const tenantId = this.getTenantId(currentUser);
    const dev = (this.devicesRepository as any).findById ? await (this.devicesRepository as any).findById(id) : null;
    if (dev && tenantId && dev.companyId && dev.companyId !== tenantId) {
      throw new NotFoundException(`Biometric device with ID "${id}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = (this.devicesRepository as any).update
        ? await (this.devicesRepository as any).update(id, { last: 'Just now', status: 'Online' })
        : { id, status: 'Online' };

      if (this.outboxPublisher) {
        await this.outboxPublisher.publishAttendanceSync(tx, {
          syncDate: new Date().toISOString().slice(0, 10),
          deviceId: id,
          companyId: tenantId || 'PLATFORM',
          actor: { id: currentUser?.id || 'system', role: currentUser?.role || 'Admin' },
        });
      }

      return updated;
    });
  }

  async deleteDevice(currentUser: any, id: string) {
    const tenantId = this.getTenantId(currentUser);
    const dev = (this.devicesRepository as any).findById ? await (this.devicesRepository as any).findById(id) : null;
    if (dev && tenantId && dev.companyId && dev.companyId !== tenantId) {
      throw new NotFoundException(`Biometric device with ID "${id}" not found`);
    }
    return (this.devicesRepository as any).delete ? (this.devicesRepository as any).delete(id) : { success: true };
  }

  // ── Attendance Settings ─────────────────────────────────────────────────
  async getSettings(currentUser: any) {
    const tenantId = this.getTenantId(currentUser);
    return (this.settingsRepository as any).get ? (this.settingsRepository as any).get(tenantId) : {};
  }

  async updateSettings(currentUser: any, data: any) {
    const tenantId = this.getTenantId(currentUser);
    return (this.settingsRepository as any).update ? (this.settingsRepository as any).update(tenantId, data) : data;
  }
}
