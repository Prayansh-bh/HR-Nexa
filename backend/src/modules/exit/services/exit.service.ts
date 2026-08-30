import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ExitRepository } from '../repositories/exit.repository';
import { ExitTimelineService } from '../timeline/exit-timeline.service';
import { ExitChecklistService } from '../checklist/exit-checklist.service';
import { ExitSettlementService } from '../settlement/exit-settlement.service';
import {
  ExitStage,
  ExitStatus,
  ExitAction,
  ExitApproverRole,
  Prisma,
} from '@prisma/client';
import { SubmitResignationDto, ApproveExitDto } from '../dto/exit.dto';

@Injectable()
export class ExitService {
  constructor(
    private readonly prisma: PrismaService,
    private repository: ExitRepository,
    private timelineService: ExitTimelineService,
    private checklistService: ExitChecklistService,
    private settlementService: ExitSettlementService,
  ) {}

  async submitResignation(
    employeeId: string,
    companyId: string,
    dto: SubmitResignationDto,
  ) {
    const activeExit = await this.repository.checkActiveExit(
      employeeId,
      companyId,
    );
    if (activeExit) {
      throw new BadRequestException(
        'An active resignation already exists for this employee.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const exit = await this.repository.create(
        {
          employeeId,
          companyId,
          reason: dto.reason,
          proposedLastWorkingDay: new Date(dto.proposedLastWorkingDay),
          noticeBuyoutRequest: dto.noticeBuyoutRequest || false,
          additionalComments: dto.additionalComments,
          stage: ExitStage.SUBMITTED,
          status: ExitStatus.PENDING,
        },
        tx,
      );

      await this.timelineService.logAction(
        {
          exitId: exit.id,
          action: ExitAction.SUBMITTED,
          newStage: ExitStage.SUBMITTED,
          description: 'Resignation submitted by employee.',
          userId: employeeId,
        },
        tx,
      );

      return exit;
    });
  }

  async managerApprove(
    exitId: string,
    userId: string,
    companyId: string,
    dto: ApproveExitDto,
    actorEmployeeId?: string,
  ) {
    const exit = await this.repository.findById(exitId, companyId);
    if (!exit) {
      throw new NotFoundException(`Exit record with ID "${exitId}" not found`);
    }

    // P2-1 Remediation: A user MUST NOT approve their own resignation
    if (exit.employeeId === userId || (actorEmployeeId && exit.employeeId === actorEmployeeId)) {
      throw new ForbiddenException('You cannot approve your own resignation.');
    }

    if (exit.stage !== ExitStage.SUBMITTED)
      throw new BadRequestException('Invalid state transition.');

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.repository.update(
        exitId,
        {
          stage: ExitStage.MANAGER_APPROVED,
          approvedLastWorkingDay: new Date(dto.approvedLastWorkingDay),
          noticeStartDate: dto.noticeStartDate
            ? new Date(dto.noticeStartDate)
            : undefined,
          noticeEndDate: dto.noticeEndDate
            ? new Date(dto.noticeEndDate)
            : undefined,
        },
        exit.version,
        tx,
      );

      await this.timelineService.recordApproval(
        {
          exitId,
          approverId: userId,
          role: ExitApproverRole.MANAGER,
          action: ExitAction.APPROVED,
          remarks: dto.remarks,
        },
        tx,
      );

      await this.timelineService.logAction(
        {
          exitId,
          action: ExitAction.APPROVED,
          oldStage: ExitStage.SUBMITTED,
          newStage: ExitStage.MANAGER_APPROVED,
          description: 'Manager approved resignation.',
          userId,
        },
        tx,
      );

      return updated;
    });
  }

  async hrApprove(
    exitId: string,
    userId: string,
    companyId: string,
    dto: ApproveExitDto,
    actorEmployeeId?: string,
  ) {
    const exit = await this.repository.findById(exitId, companyId);
    if (!exit) {
      throw new NotFoundException(`Exit record with ID "${exitId}" not found`);
    }

    // P2-1 Remediation: A user MUST NOT approve their own resignation
    if (exit.employeeId === userId || (actorEmployeeId && exit.employeeId === actorEmployeeId)) {
      throw new ForbiddenException('You cannot approve your own resignation.');
    }

    if (exit.stage !== ExitStage.MANAGER_APPROVED)
      throw new BadRequestException(
        'Invalid state transition. Manager must approve first.',
      );

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.repository.update(
        exitId,
        {
          stage: ExitStage.NOTICE_PERIOD,
          status: ExitStatus.APPROVED,
          approvedLastWorkingDay: dto.approvedLastWorkingDay
            ? new Date(dto.approvedLastWorkingDay)
            : undefined,
        },
        exit.version,
        tx,
      );

      await this.timelineService.recordApproval(
        {
          exitId,
          approverId: userId,
          role: ExitApproverRole.HR_ADMIN,
          action: ExitAction.APPROVED,
          remarks: dto.remarks,
        },
        tx,
      );

      await this.timelineService.logAction(
        {
          exitId,
          action: ExitAction.APPROVED,
          oldStage: ExitStage.MANAGER_APPROVED,
          newStage: ExitStage.NOTICE_PERIOD,
          description: 'HR approved resignation. Notice period begins.',
          userId,
        },
        tx,
      );

      return updated;
    });
  }

  async advanceToChecklist(exitId: string, userId: string, companyId: string) {
    const exit = await this.repository.findById(exitId, companyId);
    if (!exit) {
      throw new NotFoundException(`Exit record with ID "${exitId}" not found`);
    }
    if (exit.stage !== ExitStage.NOTICE_PERIOD) throw new BadRequestException();

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.repository.update(
        exitId,
        { stage: ExitStage.CHECKLIST },
        exit.version,
        tx,
      );
      await this.checklistService.generateFromTemplates(
        exitId,
        exit.companyId,
        tx,
      );

      await this.timelineService.logAction(
        {
          exitId,
          action: ExitAction.APPROVED,
          oldStage: ExitStage.NOTICE_PERIOD,
          newStage: ExitStage.CHECKLIST,
          description: 'Advanced to Checklist stage.',
          userId,
        },
        tx,
      );

      return updated;
    });
  }
}
