import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Department, Designation } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

@Injectable()
export class DepartmentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async findAllDepartments(options?: { page?: number; limit?: number }): Promise<PaginatedResponse<Department> | Department[]> {
    const where: any = {};
    if (!this.tenantContextService.isPlatform()) {
      where.subscriptionId = this.tenantContextService.getSubscriptionId();
    } else {
      where.OR = [
        { company: { isDemo: false } },
        { subscription: { companyRelation: { isDemo: false } } },
      ];
    }

    if (options?.page || options?.limit) {
      const page = options.page && options.page > 0 ? options.page : 1;
      const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50;
      const [total, data] = await Promise.all([
        this.prisma.department.count({ where }),
        this.prisma.department.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: 'asc' },
        }),
      ]);
      return createPaginatedResponse(data, total, page, limit);
    }

    return this.prisma.department.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findDepartmentByName(
    name: string,
    explicitSubscriptionId?: string,
  ): Promise<Department | null> {
    const subscriptionId =
      explicitSubscriptionId ||
      (!this.tenantContextService.isPlatform()
        ? this.tenantContextService.getSubscriptionId()
        : undefined);

    if (subscriptionId) {
      return this.prisma.department.findFirst({
        where: {
          name,
          subscriptionId,
        },
      });
    }

    return this.prisma.department.findFirst({
      where: {
        name,
        OR: [
          { company: { isDemo: false } },
          { subscription: { companyRelation: { isDemo: false } } },
        ],
      },
    });
  }

  async findDepartmentById(id: string): Promise<Department | null> {
    return this.prisma.department.findUnique({ where: { id } });
  }

  async createDepartment(data: {
    name: string;
    head?: string;
    subscriptionId?: string;
    companyId?: string;
  }): Promise<Department> {
    const isPlatform = this.tenantContextService.isPlatform();
    const subscriptionId =
      data.subscriptionId ||
      (!isPlatform
        ? this.tenantContextService.getSubscriptionId()
        : null);
    const companyId =
      data.companyId ||
      (!isPlatform
        ? this.tenantContextService.getCompanyId()
        : null);

    return this.prisma.department.create({
      data: {
        ...data,
        subscriptionId,
        companyId,
      },
    });
  }

  async deleteDepartment(id: string): Promise<Department> {
    return this.prisma.department.delete({ where: { id } });
  }

  async findAllDesignations(options?: { page?: number; limit?: number }): Promise<PaginatedResponse<Designation> | Designation[]> {
    const where: any = {};
    if (!this.tenantContextService.isPlatform()) {
      where.subscriptionId = this.tenantContextService.getSubscriptionId();
    } else {
      where.OR = [
        { company: { isDemo: false } },
        { subscription: { companyRelation: { isDemo: false } } },
      ];
    }

    if (options?.page || options?.limit) {
      const page = options.page && options.page > 0 ? options.page : 1;
      const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50;
      const [total, data] = await Promise.all([
        this.prisma.designation.count({ where }),
        this.prisma.designation.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: 'asc' },
        }),
      ]);
      return createPaginatedResponse(data, total, page, limit);
    }

    return this.prisma.designation.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findDesignationsByDepartment(
    departmentId: string,
  ): Promise<Designation[]> {
    const where: any = { departmentId };
    if (!this.tenantContextService.isPlatform()) {
      where.subscriptionId = this.tenantContextService.getSubscriptionId();
    } else {
      where.OR = [
        { company: { isDemo: false } },
        { subscription: { companyRelation: { isDemo: false } } },
      ];
    }

    return this.prisma.designation.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findDesignationByName(
    name: string,
    explicitSubscriptionId?: string,
  ): Promise<Designation | null> {
    const subscriptionId =
      explicitSubscriptionId ||
      (!this.tenantContextService.isPlatform()
        ? this.tenantContextService.getSubscriptionId()
        : undefined);

    if (subscriptionId) {
      return this.prisma.designation.findFirst({
        where: {
          name,
          subscriptionId,
        },
      });
    }

    return this.prisma.designation.findFirst({
      where: { name, subscriptionId: null },
    });
  }

  async findDesignationById(id: string): Promise<Designation | null> {
    return this.prisma.designation.findUnique({ where: { id } });
  }

  async createDesignation(data: {
    name: string;
    band: string;
    subscriptionId?: string;
    companyId?: string;
  }): Promise<Designation> {
    const isPlatform = this.tenantContextService.isPlatform();
    const subscriptionId =
      data.subscriptionId ||
      (!isPlatform
        ? this.tenantContextService.getSubscriptionId()
        : null);
    const companyId =
      data.companyId ||
      (!isPlatform
        ? this.tenantContextService.getCompanyId()
        : null);

    return this.prisma.designation.create({
      data: {
        ...data,
        subscriptionId,
        companyId,
      },
    });
  }

  async deleteDesignation(id: string): Promise<Designation> {
    return this.prisma.designation.delete({ where: { id } });
  }
}
