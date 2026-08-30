import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export type FiscalYearStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

export interface CreateFiscalYearData {
  companyId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status?: FiscalYearStatus;
}

export interface UpdateFiscalYearData {
  name?: string;
  startDate?: Date;
  endDate?: Date;
  status?: FiscalYearStatus;
  isLocked?: boolean;
  lockedAt?: Date | null;
}

@Injectable()
export class FiscalYearRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get fiscalYear() {
    return (this.prisma as any).fiscalYear;
  }

  async findAll(companyId: string) {
    return this.fiscalYear.findMany({
      where: {
        companyId,
        deletedAt: null,
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findById(id: string, companyId: string) {
    return this.fiscalYear.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
    });
  }

  async findByName(name: string, companyId: string) {
    return this.fiscalYear.findFirst({
      where: {
        companyId,
        name: { equals: name, mode: 'insensitive' },
        deletedAt: null,
      },
    });
  }

  async findActive(companyId: string) {
    return this.fiscalYear.findFirst({
      where: {
        companyId,
        status: 'ACTIVE' as FiscalYearStatus,
        deletedAt: null,
      },
    });
  }

  async findOverlapping(companyId: string, startDate: Date, endDate: Date, excludeId?: string) {
    return this.fiscalYear.findFirst({
      where: {
        companyId,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });
  }

  async create(data: CreateFiscalYearData) {
    return this.fiscalYear.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status || 'DRAFT',
      },
    });
  }

  async update(id: string, companyId: string, data: UpdateFiscalYearData) {
    return this.fiscalYear.updateMany({
      where: { id, companyId, deletedAt: null },
      data,
    });
  }

  async activate(id: string, companyId: string) {
    return this.prisma.$transaction(async (tx) => {
      const fyDelegate = (tx as any).fiscalYear;
      // Deactivate/close all currently active fiscal years for this tenant
      await fyDelegate.updateMany({
        where: {
          companyId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        data: {
          status: 'CLOSED',
        },
      });

      // Activate target fiscal year
      await fyDelegate.update({
        where: { id },
        data: {
          status: 'ACTIVE',
        },
      });

      return fyDelegate.findUnique({ where: { id } });
    });
  }

  async close(id: string, companyId: string) {
    return this.fiscalYear.update({
      where: { id },
      data: {
        status: 'CLOSED',
      },
    });
  }

  async lock(id: string, companyId: string) {
    return this.fiscalYear.update({
      where: { id },
      data: {
        isLocked: true,
        lockedAt: new Date(),
      },
    });
  }

  async softDelete(id: string, companyId: string, deletedBy: string) {
    return this.fiscalYear.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
      },
    });
  }
}
