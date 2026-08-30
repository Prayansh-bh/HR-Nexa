import { Injectable, ConflictException } from '@nestjs/common';
import {
  PrismaClient,
  Exit,
  ExitStage,
  ExitStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

@Injectable()
export class ExitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.ExitUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Exit> {
    const client = tx || this.prisma;
    return client.exit.create({ data });
  }

  async findById(
    id: string,
    companyId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Exit | null> {
    const client = tx || this.prisma;
    const where: Prisma.ExitWhereInput = { id };
    if (companyId) where.companyId = companyId;

    return client.exit.findFirst({
      where,
      include: {
        employee: {
          include: { department: true, designation: true },
        },
        approvals: true,
        checklists: true,
        interview: true,
        timeline: true,
        documents: true,
        settlement: true,
      },
    });
  }

  async findAll(
    companyId: string,
    filters?: { stage?: ExitStage; status?: ExitStatus; employeeId?: string; page?: number; limit?: number },
    tx?: Prisma.TransactionClient,
  ): Promise<PaginatedResponse<Exit>> {
    const client = tx || this.prisma;
    const where: Prisma.ExitWhereInput = {};
    if (companyId) where.companyId = companyId;
    if (filters?.stage) where.stage = filters.stage;
    if (filters?.status) where.status = filters.status;
    if (filters?.employeeId) where.employeeId = filters.employeeId;

    const safePage =
      filters?.page && Number(filters.page) > 0
        ? Math.floor(Number(filters.page))
        : 1;
    const safeLimit = Math.min(
      filters?.limit && Number(filters.limit) > 0
        ? Math.floor(Number(filters.limit))
        : 50,
      100,
    );
    const skip = (safePage - 1) * safeLimit;
    const take = safeLimit;

    const [total, data] = await Promise.all([
      client.exit.count({ where }),
      client.exit.findMany({
        where,
        skip,
        take,
        include: {
          employee: {
            select: { id: true, name: true, avatar: true, department: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return createPaginatedResponse(data, total, safePage, safeLimit);
  }

  async update(
    id: string,
    data: Prisma.ExitUpdateInput,
    currentVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Exit> {
    const client = tx || this.prisma;
    const updateData = { ...data, version: currentVersion + 1 };

    try {
      return await client.exit.update({
        where: { id, version: currentVersion },
        data: updateData,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new ConflictException(
          'Exit record was modified by another user. Please refresh and try again.',
        );
      }
      throw error;
    }
  }

  async checkActiveExit(
    employeeId: string,
    companyId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Exit | null> {
    const client = tx || this.prisma;
    const where: Prisma.ExitWhereInput = {
      employeeId,
      status: {
        notIn: [
          ExitStatus.COMPLETED,
          ExitStatus.CANCELLED,
          ExitStatus.REJECTED,
        ],
      },
    };
    if (companyId) where.companyId = companyId;

    return client.exit.findFirst({
      where,
    });
  }
}
