import { Test, TestingModule } from '@nestjs/testing';
import { ExitService } from './exit.service';
import { ExitRepository } from '../repositories/exit.repository';
import { ExitTimelineService } from '../timeline/exit-timeline.service';
import { ExitChecklistService } from '../checklist/exit-checklist.service';
import { ExitSettlementService } from '../settlement/exit-settlement.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExitStage, ExitStatus } from '@prisma/client';

describe('ExitService - Resignation Workflow & Lifecycle', () => {
  let service: ExitService;
  let exitRepository: jest.Mocked<ExitRepository>;
  let prisma: any;

  beforeEach(async () => {
    const mockExitRepo = {
      checkActiveExit: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => ({
        id: 'exit-1',
        ...data,
      })),
      findById: jest.fn(),
      update: jest.fn(),
    };

    const mockTimeline = {
      logAction: jest.fn().mockResolvedValue({}),
    };

    const mockChecklist = {};
    const mockSettlement = {};

    const mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExitService,
        { provide: ExitRepository, useValue: mockExitRepo },
        { provide: ExitTimelineService, useValue: mockTimeline },
        { provide: ExitChecklistService, useValue: mockChecklist },
        { provide: ExitSettlementService, useValue: mockSettlement },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ExitService>(ExitService);
    exitRepository = module.get(ExitRepository);
    prisma = module.get(PrismaService);
  });

  it('should submit resignation successfully for valid employee', async () => {
    const result = await service.submitResignation('emp-1', 'comp-1', {
      reason: 'Pursuing higher studies',
      proposedLastWorkingDay: '2026-09-30T00:00:00.000Z',
      noticeBuyoutRequest: false,
    });

    expect(result).toBeDefined();
    expect(result.id).toBe('exit-1');
    expect(result.stage).toBe(ExitStage.SUBMITTED);
    expect(result.status).toBe(ExitStatus.PENDING);
    expect(exitRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'emp-1',
        companyId: 'comp-1',
        reason: 'Pursuing higher studies',
      }),
      expect.anything(),
    );
  });

  it('should reject resignation if an active exit already exists for employee', async () => {
    exitRepository.checkActiveExit.mockResolvedValueOnce({
      id: 'active-exit-99',
      stage: ExitStage.SUBMITTED,
    } as any);

    await expect(
      service.submitResignation('emp-1', 'comp-1', {
        reason: 'Duplicate request',
        proposedLastWorkingDay: '2026-09-30T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
