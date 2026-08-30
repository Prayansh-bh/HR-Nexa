import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";

export interface SystemMetrics {
  cpuUsage: string;
  cpuStatus: string;
  ramUsage: string;
  ramTotal: string;
  ramStatus: string;
  dbSize: string;
  dbStatus: string;
  serverHealth: string;
  serverUptime: string;
  emailQueue: number;
  emailQueueStatus: string;
  smsQueue: number;
  smsQueueStatus: string;
  apiStatus: string;
  apiLatency: string;
  storageUsed: string;
  storageTotal: string;
  storageStatus: string;
  timestamp: string;
}

export const systemService = {
  async getMetrics(): Promise<SystemMetrics | null> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.SYSTEM.METRICS);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
