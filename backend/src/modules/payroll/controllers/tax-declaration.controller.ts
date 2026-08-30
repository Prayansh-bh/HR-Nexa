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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TaxDeclarationService } from '../services/tax-declaration.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { TenantContext } from '../../../common/tenant/tenant-context.util';
import { CreateTaxDeclarationDto, AuditTaxDeclarationDto } from '../dto/tax-declaration.dto';
import { TaxDeclarationStatus } from '../repositories/tax-declaration.repository';

@ApiTags('Tax Declarations')
@Controller('tax-declarations')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class TaxDeclarationController {
  constructor(private readonly taxDeclarationService: TaxDeclarationService) {}

  @Get('my')
  @RequirePermissions(Permission.TAX_DECLARATIONS_VIEW)
  @ApiOperation({ summary: 'Get current employee own tax declaration for a fiscal year' })
  @ApiQuery({ name: 'fiscalYearId', required: false, type: String })
  async getMyDeclaration(
    @Request() req: AuthenticatedRequest,
    @Query('fiscalYearId') fiscalYearId?: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.taxDeclarationService.getMyDeclaration(req.user, scope, fiscalYearId);
  }

  @Post('my')
  @RequirePermissions(Permission.TAX_DECLARATIONS_SUBMIT)
  @ApiOperation({ summary: 'Create initial tax declaration draft for current employee' })
  async createMyDeclaration(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateTaxDeclarationDto,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.taxDeclarationService.createMyDeclaration(req.user, scope, body);
  }

  @Put('my')
  @RequirePermissions(Permission.TAX_DECLARATIONS_SUBMIT)
  @ApiOperation({ summary: 'Update draft tax declaration items for current employee' })
  async updateMyDeclaration(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateTaxDeclarationDto,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.taxDeclarationService.updateMyDeclaration(req.user, scope, body);
  }

  @Post('my/submit')
  @RequirePermissions(Permission.TAX_DECLARATIONS_SUBMIT)
  @ApiOperation({ summary: 'Submit tax declaration for review' })
  async submitMyDeclaration(
    @Request() req: AuthenticatedRequest,
    @Body() body: { fiscalYearId: string },
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.taxDeclarationService.submitMyDeclaration(req.user, scope, body.fiscalYearId);
  }

  @Get()
  @RequirePermissions(Permission.TAX_DECLARATIONS_MANAGE)
  @ApiOperation({ summary: 'Get tenant tax declarations list for accountant audit' })
  @ApiQuery({ name: 'fiscalYearId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTenantDeclarations(
    @Request() req: AuthenticatedRequest,
    @Query('fiscalYearId') fiscalYearId?: string,
    @Query('status') status?: TaxDeclarationStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.taxDeclarationService.findTenantDeclarations(scope, {
      fiscalYearId,
      status,
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Get(':id')
  @RequirePermissions(Permission.TAX_DECLARATIONS_MANAGE)
  @ApiOperation({ summary: 'Get single tax declaration details for audit' })
  async getDeclarationById(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.taxDeclarationService.getDeclarationById(id, scope);
  }

  @Post(':id/audit')
  @RequirePermissions(Permission.TAX_DECLARATIONS_MANAGE)
  @ApiOperation({ summary: 'Audit decision (Approve / Reject / Request Correction) on tax declaration' })
  async auditDeclaration(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: AuditTaxDeclarationDto,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.taxDeclarationService.auditDeclaration(id, scope, req.user, body);
  }
}
