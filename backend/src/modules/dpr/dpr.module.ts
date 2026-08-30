import { Module } from '@nestjs/common';
import { DprController } from './controllers/dpr.controller';
import { DprService } from './services/dpr.service';
import { DprRepository } from './repositories/dpr.repository';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DprController],
  providers: [DprService, DprRepository],
  exports: [DprService, DprRepository],
})
export class DprModule {}
