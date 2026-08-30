import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { Role } from '../../auth/role.enum';
import { DprService } from '../services/dpr.service';
import { CreateDprDto } from '../dto/create-dpr.dto';
import { UpdateDprDto } from '../dto/update-dpr.dto';
import { ReviewDprDto } from '../dto/review-dpr.dto';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { TenantContext } from '../../../common/tenant/tenant-context.util';
import { DPRStatus } from '@prisma/client';

@Controller('dpr')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
export class DprController {
  constructor(private readonly dprService: DprService) {}

  private getRequiredEmployeeId(req: AuthenticatedRequest): string {
    const employeeId = req.user.employee?.id;
    if (!employeeId) {
      throw new ForbiddenException('User must have an associated employee profile.');
    }
    return employeeId;
  }

  // --- Employee Endpoints ---

  @Post('my')
  @RequirePermissions(Permission.DPR_SUBMIT)
  async createMyDpr(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateDprDto,
  ) {
    const companyId = TenantContext.getRequiredTenantScope(req.user).companyId;
    const employeeId = this.getRequiredEmployeeId(req);
    return this.dprService.createMyDpr(companyId, employeeId, dto);
  }

  @Get('my')
  @RequirePermissions(Permission.DPR_VIEW)
  async getMyHistory(@Request() req: AuthenticatedRequest) {
    const companyId = TenantContext.getRequiredTenantScope(req.user).companyId;
    const employeeId = this.getRequiredEmployeeId(req);
    return this.dprService.getMyHistory(companyId, employeeId);
  }

  @Get('my/:id')
  @RequirePermissions(Permission.DPR_VIEW)
  async getMyDprById(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const companyId = TenantContext.getRequiredTenantScope(req.user).companyId;
    const employeeId = this.getRequiredEmployeeId(req);
    return this.dprService.getMyDprById(companyId, employeeId, id);
  }

  @Put('my/:id')
  @RequirePermissions(Permission.DPR_SUBMIT)
  async updateMyDpr(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateDprDto,
  ) {
    const companyId = TenantContext.getRequiredTenantScope(req.user).companyId;
    const employeeId = this.getRequiredEmployeeId(req);
    return this.dprService.updateMyDpr(companyId, employeeId, id, dto);
  }

  @Post('my/:id/submit')
  @RequirePermissions(Permission.DPR_SUBMIT)
  async submitMyDpr(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const companyId = TenantContext.getRequiredTenantScope(req.user).companyId;
    const employeeId = this.getRequiredEmployeeId(req);
    return this.dprService.submitMyDpr(companyId, employeeId, id);
  }

  // --- Manager / HR Review Endpoints ---

  @Get('team')
  @RequirePermissions(Permission.DPR_APPROVE)
  async getTeamReports(
    @Request() req: AuthenticatedRequest,
    @Query('employeeId') employeeId?: string,
    @Query('reportDate') reportDate?: string,
    @Query('status') status?: DPRStatus,
  ) {
    const companyId = TenantContext.getRequiredTenantScope(req.user).companyId;
    const reviewerId = this.getRequiredEmployeeId(req);
    const isHRAdmin =
      req.user.permissions?.includes(Permission.DPR_MANAGE) ||
      req.user.role === Role.SuperAdmin;

    return this.dprService.getTeamReports(companyId, reviewerId, isHRAdmin, {
      employeeId,
      reportDate,
      status,
    });
  }

  @Get('team/:id')
  @RequirePermissions(Permission.DPR_APPROVE)
  async getTeamDprById(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const companyId = TenantContext.getRequiredTenantScope(req.user).companyId;
    const reviewerId = this.getRequiredEmployeeId(req);
    const isHRAdmin =
      req.user.permissions?.includes(Permission.DPR_MANAGE) ||
      req.user.role === Role.SuperAdmin;

    return this.dprService.getTeamDprById(companyId, reviewerId, isHRAdmin, id);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.DPR_APPROVE)
  async approveReport(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ReviewDprDto,
  ) {
    const companyId = TenantContext.getRequiredTenantScope(req.user).companyId;
    const reviewerId = this.getRequiredEmployeeId(req);
    const isHRAdmin =
      req.user.permissions?.includes(Permission.DPR_MANAGE) ||
      req.user.role === Role.SuperAdmin;

    return this.dprService.reviewReport(
      companyId,
      reviewerId,
      isHRAdmin,
      id,
      DPRStatus.APPROVED,
      dto.reviewerRemark,
    );
  }

  @Post(':id/reject')
  @RequirePermissions(Permission.DPR_APPROVE)
  async rejectReport(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ReviewDprDto,
  ) {
    const companyId = TenantContext.getRequiredTenantScope(req.user).companyId;
    const reviewerId = this.getRequiredEmployeeId(req);
    const isHRAdmin =
      req.user.permissions?.includes(Permission.DPR_MANAGE) ||
      req.user.role === Role.SuperAdmin;

    return this.dprService.reviewReport(
      companyId,
      reviewerId,
      isHRAdmin,
      id,
      DPRStatus.REJECTED,
      dto.reviewerRemark,
    );
  }

  @Post(':id/correction-required')
  @RequirePermissions(Permission.DPR_APPROVE)
  async correctionRequiredReport(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ReviewDprDto,
  ) {
    const companyId = TenantContext.getRequiredTenantScope(req.user).companyId;
    const reviewerId = this.getRequiredEmployeeId(req);
    const isHRAdmin =
      req.user.permissions?.includes(Permission.DPR_MANAGE) ||
      req.user.role === Role.SuperAdmin;

    return this.dprService.reviewReport(
      companyId,
      reviewerId,
      isHRAdmin,
      id,
      DPRStatus.CORRECTION_REQUIRED,
      dto.reviewerRemark,
    );
  }
}
