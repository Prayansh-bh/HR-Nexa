import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { ExitService } from '../services/exit.service';
import { ExitRepository } from '../repositories/exit.repository';
import { ExitChecklistService } from '../checklist/exit-checklist.service';
import { ExitInterviewService } from '../interview/exit-interview.service';
import { ExitSettlementService } from '../settlement/exit-settlement.service';
import { SubmitResignationDto, ApproveExitDto } from '../dto/exit.dto';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { Roles } from '../../auth/roles.decorator';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { Role } from '../../auth/role.enum';
import { TenantId } from '../../../common/tenant/tenant-id.decorator';

@Controller('exit')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
export class ExitController {
  constructor(
    private readonly exitService: ExitService,
    private readonly exitRepository: ExitRepository,
    private readonly checklistService: ExitChecklistService,
    private readonly interviewService: ExitInterviewService,
    private readonly settlementService: ExitSettlementService,
  ) {}

  @Post()
  @RequirePermissions(Permission.EXIT_SUBMIT)
  async submitResignation(
    @Request() req: any,
    @TenantId() tenantId: string,
    @Body() dto: SubmitResignationDto,
  ) {
    const user = req.user;
    const employeeId = user.employee?.id || user.employeeId;
    if (!employeeId) {
      throw new ForbiddenException(
        'Only users with a linked employee profile can submit a resignation.',
      );
    }
    return this.exitService.submitResignation(
      employeeId,
      tenantId,
      dto,
    );
  }

  @Get()
  @RequirePermissions(Permission.EXIT_VIEW)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getExits(
    @Request() req: any,
    @TenantId() tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;

    const user = req.user;
    const isCompanyAdmin =
      user.role === Role.HRAdmin ||
      user.role === Role.CompanyOwner ||
      user.role === Role.SuperAdmin ||
      user.permissions?.includes(Permission.EXIT_APPROVE) ||
      user.permissions?.includes(Permission.EXIT_MANAGE);

    const filters: any =
      !isCompanyAdmin && user.employee?.id
        ? { employeeId: user.employee.id, page: parsedPage, limit: parsedLimit }
        : { page: parsedPage, limit: parsedLimit };

    return this.exitRepository.findAll(tenantId, filters);
  }

  @Get(':id')
  @RequirePermissions(Permission.EXIT_VIEW)
  async getExitDetails(
    @Param('id') id: string,
    @Request() req: any,
    @TenantId() tenantId: string,
  ) {
    const exit = await this.exitRepository.findById(id, tenantId);
    if (!exit) {
      throw new NotFoundException(`Exit record with ID "${id}" not found`);
    }

    const user = req.user;
    const isCompanyAdmin =
      user.role === Role.HRAdmin ||
      user.role === Role.CompanyOwner ||
      user.role === Role.SuperAdmin ||
      user.permissions?.includes(Permission.EXIT_APPROVE) ||
      user.permissions?.includes(Permission.EXIT_MANAGE);

    // Role-based ownership check for 404 anti-enumeration
    if (!isCompanyAdmin && exit.employeeId !== user.employee?.id) {
      throw new NotFoundException(`Exit record with ID "${id}" not found`);
    }

    return exit;
  }

  @Patch(':id/manager-approve')
  @RequirePermissions(Permission.EXIT_APPROVE)
  async managerApprove(
    @Param('id') id: string,
    @Request() req: any,
    @TenantId() tenantId: string,
    @Body() dto: ApproveExitDto,
  ) {
    return this.exitService.managerApprove(
      id,
      req.user.id,
      tenantId,
      dto,
      req.user.employee?.id,
    );
  }

  @Patch(':id/hr-approve')
  @RequirePermissions(Permission.EXIT_APPROVE)
  async hrApprove(
    @Param('id') id: string,
    @Request() req: any,
    @TenantId() tenantId: string,
    @Body() dto: ApproveExitDto,
  ) {
    return this.exitService.hrApprove(
      id,
      req.user.id,
      tenantId,
      dto,
      req.user.employee?.id,
    );
  }

  @Patch(':id/checklist')
  @RequirePermissions(Permission.EXIT_MANAGE)
  async advanceToChecklist(
    @Param('id') id: string,
    @Request() req: any,
    @TenantId() tenantId: string,
  ) {
    return this.exitService.advanceToChecklist(
      id,
      req.user.id,
      tenantId,
    );
  }

  @Post(':id/settlement')
  @RequirePermissions(Permission.EXIT_SETTLE)
  async generateSettlement(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.settlementService.generateSettlement(id, tenantId);
  }

}
