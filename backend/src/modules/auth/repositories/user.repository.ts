/**
 * UserRepository
 *
 * Single Responsibility: Raw database access for User entities.
 * All user queries respect tenant boundaries via subscriptionId.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

export type UserWithSubscription = User & {
  employee?: any;
  subscription?: any;
  roleRelation?: any;
};

export interface UserQueryOptions {
  tenantCompanyId?: string | null;
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserWithSubscription | null> {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: {
        employee: true,
        company: { select: { name: true } },
        subscription: { select: { company: true } },
        roleRelation: true,
      },
    });
  }

  async findById(id: string): Promise<UserWithSubscription | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        company: { select: { name: true } },
        roleRelation: true,
        subscription: true,
      },
    });
  }

  async findByIdAndTenant(
    id: string,
    tenantId?: string | null,
  ): Promise<UserWithSubscription | null> {
    const user = await this.findById(id);
    if (!user) return null;

    if (tenantId) {
      const userTenant = user.companyId || user.subscriptionId;
      if (userTenant !== tenantId) {
        return null; // Uniform 404 Not Found for cross-tenant attempts
      }
    }

    return user;
  }

  async createUser(data: {
    email: string;
    password: string;
    name: string;
    role: string;
    roleId?: string | null;
    initials: string;
    subscriptionId?: string | null;
    companyId?: string | null;
  }): Promise<User> {
    let resolvedRoleId = data.roleId;
    if (!resolvedRoleId) {
      const roleRecord = await this.prisma.role.findFirst({
        where: data.companyId
          ? { companyId: data.companyId, name: data.role }
          : { name: data.role },
      });
      if (roleRecord) {
        resolvedRoleId = roleRecord.id;
      }
    }

    return this.prisma.user.create({
      data: {
        email: data.email.trim().toLowerCase(),
        password: data.password,
        name: data.name,
        role: data.role,
        roleId: resolvedRoleId ?? null,
        initials: data.initials,
        subscriptionId: data.subscriptionId ?? null,
        companyId: data.companyId ?? null,
      },
    });
  }

  async updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async findMany(
    options?: UserQueryOptions | string | null,
  ): Promise<PaginatedResponse<UserWithSubscription>> {
    let tenantCompanyId: string | null = null;
    let page = 1;
    let limit = 50;
    let search: string | undefined = undefined;
    let role: string | undefined = undefined;
    let status: string | undefined = undefined;

    if (typeof options === 'string' || options === null) {
      tenantCompanyId = options;
      limit = 1000;
    } else if (options) {
      tenantCompanyId = options.tenantCompanyId ?? null;
      page = options.page && options.page > 0 ? options.page : 1;
      limit = options.limit && options.limit > 0 ? options.limit : 50;
      search = options.search;
      role = options.role;
      status = options.status;
    }

    const whereConditions: Prisma.UserWhereInput[] = [];

    if (tenantCompanyId) {
      whereConditions.push({
        OR: [
          { companyId: tenantCompanyId },
          { subscriptionId: tenantCompanyId },
        ],
      });
    } else {
      // SuperAdmin / Platform query:
      // Include users belonging to real tenants (company.isDemo === false)
      // AND include the platform SuperAdmin account (companyId === null or role === 'SuperAdmin')
      whereConditions.push({
        OR: [
          { company: { isDemo: false } },
          { subscription: { companyRelation: { isDemo: false } } },
          { role: 'SuperAdmin' },
          { companyId: null, subscriptionId: null },
        ],
      });
    }

    if (search && search.trim()) {
      const q = search.trim();
      whereConditions.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (role) {
      whereConditions.push({ role });
    }

    if (status) {
      whereConditions.push({ status });
    }

    const where: Prisma.UserWhereInput =
      whereConditions.length > 0 ? { AND: whereConditions } : {};

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: { select: { company: true } },
        },
      }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }

  async findBySubscriptionId(subscriptionId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async countByRole(role: string): Promise<number> {
    return this.prisma.user.count({ where: { role } });
  }

  async deleteUser(id: string): Promise<User> {
    // Attempt to remove the linked employee record first (optional, may not exist)
    await this.prisma.employee
      .delete({
        where: { userId: id },
      })
      .catch(() => {});

    return this.prisma.user.delete({
      where: { id },
    });
  }
}
