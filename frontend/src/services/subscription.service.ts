import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";

export interface Subscription {
  id: string;
  company: string;
  plan: string;
  cycle: string;
  start: string;
  expiry: string;
  amount: number;
  status: string;
  autoRenew?: boolean;
  currency?: string;
  suspendedAt?: string | null;
  cancelledAt?: string | null;
  suspendReason?: string | null;
  notes?: string | null;
  gst?: string;
  pan?: string;
  cin?: string;
  address?: string;
  contact?: string;
  hrAdmin?: string;
  ownerName?: string;
  ownerEmail?: string;
  billing?: string;
  storageUsed?: string;
  employeesCount?: number;
  purchasedSeats?: number;
  usedSeats?: number;
  logo?: string;
  daysLeft?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  event: string;
  fromPlan?: string | null;
  toPlan?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  performedBy?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  type: string;
  company: string;
  date: string;
  amount: number;
  status: string;
  subscriptionId?: string | null;
  couponCode?: string | null;
  tax?: number;
  discount?: number;
  period?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Coupon {
  id: string;
  code: string;
  description?: string;
  discountType: string;
  discountValue: number;
  maxUses: number;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  active: boolean;
}

export interface SubscriptionUsage {
  employees: { used: number; limit: number; pct: number };
  storage: { used: number; limit: number; pct: number };
}

export interface SubscriptionStats {
  totalRevenue: number;
  monthlyRevenue: number;
  annualRevenue: number;
  pendingPayments: number;
  renewalsToday: number;
}

export interface EnrichedStats {
  totalCompanies: number;
  activeSubscriptions: number;
  trialCompanies: number;
  expiringIn30Days: number;
  expired: number;
  suspended: number;
  cancelled: number;
  other?: number;
  totalRevenue: number;
  monthlyRevenue: number;
  annualRevenue: number;
  mrr: number;
  arr: number;
  renewalRate: number;
  churnRate: number;
  recentPayments: Invoice[];
  renewalsToday: number;
  recentEvents: SubscriptionEvent[];
}

export interface GetSubscriptionsResponse {
  subscriptions: Subscription[];
  stats: SubscriptionStats;
}

export const subscriptionService = {
  async getSubscriptions(): Promise<GetSubscriptionsResponse> {
    try {
      const r = await axiosInstance.get(ENDPOINTS.SUBSCRIPTION.GET_ALL);
      const d = r.data;
      const subs = Array.isArray(d) ? d : Array.isArray(d?.subscriptions) ? d.subscriptions : [];
      return { ...d, subscriptions: subs };
    } catch (e) {
      return handleApiError(e);
    }
  },

  async getEnrichedStats(): Promise<EnrichedStats> {
    try {
      const r = await axiosInstance.get(ENDPOINTS.SUBSCRIPTION.DASHBOARD_STATS);
      const d = r.data;
      if (!d || d.error)
        return {
          totalCompanies: 0,
          activeSubscriptions: 0,
          trialCompanies: 0,
          expiringIn30Days: 0,
          expired: 0,
          suspended: 0,
          cancelled: 0,
          totalRevenue: 0,
          monthlyRevenue: 0,
          annualRevenue: 0,
          mrr: 0,
          arr: 0,
          renewalRate: 100,
          churnRate: 0,
          recentPayments: [],
          renewalsToday: 0,
          recentEvents: [],
        };
      return {
        totalCompanies: typeof d.totalCompanies === "number" ? d.totalCompanies : 0,
        activeSubscriptions: typeof d.activeSubscriptions === "number" ? d.activeSubscriptions : 0,
        trialCompanies: typeof d.trialCompanies === "number" ? d.trialCompanies : 0,
        expiringIn30Days: typeof d.expiringIn30Days === "number" ? d.expiringIn30Days : 0,
        expired: typeof d.expired === "number" ? d.expired : 0,
        suspended: typeof d.suspended === "number" ? d.suspended : 0,
        cancelled: typeof d.cancelled === "number" ? d.cancelled : 0,
        totalRevenue: typeof d.totalRevenue === "number" ? d.totalRevenue : 0,
        monthlyRevenue: typeof d.monthlyRevenue === "number" ? d.monthlyRevenue : 0,
        annualRevenue: typeof d.annualRevenue === "number" ? d.annualRevenue : 0,
        mrr: typeof d.mrr === "number" ? d.mrr : 0,
        arr: typeof d.arr === "number" ? d.arr : 0,
        renewalRate: typeof d.renewalRate === "number" ? d.renewalRate : 100,
        churnRate: typeof d.churnRate === "number" ? d.churnRate : 0,
        recentPayments: Array.isArray(d.recentPayments) ? d.recentPayments : [],
        renewalsToday: typeof d.renewalsToday === "number" ? d.renewalsToday : 0,
        recentEvents: Array.isArray(d.recentEvents) ? d.recentEvents : [],
      };
    } catch (e) {
      return handleApiError(e);
    }
  },

  async getSubscriptionById(
    id: string,
  ): Promise<Subscription & { events: SubscriptionEvent[]; invoices: Invoice[] }> {
    try {
      const r = await axiosInstance.get(ENDPOINTS.SUBSCRIPTION.GET_ONE(id));
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async getSubscriptionEvents(id: string): Promise<SubscriptionEvent[]> {
    try {
      const r = await axiosInstance.get(ENDPOINTS.SUBSCRIPTION.GET_EVENTS(id));
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async getUsage(id: string): Promise<SubscriptionUsage> {
    try {
      const r = await axiosInstance.get(ENDPOINTS.SUBSCRIPTION.GET_USAGE(id));
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async getMyUsage(): Promise<SubscriptionUsage> {
    try {
      const r = await axiosInstance.get("/subscriptions/my/usage");
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async getRenewalQueue(): Promise<(Subscription & { daysLeft: number })[]> {
    try {
      const r = await axiosInstance.get(ENDPOINTS.SUBSCRIPTION.RENEWAL_QUEUE);
      const d = r.data;
      return Array.isArray(d) ? d : [];
    } catch (e) {
      return handleApiError(e);
    }
  },

  async getAllInvoices(): Promise<Invoice[]> {
    try {
      const r = await axiosInstance.get(ENDPOINTS.SUBSCRIPTION.INVOICES);
      const d = r.data;
      return Array.isArray(d) ? d : [];
    } catch (e) {
      return handleApiError(e);
    }
  },

  async listCoupons(): Promise<Coupon[]> {
    try {
      const r = await axiosInstance.get(ENDPOINTS.SUBSCRIPTION.COUPONS);
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async createCoupon(data: Partial<Coupon>): Promise<Coupon> {
    try {
      const r = await axiosInstance.post(ENDPOINTS.SUBSCRIPTION.COUPONS, data);
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async applyCoupon(id: string, code: string): Promise<Coupon> {
    try {
      const r = await axiosInstance.post(ENDPOINTS.SUBSCRIPTION.APPLY_COUPON(id), { code });
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async upgradeSubscription(id: string, plan: string): Promise<Subscription> {
    try {
      const r = await axiosInstance.put(ENDPOINTS.SUBSCRIPTION.UPGRADE(id), { plan });
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async downgradeSubscription(id: string, plan: string): Promise<Subscription> {
    try {
      const r = await axiosInstance.put(ENDPOINTS.SUBSCRIPTION.DOWNGRADE(id), { plan });
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async renewSubscription(id: string, duration?: string): Promise<Subscription> {
    try {
      const r = await axiosInstance.put(ENDPOINTS.SUBSCRIPTION.RENEW(id), duration ? { duration } : {});
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async extendTrial(id: string, days?: number): Promise<Subscription> {
    try {
      const r = await axiosInstance.put(ENDPOINTS.SUBSCRIPTION.EXTEND_TRIAL(id), days ? { days } : {});
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async suspendSubscription(id: string, reason?: string): Promise<Subscription> {
    try {
      const r = await axiosInstance.put(ENDPOINTS.SUBSCRIPTION.SUSPEND(id), { reason });
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async reactivateSubscription(id: string): Promise<Subscription> {
    try {
      const r = await axiosInstance.put(ENDPOINTS.SUBSCRIPTION.REACTIVATE(id));
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async cancelSubscription(id: string, note?: string): Promise<Subscription> {
    try {
      const r = await axiosInstance.put(ENDPOINTS.SUBSCRIPTION.CANCEL(id), { note });
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async setAutoRenew(id: string, autoRenew: boolean): Promise<Subscription> {
    try {
      const r = await axiosInstance.put(ENDPOINTS.SUBSCRIPTION.AUTO_RENEW(id), { autoRenew });
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async markInvoicePaid(invoiceId: string): Promise<Invoice> {
    try {
      const r = await axiosInstance.put(ENDPOINTS.SUBSCRIPTION.MARK_INVOICE_PAID(invoiceId));
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async deleteSubscription(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const r = await axiosInstance.delete(ENDPOINTS.SUBSCRIPTION.DELETE(id));
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },

  async purgeSubscription(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const r = await axiosInstance.delete(ENDPOINTS.SUBSCRIPTION.PURGE(id));
      return r.data;
    } catch (e) {
      return handleApiError(e);
    }
  },
};
