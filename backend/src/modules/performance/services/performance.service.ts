import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RatingEngineService } from './rating-engine.service';
import { AttendancePerformanceService } from './attendance-performance.service';
import { getBusinessDateString } from '../../../common/utils/date.util';

@Injectable()
export class PerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ratingEngine: RatingEngineService,
    private readonly attendanceService: AttendancePerformanceService,
  ) {}

  async getAppraisals(companyId?: string | null, employeeId?: string) {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (employeeId) {
      where.employeeId = employeeId;
    }
    const list = await this.prisma.performanceReview.findMany({
      where,
      include: {
        employee: true,
        reviewCycle: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return list.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employee?.name || 'Unknown',
      cycle: r.reviewCycle?.name || 'Unknown',
      rating: r.finalRating,
      status: r.status,
      submittedDate: r.updatedAt.toISOString().slice(0, 10),
    }));
  }

  async getGoals(employeeId?: string) {
    const where: any = {};
    if (employeeId) {
      where.employeeId = employeeId;
    }
    const list = await this.prisma.performanceGoal.findMany({
      where,
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((g) => ({
      id: g.id,
      employeeId: g.employeeId,
      title: g.title,
      targetDate: g.targetDate,
      progressPercentage: Math.round(g.progress),
      status: g.status,
    }));
  }

  async getHrDashboardAnalytics(companyId?: string | null) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    const reviews = await this.prisma.performanceReview.findMany({
      where,
      include: { employee: { include: { department: true } } },
    });

    const activeReviews = reviews.filter((r) =>
      ['Self Review', 'Manager Review', 'HR Review', 'Approved'].includes(
        r.status,
      ),
    ).length;
    const pendingReviews = reviews.filter((r) =>
      ['Draft', 'Self Review', 'Manager Review'].includes(r.status),
    ).length;
    const completedReviews = reviews.filter(
      (r) => r.status === 'Completed',
    ).length;

    const completedWithRating = reviews.filter(
      (r) => r.status === 'Completed' && r.finalRating > 0,
    );
    const avgCompanyRating =
      completedWithRating.length > 0
        ? Math.round(
            (completedWithRating.reduce((sum, r) => sum + r.finalRating, 0) /
              completedWithRating.length) *
              10,
          ) / 10
        : 3.5; // default meets expectations fallback

    const completedWithAttendance = reviews.filter(
      (r) => r.attendanceRating > 0,
    );
    const avgAttendanceRating =
      completedWithAttendance.length > 0
        ? Math.round(
            (completedWithAttendance.reduce(
              (sum, r) => sum + r.attendanceRating,
              0,
            ) /
              completedWithAttendance.length) *
              10,
          ) / 10
        : 4.0;

    // Convert rating score to attendance percentage (e.g. 4.0/5.0 -> 80% attendance)
    const avgAttendancePct = Math.round(((avgAttendanceRating - 1) / 4) * 100);

    // Department comparison
    const deptTotals: Record<string, { sum: number; count: number }> = {};
    for (const r of completedWithRating) {
      const deptName = r.employee?.department?.name || 'Other';
      if (!deptTotals[deptName]) {
        deptTotals[deptName] = { sum: 0, count: 0 };
      }
      deptTotals[deptName].sum += r.finalRating;
      deptTotals[deptName].count += 1;
    }

    const departmentComparison = Object.entries(deptTotals)
      .map(([dept, data]) => ({
        department: dept,
        averageRating: Math.round((data.sum / data.count) * 10) / 10,
      }))
      .sort((a, b) => b.averageRating - a.averageRating);

    const topPerformingDepartment =
      departmentComparison[0]?.department || 'N/A';

    const promotionCandidates = reviews.filter(
      (r) => r.promotionRecommended,
    ).length;
    const trainingRecommended = reviews.filter(
      (r) => r.trainingRecommended,
    ).length;

    const improvementEmployees = reviews
      .filter((r) => r.status === 'Completed' && r.finalRating < 2.5)
      .map((r) => ({
        employeeId: r.employeeId,
        name: r.employee?.name || 'Unknown',
        rating: r.finalRating,
      }));

    return {
      activeReviews,
      pendingReviews,
      completedReviews,
      avgCompanyRating,
      avgAttendance: avgAttendancePct || 90, // fallback
      departmentComparison,
      promotionCandidates,
      trainingRecommended,
      topPerformingDepartment,
      employeesRequiringImprovement: improvementEmployees,
    };
  }

  async getManagerDashboardAnalytics(
    companyId?: string | null,
    managerEmployeeId?: string,
  ) {
    // A manager manages employees in their department
    if (!managerEmployeeId) {
      return {
        avgTeamRating: 0.0,
        pendingReviews: 0,
        completedReviews: 0,
        topPerformer: 'N/A',
        lowestPerformer: 'N/A',
        avgAttendance: 0,
        teamGoalCompletion: 0,
        departmentKPIs: [],
      };
    }
    const managerEmp = await this.prisma.employee.findUnique({
      where: { id: managerEmployeeId },
    });
    if (!managerEmp || !managerEmp.departmentId) {
      return {
        avgTeamRating: 0.0,
        pendingReviews: 0,
        completedReviews: 0,
        topPerformer: 'N/A',
        lowestPerformer: 'N/A',
        avgAttendance: 0,
        teamGoalCompletion: 0,
        departmentKPIs: [],
      };
    }

    const empWhere: any = { departmentId: managerEmp.departmentId };
    if (companyId) empWhere.companyId = companyId;

    const team = await this.prisma.employee.findMany({
      where: empWhere,
    });
    const teamIds = team.map((t) => t.id);

    const revWhere: any = { employeeId: { in: teamIds } };
    if (companyId) revWhere.companyId = companyId;

    const reviews = await this.prisma.performanceReview.findMany({
      where: revWhere,
      include: { employee: true },
    });

    const pendingReviews = reviews.filter((r) =>
      ['Draft', 'Self Review'].includes(r.status),
    ).length;
    const completedReviews = reviews.filter(
      (r) => r.status === 'Completed',
    ).length;

    const completedWithRating = reviews.filter(
      (r) => r.status === 'Completed' && r.finalRating > 0,
    );
    const avgTeamRating =
      completedWithRating.length > 0
        ? Math.round(
            (completedWithRating.reduce((sum, r) => sum + r.finalRating, 0) /
              completedWithRating.length) *
              10,
          ) / 10
        : 3.5;

    const sortedPerformers = [...completedWithRating].sort(
      (a, b) => b.finalRating - a.finalRating,
    );
    const topPerformer = sortedPerformers[0]?.employee?.name || 'N/A';
    const lowestPerformer =
      sortedPerformers[sortedPerformers.length - 1]?.employee?.name || 'N/A';

    const completedWithAttendance = reviews.filter(
      (r) => r.attendanceRating > 0,
    );
    const avgAttendanceRating =
      completedWithAttendance.length > 0
        ? Math.round(
            (completedWithAttendance.reduce(
              (sum, r) => sum + r.attendanceRating,
              0,
            ) /
              completedWithAttendance.length) *
              10,
          ) / 10
        : 4.0;
    const avgAttendancePct = Math.round(((avgAttendanceRating - 1) / 4) * 100);

    // Goal completions
    const goalWhere: any = { employeeId: { in: teamIds } };
    if (companyId) goalWhere.companyId = companyId;

    const goals = await this.prisma.performanceGoal.findMany({
      where: goalWhere,
    });
    const completedGoals = goals.filter((g) => g.status === 'Completed').length;
    const teamGoalCompletion =
      goals.length > 0 ? Math.round((completedGoals / goals.length) * 100) : 0;

    return {
      avgTeamRating,
      pendingReviews,
      completedReviews,
      topPerformer,
      lowestPerformer,
      avgAttendance: avgAttendancePct || 90,
      teamGoalCompletion,
    };
  }

  async getEmployeeDashboardAnalytics(companyId?: string | null, employeeId?: string) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (employeeId) where.employeeId = employeeId;

    const reviews = await this.prisma.performanceReview.findMany({
      where,
      include: { reviewCycle: true },
      orderBy: { updatedAt: 'desc' },
    });

    const latestReview = reviews[0];
    const overallRating = latestReview?.finalRating || 0.0;
    const currentReviewStatus = latestReview?.status || 'No Active Review';
    const managerFeedback = latestReview?.managerFeedback || 'No feedback yet';

    // Find upcoming active cycle deadline
    const cycleWhere: any = { status: 'Active' };
    if (companyId) cycleWhere.companyId = companyId;
    const activeCycles = await this.prisma.reviewCycle.findMany({
      where: cycleWhere,
      orderBy: { deadline: 'asc' },
    });
    const upcomingReview = activeCycles[0]?.deadline || 'None scheduled';

    let attendancePct = 100;
    if (employeeId) {
      // Calculate attendance score
      const today = getBusinessDateString();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

      const attRating = await this.attendanceService.calculateAttendanceScore(
        employeeId,
        thirtyDaysAgoStr,
        today,
        companyId,
      );
      attendancePct = Math.round(((attRating - 1) / 4) * 100);
    }

    // Goal progress
    const goalWhere: any = {};
    if (companyId) goalWhere.companyId = companyId;
    if (employeeId) goalWhere.employeeId = employeeId;
    const goals = await this.prisma.performanceGoal.findMany({
      where: goalWhere,
    });
    const avgGoalProgress =
      goals.length > 0
        ? Math.round(
            goals.reduce((sum, g) => sum + g.progress, 0) / goals.length,
          )
        : 0;

    // Performance trend timeline
    const completedWithRating = reviews
      .filter((r) => r.status === 'Completed')
      .reverse();
    const performanceTrend = completedWithRating.map((r) => ({
      cycle: r.reviewCycle?.name || 'Cycle',
      rating: r.finalRating,
    }));

    return {
      overallRating,
      attendanceScore: attendancePct || 100,
      goalProgress: avgGoalProgress,
      currentReviewStatus,
      managerFeedback,
      upcomingReview,
      performanceTrend,
    };
  }
}
