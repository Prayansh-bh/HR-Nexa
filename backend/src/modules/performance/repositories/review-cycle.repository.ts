import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, ReviewCycle } from '@prisma/client';

import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

@Injectable()
export class ReviewCycleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCompany(
    companyId: string,
    companyName: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    const existing = await client.company.findUnique({
      where: { id: companyId },
    });
    if (existing) return existing;

    const fallbackByName = companyName
      ? await client.company.findFirst({ where: { name: companyName } })
      : null;
    if (fallbackByName) return fallbackByName;

    throw new NotFoundException(
      `Company tenant record with ID "${companyId}" does not exist.`,
    );
  }

  async create(
    companyId: string,
    companyName: string,
    data: Omit<Prisma.ReviewCycleUncheckedCreateInput, 'companyId'>,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewCycle> {
    await this.ensureCompany(companyId, companyName, tx);
    const client = tx || this.prisma;
    return client.reviewCycle.create({
      data: {
        ...data,
        companyId,
      },
    });
  }

  async findMany(
    companyId?: string | null,
    status?: string,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<ReviewCycle>> {
    const where: Prisma.ReviewCycleWhereInput = {};
    if (companyId) where.companyId = companyId;
    if (status) {
      where.status = status;
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
      this.prisma.reviewCycle.count({ where }),
      this.prisma.reviewCycle.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return createPaginatedResponse(data, total, safePage, safeLimit);
  }

  async findById(id: string, companyId?: string | null): Promise<ReviewCycle | null> {
    const where: Prisma.ReviewCycleWhereInput = { id };
    if (companyId) where.companyId = companyId;
    return this.prisma.reviewCycle.findFirst({
      where,
    });
  }

  async update(
    id: string,
    companyId: string | null,
    data: Prisma.ReviewCycleUncheckedUpdateInput,
  ): Promise<ReviewCycle> {
    return this.prisma.reviewCycle.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, companyId?: string | null): Promise<ReviewCycle> {
    return this.prisma.reviewCycle.delete({
      where: { id },
    });
  }
}
