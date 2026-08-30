import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PerformanceReviewRepository } from '../repositories/performance-review.repository';
import { AttendancePerformanceService } from './attendance-performance.service';
import { RatingEngineService } from './rating-engine.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PERFORMANCE_EVENTS } from '../../../common/events/performance.events';

@Injectable()
export class PerformanceReviewService {
  constructor(
    private readonly repository: PerformanceReviewRepository,
    private readonly attendanceService: AttendancePerformanceService,
    private readonly ratingEngine: RatingEngineService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createReviewsForCycle(
    companyId: string,
    companyName: string,
    reviewCycleId: string,
    authorId: string,
  ) {
    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: reviewCycleId, companyId },
    });
    if (!cycle) {
      throw new NotFoundException(`Review cycle not found`);
    }

    // Provision criteria if they don't exist
    const criteria = await this.repository.ensureDefaultCriteria(
      companyId,
      companyName,
    );

    // Fetch pending participants from the snapshot
    // @ts-ignore: TS cache issue with new Prisma schema
    const participants = await this.prisma.reviewCycleParticipant.findMany({
      where: { reviewCycleId, status: 'Pending' },
      include: { employee: true },
    });

    const reviewsCreated: any[] = [];

    for (const participant of participants) {
      const emp = participant.employee;

      // Find if a review already exists
      const existing = await this.prisma.performanceReview.findFirst({
        where: { employeeId: emp.id, reviewCycleId },
      });

      if (existing) {
        // @ts-ignore: TS cache issue with new Prisma schema
        await this.prisma.reviewCycleParticipant.update({
          where: { id: participant.id },
          data: { status: 'Provisioned' },
        });
        continue;
      }

      // Identify manager (fallback to department head or null if not set)
      let managerId: string | null = null;
      if (emp.managerId) {
        managerId = emp.managerId;
      } else if (emp.departmentId) {
        const dept = await this.prisma.department.findUnique({
          where: { id: emp.departmentId },
        });
        if (dept && dept.head) {
          // If the head is an employee ID
          const headEmp = await this.prisma.employee.findFirst({
            where: { name: dept.head, companyId: companyId },
          });
          if (headEmp && headEmp.id !== emp.id) {
            managerId = headEmp.id;
          }
        }
      }

      const review = await this.repository.createReview(
        companyId,
        companyName,
        {
          employeeId: emp.id,
          managerId,
          reviewCycleId,
          status: 'Draft',
        },
      );

      // Initialize criterion scores
      let initialAttendanceScore = 0.0;
      for (const crit of criteria) {
        if (crit.name === 'Attendance') {
          // Automatically calculate default attendance contribution
          initialAttendanceScore =
            await this.attendanceService.calculateAttendanceScore(
              emp.id,
              cycle.startDate,
              cycle.endDate,
              cycle.companyId,
            );
        }

        await this.repository.saveCriterionScore(review.id, crit.id, {
          selfScore: 0.0,
          managerScore: 0.0,
          hrScore: crit.name === 'Attendance' ? initialAttendanceScore : 0.0,
          remarks:
            crit.name === 'Attendance'
              ? 'Auto-calculated from attendance records'
              : '',
        });
      }

      let provisionedReview = review;
      if (initialAttendanceScore > 0) {
        provisionedReview = await this.repository.update(review.id, {
          attendanceRating: initialAttendanceScore,
        });
      }

      reviewsCreated.push(provisionedReview);

      // Update participant status
      // @ts-ignore: TS cache issue with new Prisma schema
      await this.prisma.reviewCycleParticipant.update({
        where: { id: participant.id },
        data: { status: 'Provisioned' },
      });
    }

    this.eventEmitter.emit(PERFORMANCE_EVENTS.REVIEW_CREATED, {
      cycleId: reviewCycleId,
      count: reviewsCreated.length,
      companyId,
    });

    return reviewsCreated;
  }

  async findReviews(
    companyId?: string | null,
    filters?: {
      employeeId?: string;
      managerId?: string;
      reviewCycleId?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.repository.findMany(companyId, filters);
  }

  async findReviewById(id: string, companyId?: string | null) {
    const review = await this.repository.findById(id, companyId);
    if (!review) {
      throw new NotFoundException(`Performance review with ID "${id}" not found`);
    }
    return review;
  }

  async submitSelfReview(
    id: string,
    companyId: string | null,
    employeeId: string,
    selfFeedback: string,
    scores: { criterionId: string; score: number; remarks?: string }[],
    auditMeta: {
      userId: string;
      userName: string;
      role: string;
      ip: string;
      userAgent: string;
    },
  ) {
    const review = await this.repository.findById(id, companyId);
    if (!review || review.employeeId !== employeeId) {
      throw new NotFoundException(`Performance review with ID "${id}" not found`);
    }
    if (review.status !== 'Draft')
      throw new BadRequestException(
        `Self-review can only be submitted in Draft status`,
      );

    // Save criterion self scores
    for (const item of scores) {
      await this.repository.saveCriterionScore(review.id, item.criterionId, {
        selfScore: item.score,
        remarks: item.remarks,
      });
    }

    // Refresh review scores
    const updatedReview = await this.repository.findById(id, companyId);
    if (!updatedReview)
      throw new NotFoundException(`Review score refresh failed`);
    const selfRating = this.ratingEngine.calculateWeightedScore(
      updatedReview.scores,
      'self',
    );

    const updated = await this.repository.update(id, {
      status: 'Self Review',
      selfRating,
      selfFeedback,
    });

    await this.logAudit(
      companyId,
      updated.id,
      'Self Review Submitted',
      null,
      JSON.stringify({ selfRating, selfFeedback }),
      auditMeta,
    );

    this.eventEmitter.emit(PERFORMANCE_EVENTS.REVIEW_UPDATED, {
      reviewId: updated.id,
      employeeId: updated.employeeId,
      status: updated.status,
      companyId,
    });

    return updated;
  }

  async submitManagerReview(
    id: string,
    companyId: string | null,
    managerId: string,
    managerFeedback: string,
    recommendation: {
      promotion: boolean;
      increment: boolean;
      training: boolean;
    },
    scores: { criterionId: string; score: number; remarks?: string }[],
    auditMeta: {
      userId: string;
      userName: string;
      role: string;
      ip: string;
      userAgent: string;
    },
  ) {
    const review = await this.repository.findById(id, companyId);
    if (!review || (auditMeta.role === 'Manager' && review.managerId !== managerId)) {
      throw new NotFoundException(`Performance review with ID "${id}" not found`);
    }

    // P2-1 Remediation: A user MUST NOT submit a manager review for their own performance appraisal
    if (review.employeeId === managerId) {
      throw new ForbiddenException(
        'You cannot submit a manager review for your own performance appraisal.',
      );
    }

    if (review.status !== 'Self Review' && review.status !== 'Draft') {
      throw new BadRequestException(
        `Manager review can only be submitted when status is Draft or Self Review`,
      );
    }

    // Save manager criterion scores
    for (const item of scores) {
      await this.repository.saveCriterionScore(review.id, item.criterionId, {
        managerScore: item.score,
        remarks: item.remarks,
      });
    }

    // Refresh review scores
    const updatedReview = await this.repository.findById(id, companyId);
    if (!updatedReview)
      throw new NotFoundException(`Review score refresh failed`);
    const managerRating = this.ratingEngine.calculateWeightedScore(
      updatedReview.scores,
      'manager',
    );

    const updated = await this.repository.update(id, {
      status: 'Manager Review',
      managerRating,
      managerFeedback,
      promotionRecommended: recommendation.promotion,
      incrementRecommended: recommendation.increment,
      trainingRecommended: recommendation.training,
    });

    await this.logAudit(
      companyId,
      updated.id,
      'Manager Review Submitted',
      null,
      JSON.stringify({ managerRating, managerFeedback, recommendation }),
      auditMeta,
    );

    this.eventEmitter.emit(PERFORMANCE_EVENTS.REVIEW_UPDATED, {
      reviewId: updated.id,
      employeeId: updated.employeeId,
      status: updated.status,
      companyId,
    });

    return updated;
  }

  async overrideHrReview(
    id: string,
    companyId: string | null,
    hrRemarks: string,
    scores: { criterionId: string; score: number; remarks?: string }[],
    auditMeta: {
      userId: string;
      userName: string;
      role: string;
      ip: string;
      userAgent: string;
    },
  ) {
    const review = await this.repository.findById(id, companyId);
    if (!review) throw new NotFoundException(`Review not found`);

    // HR Admin can update at any time except completed/archived
    if (review.status === 'Completed' || review.status === 'Archived') {
      throw new BadRequestException(
        `Cannot override rating of a completed or archived review`,
      );
    }

    // Save HR criterion scores
    for (const item of scores) {
      await this.repository.saveCriterionScore(review.id, item.criterionId, {
        hrScore: item.score,
        remarks: item.remarks,
      });
    }

    // Calculate final rating (weighted average of HR scores, which integrates automatic attendance score)
    const updatedReview = await this.repository.findById(id, companyId);
    if (!updatedReview)
      throw new NotFoundException(`Review score refresh failed`);

    // Find attendance score to populate the attendanceRating field
    const attendanceCrit = updatedReview.scores.find(
      (s) => s.criterion.name === 'Attendance',
    );
    const attendanceRating = attendanceCrit ? attendanceCrit.hrScore : 0.0;

    const finalRating = this.ratingEngine.calculateWeightedScore(
      updatedReview.scores,
      'hr',
    );

    const updated = await this.repository.update(id, {
      status: 'HR Review',
      hrRating: finalRating,
      attendanceRating,
      finalRating,
      hrRemarks,
    });

    await this.logAudit(
      companyId,
      updated.id,
      'HR Rating Override',
      JSON.stringify({ old: review.finalRating }),
      JSON.stringify({ new: finalRating, hrRemarks }),
      auditMeta,
    );

    this.eventEmitter.emit(PERFORMANCE_EVENTS.RATING_UPDATED, {
      reviewId: updated.id,
      employeeId: updated.employeeId,
      finalRating,
      companyId,
    });

    return updated;
  }

  async approveReview(
    id: string,
    companyId: string | null,
    auditMeta: {
      userId: string;
      userName: string;
      role: string;
      ip: string;
      userAgent: string;
    },
  ) {
    const review = await this.repository.findById(id, companyId);
    if (!review) throw new NotFoundException(`Review not found`);

    const updated = await this.repository.update(id, {
      status: 'Approved',
    });

    await this.logAudit(
      companyId,
      id,
      'Review Approved',
      review.status,
      'Approved',
      auditMeta,
    );

    this.eventEmitter.emit(PERFORMANCE_EVENTS.REVIEW_UPDATED, {
      reviewId: id,
      employeeId: updated.employeeId,
      status: 'Approved',
      companyId,
    });

    return updated;
  }

  async completeReview(
    id: string,
    companyId: string | null,
    auditMeta: {
      userId: string;
      userName: string;
      role: string;
      ip: string;
      userAgent: string;
    },
  ) {
    const review = await this.repository.findById(id, companyId);
    if (!review) throw new NotFoundException(`Review not found`);

    if (review.status === 'Completed') {
      return review; // Immutable guard: Completed reviews must never be recalculated
    }

    // Refresh system attendance score before completing if not explicitly customized by HR
    const attendanceCrit = review.scores?.find(
      (s) => s.criterion?.name === 'Attendance',
    );
    if (
      attendanceCrit &&
      attendanceCrit.remarks !== 'HR override score' &&
      review.reviewCycle
    ) {
      const refreshedAttScore =
        await this.attendanceService.calculateAttendanceScore(
          review.employeeId,
          review.reviewCycle.startDate,
          review.reviewCycle.endDate,
          companyId,
        );
      await this.repository.saveCriterionScore(
        review.id,
        attendanceCrit.criterionId,
        {
          hrScore: refreshedAttScore,
          remarks: 'Auto-calculated from attendance records',
        },
      );
      await this.repository.update(id, {
        attendanceRating: refreshedAttScore,
      });
    }

    // Compute final ratings if not already locked
    const updatedReview = await this.repository.findById(id, companyId);
    if (!updatedReview)
      throw new NotFoundException(`Review score refresh failed`);

    // Default final rating to HR weighted score or manager weighted score if HR has not overridden yet
    let finalRating = review.finalRating;
    if (finalRating === 0.0) {
      finalRating = this.ratingEngine.calculateWeightedScore(
        updatedReview.scores,
        'hr',
      );
      if (finalRating === 0.0) {
        finalRating = this.ratingEngine.calculateWeightedScore(
          updatedReview.scores,
          'manager',
        );
      }
    }

    const updated = await this.repository.update(id, {
      status: 'Completed',
      finalRating,
    });

    await this.logAudit(
      companyId,
      id,
      'Review Completed',
      review.status,
      'Completed',
      auditMeta,
    );

    this.eventEmitter.emit(PERFORMANCE_EVENTS.REVIEW_COMPLETED, {
      reviewId: id,
      employeeId: updated.employeeId,
      finalRating: updated.finalRating,
      companyId,
    });

    return updated;
  }

  private async logAudit(
    companyId: string | null,
    reviewId: string,
    action: string,
    oldValue: string | null,
    newValue: string | null,
    meta: {
      userId: string;
      userName: string;
      role: string;
      ip: string;
      userAgent: string;
    },
  ) {
    await this.prisma.performanceAudit.create({
      data: {
        companyId: companyId || 'PLATFORM',
        userId: meta.userId,
        userName: meta.userName,
        userRole: meta.role,
        action,
        details: `Performance Review ID: ${reviewId}`,
        oldValue,
        newValue,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  }

  async findCriteria(companyId?: string | null) {
    return this.repository.findCriteria(companyId);
  }
}
