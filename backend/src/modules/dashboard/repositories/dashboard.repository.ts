import { Injectable } from '@nestjs/common';
import { ReportsRepository } from '../../reports/repositories/reports.repository';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';

@Injectable()
export class DashboardRepository {
  constructor(private readonly reportsRepository: ReportsRepository) {}

  async getMetrics(scope?: TenantScope) {
    const effectiveScope: TenantScope = scope || {
      companyId: 'PLATFORM',
      isSuperAdmin: true,
      isPlatformBypass: true,
    };
    const stats = await this.reportsRepository.getAdminStats(effectiveScope);

    return {
      totalEmployees: stats.employees.active,
      presentToday: stats.attendance.presentToday,
      onLeaveToday: stats.employees.onLeave,
      pendingLeaves: stats.leaves.pending,
      monthlyPayrollTotal: stats.payroll.totalSpend,
      departmentCount: stats.departments.length,
    };
  }
}
