export const subscriptionKeys = {
  all: ["subscriptions"] as const,
  stats: () => [...subscriptionKeys.all, "stats"] as const,
  list: () => [...subscriptionKeys.all, "list"] as const,
  invoices: () => [...subscriptionKeys.all, "invoices"] as const,
  renewalQueue: () => [...subscriptionKeys.all, "renewalQueue"] as const,
  coupons: () => [...subscriptionKeys.all, "coupons"] as const,
  detail: (id: string) => [...subscriptionKeys.all, "detail", id] as const,
  events: (id: string) => [...subscriptionKeys.all, "events", id] as const,
  usage: (id: string) => [...subscriptionKeys.all, "usage", id] as const,
};
