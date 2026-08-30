import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, KPIDefinition } from '@prisma/client';

@Injectable()
export class KpiRepository {
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

  async ensureDefaultKPIs(
    companyId: string,
    companyName: string,
  ): Promise<KPIDefinition[]> {
    await this.ensureCompany(companyId, companyName);
    const existing = await this.prisma.kPIDefinition.findMany({
      where: { companyId },
    });
    if (existing.length > 0) {
      return existing;
    }

    const defaultKPIs = [
      {
        name: 'Core Task Delivery Rate',
        department: 'Engineering',
        weight: 0.4,
        measurementType: 'Manual',
        target: 95.0,
        currentValue: 90.0,
      },
      {
        name: 'System Uptime & Quality',
        department: 'Engineering',
        weight: 0.3,
        measurementType: 'Manual',
        target: 99.9,
        currentValue: 99.5,
      },
      {
        name: 'Sprint Attendance Rate',
        department: 'Engineering',
        weight: 0.3,
        measurementType: 'Attendance Driven',
        target: 100.0,
        currentValue: 0.0,
      },
      {
        name: 'Sales Target Achievement',
        department: 'Sales & Marketing',
        weight: 0.5,
        measurementType: 'Manual',
        target: 100.0,
        currentValue: 85.0,
      },
      {
        name: 'Client Meeting Quota',
        department: 'Sales & Marketing',
        weight: 0.2,
        measurementType: 'Manual',
        target: 20.0,
        currentValue: 18.0,
      },
      {
        name: 'Sales Attendance Rate',
        department: 'Sales & Marketing',
        weight: 0.3,
        measurementType: 'Attendance Driven',
        target: 100.0,
        currentValue: 0.0,
      },
      {
        name: 'Organization Attendance Rate',
        department: 'All',
        weight: 1.0,
        measurementType: 'Attendance Driven',
        target: 100.0,
        currentValue: 0.0,
      },
    ];

    const created: KPIDefinition[] = [];
    for (const item of defaultKPIs) {
      const k = await this.prisma.kPIDefinition.create({
        data: {
          companyId,
          name: item.name,
          department: item.department,
          weight: item.weight,
          measurementType: item.measurementType,
          target: item.target,
          currentValue: item.currentValue,
          active: true,
        },
      });
      created.push(k);
    }
    return created;
  }

  async create(
    companyId: string,
    companyName: string,
    data: Omit<Prisma.KPIDefinitionUncheckedCreateInput, 'companyId'>,
  ): Promise<KPIDefinition> {
    await this.ensureCompany(companyId, companyName);
    return this.prisma.kPIDefinition.create({
      data: {
        ...data,
        companyId,
      },
    });
  }

  async findMany(
    companyId?: string | null,
    department?: string,
  ): Promise<KPIDefinition[]> {
    const where: Prisma.KPIDefinitionWhereInput = { active: true };
    if (companyId) where.companyId = companyId;
    if (department && department !== 'All') {
      where.OR = [{ department }, { department: 'All' }];
    }
    return this.prisma.kPIDefinition.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, companyId?: string | null): Promise<KPIDefinition | null> {
    const where: Prisma.KPIDefinitionWhereInput = { id };
    if (companyId) where.companyId = companyId;
    return this.prisma.kPIDefinition.findFirst({
      where,
    });
  }

  async update(
    id: string,
    data: Prisma.KPIDefinitionUncheckedUpdateInput,
  ): Promise<KPIDefinition> {
    return this.prisma.kPIDefinition.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<KPIDefinition> {
    return this.prisma.kPIDefinition.delete({
      where: { id },
    });
  }
}
