import { Injectable } from '@nestjs/common';
import { SubscriptionsRepository } from '../repositories/subscriptions.repository';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { SubscriptionBillingService } from './subscription-billing.service';
import { SubscriptionDashboardService } from './subscription-dashboard.service';
import { SubscriptionUsageService } from './subscription-usage.service';
import { SubscriptionCouponService } from './subscription-coupon.service';
import { CreateSubscriptionDto } from '../controllers/dto/create-subscription.dto';

/**
 * SubscriptionsService Facade
 * Lightweight orchestrator facade (< 150 lines) with zero business logic.
 * Delegates all domain operations directly to specialized domain services.
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly repository: SubscriptionsRepository,
    private readonly provisioningService: SubscriptionProvisioningService,
    private readonly lifecycleService: SubscriptionLifecycleService,
    private readonly billingService: SubscriptionBillingService,
    private readonly dashboardService: SubscriptionDashboardService,
    private readonly usageService: SubscriptionUsageService,
    private readonly couponService: SubscriptionCouponService,
  ) {}

  // --- Core Repository & Lookups ---
  async getSubscriptions(options?: { page?: number; limit?: number; isDemo?: boolean }) {
    const isDemo = options?.isDemo !== undefined ? options.isDemo : false;
    const rawResult = await this.repository.findAll({
      page: options?.page,
      limit: options?.limit,
      isDemo,
    });
    const subscriptions = Array.isArray(rawResult) ? rawResult : rawResult.data;
    const stats = await this.billingService.getAllInvoices();
    return Array.isArray(rawResult)
      ? { subscriptions, stats }
      : { data: subscriptions, total: rawResult.total, page: rawResult.page, limit: rawResult.limit, subscriptions, stats };
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  async getSubscriptionById(id: string) {
    return this.usageService.getSubscriptionById(id);
  }

  // --- Provisioning ---
  async createSubscription(data: CreateSubscriptionDto) {
    return this.provisioningService.createSubscription(data);
  }

  // --- Lifecycle Operations ---
  async upgradeSubscription(id: string, plan: string) {
    return this.lifecycleService.upgradeSubscription(id, plan);
  }

  async downgradeSubscription(id: string, plan: string, performedBy?: string) {
    return this.lifecycleService.downgradeSubscription(id, plan);
  }

  async renewSubscription(id: string, duration?: string) {
    return this.lifecycleService.renewSubscription(id, duration);
  }

  async approveCompany(id: string, performedBy?: string) {
    return this.lifecycleService.approveCompany(id, performedBy);
  }

  async rejectCompany(id: string, reason?: string, performedBy?: string) {
    return this.lifecycleService.rejectCompany(id, reason, performedBy);
  }

  async suspendSubscription(id: string, reason?: string, performedBy?: string) {
    return this.lifecycleService.suspendSubscription(id, reason);
  }

  async reactivateSubscription(id: string, performedBy?: string) {
    return this.lifecycleService.reactivateSubscription(id);
  }

  async cancelSubscription(id: string, performedBy?: string, note?: string) {
    return this.lifecycleService.cancelSubscription(id, note || performedBy);
  }

  async setAutoRenew(id: string, autoRenew: boolean, performedBy?: string) {
    return this.lifecycleService.setAutoRenew(id, autoRenew);
  }

  /**
   * @deprecated DO NOT USE DIRECTLY. Status transitions must go through explicit lifecycle methods
   * (e.g. suspendSubscription, reactivateSubscription, cancelSubscription, deleteSubscription).
   */
  async updateSubscriptionStatus(id: string, status: string) {
    if (status === 'Active') {
      return this.lifecycleService.reactivateSubscription(id);
    }
    if (status === 'Suspended') {
      return this.lifecycleService.suspendSubscription(id, 'Status update');
    }
    if (status === 'Cancelled') {
      return this.lifecycleService.cancelSubscription(id, 'Status update');
    }
    if (status === 'Archived') {
      return this.lifecycleService.deleteSubscription(id);
    }
    return this.usageService.updateSubscriptionStatus(id, status);
  }

  async extendTrial(id: string, days?: number) {
    return this.usageService.extendTrial(id, days);
  }

  /** Default Delete: Soft-Disable & Archive */
  async deleteSubscription(id: string) {
    return this.lifecycleService.deleteSubscription(id);
  }

  /** Explicit SuperAdmin Permanent Purge */
  async purgeSubscription(id: string, confirmCompanyName?: string) {
    return this.lifecycleService.purgeSubscription(id, confirmCompanyName);
  }

  async reconcileExpiredSubscriptions() {
    return this.lifecycleService.reconcileExpiredSubscriptions();
  }

  // --- Billing & Invoices ---
  async getAllInvoices() {
    return this.billingService.getAllInvoices();
  }

  async markInvoicePaid(invoiceId: string) {
    return this.billingService.markInvoicePaid(invoiceId);
  }

  // --- Dashboard & Analytics ---
  async getEnrichedStats() {
    return this.dashboardService.getEnrichedStats();
  }

  async getRenewalQueue() {
    return this.dashboardService.getRenewalQueue();
  }

  // --- Usage, Storage, Profile & Events ---
  async getUsage(subscriptionId: string) {
    return this.usageService.getUsage(subscriptionId);
  }

  async getSubscriptionEvents(subscriptionId: string) {
    return this.usageService.getSubscriptionEvents(subscriptionId);
  }

  async addStorage(id: string, body: any) {
    return this.usageService.addStorage(id, body);
  }

  async resetPassword(id: string) {
    return this.usageService.resetPassword(id);
  }

  async editProfile(id: string, data: any) {
    return this.usageService.editProfile(id, data);
  }

  // --- Coupon Management ---
  async listCoupons() {
    return this.couponService.listCoupons();
  }

  async createCoupon(data: { code: string; discountPercent: number; expiryDate: string; maxUses?: number }) {
    return this.couponService.createCoupon(data);
  }

  async applyCoupon(subscriptionId: string, code: string) {
    return this.couponService.applyCoupon(subscriptionId, code);
  }
}
