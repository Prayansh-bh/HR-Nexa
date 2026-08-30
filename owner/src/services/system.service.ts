import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";

export interface SystemMetrics {
  cpuUsage: string;
  cpuStatus: string;
  // Node Process Memory
  processMemory?: string;
  processHeapUsed?: string;
  processHeapTotal?: string;
  processRss?: string;
  processMemoryStatus?: string;
  // Host Physical Memory
  hostMemory?: string;
  hostMemoryUsed?: string;
  hostMemoryTotal?: string;
  hostMemoryStatus?: string;
  // Backward compatibility
  ramUsage: string;
  ramTotal: string;
  ramStatus: string;
  dbSize: string;
  dbStatus: string;
  serverHealth: string;
  serverUptime: string;
  outboxQueue?: number;
  outboxQueueStatus?: string;
  emailQueue: number;
  emailQueueStatus: string;
  smsQueue?: number | null;
  smsQueueStatus?: string;
  apiStatus: string;
  apiLatency: string;
  metricsDuration?: string;
  storageUsed: string | null;
  storageTotal: string | null;
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
