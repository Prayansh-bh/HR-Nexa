import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";
import { mapApiPayrollToModel } from "../mappers/payroll.mapper";
import type { PaginatedResponse } from "../types/pagination";

export const payrollService = {
  async getPayroll(
    month?: string,
    employeeId?: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<any>> {
    try {
      const queryParams = new URLSearchParams();
      if (month) queryParams.append("month", month);
      if (employeeId) queryParams.append("employeeId", employeeId);
      if (params?.page) queryParams.append("page", String(params.page));
      if (params?.limit) queryParams.append("limit", String(params.limit));

      const response = await axiosInstance.get(
        `${ENDPOINTS.PAYROLL.GET_ALL}${queryParams.toString() ? "?" + queryParams.toString() : ""}`,
      );
      const raw = response.data;
      if (raw && Array.isArray(raw.data)) {
        return {
          data: raw.data.map(mapApiPayrollToModel),
          total: Number(raw.total) >= 0 ? Number(raw.total) : raw.data.length,
          page: Number(raw.page) > 0 ? Number(raw.page) : 1,
          limit: Number(raw.limit) > 0 ? Number(raw.limit) : 50,
          totalPages:
            Number(raw.totalPages) >= 0
              ? Number(raw.totalPages)
              : raw.total
              ? Math.ceil(raw.total / (raw.limit || 50))
              : 1,
        };
      }
      if (Array.isArray(raw)) {
        const mapped = raw.map(mapApiPayrollToModel);
        return {
          data: mapped,
          total: mapped.length,
          page: 1,
          limit: mapped.length || 50,
          totalPages: 1,
        };
      }
      return {
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      };
    } catch (error) {
      return handleApiError(error);
    }
  },

  async calculatePayroll(payload: { month: string; adjustments?: any }): Promise<any[]> {
    try {
      const response = await axiosInstance.post("/payroll/calculate", payload);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async generatePayroll(payload: {
    month: string;
    payDate?: string;
    adjustments?: any;
  }): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.PAYROLL.GENERATE, payload);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async processPayroll(payload: {
    month: string;
    payDate: string;
    status?: string;
    adjustments?: any;
  }): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.PAYROLL.PROCESS, payload);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updatePayrollStatus(id: string, status: string): Promise<any> {
    try {
      const response = await axiosInstance.put(ENDPOINTS.PAYROLL.UPDATE_STATUS(id), { status });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async markMonthAsPaid(payload: {
    month: string;
    payDate?: string;
    paymentReference?: string;
  }): Promise<any> {
    try {
      const response = await axiosInstance.post("/payroll/mark-paid", payload);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async lockPeriod(month: string): Promise<any> {
    try {
      const response = await axiosInstance.put("/payroll/period/lock", { month });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async unlockPeriod(month: string): Promise<any> {
    try {
      const response = await axiosInstance.put("/payroll/period/unlock", { month });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getPayrollSummary(month: string): Promise<any> {
    try {
      const response = await axiosInstance.get(
        `${ENDPOINTS.PAYROLL.SUMMARY}?month=${encodeURIComponent(month)}`,
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getComponents(): Promise<any[]> {
    try {
      const response = await axiosInstance.get("/payroll/components");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createComponent(payload: any): Promise<any> {
    try {
      const response = await axiosInstance.post("/payroll/components", payload);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteComponent(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/payroll/components/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateSlip(id: string, payload: any): Promise<any> {
    try {
      const response = await axiosInstance.put(`/payroll/${id}`, payload);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getPayrollInputs(month?: string, employeeId?: string): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (month) params.append("month", month);
      if (employeeId) params.append("employeeId", employeeId);
      const query = params.toString() ? `?${params.toString()}` : "";
      const response = await axiosInstance.get(`/payroll/inputs${query}`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updatePayrollInput(
    employeeId: string,
    payload: {
      month: string;
      lopDays?: number;
      overtimeHours?: number;
      bonus?: number;
      deductions?: number;
      remarks?: string;
    },
  ): Promise<any> {
    try {
      const response = await axiosInstance.put(`/payroll/inputs/${employeeId}`, payload);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
