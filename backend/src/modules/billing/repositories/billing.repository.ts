import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId?: string | null,
    options?: { page?: number; limit?: number; isDemo?: boolean },
  ): Promise<PaginatedResponse<any>> {
    const where: any = {};
    if (companyId) {
      where.OR = [{ company: companyId }, { subscriptionId: companyId }];
    } else if (options?.isDemo !== undefined) {
      where.subscription = { companyRelation: { isDemo: options.isDemo } };
    } else {
      where.subscription = { companyRelation: { isDemo: false } };
    }

    const safePage =
      options?.page && Number(options.page) > 0
        ? Math.floor(Number(options.page))
        : 1;
    const safeLimit = Math.min(
      options?.limit && Number(options.limit) > 0
        ? Math.floor(Number(options.limit))
        : 50,
      100,
    );
    const skip = (safePage - 1) * safeLimit;
    const take = safeLimit;

    const [total, data] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
      }),
    ]);

    return createPaginatedResponse(data, total, safePage, safeLimit);
  }

  async create(data: any) {
    return this.prisma.invoice.create({ data });
  }
}
