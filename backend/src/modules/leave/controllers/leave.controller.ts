import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LeaveService } from '../services/leave.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { TenantContext } from '../../../common/tenant/tenant-context.util';

@ApiTags('Leave')
@Controller('leaves')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class LeaveController {
  constructor(private readonly leavesService: LeaveService) {}

  @Post()
  @RequirePermissions(Permission.LEAVES_REQUESTS_CREATE)
  @ApiOperation({ summary: 'Apply for leave' })
  async applyLeave(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: {
      type: string;
      startDate: string;
      endDate: string;
      reason: string;
    },
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.leavesService.applyLeave(req.user, body, scope);
  }

  @Get()
  @RequirePermissions(Permission.LEAVES_VIEW)
  @ApiOperation({ summary: 'Get all leaves (filtered by role)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'employeeId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getLeaves(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
    @Query('search') search?: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user, true);
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.leavesService.getLeaves(req.user, scope, {
      page: parsedPage || 1,
      limit: parsedLimit || 50,
      status,
      employeeId,
      search,
    });
  }

  @Get('quota/:employeeId')
  @RequirePermissions(Permission.LEAVES_VIEW)
  @ApiOperation({ summary: 'Get employee leave balance / quota' })
  async getQuotas(
    @Param('employeeId') employeeId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    const scope = TenantContext.getRequiredTenantScope(user);
    
    if (
      user.role === 'Employee' &&
      user.employee?.id !== employeeId
    ) {
      throw new ForbiddenException(
        'You can only access your own leave quota',
      );
    }
    return this.leavesService.getQuotas(scope, employeeId);
  }

  @Put(':id/status')
  @RequirePermissions(Permission.LEAVES_REQUESTS_APPROVE)
  @ApiOperation({ summary: 'Update leave request status (Approve/Reject)' })
  async updateLeaveStatus(
    @Param('id') id: string,
    @Body() body: { status: 'Approved' | 'Rejected'; note?: string },
    @Request() req: AuthenticatedRequest,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.leavesService.updateLeaveStatus(
      id,
      body.status,
      req.user,
      scope,
      body.note,
    );
  }

  // ── Leave Types / Policies ──────────────────────────────────────────────
  @Get('types')
  @RequirePermissions(Permission.LEAVES_VIEW)
  @ApiOperation({ summary: 'Get configured leave types for authenticated tenant' })
  async getLeaveTypes(@Request() req: AuthenticatedRequest) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.leavesService.getLeaveTypes(scope);
  }

  @Post('types')
  @RequirePermissions(Permission.LEAVES_POLICY_MANAGE)
  @ApiOperation({ summary: 'Create a new leave policy' })
  async createLeaveType(
    @Request() req: AuthenticatedRequest,
    @Body() body: any,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.leavesService.createLeaveType(scope, req.user, body);
  }

  @Put('types/:id')
  @RequirePermissions(Permission.LEAVES_POLICY_MANAGE)
  @ApiOperation({ summary: 'Update an existing leave policy' })
  async updateLeaveType(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.leavesService.updateLeaveType(id, scope, req.user, body);
  }

  @Delete('types/:id')
  @RequirePermissions(Permission.LEAVES_POLICY_MANAGE)
  @ApiOperation({ summary: 'Delete a leave policy' })
  async deleteLeaveType(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.leavesService.deleteLeaveType(id, scope, req.user);
  }

  // ── Calendar Events ─────────────────────────────────────────────────────
  @Get('events')
  @RequirePermissions(Permission.LEAVES_VIEW)
  async getEvents(@Request() req: AuthenticatedRequest) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.leavesService.getEvents(scope);
  }

  @Post('events')
  @RequirePermissions(Permission.LEAVES_REQUESTS_CREATE)
  async createEvent(
    @Body() body: { title: string; date: string; type: string },
    @Request() req: AuthenticatedRequest,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.leavesService.createEvent({
      ...body,
      companyId: scope.companyId,
    });
  }

  @Delete('events/:id')
  @RequirePermissions(Permission.LEAVES_REQUESTS_DELETE)
  @ApiOperation({ summary: 'Delete a calendar event' })
  async deleteEvent(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.leavesService.deleteEvent(id, scope);
  }
}
