import { Injectable } from '@nestjs/common';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getDashboardAnalytics(scope?: TenantScope) {
    return this.dashboardRepository.getMetrics(scope);
  }
}
