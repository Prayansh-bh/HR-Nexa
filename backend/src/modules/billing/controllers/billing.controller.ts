import { Controller, Get, Post, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/role.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { BillingService } from '../services/billing.service';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  private getTenantId(req: AuthenticatedRequest): string | null {
    if (req.user.role === Role.SuperAdmin) return null;
    return req.user.companyId || req.user.subscriptionId || null;
  }

  @Get('invoices')
  @RequirePermissions(Permission.SETTINGS_COMPANY_VIEW)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getInvoices(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const companyId = this.getTenantId(req);
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.billingService.getInvoices(companyId, {
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Post('invoices')
  @Roles(Role.SuperAdmin)
  async createInvoice(@Body() body: any) {
    return this.billingService.createInvoice(body);
  }
}
