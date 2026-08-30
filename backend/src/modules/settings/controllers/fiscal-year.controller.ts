import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FiscalYearService } from '../services/fiscal-year.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { TenantContext } from '../../../common/tenant/tenant-context.util';
import { CreateFiscalYearDto } from '../dto/create-fiscal-year.dto';
import { UpdateFiscalYearDto } from '../dto/update-fiscal-year.dto';

@ApiTags('Fiscal Year')
@Controller('fiscal-years')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class FiscalYearController {
  constructor(private readonly fiscalYearService: FiscalYearService) {}

  @Get()
  @RequirePermissions(Permission.SETTINGS_COMPANY_VIEW)
  @ApiOperation({ summary: 'Get configured fiscal years for authenticated tenant' })
  async getFiscalYears(@Request() req: AuthenticatedRequest) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.fiscalYearService.findAll(scope);
  }

  @Get(':id')
  @RequirePermissions(Permission.SETTINGS_COMPANY_VIEW)
  @ApiOperation({ summary: 'Get single fiscal year by ID' })
  async getFiscalYearById(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.fiscalYearService.findById(id, scope);
  }

  @Post()
  @RequirePermissions(Permission.SETTINGS_COMPANY_EDIT)
  @ApiOperation({ summary: 'Create a new draft fiscal year' })
  async createFiscalYear(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateFiscalYearDto,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.fiscalYearService.create(scope, req.user, body);
  }

  @Put(':id')
  @RequirePermissions(Permission.SETTINGS_COMPANY_EDIT)
  @ApiOperation({ summary: 'Update an existing draft fiscal year' })
  async updateFiscalYear(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateFiscalYearDto,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.fiscalYearService.update(id, scope, req.user, body);
  }

  @Post(':id/activate')
  @RequirePermissions(Permission.SETTINGS_COMPANY_EDIT)
  @ApiOperation({ summary: 'Activate a fiscal year as the operational period' })
  async activateFiscalYear(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.fiscalYearService.activate(id, scope, req.user);
  }

  @Post(':id/close')
  @RequirePermissions(Permission.SETTINGS_COMPANY_EDIT)
  @ApiOperation({ summary: 'Close and finalize a fiscal year period' })
  async closeFiscalYear(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.fiscalYearService.close(id, scope, req.user);
  }

  @Post(':id/lock')
  @RequirePermissions(Permission.SETTINGS_COMPANY_EDIT)
  @ApiOperation({ summary: 'Lock a fiscal year to prevent modifications' })
  async lockFiscalYear(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.fiscalYearService.lock(id, scope, req.user);
  }

  @Delete(':id')
  @RequirePermissions(Permission.SETTINGS_COMPANY_EDIT)
  @ApiOperation({ summary: 'Delete a draft fiscal year' })
  async deleteFiscalYear(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.fiscalYearService.delete(id, scope, req.user);
  }
}
