import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  Prisma,
  PerformanceReview,
  PerformanceCriterion,
  PerformanceCriterionScore,
} from '@prisma/client';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

@Injectable()
export class PerformanceReviewRepository {
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

  async ensureDefaultCriteria(
    companyId: string,
    companyName: string,
  ): Promise<PerformanceCriterion[]> {
    await this.ensureCompany(companyId, companyName);
    const existing = await this.prisma.performanceCriterion.findMany({
      where: { companyId },
    });
    if (existing.length > 0) {
      return existing;
    }

    const defaults = [
      {
        name: 'Attendance',
        weight: 1.0,
        description: 'Punctuality and reliability based on attendance records',
      },
      {
        name: 'Technical Skills',
        weight: 1.0,
        description: 'Role-specific domain expertise and application',
      },
      {
        name: 'Communication',
        weight: 1.0,
        description: 'Clarity, listening skills, and professional expression',
      },
      {
        name: 'Productivity',
        weight: 1.0,
        description: 'Output quantity and efficiency of task completion',
      },
      {
        name: 'Quality',
        weight: 1.0,
        description: 'Accuracy, neatness, and thoroughness of deliverables',
      },
      {
        name: 'Leadership',
        weight: 1.0,
        description:
          'Guiding others, taking ownership, and driving initiatives',
      },
      {
        name: 'Problem Solving',
        weight: 1.0,
        description:
          'Analytical thinking, troubleshooting, and root cause analysis',
      },
      {
        name: 'Team Collaboration',
        weight: 1.0,
        description:
          'Working effectively with teammates and cross-functional partners',
      },
      {
        name: 'Initiative',
        weight: 1.0,
        description:
          'Proactively seeking improvements and taking extra responsibility',
      },
      {
        name: 'Learning',
        weight: 1.0,
        description: 'Adaptability, self-development, and acquiring new skills',
      },
    ];

    const created: PerformanceCriterion[] = [];
    for (const item of defaults) {
      const c = await this.prisma.performanceCriterion.create({
        data: {
          companyId,
          name: item.name,
          weight: item.weight,
          description: item.description,
        },
      });
      created.push(c);
    }
    return created;
  }

  async findCriteria(companyId?: string | null): Promise<PerformanceCriterion[]> {
    const where: Prisma.PerformanceCriterionWhereInput = {};
    if (companyId) where.companyId = companyId;
    return this.prisma.performanceCriterion.findMany({
      where,
    });
  }

  async findCriterionById(id: string): Promise<PerformanceCriterion | null> {
    return this.prisma.performanceCriterion.findUnique({
      where: { id },
    });
  }

  async createReview(
    companyId: string,
    companyName: string,
    data: Omit<Prisma.PerformanceReviewUncheckedCreateInput, 'companyId'>,
  ): Promise<PerformanceReview> {
    await this.ensureCompany(companyId, companyName);
    return this.prisma.performanceReview.create({
      data: {
        ...data,
        companyId,
      },
    });
  }

  async findMany(
    companyId?: string | null,
    filters: {
      employeeId?: string;
      managerId?: string;
      reviewCycleId?: string;
      status?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<
    PaginatedResponse<
      PerformanceReview & { employee: any; reviewCycle: any; scores: any[] }
    >
  > {
    const where: Prisma.PerformanceReviewWhereInput = {};
    if (companyId) where.companyId = companyId;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.managerId) where.managerId = filters.managerId;
    if (filters.reviewCycleId) where.reviewCycleId = filters.reviewCycleId;
    if (filters.status) where.status = filters.status;

    const safePage =
      filters.page && Number(filters.page) > 0
        ? Math.floor(Number(filters.page))
        : 1;
    const safeLimit = Math.min(
      filters.limit && Number(filters.limit) > 0
        ? Math.floor(Number(filters.limit))
        : 50,
      100,
    );
    const skip = (safePage - 1) * safeLimit;
    const take = safeLimit;

    const [total, data] = await Promise.all([
      this.prisma.performanceReview.count({ where }),
      this.prisma.performanceReview.findMany({
        where,
        skip,
        take,
        include: {
          employee: {
            include: {
              department: true,
              designation: true,
            },
          },
          reviewCycle: true,
          scores: {
            include: {
              criterion: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return createPaginatedResponse(data, total, safePage, safeLimit);
  }

  async findById(
    id: string,
    companyId?: string | null,
  ): Promise<
    | (PerformanceReview & { employee: any; reviewCycle: any; scores: any[] })
    | null
  > {
    const where: Prisma.PerformanceReviewWhereInput = { id };
    if (companyId) {
      where.companyId = companyId;
    }
    return this.prisma.performanceReview.findFirst({
      where,
      include: {
        employee: {
          include: {
            department: true,
            designation: true,
          },
        },
        reviewCycle: true,
        scores: {
          include: {
            criterion: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    data: Prisma.PerformanceReviewUncheckedUpdateInput,
  ): Promise<PerformanceReview> {
    return this.prisma.performanceReview.update({
      where: { id },
      data,
    });
  }

  async saveCriterionScore(
    reviewId: string,
    criterionId: string,
    data: {
      selfScore?: number;
      managerScore?: number;
      hrScore?: number;
      remarks?: string;
    },
  ): Promise<PerformanceCriterionScore> {
    const existing = await this.prisma.performanceCriterionScore.findFirst({
      where: { reviewId, criterionId },
    });

    if (existing) {
      return this.prisma.performanceCriterionScore.update({
        where: { id: existing.id },
        data: {
          selfScore:
            data.selfScore !== undefined ? data.selfScore : existing.selfScore,
          managerScore:
            data.managerScore !== undefined
              ? data.managerScore
              : existing.managerScore,
          hrScore: data.hrScore !== undefined ? data.hrScore : existing.hrScore,
          remarks: data.remarks !== undefined ? data.remarks : existing.remarks,
        },
      });
    } else {
      return this.prisma.performanceCriterionScore.create({
        data: {
          reviewId,
          criterionId,
          selfScore: data.selfScore || 0,
          managerScore: data.managerScore || 0,
          hrScore: data.hrScore || 0,
          remarks: data.remarks || '',
        },
      });
    }
  }

  async delete(id: string): Promise<PerformanceReview> {
    return this.prisma.performanceReview.delete({
      where: { id },
    });
  }
}
