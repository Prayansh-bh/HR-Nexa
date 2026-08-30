import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';
import { getBusinessDateString } from '../../../common/utils/date.util';

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminStats(scope: TenantScope) {
    const isPlatform = scope.isPlatformBypass;

    const empFilter = isPlatform ? {} : { companyId: scope.companyId };
    const deptFilter = isPlatform ? {} : { companyId: scope.companyId };
    const leaveFilter = isPlatform ? {} : { employee: { companyId: scope.companyId } };
    const attendanceFilter = isPlatform ? {} : { employee: { companyId: scope.companyId } };
    const payrollFilter = isPlatform ? {} : { employee: { companyId: scope.companyId } };
    const logFilter = isPlatform ? {} : { companyId: scope.companyId };

    const employeesCount = await this.prisma.employee.count({
      where: empFilter,
    });
    const activeEmployees = await this.prisma.employee.count({
      where: { ...empFilter, status: 'Active' },
    });
    const onLeaveEmployees = await this.prisma.employee.count({
      where: { ...empFilter, status: 'On Leave' },
    });
    const inactiveEmployees = await this.prisma.employee.count({
      where: { ...empFilter, status: 'Inactive' },
    });

    const depts = await this.prisma.department.findMany({
      where: deptFilter,
    });
    const deptBreakdown = await Promise.all(
      depts.map(async (d) => {
        const count = await this.prisma.employee.count({
          where: { ...empFilter, departmentId: d.name },
        });
        return { name: d.name, count };
      }),
    );

    const totalLeavesPending = await this.prisma.leaveRequest.count({
      where: { ...leaveFilter, status: 'PENDING' },
    });
    const totalLeavesApproved = await this.prisma.leaveRequest.count({
      where: { ...leaveFilter, status: 'APPROVED' },
    });

    const todayStr = getBusinessDateString();
    const presentToday = await this.prisma.attendance.count({
      where: { ...attendanceFilter, date: todayStr, status: 'Present' },
    });
    const lateToday = await this.prisma.attendance.count({
      where: { ...attendanceFilter, date: todayStr, status: 'Late' },
    });

    const payrolls = await this.prisma.payroll.findMany({
      where: payrollFilter,
    });
    const totalPaidSalary = payrolls.reduce((sum, p) => sum + p.netSalary, 0);

    const recentAuditLogs = await this.prisma.auditLog.findMany({
      where: logFilter,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      employees: {
        total: employeesCount,
        active: activeEmployees,
        onLeave: onLeaveEmployees,
        inactive: inactiveEmployees,
      },
      departments: deptBreakdown,
      leaves: {
        pending: totalLeavesPending,
        approved: totalLeavesApproved,
      },
      attendance: {
        presentToday,
        lateToday,
        date: todayStr,
      },
      payroll: {
        totalSpend: totalPaidSalary,
        recordCount: payrolls.length,
      },
      recentLogs: recentAuditLogs,
    };
  }
}
