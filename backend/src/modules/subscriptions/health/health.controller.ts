import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { EmployeeCountHealthIndicator } from './employee-count.health';
import { EmployeeCountSyncService } from '../services/employee-count-sync.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly employeeCountIndicator: EmployeeCountHealthIndicator,
    private readonly employeeCountSyncService: EmployeeCountSyncService,
  ) {}

  @Get('employee-count-sync')
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.employeeCountIndicator.isHealthy('employeeCountSync'),
    ]);
  }

  @Get('employee-count-sync/metrics')
  getMetrics() {
    return this.employeeCountSyncService.getMetrics();
  }
}
