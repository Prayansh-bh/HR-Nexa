import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLog, Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

export type PaginatedAuditLogsResult = PaginatedResponse<AuditLog>;

@Injectable()
export class AuditLogsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: Prisma.AuditLogCreateInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data,
    });
  }

  async findMany(options?: { page?: number; limit?: number }): Promise<PaginatedResponse<AuditLog>> {
    const where: Prisma.AuditLogWhereInput = {};

    // Filter audit logs by tenant companyId unless SuperAdmin / Platform view
    if (!this.tenantContextService.isPlatform()) {
      where.companyId = this.tenantContextService.getCompanyId();
    }

    // Enforce mandatory server-side bounds
    const rawPage = Number(options?.page);
    const page = !isNaN(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

    const rawLimit = Number(options?.limit);
    const defaultLimit = 50;
    const maxLimit = 100;
    const limit =
      !isNaN(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), maxLimit)
        : defaultLimit;

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }
}
