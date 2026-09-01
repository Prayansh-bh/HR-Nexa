import { PerformanceReviewService } from './performance-review.service';
import { RatingEngineService } from './rating-engine.service';
import { NotFoundException } from '@nestjs/common';

describe('PerformanceReviewService - F-02 Lifecycle & HR Override Preservation Suite', () => {
  let service: PerformanceReviewService;
  let mockRepository: any;
  let mockAttendanceService: any;
  let ratingEngine: RatingEngineService;
  let mockEventEmitter: any;
  let mockPrisma: any;

  const auditMeta = {
    userId: 'user-hr-1',
    userName: 'Ravi Kisan',
    role: 'HRAdmin',
    ip: '127.0.0.1',
    userAgent: 'JestTest',
  };

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      update: jest.fn(),
      saveCriterionScore: jest.fn(),
      create: jest.fn(),
      findReviews: jest.fn(),
      getCriteria: jest.fn(),
    };

    mockAttendanceService = {
      calculateAttendanceScore: jest.fn(),
    };

    ratingEngine = new RatingEngineService();

    mockEventEmitter = {
      emit: jest.fn(),
    };

    mockPrisma = {
      performanceAudit: { create: jest.fn() },
      reviewCycleParticipant: { update: jest.fn() },
    };

    service = new PerformanceReviewService(
      mockRepository,
      mockAttendanceService,
      ratingEngine,
      mockPrisma,
      mockEventEmitter,
    );
  });

  const baseScores = [
    {
      criterionId: 'crit-att',
      criterion: { id: 'crit-att', name: 'Attendance', weight: 1.0 },
      hrScore: 5.0,
      managerScore: 5.0,
      selfScore: 5.0,
      remarks: 'Auto-calculated from attendance records',
    },
    {
      criterionId: 'crit-tech',
      criterion: { id: 'crit-tech', name: 'Technical Skills', weight: 1.0 },
      hrScore: 4.0,
      managerScore: 4.0,
      selfScore: 4.0,
      remarks: '',
    },
  ];

  it('1. System-generated Attendance score is recalculated during review completion', async () => {
    mockRepository.findById.mockResolvedValue({
      id: 'rev-1',
      employeeId: 'emp-1',
      companyId: 'comp-1',
      status: 'In Progress',
      finalRating: 0.0,
      reviewCycle: { startDate: '2026-08-01', endDate: '2026-08-31' },
      scores: [...baseScores],
    });

    // Attendance service returns refreshed score 3.8
    mockAttendanceService.calculateAttendanceScore.mockResolvedValue(3.8);

    mockRepository.update.mockImplementation((id: string, data: any) => ({
      id,
      ...data,
    }));

    await service.completeReview('rev-1', 'comp-1', auditMeta);

    // Verify recalculation was invoked
    expect(mockAttendanceService.calculateAttendanceScore).toHaveBeenCalledWith(
      'emp-1',
      '2026-08-01',
      '2026-08-31',
      'comp-1',
    );

    // Verify criterion score and parent attendanceRating were updated
    expect(mockRepository.saveCriterionScore).toHaveBeenCalledWith(
      'rev-1',
      'crit-att',
      {
        hrScore: 3.8,
        remarks: 'Auto-calculated from attendance records',
      },
      'comp-1',
    );
  });

  it('2. Explicit HR override on Attendance score (e.g. 3.2) is preserved and NEVER overwritten on completion', async () => {
    const overriddenScores = [
      {
        criterionId: 'crit-att',
        criterion: { id: 'crit-att', name: 'Attendance', weight: 1.0 },
        hrScore: 3.2,
        managerScore: 5.0,
        selfScore: 5.0,
        remarks: 'HR override score', // Explicit HR Override Marker
      },
      {
        criterionId: 'crit-tech',
        criterion: { id: 'crit-tech', name: 'Technical Skills', weight: 1.0 },
        hrScore: 4.0,
        managerScore: 4.0,
        selfScore: 4.0,
        remarks: 'HR override score',
      },
    ];

    mockRepository.findById.mockResolvedValue({
      id: 'rev-2',
      employeeId: 'emp-2',
      companyId: 'comp-1',
      status: 'HR Review',
      finalRating: 3.6,
      attendanceRating: 3.2,
      reviewCycle: { startDate: '2026-08-01', endDate: '2026-08-31' },
      scores: overriddenScores,
    });

    mockRepository.update.mockImplementation((id: string, data: any) => ({
      id,
      ...data,
    }));

    await service.completeReview('rev-2', 'comp-1', auditMeta);

    // calculateAttendanceScore MUST NOT be called because HR explicitly locked it
    expect(mockAttendanceService.calculateAttendanceScore).not.toHaveBeenCalled();

    // saveCriterionScore MUST NOT be called for Attendance
    expect(mockRepository.saveCriterionScore).not.toHaveBeenCalled();

    // Final completed update preserves attendanceRating and finalRating
    expect(mockRepository.update).toHaveBeenCalledWith(
      'rev-2',
      expect.objectContaining({
        status: 'Completed',
        finalRating: 3.6,
      }),
    );
  });

  it('3. Already Completed reviews are immutable and return immediately without recalculation', async () => {
    const completedReview = {
      id: 'rev-3',
      employeeId: 'emp-3',
      companyId: 'comp-1',
      status: 'Completed',
      finalRating: 4.5,
      attendanceRating: 4.5,
      scores: baseScores,
    };

    mockRepository.findById.mockResolvedValue(completedReview);

    const res = await service.completeReview('rev-3', 'comp-1', auditMeta);

    expect(res).toEqual(completedReview);
    expect(mockAttendanceService.calculateAttendanceScore).not.toHaveBeenCalled();
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it('4. Non-Attendance criterion overrides remain unaffected when attendance is refreshed', async () => {
    const mixedScores = [
      {
        criterionId: 'crit-att',
        criterion: { id: 'crit-att', name: 'Attendance', weight: 1.0 },
        hrScore: 5.0,
        remarks: 'Auto-calculated from attendance records',
      },
      {
        criterionId: 'crit-tech',
        criterion: { id: 'crit-tech', name: 'Technical Skills', weight: 1.0 },
        hrScore: 4.8,
        remarks: 'HR override score', // Tech skills overridden
      },
    ];

    mockRepository.findById.mockResolvedValue({
      id: 'rev-4',
      employeeId: 'emp-4',
      companyId: 'comp-1',
      status: 'Draft',
      finalRating: 0.0,
      reviewCycle: { startDate: '2026-08-01', endDate: '2026-08-31' },
      scores: mixedScores,
    });

    mockAttendanceService.calculateAttendanceScore.mockResolvedValue(4.0);
    mockRepository.update.mockImplementation((id: string, data: any) => ({
      id,
      ...data,
    }));

    await service.completeReview('rev-4', 'comp-1', auditMeta);

    // Attendance is refreshed to 4.0
    expect(mockRepository.saveCriterionScore).toHaveBeenCalledWith(
      'rev-4',
      'crit-att',
      expect.objectContaining({ hrScore: 4.0 }),
      'comp-1',
    );

    // Tech skills is untouched
    expect(mockRepository.saveCriterionScore).not.toHaveBeenCalledWith(
      'rev-4',
      'crit-tech',
      expect.anything(),
    );
  });
});
