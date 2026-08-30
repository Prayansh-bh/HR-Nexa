import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenBlacklistService } from '../../auth/services/token-blacklist.service';
import { StorageService } from '../../../common/storage/storage.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

describe('SubscriptionLifecycleService - Permanent Purge Hardening', () => {
  let service: SubscriptionLifecycleService;
  let prismaMock: any;
  let storageMock: any;

  beforeEach(async () => {
    prismaMock = {
      subscription: {
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'usr-1' }]),
        deleteMany: jest.fn(),
      },
      supportTicket: {
        findMany: jest.fn().mockResolvedValue([{ id: 'tkt-1' }]),
        deleteMany: jest.fn(),
      },
      document: {
        findMany: jest.fn().mockResolvedValue([{ filePath: 'uploads/doc-1.pdf' }]),
        deleteMany: jest.fn(),
      },
      exitDocument: {
        findMany: jest.fn().mockResolvedValue([{ storageKey: 'uploads/exit-1.pdf' }]),
        deleteMany: jest.fn(),
      },
      payroll: {
        findMany: jest.fn().mockResolvedValue([{ payslipPath: 'uploads/slip-1.pdf' }]),
        deleteMany: jest.fn(),
      },
      candidate: {
        findMany: jest.fn().mockResolvedValue([{ resume: 'uploads/resume-1.pdf' }]),
        deleteMany: jest.fn(),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([{ avatar: 'uploads/avatars/emp-1.png' }]),
        deleteMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        const tx = {
          ticketMessage: { deleteMany: jest.fn() },
          otpChallenge: { deleteMany: jest.fn() },
          expenseClaimItem: { deleteMany: jest.fn() },
          taxDeclarationItem: { deleteMany: jest.fn() },
          exitDocument: { deleteMany: jest.fn() },
          exitTimeline: { deleteMany: jest.fn() },
          exitSettlement: { deleteMany: jest.fn() },
          exitInterview: { deleteMany: jest.fn() },
          exitChecklistItem: { deleteMany: jest.fn() },
          exitApproval: { deleteMany: jest.fn() },
          performanceCriterionScore: { deleteMany: jest.fn() },
          reviewCycleParticipant: { deleteMany: jest.fn() },
          candidateEvaluation: { deleteMany: jest.fn() },
          subscriptionEvent: { deleteMany: jest.fn() },
          userSession: { deleteMany: jest.fn() },
          passwordResetToken: { deleteMany: jest.fn() },
          supportTicket: { deleteMany: jest.fn() },
          expenseClaim: { deleteMany: jest.fn() },
          taxDeclaration: { deleteMany: jest.fn() },
          performanceReview: { deleteMany: jest.fn() },
          performanceCriterion: { deleteMany: jest.fn() },
          performanceGoal: { deleteMany: jest.fn() },
          kPIDefinition: { deleteMany: jest.fn() },
          performanceAudit: { deleteMany: jest.fn() },
          exit: { deleteMany: jest.fn() },
          exitChecklistTemplate: { deleteMany: jest.fn() },
          attendanceRegularizationRequest: { deleteMany: jest.fn() },
          attendanceSetting: { deleteMany: jest.fn() },
          attendance: { deleteMany: jest.fn() },
          leaveQuota: { deleteMany: jest.fn() },
          jobRequisition: { deleteMany: jest.fn() },
          candidate: { deleteMany: jest.fn() },
          expenseCategory: { deleteMany: jest.fn() },
          fiscalYear: { deleteMany: jest.fn() },
          reviewCycle: { deleteMany: jest.fn() },
          leaveRequest: { deleteMany: jest.fn() },
          leaveType: { deleteMany: jest.fn() },
          payroll: { deleteMany: jest.fn() },
          salaryComponent: { deleteMany: jest.fn() },
          officeTiming: { deleteMany: jest.fn() },
          holiday: { deleteMany: jest.fn() },
          calendarEvent: { deleteMany: jest.fn() },
          document: { deleteMany: jest.fn() },
          companyAsset: { deleteMany: jest.fn() },
          companyDevice: { deleteMany: jest.fn() },
          companySettings: { deleteMany: jest.fn() },
          message: { deleteMany: jest.fn() },
          auditLog: { deleteMany: jest.fn() },
          announcement: { deleteMany: jest.fn() },
          invoice: { deleteMany: jest.fn() },
          paymentRecord: { deleteMany: jest.fn() },
          outboxIdempotency: { deleteMany: jest.fn() },
          outboxEvent: { deleteMany: jest.fn() },
          companyPlanAssignment: { deleteMany: jest.fn() },
          employee: { deleteMany: jest.fn() },
          designation: { deleteMany: jest.fn() },
          department: { deleteMany: jest.fn() },
          role: { deleteMany: jest.fn() },
          user: { deleteMany: jest.fn() },
          subscription: { delete: jest.fn() },
          company: { deleteMany: jest.fn() },
        };
        return cb(tx);
      }),
    };

    storageMock = {
      deleteFile: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TokenBlacklistService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: StorageService, useValue: storageMock },
      ],
    }).compile();

    service = module.get<SubscriptionLifecycleService>(SubscriptionLifecycleService);
  });

  it('should reject purge if subscription does not exist', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    await expect(service.purgeSubscription('sub-none', 'Acme Corp')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should reject purge if subscription is Active (not Archived)', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      company: 'Acme Corp',
      status: SubscriptionStatus.ACTIVE,
      companyId: 'comp-1',
    });

    await expect(service.purgeSubscription('sub-1', 'Acme Corp')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.purgeSubscription('sub-1', 'Acme Corp')).rejects.toThrow(
      /must be archived first/i,
    );
  });

  it('should reject purge if confirmation company name does not match', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      company: 'Acme Corp',
      status: SubscriptionStatus.ARCHIVED,
      companyId: 'comp-1',
    });

    await expect(service.purgeSubscription('sub-1', 'Wrong Name')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.purgeSubscription('sub-1', 'Wrong Name')).rejects.toThrow(
      /confirmation mismatch/i,
    );
  });

  it('should execute 32-model purge transaction and storage deletion when status is Archived and confirmation matches', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      company: 'Acme Corp',
      status: SubscriptionStatus.ARCHIVED,
      companyId: 'comp-1',
    });

    const result = await service.purgeSubscription('sub-1', 'Acme Corp');

    expect(result.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(storageMock.deleteFile).toHaveBeenCalledWith('uploads/doc-1.pdf');
    expect(storageMock.deleteFile).toHaveBeenCalledWith('uploads/exit-1.pdf');
    expect(storageMock.deleteFile).toHaveBeenCalledWith('uploads/slip-1.pdf');
    expect(storageMock.deleteFile).toHaveBeenCalledWith('uploads/resume-1.pdf');
  });

  it('should include valid employee avatar storage paths in post-commit storage deletion', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      company: 'Acme Corp',
      status: SubscriptionStatus.ARCHIVED,
      companyId: 'comp-1',
    });
    prismaMock.employee = {
      findMany: jest.fn().mockResolvedValue([
        { avatar: 'uploads/avatars/emp-custom.png' },
        { avatar: 'avatar1.png' }, // placeholder/default -> should not be deleted
      ]),
    };

    await service.purgeSubscription('sub-1', 'Acme Corp');

    expect(storageMock.deleteFile).toHaveBeenCalledWith('uploads/avatars/emp-custom.png');
    expect(storageMock.deleteFile).not.toHaveBeenCalledWith('avatar1.png');
  });
});
