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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { Roles } from '../../auth/roles.decorator';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { Role } from '../../auth/role.enum';
import { RecruitmentService } from '../services/recruitment.service';
import { PlatformRecruitmentOverview } from '../repositories/recruitment.repository';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { ApiQuery } from '@nestjs/swagger';
import { TenantContext } from '../../../common/tenant/tenant-context.util';

@Controller('recruitment')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  @Get('platform/overview')
  @Roles(Role.SuperAdmin)
  async getPlatformOverview(): Promise<PlatformRecruitmentOverview> {
    return this.recruitmentService.getPlatformOverview();
  }

  @Get('jobs')
  @RequirePermissions(Permission.RECRUITMENT_JOBS_VIEW)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getJobPostings(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.recruitmentService.getJobPostings(scope, {
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Post('jobs')
  @RequirePermissions(Permission.RECRUITMENT_JOBS_CREATE)
  async createJobPosting(
    @Request() req: AuthenticatedRequest,
    @Body() body: any,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.recruitmentService.createJobPosting(scope, body);
  }

  @Delete('jobs/:id')
  @RequirePermissions(Permission.RECRUITMENT_JOBS_DELETE)
  async deleteJobPosting(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.recruitmentService.deleteJobPosting(id, scope);
  }

  @Put('jobs/:id')
  @RequirePermissions(Permission.RECRUITMENT_JOBS_EDIT)
  async updateJobPosting(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.recruitmentService.updateJobPosting(id, scope, body);
  }

  @Get('candidates')
  @RequirePermissions(Permission.RECRUITMENT_CANDIDATES_VIEW)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getCandidates(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.recruitmentService.getCandidates(scope, jobId, {
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Post('candidates')
  @RequirePermissions(Permission.RECRUITMENT_CANDIDATES_ADD)
  async createCandidate(
    @Request() req: AuthenticatedRequest,
    @Body() body: any,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.recruitmentService.createCandidate(scope, body);
  }

  @Put('candidates/:id/stage')
  @RequirePermissions(Permission.RECRUITMENT_CANDIDATES_MOVESTAGE)
  async updateCandidateStage(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('stage') stage: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.recruitmentService.updateCandidateStage(id, scope, stage);
  }

  @Post('candidates/:id/evaluation')
  @RequirePermissions(Permission.RECRUITMENT_CANDIDATES_VIEW)
  async submitEvaluation(
    @Request() req: AuthenticatedRequest,
    @Param('id') candidateId: string,
    @Body() body: any,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.recruitmentService.createEvaluation(candidateId, scope, body);
  }

  @Get('candidates/:id/evaluation')
  @RequirePermissions(Permission.RECRUITMENT_CANDIDATES_VIEW)
  async getEvaluation(
    @Request() req: AuthenticatedRequest,
    @Param('id') candidateId: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.recruitmentService.getEvaluation(candidateId, scope);
  }

  @Post('candidates/:id/offer/preview')
  @RequirePermissions(
    Permission.RECRUITMENT_CANDIDATES_MOVESTAGE,
    Permission.EMPLOYEES_PROFILE_DOCS_UPLOAD,
  )
  async previewOffer(
    @Request() req: AuthenticatedRequest,
    @Param('id') candidateId: string,
    @Body() body: any,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.recruitmentService.previewOfferCompensation(candidateId, scope, body);
  }

  @Post('candidates/:id/offer/generate')
  @RequirePermissions(Permission.RECRUITMENT_CANDIDATES_MOVESTAGE)
  async generateOffer(
    @Request() req: AuthenticatedRequest,
    @Param('id') candidateId: string,
    @Body() body: any,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.recruitmentService.generateOfferLetter(candidateId, scope, body);
  }

  @Get('candidates/:id/offer')
  @RequirePermissions(Permission.RECRUITMENT_CANDIDATES_VIEW)
  async getCandidateOffer(
    @Request() req: AuthenticatedRequest,
    @Param('id') candidateId: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.recruitmentService.getOfferByCandidateId(candidateId, scope);
  }

  @Get('offers')
  @RequirePermissions(Permission.RECRUITMENT_CANDIDATES_VIEW)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getOffers(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.recruitmentService.getOffers(scope, {
      page: parsedPage,
      limit: parsedLimit,
    });
  }
}
