import axiosInstance from "../api/axios";
import { handleApiError } from "../utils/apiError";

export const dprService = {
  async getMyHistory(): Promise<any[]> {
    try {
      const response = await axiosInstance.get("/dpr/my");
      return response.data || [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getMyDprById(id: string): Promise<any> {
    try {
      const response = await axiosInstance.get(`/dpr/my/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createMyDpr(payload: any): Promise<any> {
    try {
      const response = await axiosInstance.post("/dpr/my", payload);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateMyDpr(id: string, payload: any): Promise<any> {
    try {
      const response = await axiosInstance.put(`/dpr/my/${id}`, payload);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async submitMyDpr(id: string): Promise<any> {
    try {
      const response = await axiosInstance.post(`/dpr/my/${id}/submit`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getTeamReports(params?: {
    employeeId?: string;
    reportDate?: string;
    status?: string;
  }): Promise<any[]> {
    try {
      const response = await axiosInstance.get("/dpr/team", { params });
      return response.data || [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getTeamDprById(id: string): Promise<any> {
    try {
      const response = await axiosInstance.get(`/dpr/team/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async approveReport(id: string, payload?: { reviewerRemark?: string }): Promise<any> {
    try {
      const response = await axiosInstance.post(`/dpr/${id}/approve`, payload || {});
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async rejectReport(id: string, payload?: { reviewerRemark?: string }): Promise<any> {
    try {
      const response = await axiosInstance.post(`/dpr/${id}/reject`, payload || {});
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async correctionRequiredReport(id: string, payload?: { reviewerRemark?: string }): Promise<any> {
    try {
      const response = await axiosInstance.post(`/dpr/${id}/correction-required`, payload || {});
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
