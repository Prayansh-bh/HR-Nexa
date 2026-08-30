import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, PerformanceGoal } from '@prisma/client';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

@Injectable()
export class GoalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCompany(companyId: string, companyName: string) {
    const existing = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!existing) {
      await this.prisma.company.create({
        data: {
          id: companyId,
          name: companyName || `Company_${companyId.slice(0, 8)}`,
        },
      });
    }
  }

  async create(
    companyId: string,
    companyName: string,
    data: Omit<Prisma.PerformanceGoalUncheckedCreateInput, 'companyId'>,
  ): Promise<PerformanceGoal> {
    await this.ensureCompany(companyId, companyName);
    return this.prisma.performanceGoal.create({
      data: {
        ...data,
        companyId,
      },
    });
  }

  async findMany(
    companyId?: string | null,
    employeeId?: string,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<PerformanceGoal>> {
    const where: Prisma.PerformanceGoalWhereInput = {};
    if (companyId) where.companyId = companyId;
    if (employeeId) {
      where.employeeId = employeeId;
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
      this.prisma.performanceGoal.count({ where }),
      this.prisma.performanceGoal.findMany({
        where,
        skip,
        take,
        include: {
          employee: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return createPaginatedResponse(data, total, safePage, safeLimit);
  }

  async findById(
    id: string,
    companyId?: string | null,
  ): Promise<PerformanceGoal | null> {
    const where: Prisma.PerformanceGoalWhereInput = { id };
    if (companyId) where.companyId = companyId;
    return this.prisma.performanceGoal.findFirst({
      where,
    });
  }

  async update(
    id: string,
    data: Prisma.PerformanceGoalUncheckedUpdateInput,
  ): Promise<PerformanceGoal> {
    return this.prisma.performanceGoal.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<PerformanceGoal> {
    return this.prisma.performanceGoal.delete({
      where: { id },
    });
  }
}
