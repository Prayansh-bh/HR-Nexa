import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/role.enum';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { TicketsService } from '../../tickets/services/tickets.service';
import { SystemService } from '../../system/services/system.service';

@ApiTags('Super Admin Dashboard')
@ApiBearerAuth()
@Controller('super-admin/dashboard-stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SuperAdmin)
export class SuperAdminDashboardController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly ticketsService: TicketsService,
    private readonly systemService: SystemService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get aggregated platform metrics for Super Admin dashboard' })
  async getDashboardSummary() {
    const [subStats, ticketStats, systemMetrics] = await Promise.all([
      this.subscriptionsService.getEnrichedStats(),
      this.ticketsService.getTicketStats(),
      this.systemService.getSystemMetrics(),
    ]);

    return {
      subscriptions: {
        mrr: subStats.mrr,
        arr: subStats.arr,
        totalRevenue: subStats.totalRevenue,
        monthlyRevenue: subStats.monthlyRevenue,
        annualRevenue: subStats.annualRevenue,
        renewalRate: subStats.renewalRate,
        churnRate: subStats.churnRate,
      },
      companies: {
        total: subStats.totalCompanies,
        active: subStats.activeSubscriptions,
        trial: subStats.trialCompanies,
        expired: subStats.expired,
        suspended: subStats.suspended,
        cancelled: subStats.cancelled,
      },
      support: {
        openTickets: ticketStats.openTickets,
        criticalTickets: ticketStats.criticalTickets,
      },
      system: {
        serverHealth: systemMetrics.serverHealth,
        serverUptime: systemMetrics.serverUptime,
        cpuUsage: systemMetrics.cpuUsage,
        ramUsage: systemMetrics.ramUsage,
        storageUsed: systemMetrics.storageUsed,
      },
    };
  }
}
