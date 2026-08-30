import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Employee, Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

// The Employee with expanded relations
export type EmployeeWithRelations = Employee & {
  department: { id: string; name: string } | null;
  designation: { id: string; name: string; band: string } | null;
  user: {
    id: string;
    email: string;
    role: string;
    roleId?: string | null;
  } | null;
};

export interface EmployeeQueryOptions {
  tenantCompanyId?: string | null;
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  status?: string;
}

@Injectable()
export class EmployeesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async findMany(
    optionsOrTenant?: EmployeeQueryOptions | string | null,
    search?: string,
    department?: string,
    status?: string,
  ): Promise<PaginatedResponse<EmployeeWithRelations> | EmployeeWithRelations[]> {
    let tenantCompanyId: string | null = null;
    let page: number | undefined = undefined;
    let limit: number | undefined = undefined;
    let s = search;
    let d = department;
    let st = status;
    let isStructuredQuery = false;

    if (typeof optionsOrTenant === 'object' && optionsOrTenant !== null) {
      isStructuredQuery = true;
      tenantCompanyId = optionsOrTenant.tenantCompanyId ?? null;
      page = optionsOrTenant.page && optionsOrTenant.page > 0 ? optionsOrTenant.page : 1;
      limit = optionsOrTenant.limit && optionsOrTenant.limit > 0 ? optionsOrTenant.limit : 50;
      s = optionsOrTenant.search;
      d = optionsOrTenant.department;
      st = optionsOrTenant.status;
    } else {
      tenantCompanyId = optionsOrTenant ?? null;
    }

    const where: Prisma.EmployeeWhereInput = {};

    const tenantId =
      tenantCompanyId !== undefined
        ? tenantCompanyId
        : !this.tenantContextService.isPlatform()
          ? this.tenantContextService.getCompanyId()
          : null;

    if (tenantId) {
      where.companyId = tenantId;
    } else {
      where.company = { isDemo: false };
    }

    if (d && d !== 'All') {
      where.department = { name: d };
    }

    if (st && st !== 'All') {
      where.status = st;
    }

    if (s && s.trim()) {
      const q = s.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { id: { contains: q, mode: 'insensitive' } },
      ];
    }

    const relationProjections = {
      department: { select: { id: true, name: true } },
      designation: { select: { id: true, name: true, band: true } },
      user: { select: { id: true, email: true, role: true, roleId: true } },
    };

    if (isStructuredQuery && page && limit) {
      const [total, data] = await Promise.all([
        this.prisma.employee.count({ where }),
        this.prisma.employee.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: relationProjections,
        }),
      ]);
      return createPaginatedResponse(data, total, page, limit) as any;
    }

    return this.prisma.employee.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: relationProjections,
    });
  }

  async findById(id: string): Promise<EmployeeWithRelations | null> {
    return this.prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        designation: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            roleId: true,
          },
        },
      },
    });
  }

  async findByIdAndTenant(
    id: string,
    tenantId?: string | null,
  ): Promise<EmployeeWithRelations | null> {
    const employee = await this.findById(id);
    if (!employee) return null;

    if (tenantId) {
      if (employee.companyId !== tenantId) {
        return null; // Uniform 404 Not Found for cross-tenant attempts
      }
    }

    return employee;
  }

  async findByEmail(email: string): Promise<Employee | null> {
    return this.prisma.employee.findUnique({
      where: { email },
    });
  }

  async create(data: Prisma.EmployeeUncheckedCreateInput): Promise<Employee> {
    const resolvedSubscriptionId = data.subscriptionId || (
      !this.tenantContextService.isPlatform()
        ? this.tenantContextService.getSubscriptionId()
        : null
    );

    return this.prisma.employee.create({
      data: {
        ...data,
        subscriptionId: resolvedSubscriptionId || null,
      },
      include: {
        department: true,
        designation: true,
      },
    });
  }

  async update(
    id: string,
    data: Prisma.EmployeeUncheckedUpdateInput,
  ): Promise<Employee> {
    return this.prisma.employee.update({
      where: { id },
      data,
      include: {
        department: true,
        designation: true,
      },
    });
  }

  async delete(id: string): Promise<Employee> {
    return this.prisma.employee.delete({
      where: { id },
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.prisma.user
      .delete({
        where: { id: userId },
      })
      .catch(() => {});
  }
}
