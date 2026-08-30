import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LeaveRequest, LeaveQuota, Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

export interface LeaveQueryOptions {
  tenantCompanyId?: string | null;
  employeeId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class LeaveRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async findQuota(
    employeeId: string,
    leaveType: string,
  ): Promise<LeaveQuota | null> {
    const companyId = this.tenantContextService.getCompanyId();
    const isPlatform = this.tenantContextService.isPlatform();

    return this.prisma.leaveQuota.findFirst({
      where: {
        employeeId,
        leaveType,
        ...(isPlatform ? {} : { employee: { companyId } }),
      },
    });
  }

  async createQuota(data: {
    employeeId: string;
    leaveType: string;
    totalDays: number;
    usedDays: number;
  }): Promise<LeaveQuota> {
    const companyId = this.tenantContextService.getCompanyId();
    const isPlatform = this.tenantContextService.isPlatform();

    if (!isPlatform) {
      const emp = await this.prisma.employee.findFirst({
        where: { id: data.employeeId, companyId, deletedAt: null },
      });
      if (!emp) {
        throw new ForbiddenException('Access denied to employee');
      }
    }

    return this.prisma.leaveQuota.create({ data });
  }

  async updateQuota(id: string, usedDays: number): Promise<LeaveQuota> {
    const companyId = this.tenantContextService.getCompanyId();
    const isPlatform = this.tenantContextService.isPlatform();

    if (!isPlatform) {
      const quota = await this.prisma.leaveQuota.findFirst({
        where: { id, employee: { companyId } },
      });
      if (!quota) {
        throw new ForbiddenException('Leave quota not found or access denied');
      }
    }

    return this.prisma.leaveQuota.update({
      where: { id },
      data: { usedDays },
    });
  }

  async getQuotas(employeeId: string): Promise<LeaveQuota[]> {
    const companyId = this.tenantContextService.getCompanyId();
    const isPlatform = this.tenantContextService.isPlatform();

    return this.prisma.leaveQuota.findMany({
      where: {
        employeeId,
        ...(isPlatform ? {} : { employee: { companyId } }),
      },
    });
  }

  async createRequest(
    data: Prisma.LeaveRequestUncheckedCreateInput,
  ): Promise<LeaveRequest & { employee: any }> {
    const companyId = this.tenantContextService.getCompanyId();
    const isPlatform = this.tenantContextService.isPlatform();

    if (!isPlatform && data.employeeId) {
      const emp = await this.prisma.employee.findFirst({
        where: { id: data.employeeId, companyId, deletedAt: null },
      });
      if (!emp) {
        throw new ForbiddenException('Target employee context mismatch');
      }
    }

    return this.prisma.leaveRequest.create({
      data: {
        ...data,
        companyId: isPlatform ? (data.companyId || null) : companyId,
      },
      include: { employee: true },
    });
  }

  async findRequestById(id: string): Promise<LeaveRequest | null> {
    return this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
  }

  async findRequestByIdAndTenant(
    id: string,
    tenantCompanyId?: string | null,
  ): Promise<(LeaveRequest & { employee: any }) | null> {
    const req = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!req) return null;

    if (tenantCompanyId) {
      const reqTenant = req.companyId || req.employee?.subscriptionId || req.employee?.companyId;
      if (reqTenant && reqTenant !== tenantCompanyId) {
        return null; // Uniform 404 Not Found
      }
    }

    return req as any;
  }

  async findManyRequests(
    optionsOrTenant?: LeaveQueryOptions | string | null,
    employeeId?: string,
    status?: string,
    cursorId?: string,
    take: number = 20,
  ): Promise<PaginatedResponse<LeaveRequest & { employee: any }> | (LeaveRequest & { employee: any })[]> {
    let tenantCompanyId: string | null = null;
    let empId = employeeId;
    let st = status;
    let search: string | undefined = undefined;
    let page: number | undefined = undefined;
    let limit: number | undefined = undefined;
    let isStructuredQuery = false;

    if (typeof optionsOrTenant === 'object' && optionsOrTenant !== null) {
      isStructuredQuery = true;
      tenantCompanyId = optionsOrTenant.tenantCompanyId ?? null;
      empId = optionsOrTenant.employeeId;
      st = optionsOrTenant.status;
      search = optionsOrTenant.search;
      page = optionsOrTenant.page;
      limit = optionsOrTenant.limit;
    } else {
      tenantCompanyId = optionsOrTenant ?? null;
    }

    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.min(Math.max(1, limit || 50), 100);

    const where: Prisma.LeaveRequestWhereInput = {};
    if (empId) where.employeeId = empId;
    if (st && st !== 'All') {
      where.status = st.toUpperCase() as any;
    }

    const tenantId =
      tenantCompanyId !== undefined
        ? tenantCompanyId
        : !this.tenantContextService.isPlatform()
          ? this.tenantContextService.getCompanyId()
          : null;

    const employeeFilter: any = {};
    if (tenantId) {
      employeeFilter.companyId = tenantId;
    } else {
      employeeFilter.company = {
        isDemo: false,
      };
    }

    if (search && search.trim()) {
      employeeFilter.name = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    where.employee = employeeFilter;

    if (isStructuredQuery) {
      const [total, data] = await Promise.all([
        this.prisma.leaveRequest.count({ where }),
        this.prisma.leaveRequest.findMany({
          where,
          skip: (safePage - 1) * safeLimit,
          take: safeLimit,
          include: { employee: true },
          orderBy: { from: 'desc' },
        }),
      ]);
      return createPaginatedResponse(data, total, safePage, safeLimit) as any;
    }

    return this.prisma.leaveRequest.findMany({
      where,
      take,
      ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
      include: { employee: true },
      orderBy: { from: 'desc' },
    }) as any;
  }

  async updateRequestStatus(
    id: string,
    status: string,
  ): Promise<LeaveRequest & { employee: any }> {
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: status.toUpperCase() as any },
      include: { employee: true },
    }) as any;
  }

  async findEmployee(id: string, tenantCompanyId?: string | null) {
    const tenantId =
      tenantCompanyId !== undefined
        ? tenantCompanyId
        : !this.tenantContextService.isPlatform()
          ? this.tenantContextService.getCompanyId()
          : null;

    const where: Prisma.EmployeeWhereInput = { id, deletedAt: null };
    if (tenantId) {
      where.OR = [{ companyId: tenantId }, { subscriptionId: tenantId }];
    }

    return this.prisma.employee.findFirst({ where });
  }
}
