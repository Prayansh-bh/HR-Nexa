import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../api/axios";

export interface SuperAdminDashboardStats {
  subscriptions: {
    mrr: number;
    arr: number;
    totalRevenue: number;
    monthlyRevenue: number;
    annualRevenue: number;
    renewalRate: number;
    churnRate: number;
  };
  companies: {
    total: number;
    active: number;
    trial: number;
    expired: number;
    suspended: number;
    cancelled: number;
  };
  support: {
    openTickets: number;
    criticalTickets: number;
  };
  system: {
    serverHealth: string;
    serverUptime: string;
    cpuUsage: string;
    ramUsage: string;
    storageUsed: string;
  };
}

export function useSuperAdminDashboardQuery() {
  return useQuery<SuperAdminDashboardStats>({
    queryKey: ["super-admin-dashboard-stats"],
    queryFn: async () => {
      const response = await axiosInstance.get("/super-admin/dashboard-stats");
      return response.data;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30000,
  });
}
