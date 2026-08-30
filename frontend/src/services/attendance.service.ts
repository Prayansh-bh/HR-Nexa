import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";
import { mapApiAttendanceToModel } from "../mappers/attendance.mapper";
import type { ClockInOutPayload } from "../types/attendance";

export interface AttendanceQueryParams {
  employeeId?: string;
  date?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const attendanceService = {
  async getAttendance(
    employeeIdOrParams?: string | AttendanceQueryParams,
    date?: string,
    status?: string,
  ): Promise<any> {
    try {
      let paramsObj: AttendanceQueryParams = {};
      if (typeof employeeIdOrParams === "object" && employeeIdOrParams !== null) {
        paramsObj = employeeIdOrParams;
      } else {
        paramsObj = {
          employeeId: employeeIdOrParams,
          date,
          status,
        };
      }

      const params = new URLSearchParams();
      if (paramsObj.employeeId) params.append("employeeId", paramsObj.employeeId);
      if (paramsObj.date) params.append("date", paramsObj.date);
      if (paramsObj.status && paramsObj.status !== "All") params.append("status", paramsObj.status);
      if (paramsObj.search) params.append("search", paramsObj.search);
      if (paramsObj.page) params.append("page", paramsObj.page.toString());
      if (paramsObj.limit) params.append("limit", paramsObj.limit.toString());

      const response = await axiosInstance.get(
        `${ENDPOINTS.ATTENDANCE.GET_ALL}${params.toString() ? "?" + params.toString() : ""}`,
      );

      const raw = response.data;
      if (raw && typeof raw === "object" && "data" in raw && Array.isArray(raw.data)) {
        return {
          data: raw.data.map(mapApiAttendanceToModel),
          total: raw.total ?? raw.data.length,
          page: raw.page ?? (paramsObj.page || 1),
          limit: raw.limit ?? (paramsObj.limit || 50),
          totalPages: raw.totalPages ?? (raw.total ? Math.ceil(raw.total / (raw.limit || 50)) : 0),
        };
      }

      const rawData = Array.isArray(raw) ? raw : [];
      return rawData.map(mapApiAttendanceToModel);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getMatrix(month: string, department?: string, search?: string): Promise<any> {
    try {
      const params = new URLSearchParams();
      params.append("month", month);
      if (department && department !== "All") params.append("department", department);
      if (search) params.append("search", search);

      const response = await axiosInstance.get(`/attendance/matrix?${params.toString()}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async clockInOut(record: ClockInOutPayload): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.ATTENDANCE.CLOCK, record);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async regularize(id: string, record: any): Promise<any> {
    try {
      const response = await axiosInstance.put(ENDPOINTS.ATTENDANCE.REGULARIZE(id), record);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async verify(id: string): Promise<any> {
    try {
      const response = await axiosInstance.put(ENDPOINTS.ATTENDANCE.VERIFY(id));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async requestRegularization(payload: {
    attendanceId: string;
    requestedInTime: string;
    requestedOutTime: string;
    reason: string;
  }): Promise<any> {
    const response = await axiosInstance.post(ENDPOINTS.ATTENDANCE.REQUEST_REGULARIZATION, payload);
    return response.data;
  },

  async getRegularizationRequests(params?: {
    status?: string;
    employeeId?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.append("status", params.status);
      if (params?.employeeId) searchParams.append("employeeId", params.employeeId);
      if (params?.page) searchParams.append("page", params.page.toString());
      if (params?.limit) searchParams.append("limit", params.limit.toString());

      const url = `${ENDPOINTS.ATTENDANCE.GET_REGULARIZATION_REQUESTS}${searchParams.toString() ? "?" + searchParams.toString() : ""}`;
      const response = await axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async approveRegularizationRequest(id: string, reviewerRemark?: string): Promise<any> {
    const response = await axiosInstance.put(`/attendance/regularize-requests/${id}/approve`, {
      reviewerRemark,
    });
    return response.data;
  },

  async rejectRegularizationRequest(id: string, reviewerRemark: string): Promise<any> {
    const response = await axiosInstance.put(`/attendance/regularize-requests/${id}/reject`, {
      reviewerRemark,
    });
    return response.data;
  },

  // ── Biometric Devices ───────────────────────────────────────────────────
  async getDevices(): Promise<any[]> {
    try {
      const response = await axiosInstance.get("/attendance/devices");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createDevice(device: { name: string; ip: string }): Promise<any> {
    try {
      const response = await axiosInstance.post("/attendance/devices", device);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async syncDevice(id: string): Promise<any> {
    try {
      const response = await axiosInstance.post(`/attendance/devices/${id}/sync`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteDevice(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/attendance/devices/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // ── Geo-Fencing Zones ───────────────────────────────────────────────────
  async getZones(): Promise<any[]> {
    try {
      const response = await axiosInstance.get("/attendance/zones");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createZone(zone: {
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    address?: string;
    enabled?: boolean;
  }): Promise<any> {
    try {
      const response = await axiosInstance.post("/attendance/zones", zone);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateZone(
    id: string,
    zone: {
      name?: string;
      latitude?: number;
      longitude?: number;
      radiusMeters?: number;
      address?: string;
      enabled?: boolean;
    },
  ): Promise<any> {
    try {
      const response = await axiosInstance.put(`/attendance/zones/${id}`, zone);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteZone(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/attendance/zones/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // ── Attendance Settings ─────────────────────────────────────────────────
  async getSettings(): Promise<any> {
    try {
      const response = await axiosInstance.get("/attendance/settings");
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateSettings(settings: any): Promise<any> {
    try {
      const response = await axiosInstance.post("/attendance/settings", settings);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
