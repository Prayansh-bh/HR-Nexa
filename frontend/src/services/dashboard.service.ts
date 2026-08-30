import axios from "axios";
import axiosInstance from "../api/axios";
import { BASE_API } from "../config/api";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";

export const dashboardService = {
  async getDashboardAnalytics(): Promise<any> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.REPORTS.ANALYTICS);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async isServerActive(): Promise<boolean> {
    try {
      const healthUrl = BASE_API.endsWith("/api")
        ? BASE_API.replace(/\/api$/, "/health")
        : `${BASE_API}/health`;
      const response = await axios.get(healthUrl);
      return response.status === 200;
    } catch {
      return false;
    }
  },
};
