import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReportsService } from '../services/reports.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { Roles } from '../../auth/roles.decorator';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { Role } from '../../auth/role.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { TenantContext } from '../../../common/tenant/tenant-context.util';

@ApiTags('Reports & Analytics')
@Controller('reports')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @RequirePermissions(Permission.REPORTS_PAYROLL_VIEW, Permission.REPORTS_ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'Get aggregated HRMS metrics for admin dashboard' })
  @ApiResponse({ status: 200, description: 'Analytics loaded successfully' })
  async getStats(@Request() req: AuthenticatedRequest) {
    const user = req.user;
    const scope = TenantContext.getRequiredTenantScope(user);
    return this.reportsService.getAdminStats(scope);
  }
}
