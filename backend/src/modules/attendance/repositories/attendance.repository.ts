import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Attendance, Prisma } from '@prisma/client';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

export interface AttendanceQueryOptions {
  companyId?: string | null;
  employeeId?: string | { in: string[] };
  date?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmployeeAndDate(
    employeeId: string,
    date: string,
  ): Promise<Attendance | null> {
    return this.prisma.extended.attendance.findFirst({
      where: {
        employeeId,
        date,
      },
    });
  }

  async findById(id: string): Promise<Attendance | null> {
    return this.prisma.extended.attendance.findFirst({ where: { id } });
  }

  async findByIdAndTenant(
    id: string,
    tenantCompanyId?: string | null,
  ): Promise<(Attendance & { employee: any }) | null> {
    const where: any = { id };
    if (tenantCompanyId) {
      where.employee = {
        OR: [
          { companyId: tenantCompanyId },
          { subscriptionId: tenantCompanyId },
        ],
      };
    }

    const record = await this.prisma.extended.attendance.findFirst({
      where,
      include: { employee: true },
    });

    return record as any;
  }

  async findMany(
    optionsOrCompany?: AttendanceQueryOptions | string | null,
    employeeId?: string | { in: string[] },
    date?: string,
    status?: string,
  ): Promise<PaginatedResponse<Attendance & { employee: any }> | (Attendance & { employee: any })[]> {
    let companyId: string | null = null;
    let empId = employeeId;
    let dt = date;
    let st = status;
    let search: string | undefined = undefined;
    let page: number | undefined = undefined;
    let limit: number | undefined = undefined;
    let isStructuredQuery = false;

    if (typeof optionsOrCompany === 'object' && optionsOrCompany !== null) {
      isStructuredQuery = true;
      companyId = optionsOrCompany.companyId ?? null;
      empId = optionsOrCompany.employeeId;
      dt = optionsOrCompany.date;
      st = optionsOrCompany.status;
      search = optionsOrCompany.search;
      page = optionsOrCompany.page;
      limit = optionsOrCompany.limit;
    } else {
      companyId = optionsOrCompany ?? null;
    }

    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.min(Math.max(1, limit || 50), 100);

    const where: Prisma.AttendanceWhereInput = {};
    if (empId) where.employeeId = empId;
    if (dt) where.date = dt;
    if (st && st !== 'All') where.status = st;

    const employeeFilter: any = {};
    if (companyId) {
      employeeFilter.OR = [
        { companyId },
        { subscriptionId: companyId },
      ];
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

    const employeeProjection = {
      select: {
        id: true,
        name: true,
        email: true,
        companyId: true,
        subscriptionId: true,
        avatar: true,
        departmentId: true,
        designationId: true,
      },
    };

    if (isStructuredQuery) {
      const [total, data] = await Promise.all([
        this.prisma.extended.attendance.count({ where }),
        this.prisma.extended.attendance.findMany({
          where,
          skip: (safePage - 1) * safeLimit,
          take: safeLimit,
          include: { employee: employeeProjection },
          orderBy: { date: 'desc' },
        }),
      ]);
      return createPaginatedResponse(data, total, safePage, safeLimit) as any;
    }

    return this.prisma.extended.attendance.findMany({
      where,
      include: { employee: employeeProjection },
      orderBy: { date: 'desc' },
    });
  }

  async create(
    data: Prisma.AttendanceUncheckedCreateInput,
  ): Promise<Attendance> {
    return this.prisma.extended.attendance.create({ data });
  }

  async update(
    id: string,
    data: Prisma.AttendanceUncheckedUpdateInput,
  ): Promise<Attendance> {
    await this.prisma.extended.attendance.updateMany({
      where: { id },
      data,
    });
    const updated = await this.findById(id);
    if (!updated) {
      throw new NotFoundException(`Attendance record with ID ${id} not found`);
    }
    return updated;
  }
}
