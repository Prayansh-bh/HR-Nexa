import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, Optional, Logger } from '@nestjs/common';
import { LeaveRepository } from '../repositories/leave.repository';
import { EventsRepository } from '../repositories/events.repository';
import { LeaveTypesRepository } from '../repositories/leavetypes.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { Role } from '../../auth/role.enum';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';
import { CalendarReminderService } from '../../notifications/services/calendar-reminder.service';
import { LeaveRequestStatus } from '@prisma/client';

import { calculateWorkingDaysInRange } from '../../../common/utils/week-off.util';

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    private readonly leaveRepository: LeaveRepository,
    private readonly eventsRepository: EventsRepository,
    private readonly leaveTypesRepository: LeaveTypesRepository,
    private readonly prisma: PrismaService,
    @Optional() private readonly reminderService?: CalendarReminderService,
  ) {}

  async applyLeave(user: any, dto: { type: string; startDate?: string; endDate?: string; from?: string; to?: string; reason: string; employeeId?: string }, scope?: TenantScope) {
    const isAdminOrManager = user?.role === 'SuperAdmin' || user?.role === 'HRAdmin' || user?.role === 'CompanyOwner' || user?.role === 'Manager';
    const targetEmployeeId = (isAdminOrManager && dto.employeeId)
      ? dto.employeeId
      : (user.employee?.id || user.employeeId);

    if (!targetEmployeeId) {
      throw new BadRequestException('Employee record not linked to this user');
    }

    const startDate = dto.startDate || dto.from;
    const endDate = dto.endDate || dto.to;
    if (!startDate || !endDate) {
      throw new BadRequestException('Start date and end date are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format for leave request');
    }
    if (end < start) {
      throw new BadRequestException('End date cannot be earlier than start date');
    }

    const tenantCompanyId = scope?.isPlatformBypass
      ? null
      : scope?.companyId || user.companyId || user.subscriptionId || null;

    const holidayConfigKey = tenantCompanyId ? `payroll_holidays_${tenantCompanyId}` : 'payroll_holidays';

    const [attendanceSettings, holidaysConfig, companyHolidays] = await Promise.all([
      tenantCompanyId
        ? (this.prisma as any).attendanceSetting.findFirst({
            where: { companyId: tenantCompanyId },
          })
        : Promise.resolve(null),
      this.prisma.systemConfig.findUnique({
        where: { key: holidayConfigKey },
      }),
      tenantCompanyId
        ? this.prisma.holiday.findMany({
            where: {
              companyId: tenantCompanyId,
              date: {
                gte: start,
                lte: end,
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const sysHolidays = holidaysConfig
      ? holidaysConfig.value.split(',').map((s: string) => s.trim())
      : [];
    const dbHolidays = companyHolidays.map((h: any) => h.date.toISOString().slice(0, 10));
    const configuredHolidays = Array.from(new Set([...sysHolidays, ...dbHolidays]));

    const days = calculateWorkingDaysInRange(
      startDate,
      endDate,
      attendanceSettings?.weekOffs,
      configuredHolidays,
    );

    try {
      return await this.leaveRepository.createRequest({
        employeeId: targetEmployeeId,
        type: dto.type,
        from: startDate,
        to: endDate,
        days,
        reason: dto.reason,
        status: LeaveRequestStatus.PENDING,
      });
    } catch (err: any) {
      if (err.code === 'P2002' || err.message?.includes('unique constraint') || err.message?.includes('already exists')) {
        throw new ConflictException('A leave request for this exact date range already exists.');
      }
      throw err;
    }
  }

  async getLeaves(
    user: any,
    scope: TenantScope,
    options: {
      page: number;
      limit: number;
      status?: string;
      employeeId?: string;
      search?: string;
    },
  ) {
    const tenantCompanyId = scope.isPlatformBypass ? null : scope.companyId;

    if (user.role === Role.Employee) {
      if (!user.employee?.id) {
        throw new BadRequestException('Employee record not linked to this user');
      }
      return this.leaveRepository.findManyRequests({
        tenantCompanyId,
        employeeId: user.employee.id,
        status: options.status,
        search: options.search,
        page: options.page,
        limit: options.limit,
      });
    }

    return this.leaveRepository.findManyRequests({
      tenantCompanyId,
      employeeId: options.employeeId,
      status: options.status,
      search: options.search,
      page: options.page,
      limit: options.limit,
    });
  }

  async updateLeaveStatus(
    id: string,
    status: 'Approved' | 'Rejected',
    approverUser: any,
    scope: TenantScope,
    note?: string,
  ) {
    const tenantCompanyId = scope.isPlatformBypass ? null : scope.companyId;
    const targetStatus = status.toUpperCase();

    return this.prisma.$transaction(async (tx) => {
      const req = await this.leaveRepository.findRequestByIdAndTenant(id, tenantCompanyId);
      if (!req) {
        throw new NotFoundException(`Leave request with ID "${id}" not found`);
      }

      // P2-1 Remediation: A user MUST NOT approve or reject their own leave request
      if (approverUser?.employee?.id && approverUser.employee.id === req.employeeId) {
        throw new ForbiddenException('You cannot approve or reject your own leave request.');
      }

      if (req.status !== 'PENDING') {
        throw new BadRequestException(`Leave request is already in ${req.status} status and cannot be modified.`);
      }

      if (targetStatus === 'APPROVED') {
        const quota = await tx.leaveQuota.findFirst({
          where: { employeeId: req.employeeId, leaveType: req.type },
        });

        if (quota) {
          const remainingDays = quota.totalDays - quota.usedDays;
          if (req.days > remainingDays) {
            throw new BadRequestException(
              `Insufficient leave balance. Requested ${req.days} days, but only ${remainingDays} days available.`,
            );
          }

          await tx.leaveQuota.update({
            where: { id: quota.id },
            data: { usedDays: { increment: req.days } },
          });
        }
      }

      return tx.leaveRequest.update({
        where: { id },
        data: { status: targetStatus as any },
        include: { employee: true },
      });
    });
  }

  async getQuotas(scope: TenantScope, employeeId: string) {
    return this.leaveRepository.getQuotas(employeeId);
  }

  // ── Leave Types ─────────────────────────────────────────────────────────
  async getLeaveTypes(scope: TenantScope) {
    const companyId = scope.companyId;
    let list = await this.leaveTypesRepository.findAll(companyId);
    if (list.length === 0) {
      // Seed default leave types for newly onboarded company with duplicate protection
      const defaultTypes = [
        { companyId, name: 'Casual Leave', days: 12, tone: 'emerald', accrualRate: 1.0, maxCap: 12, carryForward: false, encashable: false, paid: true, accrualFrequency: 'Monthly' },
        { companyId, name: 'Sick Leave', days: 10, tone: 'amber', accrualRate: 0.83, maxCap: 10, carryForward: true, encashable: false, paid: true, accrualFrequency: 'Monthly' },
        { companyId, name: 'Earned Leave', days: 15, tone: 'indigo', accrualRate: 1.25, maxCap: 15, carryForward: true, encashable: true, paid: true, accrualFrequency: 'Monthly' },
      ];
      for (const t of defaultTypes) {
        const existing = await this.leaveTypesRepository.findByName(t.name, companyId);
        if (!existing) {
          await this.leaveTypesRepository.create(t).catch(() => null);
        }
      }
      list = await this.leaveTypesRepository.findAll(companyId);
    }
    return list;
  }

  async createLeaveType(scope: TenantScope, user: any, dto: { name: string; days: number; tone?: string; accrualRate?: number; maxCap?: number; carryForward?: boolean; encashable?: boolean; paid?: boolean; accrualFrequency?: string }) {
    const companyId = scope.companyId;
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Leave policy name is required');
    }
    if (dto.days !== undefined && dto.days <= 0) {
      throw new BadRequestException('Leave policy entitlement days must be greater than zero');
    }
    if (dto.accrualRate !== undefined && dto.accrualRate < 0) {
      throw new BadRequestException('Accrual rate cannot be negative');
    }
    if (dto.maxCap !== undefined && dto.maxCap < 0) {
      throw new BadRequestException('Max cap threshold cannot be negative');
    }

    const existing = await this.leaveTypesRepository.findByName(dto.name.trim(), companyId);
    if (existing) {
      throw new ConflictException('A leave policy with this name already exists for your company.');
    }

    const created = await this.leaveTypesRepository.create({
      companyId,
      name: dto.name.trim(),
      days: dto.days,
      tone: dto.tone || 'indigo',
      accrualRate: dto.accrualRate ?? 1.0,
      maxCap: dto.maxCap ?? dto.days,
      carryForward: dto.carryForward ?? false,
      encashable: dto.encashable ?? false,
      paid: dto.paid ?? true,
      accrualFrequency: dto.accrualFrequency || 'Monthly',
    });

    // Immutable Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'System',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'HRAdmin',
          entityType: 'COMPANY_SETTINGS' as any,
          action: 'LEAVE_POLICY_CREATED',
          details: `[LEAVE_POLICY_CREATED] Created policy '${created.name}' (${created.days} days) for company ${companyId}`,
          companyId,
        },
      });
    } catch (auditErr) {
      // non-blocking
    }

    return created;
  }

  async updateLeaveType(id: string, scope: TenantScope, user: any, dto: any) {
    const companyId = scope.companyId;
    const existing = await this.leaveTypesRepository.findById(id, companyId);
    if (!existing) {
      throw new NotFoundException(`Leave policy record not found or access denied`);
    }

    if (dto.name && dto.name.trim() !== existing.name) {
      const duplicate = await this.leaveTypesRepository.findByName(dto.name.trim(), companyId);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('A leave policy with this name already exists for your company.');
      }
    }

    const updated = await this.leaveTypesRepository.update(id, companyId, {
      ...dto,
      name: dto.name ? dto.name.trim() : undefined,
    });

    // Immutable Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'System',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'HRAdmin',
          entityType: 'COMPANY_SETTINGS' as any,
          action: 'LEAVE_POLICY_UPDATED',
          details: `[LEAVE_POLICY_UPDATED] Updated leave policy '${existing.name}' (ID: ${id}) for company ${companyId}`,
          companyId,
        },
      });
    } catch (auditErr) {
      // non-blocking
    }

    return updated;
  }

  async deleteLeaveType(idOrName: string, scope: TenantScope, user: any) {
    const companyId = scope.companyId;
    let existing = await this.leaveTypesRepository.findById(idOrName, companyId);
    if (!existing) {
      existing = await this.leaveTypesRepository.findByName(idOrName, companyId);
    }
    if (!existing) {
      throw new NotFoundException(`Leave policy record not found or access denied`);
    }

    const deleted = await this.leaveTypesRepository.softDelete(existing.id, companyId, user?.id || 'system');

    // Immutable Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || user?.email || 'System',
          actorId: user?.id || 'system',
          actorRole: user?.role || 'HRAdmin',
          entityType: 'COMPANY_SETTINGS' as any,
          action: 'LEAVE_POLICY_DELETED',
          details: `[LEAVE_POLICY_DELETED] Soft-deleted leave policy '${existing.name}' (ID: ${existing.id}) for company ${companyId}`,
          companyId,
        },
      });
    } catch (auditErr) {
      // non-blocking
    }

    return { success: true, message: `Leave policy '${existing.name}' successfully deleted` };
  }

  // ── Calendar Events ─────────────────────────────────────────────────────
  async getEvents(scope: TenantScope) {
    const calendarEvents = await this.eventsRepository.findAll(scope);
    
    // Exclude CalendarEvent records whose type is holiday, Holiday, or HOLIDAY
    const filteredEvents = calendarEvents.filter(e => {
      const typeLower = (e.type || '').trim().toLowerCase();
      return typeLower !== 'holiday';
    });

    const companyId = scope.companyId;
    const holidays = await this.prisma.holiday.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { date: 'asc' },
    });

    const mappedHolidays = holidays.map(h => ({
      id: h.id,
      title: h.occasion,
      date: h.date instanceof Date ? h.date.toISOString().slice(0, 10) : String(h.date),
      type: 'holiday',
      companyId: h.companyId,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
    }));

    return [...filteredEvents, ...mappedHolidays];
  }

  async createEvent(dto: { title: string; date: string; type: string; companyId?: string }) {
    if (dto.type && ['holiday', 'Holiday', 'HOLIDAY'].includes(dto.type.trim())) {
      throw new BadRequestException('Official holidays must be managed through Settings → Holidays');
    }
    const event = await this.eventsRepository.create(dto);

    if (this.reminderService) {
      this.reminderService
        .sendEventImmediate(dto.companyId, event)
        .catch((err) => {
          this.logger.warn(`Failed to dispatch immediate event notification: ${err.message}`);
        });
    }

    return event;
  }

  async deleteEvent(id: string, scope: TenantScope) {
    const deleted = await this.eventsRepository.deleteOne(id, scope);
    if (!deleted) {
      throw new NotFoundException(`Calendar event not found or access denied`);
    }
    return { success: true };
  }
}
