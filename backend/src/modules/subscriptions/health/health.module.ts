import { Module, forwardRef } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { EmployeeCountHealthIndicator } from './employee-count.health';
import { SubscriptionsModule } from '../subscriptions.module';

@Module({
  imports: [TerminusModule, forwardRef(() => SubscriptionsModule)],
  controllers: [HealthController],
  providers: [EmployeeCountHealthIndicator],
  exports: [EmployeeCountHealthIndicator],
})
export class HealthModule {}
