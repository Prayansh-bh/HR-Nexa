import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  subscriptionService,
  EnrichedStats,
  Subscription,
  Coupon,
} from "../services/subscription.service";
import { billingService, Invoice } from "../services/billing.service";
import { ticketsService, SupportTicket } from "../services/tickets.service";
import { recruitmentService, PlatformRecruitmentOverview } from "../services/recruitment.service";
import { notificationService } from "../services/notification.service";
import { subscriptionKeys } from "../features/subscriptions/queries/subscription.keys";

export const DASHBOARD_QUERY_KEYS = {
  subscriptionStats: subscriptionKeys.stats(),
  subscriptionsList: subscriptionKeys.list(),
  subscriptionInvoices: subscriptionKeys.invoices(),
  renewalQueue: subscriptionKeys.renewalQueue(),
  subscriptionCoupons: subscriptionKeys.coupons(),
  invoices: ["invoices"] as const,
  tickets: ["tickets"] as const,
  recruitmentOverview: ["recruitmentOverview"] as const,
  announcements: ["announcements"] as const,
};

export { subscriptionKeys };

export function useSubscriptionStatsQuery() {
  return useQuery<EnrichedStats>({
    queryKey: subscriptionKeys.stats(),
    queryFn: () => subscriptionService.getEnrichedStats(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useSubscriptionsListQuery() {
  return useQuery<Subscription[]>({
    queryKey: subscriptionKeys.list(),
    queryFn: async () => {
      const res = await subscriptionService.getSubscriptions();
      return res.subscriptions || [];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useSubscriptionInvoicesQuery() {
  return useQuery<Invoice[]>({
    queryKey: subscriptionKeys.invoices(),
    queryFn: () => subscriptionService.getAllInvoices(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useRenewalQueueQuery() {
  return useQuery<(Subscription & { daysLeft: number })[]>({
    queryKey: subscriptionKeys.renewalQueue(),
    queryFn: () => subscriptionService.getRenewalQueue(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useSubscriptionCouponsQuery() {
  return useQuery<Coupon[]>({
    queryKey: subscriptionKeys.coupons(),
    queryFn: () => subscriptionService.listCoupons(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

import { PaginatedResponse } from "../types/pagination";

export function useInvoicesQuery(params?: { page?: number; limit?: number }) {
  return useQuery<PaginatedResponse<Invoice>>({
    queryKey: [...DASHBOARD_QUERY_KEYS.invoices, params],
    queryFn: () => billingService.getInvoices(params),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useTicketsQuery() {
  return useQuery<SupportTicket[]>({
    queryKey: DASHBOARD_QUERY_KEYS.tickets,
    queryFn: () => ticketsService.getAllTickets(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useRecruitmentOverviewQuery() {
  return useQuery<PlatformRecruitmentOverview>({
    queryKey: DASHBOARD_QUERY_KEYS.recruitmentOverview,
    queryFn: () => recruitmentService.getPlatformOverview(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useAnnouncementsQuery() {
  return useQuery<any[]>({
    queryKey: DASHBOARD_QUERY_KEYS.announcements,
    queryFn: () => notificationService.getAnnouncements(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useSubscriptionMutations() {
  const queryClient = useQueryClient();

  const invalidateAllSubscriptionQueries = () => {
    queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.invoices });
    queryClient.invalidateQueries({ queryKey: ["companies"] });
  };

  const renewSubscription = useMutation({
    mutationFn: (args: { id: string; duration?: string } | string) => {
      const id = typeof args === "string" ? args : args.id;
      const duration = typeof args === "string" ? undefined : args.duration;
      return subscriptionService.renewSubscription(id, duration);
    },
    onSuccess: invalidateAllSubscriptionQueries,
  });

  const upgradeSubscription = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) =>
      subscriptionService.upgradeSubscription(id, plan),
    onSuccess: invalidateAllSubscriptionQueries,
  });

  const downgradeSubscription = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) =>
      subscriptionService.downgradeSubscription(id, plan),
    onSuccess: invalidateAllSubscriptionQueries,
  });

  const suspendSubscription = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      subscriptionService.suspendSubscription(id, reason),
    onSuccess: invalidateAllSubscriptionQueries,
  });

  const reactivateSubscription = useMutation({
    mutationFn: (id: string) => subscriptionService.reactivateSubscription(id),
    onSuccess: invalidateAllSubscriptionQueries,
  });

  const cancelSubscription = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      subscriptionService.cancelSubscription(id, note),
    onSuccess: invalidateAllSubscriptionQueries,
  });

  const toggleAutoRenew = useMutation({
    mutationFn: ({ id, autoRenew }: { id: string; autoRenew: boolean }) =>
      subscriptionService.setAutoRenew(id, autoRenew),
    onSuccess: invalidateAllSubscriptionQueries,
  });

  const markInvoicePaid = useMutation({
    mutationFn: (id: string) => subscriptionService.markInvoicePaid(id),
    onSuccess: invalidateAllSubscriptionQueries,
  });

  const applyCoupon = useMutation({
    mutationFn: ({ subscriptionId, code }: { subscriptionId: string; code: string }) =>
      subscriptionService.applyCoupon(subscriptionId, code),
    onSuccess: invalidateAllSubscriptionQueries,
  });

  const deleteSubscription = useMutation({
    mutationFn: (id: string) => subscriptionService.deleteSubscription(id),
    onSuccess: invalidateAllSubscriptionQueries,
  });

  const purgeSubscription = useMutation({
    mutationFn: (id: string) => subscriptionService.purgeSubscription(id),
    onSuccess: invalidateAllSubscriptionQueries,
  });

  return {
    renewSubscription,
    upgradeSubscription,
    downgradeSubscription,
    suspendSubscription,
    reactivateSubscription,
    cancelSubscription,
    toggleAutoRenew,
    markInvoicePaid,
    applyCoupon,
    deleteSubscription,
    purgeSubscription,
  };
}

export function useDashboardMutations() {
  const queryClient = useQueryClient();

  const createTicket = useMutation({
    mutationFn: (ticket: any) => ticketsService.createTicket(ticket),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.tickets });
    },
  });

  const createInvoice = useMutation({
    mutationFn: (invoice: any) => billingService.createInvoice(invoice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.invoices });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.invoices() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.stats() });
    },
  });

  const createAnnouncement = useMutation({
    mutationFn: (data: {
      type: string;
      title: string;
      content: string;
      scheduledFor?: string;
      duration?: string;
    }) => notificationService.createAnnouncement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.announcements });
    },
  });

  return {
    createTicket,
    createInvoice,
    createAnnouncement,
  };
}
