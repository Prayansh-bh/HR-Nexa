import { Injectable } from '@nestjs/common';
import { ReportsRepository } from '../repositories/reports.repository';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';

@Injectable()
export class ReportsService {
  constructor(private reportsRepository: ReportsRepository) {}

  async getAdminStats(scope: TenantScope) {
    return this.reportsRepository.getAdminStats(scope);
  }
}
