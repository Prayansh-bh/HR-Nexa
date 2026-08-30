import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { TrialRequestsController } from './controllers/trial-requests.controller';
import { TrialRequestsService } from './services/trial-requests.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [TrialRequestsController],
  providers: [TrialRequestsService],
  exports: [TrialRequestsService],
})
export class TrialRequestsModule {}
