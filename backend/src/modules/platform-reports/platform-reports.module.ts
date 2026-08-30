import { Module } from '@nestjs/common';
import { PlatformReportsController } from './controllers/platform-reports.controller';
import { PlatformReportsService } from './services/platform-reports.service';
import { PlatformReportsRepository } from './repositories/platform-reports.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { SystemModule } from '../system/system.module';

@Module({
  imports: [PrismaModule, SystemModule],
  controllers: [PlatformReportsController],
  providers: [PlatformReportsService, PlatformReportsRepository],
  exports: [PlatformReportsService, PlatformReportsRepository],
})
export class PlatformReportsModule {}
