import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DprRepository } from '../repositories/dpr.repository';
import { CreateDprDto } from '../dto/create-dpr.dto';
import { UpdateDprDto } from '../dto/update-dpr.dto';
import { DPRStatus, DPRTaskStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DprService {
  constructor(
    private readonly dprRepository: DprRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createMyDpr(companyId: string, employeeId: string, dto: CreateDprDto) {
    // 1. Check duplicate DPR for same date
    const existing = await this.dprRepository.findByDate(companyId, employeeId, dto.reportDate);
    if (existing) {
      throw new BadRequestException(`A progress report has already been created for ${dto.reportDate}.`);
    }

    // 2. Validate tasks minutesSpent are non-negative
    for (const task of dto.tasks) {
      if (task.minutesSpent < 0) {
        throw new BadRequestException('Minutes spent on each task cannot be negative.');
      }
    }

    return this.dprRepository.create(companyId, employeeId, dto);
  }

  async getMyHistory(companyId: string, employeeId: string) {
    return this.dprRepository.findHistory(companyId, employeeId);
  }

  async getMyDprById(companyId: string, employeeId: string, id: string) {
    const report = await this.dprRepository.findById(companyId, id);
    if (!report) {
      throw new NotFoundException('Daily Progress Report not found.');
    }
    if (report.employeeId !== employeeId) {
      throw new ForbiddenException('You do not have permission to access this report.');
    }
    return report;
  }

  async updateMyDpr(companyId: string, employeeId: string, id: string, dto: UpdateDprDto) {
    const report = await this.dprRepository.findById(companyId, id);
    if (!report) {
      throw new NotFoundException('Daily Progress Report not found.');
    }
    if (report.employeeId !== employeeId) {
      throw new ForbiddenException('You do not have permission to modify this report.');
    }

    // Check status: only DRAFT or CORRECTION_REQUIRED can be updated
    if (report.status !== DPRStatus.DRAFT && report.status !== DPRStatus.CORRECTION_REQUIRED) {
      throw new BadRequestException('Only reports in DRAFT or CORRECTION_REQUIRED status can be edited.');
    }

    // Validate tasks minutes
    for (const task of dto.tasks) {
      if (task.minutesSpent < 0) {
        throw new BadRequestException('Minutes spent on each task cannot be negative.');
      }
    }

    return this.dprRepository.update(companyId, id, dto);
  }

  async submitMyDpr(companyId: string, employeeId: string, id: string) {
    const report = await this.dprRepository.findById(companyId, id);
    if (!report) {
      throw new NotFoundException('Daily Progress Report not found.');
    }
    if (report.employeeId !== employeeId) {
      throw new ForbiddenException('You do not have permission to submit this report.');
    }

    // Check status: only DRAFT or CORRECTION_REQUIRED can be submitted
    if (report.status !== DPRStatus.DRAFT && report.status !== DPRStatus.CORRECTION_REQUIRED) {
      throw new BadRequestException('Only reports in DRAFT or CORRECTION_REQUIRED status can be submitted.');
    }

    // Submission validation
    if (!report.summary || !report.summary.trim()) {
      throw new BadRequestException('Summary of work is required for submission.');
    }
    if (!report.tasks || report.tasks.length === 0) {
      throw new BadRequestException('A report must contain at least one task item to be submitted.');
    }
    for (const task of report.tasks) {
      if (!task.title || !task.title.trim()) {
        throw new BadRequestException('Task title is required.');
      }
      if (task.minutesSpent < 1) {
        throw new BadRequestException('Minutes spent on each task must be at least 1 minute upon submission.');
      }
      if (![DPRTaskStatus.COMPLETED, DPRTaskStatus.IN_PROGRESS, DPRTaskStatus.BLOCKED].includes(task.status)) {
        throw new BadRequestException(`Invalid task status: ${task.status}`);
      }
    }

    return this.dprRepository.updateStatus(companyId, id, DPRStatus.SUBMITTED);
  }

  async getTeamReports(
    companyId: string,
    reviewerEmployeeId: string,
    isHRAdmin: boolean,
    filters: { employeeId?: string; reportDate?: string; status?: DPRStatus },
  ) {
    let subordinateIds: string[] | undefined = undefined;

    if (!isHRAdmin) {
      // Fetch direct subordinates
      const subordinates = await this.prisma.employee.findMany({
        where: { managerId: reviewerEmployeeId, companyId },
        select: { id: true },
      });
      subordinateIds = subordinates.map((s) => s.id);
      if (subordinateIds.length === 0) {
        return [];
      }
    }

    return this.dprRepository.findTeamReports(companyId, {
      ...filters,
      subordinateIds,
    });
  }

  async getTeamDprById(companyId: string, reviewerEmployeeId: string, isHRAdmin: boolean, id: string) {
    const report = await this.dprRepository.findById(companyId, id);
    if (!report) {
      throw new NotFoundException('Daily Progress Report not found.');
    }

    if (!isHRAdmin) {
      // Check if employee is subordinate of reviewer
      const employee = await this.prisma.employee.findUnique({
        where: { id: report.employeeId },
        select: { managerId: true },
      });
      if (!employee || employee.managerId !== reviewerEmployeeId) {
        throw new ForbiddenException('You do not have permission to view this report.');
      }
    }

    return report;
  }

  async reviewReport(
    companyId: string,
    reviewerEmployeeId: string,
    isHRAdmin: boolean,
    id: string,
    status: DPRStatus,
    remark?: string,
  ) {
    const report = await this.dprRepository.findById(companyId, id);
    if (!report) {
      throw new NotFoundException('Daily Progress Report not found.');
    }

    // 1. Employee cannot review their own report
    if (report.employeeId === reviewerEmployeeId) {
      throw new BadRequestException('Employees cannot review their own progress reports.');
    }

    // 2. Only SUBMITTED reports can be reviewed
    if (report.status !== DPRStatus.SUBMITTED) {
      throw new BadRequestException('Only reports in SUBMITTED status can be reviewed.');
    }

    // 3. Hierarchy Check
    if (!isHRAdmin) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: report.employeeId },
        select: { managerId: true },
      });
      if (!employee || employee.managerId !== reviewerEmployeeId) {
        throw new ForbiddenException('You do not have permission to review this report.');
      }
    }

    return this.dprRepository.review(companyId, id, status, reviewerEmployeeId, remark);
  }
}
