import { Module } from '@nestjs/common';
import { AssetsController } from './controllers/assets.controller';
import { AssetsService } from './services/assets.service';
import { AssetsRepository } from './repositories/assets.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AssetsController],
  providers: [AssetsService, AssetsRepository],
  exports: [AssetsService, AssetsRepository],
})
export class AssetsModule {}

