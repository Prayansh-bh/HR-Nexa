import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { createPaginatedResponse } from '../../../common/dto/paginated-response.dto';

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(options?: { page?: number; limit?: number; isDemo?: boolean }) {
    const where: any = {};
    if (options?.isDemo !== undefined) {
      where.companyRelation = { isDemo: options.isDemo };
    }

    if (options?.page || options?.limit) {
      const page = options.page && options.page > 0 ? options.page : 1;
      const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50;
      const [total, data] = await Promise.all([
        this.prisma.subscription.count({ where }),
        this.prisma.subscription.findMany({
          where,
          include: { companyRelation: true },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'asc' },
        }),
      ]);
      return createPaginatedResponse(data, total, page, limit);
    }

    return this.prisma.subscription.findMany({
      where,
      include: { companyRelation: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.subscription.findUnique({
      where: { id },
      include: { companyRelation: true },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.subscription.update({
      where: { id },
      data,
    });
  }

  async create(data: any) {
    return this.prisma.subscription.create({ data });
  }

  async delete(id: string) {
    return this.prisma.subscription.delete({ where: { id } });
  }
}
