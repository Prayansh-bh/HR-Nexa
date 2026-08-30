import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";
import { mapApiPayrollToModel } from "../mappers/payroll.mapper";

export const payrollService = {
  async getPayroll(month?: string, employeeId?: string): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (month) params.append("month", month);
      if (employeeId) params.append("employeeId", employeeId);

      const response = await axiosInstance.get(
        `${ENDPOINTS.PAYROLL.GET_ALL}${params.toString() ? "?" + params.toString() : ""}`,
      );
      const rawList = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
          ? response.data.data
          : [];
      return rawList.map(mapApiPayrollToModel);
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

  async processPayroll(payload: {
    month: string;
    payDate: string;
    status: string;
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
};
