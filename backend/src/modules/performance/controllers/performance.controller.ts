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
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Roles } from '../../auth/roles.decorator';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Role } from '../../auth/role.enum';
import { Permission } from '../../auth/permissions.enum';
import { PerformanceService } from '../services/performance.service';
import { ReviewCycleService } from '../services/review-cycle.service';
import { PerformanceReviewService } from '../services/performance-review.service';
import { KpiService } from '../services/kpi.service';
import { GoalService } from '../services/goal.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

import { CreateReviewCycleDto } from '../dto/create-review-cycle.dto';
import { UpdateReviewCycleDto } from '../dto/update-review-cycle.dto';
import { SubmitSelfReviewDto } from '../dto/submit-self-review.dto';
import { SubmitManagerReviewDto } from '../dto/submit-manager-review.dto';
import { OverrideHrReviewDto } from '../dto/override-hr-review.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { createPaginatedResponse } from '../../../common/dto/paginated-response.dto';

@Controller('performance')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PerformanceController {
  constructor(
    private readonly performanceService: PerformanceService,
    private readonly reviewCycleService: ReviewCycleService,
    private readonly reviewService: PerformanceReviewService,
    private readonly kpiService: KpiService,
    private readonly goalService: GoalService,
    private readonly prisma: PrismaService,
  ) {}

  private getTenantId(req: AuthenticatedRequest): string | null {
    if (req.user.role === Role.SuperAdmin) return null;
    if (!req.user.companyId) {
      throw new ForbiddenException(
        'Authenticated user has no valid company tenant context.',
      );
    }
    return req.user.companyId;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Review Cycles (HR Admin / SuperAdmin only)
  // ───────────────────────────────────────────────────────────────────────
  @Get('cycles')
  @RequirePermissions(Permission.PERFORMANCE_REVIEWS_VIEW)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getCycles(
    @Request() req: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const companyId = this.getTenantId(req);
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.reviewCycleService.findAll(companyId, status, {
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Post('cycles')
  @RequirePermissions(Permission.PERFORMANCE_CYCLES_MANAGE)
  async createCycle(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateReviewCycleDto,
  ) {
    let companyId = this.getTenantId(req);
    if (req.user.role === Role.SuperAdmin) {
      companyId =
        dto.companyId ||
        (req.user.companyId && req.user.companyId !== 'PLATFORM'
          ? req.user.companyId
          : null);
      if (!companyId) {
        throw new ForbiddenException(
          'SuperAdmin must specify a target companyId to create a performance cycle.',
        );
      }
    }

    let companyName = (req.user as any).subscription?.company || 'Company';
    if (companyId) {
      const targetCompany = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });
      if (targetCompany?.name) {
        companyName = targetCompany.name;
      } else if (req.user.role === Role.SuperAdmin) {
        throw new NotFoundException(
          `Target company with ID "${companyId}" does not exist.`,
        );
      }
    }

    return this.reviewCycleService.create(
      companyId!,
      companyName,
      dto,
      req.user.id,
    );
  }

  @Put('cycles/:id')
  @RequirePermissions(Permission.PERFORMANCE_CYCLES_MANAGE)
  async updateCycle(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateReviewCycleDto,
  ) {
    const companyId = this.getTenantId(req);
    return this.reviewCycleService.update(id, companyId, dto, req.user.id);
  }

  @Delete('cycles/:id')
  @RequirePermissions(Permission.PERFORMANCE_CYCLES_MANAGE)
  async deleteCycle(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const companyId = this.getTenantId(req);
    return this.reviewCycleService.delete(id, companyId);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Performance Reviews
  // ───────────────────────────────────────────────────────────────────────
  @Get('reviews')
  @RequirePermissions(Permission.PERFORMANCE_REVIEWS_VIEW)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getReviews(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('employeeId') employeeId?: string,
    @Query('managerId') managerId?: string,
    @Query('reviewCycleId') reviewCycleId?: string,
    @Query('status') status?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const companyId = this.getTenantId(req);

    // Role-based restrictions:
    // Employees can only fetch their own reviews
    if (req.user.role === Role.Employee) {
      const empId = req.user.employee?.id;
      if (!empId) return createPaginatedResponse([], 0, parsedPage || 1, parsedLimit || 50);
      return this.reviewService.findReviews(companyId, {
        employeeId: empId,
        reviewCycleId,
        status,
        page: parsedPage,
        limit: parsedLimit,
      });
    }

    // Managers:
    // 1. My Reviews (employeeId specified and matches manager's own employee ID) -> fetch own reviews
    // 2. Team Reviews (employeeId not matching own ID or omitted) -> fetch team reviews where user is manager
    if (req.user.role === Role.Manager) {
      const mgrId = req.user.employee?.id;
      if (!mgrId) return createPaginatedResponse([], 0, parsedPage || 1, parsedLimit || 50);

      if (employeeId && employeeId === mgrId) {
        return this.reviewService.findReviews(companyId, {
          employeeId: mgrId,
          reviewCycleId,
          status,
          page: parsedPage,
          limit: parsedLimit,
        });
      }

      return this.reviewService.findReviews(companyId, {
        managerId: mgrId,
        employeeId,
        reviewCycleId,
        status,
        page: parsedPage,
        limit: parsedLimit,
      });
    }

    // Non-admin / non-manager roles without PERFORMANCE_CYCLES_MANAGE permission
    // must be restricted to their own reviews if they have a linked employee record
    const canManageAll =
      req.user.role === Role.SuperAdmin ||
      req.user.role === Role.HRAdmin ||
      req.user.permissions?.includes(Permission.PERFORMANCE_CYCLES_MANAGE);

    if (!canManageAll) {
      const empId = req.user.employee?.id;
      if (!empId) return createPaginatedResponse([], 0, parsedPage || 1, parsedLimit || 50);
      return this.reviewService.findReviews(companyId, {
        employeeId: empId,
        reviewCycleId,
        status,
        page: parsedPage,
        limit: parsedLimit,
      });
    }

    return this.reviewService.findReviews(companyId, {
      employeeId,
      managerId,
      reviewCycleId,
      status,
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Get('reviews/:id')
  @RequirePermissions(Permission.PERFORMANCE_REVIEWS_VIEW)
  async getReviewById(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const companyId = this.getTenantId(req);
    const review = await this.reviewService.findReviewById(id, companyId);

    // Enforce scoping rules using 404 anti-enumeration policy
    const isHrOrSuperAdmin =
      req.user.role === Role.SuperAdmin ||
      req.user.role === Role.HRAdmin ||
      req.user.permissions?.includes(Permission.PERFORMANCE_CYCLES_MANAGE);

    if (!isHrOrSuperAdmin) {
      const userEmpId = req.user.employee?.id;
      if (req.user.role === Role.Manager) {
        const isOwnReview = review.employeeId === userEmpId;
        const isTeamReview = review.managerId === userEmpId;
        if (!isOwnReview && !isTeamReview) {
          throw new NotFoundException(`Performance review with ID "${id}" not found`);
        }
      } else {
        if (!userEmpId || review.employeeId !== userEmpId) {
          throw new NotFoundException(`Performance review with ID "${id}" not found`);
        }
      }
    }

    return review;
  }

  @Post('reviews/cycle/:cycleId')
  @RequirePermissions(Permission.PERFORMANCE_CYCLES_MANAGE)
  async provisionReviewsForCycle(
    @Request() req: AuthenticatedRequest,
    @Param('cycleId') cycleId: string,
  ) {
    const companyId = this.getTenantId(req) || 'default';
    const companyName = (req.user as any).subscription?.company || 'Company';
    const auditMeta = {
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Browser',
    };
    return this.reviewService.createReviewsForCycle(
      companyId,
      companyName,
      cycleId,
      req.user.id,
      auditMeta,
    );
  }

  @Post('reviews/:id/self')
  @RequirePermissions(Permission.PERFORMANCE_REVIEWS_VIEW)
  async submitSelfReview(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SubmitSelfReviewDto,
  ) {
    const companyId = this.getTenantId(req);
    const employeeId = req.user.employee?.id;
    if (!employeeId)
      throw new ForbiddenException('No linked employee record found');

    const auditMeta = {
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Browser',
    };

    return this.reviewService.submitSelfReview(
      id,
      companyId,
      employeeId,
      dto.feedback || '',
      dto.scores || [],
      auditMeta,
    );
  }

  @Post('reviews/:id/manager')
  @RequirePermissions(Permission.PERFORMANCE_REVIEWS_VIEW)
  async submitManagerReview(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SubmitManagerReviewDto,
  ) {
    const companyId = this.getTenantId(req);
    const managerId = req.user.employee?.id;
    if (!managerId)
      throw new ForbiddenException('No linked employee record found');

    const auditMeta = {
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Browser',
    };

    return this.reviewService.submitManagerReview(
      id,
      companyId,
      managerId,
      dto.feedback || '',
      {
        promotion: Boolean(dto.promotion),
        increment: Boolean(dto.increment),
        training: Boolean(dto.training),
      },
      dto.scores || [],
      auditMeta,
    );
  }

  @Post('reviews/:id/override')
  @RequirePermissions(Permission.PERFORMANCE_CYCLES_MANAGE)
  async overrideHrReview(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: OverrideHrReviewDto,
  ) {
    const companyId = this.getTenantId(req);
    const auditMeta = {
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Browser',
    };

    return this.reviewService.overrideHrReview(
      id,
      companyId,
      dto.remarks || '',
      dto.scores || [],
      auditMeta,
    );
  }

  @Post('reviews/:id/approve')
  @RequirePermissions(Permission.PERFORMANCE_CYCLES_MANAGE)
  async approveReview(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const companyId = this.getTenantId(req);
    const auditMeta = {
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Browser',
    };
    return this.reviewService.approveReview(id, companyId, auditMeta);
  }

  @Post('reviews/:id/complete')
  @RequirePermissions(Permission.PERFORMANCE_CYCLES_MANAGE)
  async completeReview(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const companyId = this.getTenantId(req);
    const auditMeta = {
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Browser',
    };
    return this.reviewService.completeReview(id, companyId, auditMeta);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Customizable Criteria
  // ───────────────────────────────────────────────────────────────────────
  @Get('criteria')
  @RequirePermissions(Permission.PERFORMANCE_REVIEWS_VIEW)
  async getCriteria(@Request() req: AuthenticatedRequest) {
    const companyId = this.getTenantId(req);
    return this.reviewService.findCriteria(companyId);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Configurable KPIs
  // ───────────────────────────────────────────────────────────────────────
  @Get('kpis')
  @RequirePermissions(Permission.PERFORMANCE_REVIEWS_VIEW)
  async getKPIs(
    @Request() req: AuthenticatedRequest,
    @Query('department') department?: string,
  ) {
    const companyId = this.getTenantId(req);
    return this.kpiService.findAll(companyId, department);
  }

  @Post('kpis')
  @RequirePermissions(Permission.PERFORMANCE_CYCLES_MANAGE)
  async createKPI(@Request() req: AuthenticatedRequest, @Body() body: any) {
    const companyId = this.getTenantId(req) || 'default';
    const companyName = (req.user as any).subscription?.company || 'Company';
    return this.kpiService.create(companyId, companyName, body);
  }

  @Put('kpis/:id')
  @RequirePermissions(Permission.PERFORMANCE_CYCLES_MANAGE)
  async updateKPI(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const companyId = this.getTenantId(req);
    return this.kpiService.update(id, companyId, body);
  }

  @Delete('kpis/:id')
  @RequirePermissions(Permission.PERFORMANCE_CYCLES_MANAGE)
  async deleteKPI(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const companyId = this.getTenantId(req);
    return this.kpiService.delete(id, companyId);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Goals
  // ───────────────────────────────────────────────────────────────────────
  @Get('goals')
  @RequirePermissions(Permission.PERFORMANCE_REVIEWS_VIEW)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getGoals(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const companyId = this.getTenantId(req);

    // Employee role check
    if (req.user.role === Role.Employee) {
      const empId = req.user.employee?.id;
      if (!empId) return createPaginatedResponse([], 0, parsedPage || 1, parsedLimit || 50);
      return this.goalService.findAll(companyId, empId, {
        page: parsedPage,
        limit: parsedLimit,
      });
    }

    return this.goalService.findAll(companyId, employeeId, {
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Post('goals')
  @RequirePermissions(Permission.PERFORMANCE_REVIEWS_VIEW)
  async createGoal(@Request() req: AuthenticatedRequest, @Body() body: any) {
    const companyId = this.getTenantId(req) || 'default';
    const companyName = (req.user as any).subscription?.company || 'Company';
    return this.goalService.create(companyId, companyName, body);
  }

  @Put('goals/:id')
  @RequirePermissions(Permission.PERFORMANCE_REVIEWS_VIEW)
  async updateGoal(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const companyId = this.getTenantId(req);

    // Check goal ownership if role is employee
    if (req.user.role === Role.Employee) {
      const goal = await this.goalService.findById(id, companyId);
      if (goal.employeeId !== req.user.employee?.id) {
        throw new ForbiddenException(
          'You cannot update goals assigned to other employees',
        );
      }
    }

    return this.goalService.update(id, companyId, body);
  }

  @Delete('goals/:id')
  @RequirePermissions(Permission.PERFORMANCE_CYCLES_MANAGE)
  async deleteGoal(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const companyId = this.getTenantId(req);
    return this.goalService.delete(id, companyId);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Dashboard Analytics
  // ───────────────────────────────────────────────────────────────────────
  @Get('analytics')
  @RequirePermissions(Permission.PERFORMANCE_REVIEWS_VIEW)
  async getAnalytics(@Request() req: AuthenticatedRequest) {
    const companyId = this.getTenantId(req);

    if (req.user.role === Role.SuperAdmin || req.user.role === Role.HRAdmin) {
      return this.performanceService.getHrDashboardAnalytics(companyId);
    }

    if (req.user.role === Role.Manager) {
      const managerId = req.user.employee?.id;
      if (!managerId)
        throw new ForbiddenException(
          'No employee record linked to manager profile',
        );
      return this.performanceService.getManagerDashboardAnalytics(
        companyId,
        managerId,
      );
    }

    // Default to employee role
    const employeeId = req.user.employee?.id;
    if (!employeeId)
      throw new ForbiddenException('No employee record linked to user profile');
    return this.performanceService.getEmployeeDashboardAnalytics(
      companyId,
      employeeId,
    );
  }

  // ───────────────────────────────────────────────────────────────────────
  // Legacy / Fallback endpoints (ensuring compatibility)
  // ───────────────────────────────────────────────────────────────────────
  @Get('appraisals')
  @RequirePermissions(Permission.PERFORMANCE_REVIEWS_VIEW)
  async getAppraisals(
    @Request() req: AuthenticatedRequest,
    @Query('employeeId') employeeId?: string,
  ) {
    const companyId = this.getTenantId(req);
    if (req.user.role === Role.Employee) {
      const empId = req.user.employee?.id;
      return this.performanceService.getAppraisals(companyId, empId);
    }
    return this.performanceService.getAppraisals(companyId, employeeId);
  }
}
