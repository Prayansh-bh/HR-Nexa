import { Controller, Get, Post, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/role.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { PaymentsService } from '../services/payments.service';
import { ProcessRefundDto } from '../dto/process-refund.dto';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  private getTenantId(req: AuthenticatedRequest): string | null {
    if (req.user.role === Role.SuperAdmin) return null;
    return req.user.companyId || req.user.subscriptionId || null;
  }

  @Get('payments')
  @RequirePermissions(Permission.SETTINGS_COMPANY_VIEW)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPayments(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const companyId = this.getTenantId(req);
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.paymentsService.getPayments(companyId, {
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Post('payments')
  @RequirePermissions(Permission.SETTINGS_COMPANY_VIEW)
  async processPayment(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: {
      invoiceId?: string;
      company: string;
      amount: number;
      paymentMethod: string;
    },
  ) {
    const companyId = this.getTenantId(req);
    return this.paymentsService.processPayment({
      ...body,
      company: companyId || body.company,
    });
  }

  @Post('refunds/:id')
  @Roles(Role.SuperAdmin)
  async processRefund(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body?: ProcessRefundDto,
  ) {
    return this.paymentsService.processRefund(id, body, {
      id: req.user?.id,
      email: req.user?.email,
      name: req.user?.name,
      role: req.user?.role,
    });
  }

  @Post('payments/:id/refund')
  @Roles(Role.SuperAdmin)
  async processPaymentRefund(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body?: ProcessRefundDto,
  ) {
    return this.processRefund(req, id, body);
  }
}
