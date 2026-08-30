import { Module } from '@nestjs/common';
import { PerformanceController } from './controllers/performance.controller';
import { PerformanceService } from './services/performance.service';
import { ReviewCycleService } from './services/review-cycle.service';
import { PerformanceReviewService } from './services/performance-review.service';
import { KpiService } from './services/kpi.service';
import { GoalService } from './services/goal.service';
import { RatingEngineService } from './services/rating-engine.service';
import { AttendancePerformanceService } from './services/attendance-performance.service';

import { PerformanceRepository } from './repositories/performance.repository';
import { ReviewCycleRepository } from './repositories/review-cycle.repository';
import { PerformanceReviewRepository } from './repositories/performance-review.repository';
import { KpiRepository } from './repositories/kpi.repository';
import { GoalRepository } from './repositories/goal.repository';

import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PerformanceController],
  providers: [
    PerformanceService,
    ReviewCycleService,
    PerformanceReviewService,
    KpiService,
    GoalService,
    RatingEngineService,
    AttendancePerformanceService,
    PerformanceRepository,
    ReviewCycleRepository,
    PerformanceReviewRepository,
    KpiRepository,
    GoalRepository,
  ],
  exports: [
    PerformanceService,
    ReviewCycleService,
    PerformanceReviewService,
    KpiService,
    GoalService,
    RatingEngineService,
    AttendancePerformanceService,
    PerformanceRepository,
    ReviewCycleRepository,
    PerformanceReviewRepository,
    KpiRepository,
    GoalRepository,
  ],
})
export class PerformanceModule {}
