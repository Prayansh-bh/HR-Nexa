import { Module } from '@nestjs/common';
import { PlansController } from './controllers/plans.controller';
import { PublicPlansController } from './controllers/public-plans.controller';
import { TenantFeatureOverridesController } from './controllers/tenant-feature-overrides.controller';
import { PlansService } from './services/plans.service';
import { PlansRepository } from './repositories/plans.repository';
import { EffectiveFeatureService } from './services/effective-feature.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    PlansController,
    PublicPlansController,
    TenantFeatureOverridesController,
  ],
  providers: [PlansService, PlansRepository, EffectiveFeatureService],
  exports: [PlansService, PlansRepository, EffectiveFeatureService],
})
export class PlansModule {}
