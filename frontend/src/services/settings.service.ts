import axiosInstance from "../api/axios";
import { handleApiError } from "../utils/apiError";

export const settingsService = {
  async getCompanySettings(): Promise<any> {
    try {
      const response = await axiosInstance.get("/settings/company");
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateCompanySettings(id: string, version: number, data: any): Promise<any> {
    try {
      const response = await axiosInstance.put("/settings/company", { id, version, data });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getOfficeTiming(): Promise<any> {
    try {
      const response = await axiosInstance.get("/settings/timing");
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateOfficeTiming(id: string, version: number, data: any): Promise<any> {
    try {
      const response = await axiosInstance.put("/settings/timing", { id, version, data });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getHolidays(): Promise<any[]> {
    try {
      const response = await axiosInstance.get("/settings/holidays");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async addHoliday(holiday: any): Promise<any> {
    try {
      const response = await axiosInstance.post("/settings/holidays", holiday);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteHoliday(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/settings/holidays/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
