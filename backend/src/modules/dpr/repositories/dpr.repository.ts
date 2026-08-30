import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateDprDto } from '../dto/create-dpr.dto';
import { UpdateDprDto } from '../dto/update-dpr.dto';
import { DPRStatus } from '@prisma/client';

@Injectable()
export class DprRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma;
  }

  async findById(companyId: string, id: string) {
    return this.db.dailyProgressReport.findFirst({
      where: { id, companyId },
      include: {
        tasks: true,
        employee: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findByDate(companyId: string, employeeId: string, reportDate: string) {
    return this.db.dailyProgressReport.findFirst({
      where: { companyId, employeeId, reportDate },
      include: { tasks: true },
    });
  }

  async create(companyId: string, employeeId: string, data: CreateDprDto) {
    const totalMinutes = data.tasks.reduce((sum, t) => sum + t.minutesSpent, 0);
    const hoursWorked = Number((totalMinutes / 60).toFixed(2));

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.dailyProgressReport.create({
        data: {
          companyId,
          employeeId,
          reportDate: data.reportDate,
          summary: data.summary,
          blockers: data.blockers || null,
          hoursWorked,
          status: DPRStatus.DRAFT,
        },
      });

      if (data.tasks && data.tasks.length > 0) {
        await tx.dPRTaskItem.createMany({
          data: data.tasks.map((t) => ({
            reportId: report.id,
            title: t.title,
            description: t.description || null,
            status: t.status,
            minutesSpent: t.minutesSpent,
          })),
        });
      }

      return tx.dailyProgressReport.findUnique({
        where: { id: report.id },
        include: { tasks: true },
      });
    });
  }

  async update(companyId: string, id: string, data: UpdateDprDto) {
    const totalMinutes = data.tasks.reduce((sum, t) => sum + t.minutesSpent, 0);
    const hoursWorked = Number((totalMinutes / 60).toFixed(2));

    return this.prisma.$transaction(async (tx) => {
      // Delete existing tasks first
      await tx.dPRTaskItem.deleteMany({
        where: { reportId: id },
      });

      // Update parent report
      await tx.dailyProgressReport.update({
        where: { id, companyId },
        data: {
          summary: data.summary,
          blockers: data.blockers || null,
          hoursWorked,
        },
      });

      // Insert new tasks
      if (data.tasks && data.tasks.length > 0) {
        await tx.dPRTaskItem.createMany({
          data: data.tasks.map((t) => ({
            reportId: id,
            title: t.title,
            description: t.description || null,
            status: t.status,
            minutesSpent: t.minutesSpent,
          })),
        });
      }

      return tx.dailyProgressReport.findUnique({
        where: { id },
        include: { tasks: true },
      });
    });
  }

  async updateStatus(companyId: string, id: string, status: DPRStatus) {
    return this.db.dailyProgressReport.update({
      where: { id, companyId },
      data: { status },
      include: { tasks: true },
    });
  }

  async review(
    companyId: string,
    id: string,
    status: DPRStatus,
    reviewerId: string,
    remark?: string,
  ) {
    return this.db.dailyProgressReport.update({
      where: { id, companyId },
      data: {
        status,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewerRemark: remark || null,
      },
      include: { tasks: true },
    });
  }

  async findHistory(companyId: string, employeeId: string) {
    return this.db.dailyProgressReport.findMany({
      where: { companyId, employeeId },
      include: { tasks: true },
      orderBy: { reportDate: 'desc' },
    });
  }

  async findTeamReports(
    companyId: string,
    filters: {
      employeeId?: string;
      reportDate?: string;
      status?: DPRStatus;
      subordinateIds?: string[];
    },
  ) {
    const where: any = { companyId };

    if (filters.employeeId) {
      // If a specific employee is requested, check if it's within subordinates if scoped
      if (filters.subordinateIds && !filters.subordinateIds.includes(filters.employeeId)) {
        return []; // Requested employee is not in subordinate scope
      }
      where.employeeId = filters.employeeId;
    } else if (filters.subordinateIds) {
      where.employeeId = { in: filters.subordinateIds };
    }

    if (filters.reportDate) {
      where.reportDate = filters.reportDate;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return this.db.dailyProgressReport.findMany({
      where,
      include: {
        tasks: true,
        employee: { select: { id: true, name: true, email: true } },
      },
      orderBy: { reportDate: 'desc' },
    });
  }
}
