import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Payroll, Prisma } from '@prisma/client';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

export interface PayrollQueryOptions {
  companyId?: string | null;
  month?: string;
  employeeId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class PayrollRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    optionsOrCompany?: PayrollQueryOptions | string | null,
    month?: string,
    employeeId?: string,
  ): Promise<PaginatedResponse<Payroll & { employee: any }>> {
    let companyId: string | null = null;
    let m = month;
    let empId = employeeId;
    let page = 1;
    let limit = 50;

    if (typeof optionsOrCompany === 'object' && optionsOrCompany !== null) {
      companyId = optionsOrCompany.companyId ?? null;
      m = optionsOrCompany.month;
      empId = optionsOrCompany.employeeId;
      const rawPage = Number(optionsOrCompany.page);
      page = !isNaN(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
      const rawLimit = Number(optionsOrCompany.limit);
      limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 50;
    } else {
      companyId = optionsOrCompany ?? null;
    }

    const where: Prisma.PayrollWhereInput = {};
    if (companyId) {
      where.employee = { companyId };
    } else {
      where.employee = {
        company: {
          isDemo: false,
        },
      };
    }
    if (m) where.month = m;
    if (empId) where.employeeId = empId;

    const [total, data] = await Promise.all([
      this.prisma.payroll.count({ where }),
      this.prisma.payroll.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { employee: true },
        orderBy: { payDate: 'desc' },
      }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }

  async findByEmployeeAndMonth(
    employeeId: string,
    month: string,
  ): Promise<Payroll | null> {
    return this.prisma.payroll.findUnique({
      where: {
        employeeId_month: {
          employeeId,
          month,
        },
      },
    });
  }

  async findById(id: string): Promise<Payroll | null> {
    return this.prisma.payroll.findUnique({ where: { id } });
  }

  async findByIdAndTenant(
    id: string,
    tenantCompanyId?: string | null,
  ): Promise<(Payroll & { employee: any }) | null> {
    const where: any = { id };
    if (tenantCompanyId) {
      where.employee = {
        OR: [
          { companyId: tenantCompanyId },
          { subscriptionId: tenantCompanyId },
        ],
      };
    }

    const record = await this.prisma.payroll.findFirst({
      where,
      include: { employee: true },
    });

    return record as any;
  }

  async create(
    data: Prisma.PayrollUncheckedCreateInput,
  ): Promise<Payroll & { employee: any }> {
    return this.prisma.payroll.create({
      data,
      include: { employee: true },
    });
  }

  async update(
    id: string,
    data: Prisma.PayrollUncheckedUpdateInput,
  ): Promise<Payroll & { employee: any }> {
    return this.prisma.payroll.update({
      where: { id },
      data,
      include: { employee: true },
    });
  }

  async findByMonth(companyId?: string | null, month?: string): Promise<Payroll[]> {
    const where: Prisma.PayrollWhereInput = {};
    if (companyId) {
      where.employee = { companyId };
    }
    if (month) where.month = month;
    return this.prisma.payroll.findMany({ where });
  }
}
