import { Module } from '@nestjs/common';
import { ExitController } from './controllers/exit.controller';
import { ExitService } from './services/exit.service';
import { ExitRepository } from './repositories/exit.repository';
import { ExitSettlementService } from './settlement/exit-settlement.service';
import { ExitChecklistService } from './checklist/exit-checklist.service';
import { ExitTimelineService } from './timeline/exit-timeline.service';
import { ExitInterviewService } from './interview/exit-interview.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [PrismaModule, SubscriptionsModule],
  controllers: [ExitController],
  providers: [
    ExitService,
    ExitRepository,
    ExitSettlementService,
    ExitChecklistService,
    ExitTimelineService,
    ExitInterviewService,
  ],
  exports: [ExitService, ExitSettlementService],
})
export class ExitModule {}
