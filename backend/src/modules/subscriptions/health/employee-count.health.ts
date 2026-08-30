import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { EmployeeCountSyncService } from '../services/employee-count-sync.service';

@Injectable()
export class EmployeeCountHealthIndicator extends HealthIndicator {
  constructor(
    private readonly employeeCountSyncService: EmployeeCountSyncService,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const metrics = this.employeeCountSyncService.getMetrics();

    // The service is considered healthy if the last repair run succeeded
    const isHealthy = metrics.lastRepairSucceeded;

    const result = this.getStatus(key, isHealthy, {
      status: isHealthy ? 'up' : 'down',
      lastSuccessfulSync: metrics.lastSuccessfulSync,
      lastRepairSucceeded: metrics.lastRepairSucceeded,
      staleCompanies: metrics.staleCompaniesFound,
    });

    if (isHealthy) {
      return result;
    }

    throw new HealthCheckError(
      'Employee count synchronization service is unhealthy',
      result,
    );
  }
}
