import axiosInstance from "../api/axios";
import { handleApiError } from "../utils/apiError";

export interface FiscalYearModel {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  isLocked: boolean;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const fiscalYearService = {
  async getFiscalYears(): Promise<FiscalYearModel[]> {
    try {
      const response = await axiosInstance.get("/fiscal-years");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getFiscalYearById(id: string): Promise<FiscalYearModel> {
    try {
      const response = await axiosInstance.get(`/fiscal-years/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createFiscalYear(data: { name: string; startDate: string; endDate: string }): Promise<FiscalYearModel> {
    try {
      const response = await axiosInstance.post("/fiscal-years", data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateFiscalYear(id: string, data: { name?: string; startDate?: string; endDate?: string }): Promise<FiscalYearModel> {
    try {
      const response = await axiosInstance.put(`/fiscal-years/${id}`, data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async activateFiscalYear(id: string): Promise<FiscalYearModel> {
    try {
      const response = await axiosInstance.post(`/fiscal-years/${id}/activate`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async closeFiscalYear(id: string): Promise<FiscalYearModel> {
    try {
      const response = await axiosInstance.post(`/fiscal-years/${id}/close`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async lockFiscalYear(id: string): Promise<FiscalYearModel> {
    try {
      const response = await axiosInstance.post(`/fiscal-years/${id}/lock`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteFiscalYear(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/fiscal-years/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
