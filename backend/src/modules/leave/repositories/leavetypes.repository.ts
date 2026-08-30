import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CreateLeaveTypeData {
  companyId: string;
  name: string;
  days: number;
  tone?: string;
  accrualRate?: number;
  maxCap?: number;
  carryForward?: boolean;
  encashable?: boolean;
  paid?: boolean;
  accrualFrequency?: string;
}

export interface UpdateLeaveTypeData {
  name?: string;
  days?: number;
  tone?: string;
  accrualRate?: number;
  maxCap?: number;
  carryForward?: boolean;
  encashable?: boolean;
  paid?: boolean;
  accrualFrequency?: string;
}

@Injectable()
export class LeaveTypesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.leaveType.findMany({
      where: {
        companyId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, companyId: string) {
    return this.prisma.leaveType.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
    });
  }

  async findByName(name: string, companyId: string) {
    return this.prisma.leaveType.findFirst({
      where: {
        companyId,
        name: { equals: name },
        deletedAt: null,
      },
    });
  }

  async create(data: CreateLeaveTypeData) {
    return this.prisma.leaveType.create({
      data: {
        ...data,
        tone: data.tone || 'indigo',
      },
    });
  }

  async update(id: string, companyId: string, data: UpdateLeaveTypeData) {
    const existing = await this.findById(id, companyId);
    if (!existing) return null;
    return this.prisma.leaveType.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...(data.tone !== undefined ? { tone: data.tone } : {}),
      },
    });
  }

  async softDelete(id: string, companyId: string, deletedBy: string) {
    const existing = await this.findById(id, companyId);
    if (!existing) return null;
    return this.prisma.leaveType.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        deletedBy,
      },
    });
  }
}

