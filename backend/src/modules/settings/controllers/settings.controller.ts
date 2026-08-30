import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { SettingsService } from '../services/settings.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { TenantId } from '../../../common/tenant/tenant-id.decorator';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  @Get('company')
  @RequirePermissions(Permission.SETTINGS_COMPANY_VIEW)
  async getCompany(@TenantId() tenantId: string) {
    return this.settingsService.getCompany(tenantId);
  }

  @Put('company')
  @RequirePermissions(Permission.SETTINGS_COMPANY_EDIT)
  async updateCompany(
    @TenantId() tenantId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const result = await this.settingsService.updateCompany(tenantId, body.id, body.version, body.data);
    await this.auditLogger.logAction({
      userId: req.user.id,
      userName: req.user.name,
      companyId: tenantId,
      action: 'SETTINGS_UPDATED',
      details: `Updated company legal profile details for ID: ${body.id}`,
    });
    return result;
  }

  @Get('timing')
  @RequirePermissions(Permission.SETTINGS_COMPANY_VIEW)
  async getTiming(@TenantId() tenantId: string) {
    return this.settingsService.getTiming(tenantId);
  }

  @Put('timing')
  @RequirePermissions(Permission.SETTINGS_COMPANY_EDIT)
  async updateTiming(
    @TenantId() tenantId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const result = await this.settingsService.updateTiming(tenantId, body.id, body.version, body.data);
    await this.auditLogger.logAction({
      userId: req.user.id,
      userName: req.user.name,
      companyId: tenantId,
      action: 'TIMING_UPDATED',
      details: `Updated office timing thresholds for ID: ${body.id}`,
    });
    return result;
  }

  @Get('holidays')
  @RequirePermissions(Permission.SETTINGS_COMPANY_VIEW)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getHolidays(
    @TenantId() tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.settingsService.getHolidays(tenantId, {
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Post('holidays')
  @RequirePermissions(Permission.SETTINGS_COMPANY_EDIT)
  async addHoliday(
    @TenantId() tenantId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const result = await this.settingsService.addHoliday(tenantId, body);
    await this.auditLogger.logAction({
      userId: req.user.id,
      userName: req.user.name,
      companyId: tenantId,
      action: 'HOLIDAY_ADDED',
      details: `Added new holiday: ${body.occasion} on ${body.date}`,
    });
    return result;
  }

  @Delete('holidays/:id')
  @RequirePermissions(Permission.SETTINGS_COMPANY_EDIT)
  async deleteHoliday(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const result = await this.settingsService.deleteHoliday(tenantId, id);
    await this.auditLogger.logAction({
      userId: req.user.id,
      userName: req.user.name,
      companyId: tenantId,
      action: 'HOLIDAY_DELETED',
      details: `Deleted holiday ID: ${id}`,
    });
    return result;
  }
}
