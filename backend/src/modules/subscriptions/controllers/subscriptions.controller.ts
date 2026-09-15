import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiQuery, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/role.enum';
import { SubscriptionsService } from '../services/subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpgradeSubscriptionDto, DowngradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { SuspendSubscriptionDto, CancelSubscriptionDto, AutoRenewSubscriptionDto } from './dto/suspend-subscription.dto';
import { CreateCouponDto, ApplyCouponDto } from './dto/coupon.dto';
import { AddStorageDto } from './dto/add-storage.dto';
import { RenewSubscriptionDto, ExtendTrialDto } from './dto/renew-subscription.dto';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import { UpdateSeatsDto } from './dto/update-seats.dto';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

@ApiTags('Subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @Roles(Role.SuperAdmin)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getSubscriptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.subscriptionsService.getSubscriptions({ page: parsedPage, limit: parsedLimit });
  }

  @Get('stats/dashboard')
  @Roles(Role.SuperAdmin)
  async getEnrichedStats() {
    return this.subscriptionsService.getEnrichedStats();
  }

  @Get('renewal-queue')
  @Roles(Role.SuperAdmin)
  async getRenewalQueue() {
    return this.subscriptionsService.getRenewalQueue();
  }

  @Get('invoices')
  @Roles(Role.SuperAdmin)
  async getAllInvoices() {
    return this.subscriptionsService.getAllInvoices();
  }

  @Get('coupons')
  @Roles(Role.SuperAdmin)
  async listCoupons() {
    return this.subscriptionsService.listCoupons();
  }

  @Get('my/usage')
  async getMyUsage(@Request() req: AuthenticatedRequest) {
    const subId =
      req.user.role === Role.SuperAdmin
        ? (req.user.subscriptionId || req.user.companyId)
        : req.user.subscriptionId;
    if (!subId) {
      throw new NotFoundException('No subscription linked to user');
    }
    return this.subscriptionsService.getUsage(subId);
  }

  @Get(':id/events')
  @Permissions(Permission.SETTINGS_COMPANY_VIEW)
  async getSubscriptionEvents(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    if (req.user.role !== Role.SuperAdmin) {
      const userSubId =
        req.user.role === Role.SuperAdmin
          ? (req.user.subscriptionId || req.user.companyId)
          : req.user.subscriptionId;
      if (id !== userSubId) {
        throw new NotFoundException(`Subscription record with ID "${id}" not found`);
      }
    }
    return this.subscriptionsService.getSubscriptionEvents(id);
  }

  @Get(':id/usage')
  @Permissions(Permission.SETTINGS_COMPANY_VIEW)
  async getUsage(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    if (req.user.role !== Role.SuperAdmin) {
      const userSubId =
        req.user.role === Role.SuperAdmin
          ? (req.user.subscriptionId || req.user.companyId)
          : req.user.subscriptionId;
      if (id !== userSubId) {
        throw new NotFoundException(`Subscription record with ID "${id}" not found`);
      }
    }
    return this.subscriptionsService.getUsage(id);
  }

  @Get(':id')
  @Permissions(Permission.SETTINGS_COMPANY_VIEW)
  async getSubscriptionById(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    if (req.user.role !== Role.SuperAdmin) {
      const userSubId =
        req.user.role === Role.SuperAdmin
          ? (req.user.subscriptionId || req.user.companyId)
          : req.user.subscriptionId;
      if (id !== userSubId) {
        throw new NotFoundException(`Subscription record with ID "${id}" not found`);
      }
    }
    return this.subscriptionsService.findById(id);
  }

  @Post()
  @Roles(Role.SuperAdmin)
  async createSubscription(@Body() body: CreateSubscriptionDto) {
    return this.subscriptionsService.createSubscription(body);
  }

  @Post('coupons')
  @Roles(Role.SuperAdmin)
  async createCoupon(@Body() body: CreateCouponDto) {
    return this.subscriptionsService.createCoupon(body);
  }

  @Post(':id/apply-coupon')
  @Roles(Role.SuperAdmin)
  async applyCoupon(@Param('id') id: string, @Body() body: ApplyCouponDto) {
    return this.subscriptionsService.applyCoupon(id, body.code);
  }

  @Put(':id/upgrade')
  @Roles(Role.SuperAdmin)
  async upgradeSubscription(
    @Param('id') id: string,
    @Body() body: UpgradeSubscriptionDto,
  ) {
    return this.subscriptionsService.upgradeSubscription(id, body.plan);
  }

  @Put(':id/downgrade')
  @Roles(Role.SuperAdmin)
  async downgradeSubscription(
    @Param('id') id: string,
    @Body() body: DowngradeSubscriptionDto,
  ) {
    return this.subscriptionsService.downgradeSubscription(id, body.plan);
  }

  @Put(':id/approve')
  @Roles(Role.SuperAdmin)
  async approveSubscription(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const performedBy = req.user?.name || req.user?.email || 'SuperAdmin';
    return this.subscriptionsService.approveCompany(id, performedBy);
  }

  @Put(':id/reject')
  @Roles(Role.SuperAdmin)
  async rejectSubscription(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: AuthenticatedRequest,
  ) {
    const performedBy = req.user?.name || req.user?.email || 'SuperAdmin';
    return this.subscriptionsService.rejectCompany(id, body?.reason, performedBy);
  }

  @Put(':id/renew')
  @Roles(Role.SuperAdmin)
  async renewSubscription(
    @Param('id') id: string,
    @Body() body: RenewSubscriptionDto,
  ) {
    return this.subscriptionsService.renewSubscription(id, body?.duration);
  }

  @Put(':id/extend-trial')
  @Roles(Role.SuperAdmin)
  async extendTrial(
    @Param('id') id: string,
    @Body() body: ExtendTrialDto,
  ) {
    return this.subscriptionsService.extendTrial(id, body?.days);
  }

  @Put(':id/suspend')
  @Roles(Role.SuperAdmin)
  async suspendSubscription(
    @Param('id') id: string,
    @Body() body: SuspendSubscriptionDto,
  ) {
    return this.subscriptionsService.suspendSubscription(id, body.reason);
  }

  @Put(':id/reactivate')
  @Roles(Role.SuperAdmin)
  async reactivateSubscription(@Param('id') id: string) {
    return this.subscriptionsService.reactivateSubscription(id);
  }

  @Put(':id/cancel')
  @Roles(Role.SuperAdmin)
  async cancelSubscription(
    @Param('id') id: string,
    @Body() body: CancelSubscriptionDto,
  ) {
    return this.subscriptionsService.cancelSubscription(id, body.note);
  }

  @Put(':id/auto-renew')
  @Roles(Role.SuperAdmin)
  async setAutoRenew(
    @Param('id') id: string,
    @Body() body: AutoRenewSubscriptionDto,
  ) {
    return this.subscriptionsService.setAutoRenew(id, body.autoRenew);
  }

  @Put(':id/mark-invoice-paid')
  @Roles(Role.SuperAdmin)
  async markInvoicePaid(@Param('id') id: string) {
    return this.subscriptionsService.markInvoicePaid(id);
  }

  @Patch(':id/seats')
  @Roles(Role.SuperAdmin)
  async updateSeats(
    @Param('id') id: string,
    @Body() body: UpdateSeatsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.updatePurchasedSeats(id, body.seats, req.user);
  }

  @Put(':id/profile')
  @Roles(Role.SuperAdmin)
  async updateProfile(
    @Param('id') id: string,
    @Body() body: UpdateCompanyProfileDto,
  ) {
    return this.subscriptionsService.editProfile(id, body);
  }

  @Post(':id/add-storage')
  @Roles(Role.SuperAdmin)
  async addStorage(
    @Param('id') id: string,
    @Body() body: AddStorageDto,
  ) {
    return this.subscriptionsService.addStorage(id, body);
  }

  @Post(':id/reset-password')
  @Roles(Role.SuperAdmin)
  async resetPassword(@Param('id') id: string) {
    return this.subscriptionsService.resetPassword(id);
  }

  /** Default DELETE: Archive / Soft-disable users while retaining tax/payroll records */
  @Delete(':id')
  @Roles(Role.SuperAdmin)
  async deleteSubscription(@Param('id') id: string) {
    return this.subscriptionsService.deleteSubscription(id);
  }

  /** Permanent Purge: Explicit SuperAdmin Hard Delete */
  @Delete(':id/purge')
  @Roles(Role.SuperAdmin)
  async purgeSubscription(
    @Param('id') id: string,
    @Body('confirmCompanyName') confirmCompanyName?: string,
  ) {
    return this.subscriptionsService.purgeSubscription(id, confirmCompanyName);
  }
}
