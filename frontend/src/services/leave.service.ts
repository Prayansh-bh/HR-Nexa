import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";
import { mapApiLeaveToModel } from "../mappers/leave.mapper";
import type { LeaveRequest, RawLeaveRequestApi, PaginatedLeaveResponse } from "../types";

export interface LeaveQueryParams {
  employeeId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const leaveService = {
  async getLeaves(
    employeeIdOrParams?: string | LeaveQueryParams,
    status?: string,
    page?: number,
    limit?: number,
  ): Promise<any> {
    try {
      let paramsObj: LeaveQueryParams = {};
      if (typeof employeeIdOrParams === "object" && employeeIdOrParams !== null) {
        paramsObj = employeeIdOrParams;
      } else {
        paramsObj = {
          employeeId: employeeIdOrParams,
          status,
          page,
          limit,
        };
      }

      const params = new URLSearchParams();
      if (paramsObj.employeeId) params.append("employeeId", paramsObj.employeeId);
      if (paramsObj.status && paramsObj.status !== "All") params.append("status", paramsObj.status);
      if (paramsObj.search) params.append("search", paramsObj.search);
      if (paramsObj.page) params.append("page", paramsObj.page.toString());
      if (paramsObj.limit) params.append("limit", paramsObj.limit.toString());

      const response = await axiosInstance.get<PaginatedLeaveResponse | RawLeaveRequestApi[]>(
        `${ENDPOINTS.LEAVE.GET_ALL}${params.toString() ? "?" + params.toString() : ""}`,
      );

      const payload = response.data;
      if (payload && typeof payload === "object" && "data" in payload && Array.isArray(payload.data)) {
        const rows: RawLeaveRequestApi[] = payload.data;
        return {
          data: rows.map(mapApiLeaveToModel),
          total: payload.total ?? rows.length,
          page: payload.page ?? (paramsObj.page || 1),
          limit: payload.limit ?? (paramsObj.limit || 50),
          totalPages: payload.totalPages ?? (payload.total ? Math.ceil(payload.total / (payload.limit || 50)) : 0),
        };
      }

      const rows: RawLeaveRequestApi[] = Array.isArray(payload) ? payload : [];
      return rows.map(mapApiLeaveToModel);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createLeave(leave: any): Promise<LeaveRequest> {
    try {
      const payload = {
        type: leave.type || leave.leaveType,
        startDate: leave.startDate || leave.from,
        endDate: leave.endDate || leave.to,
        from: leave.from || leave.startDate,
        to: leave.to || leave.endDate,
        days: leave.days,
        reason: leave.reason,
        employeeId: leave.employeeId,
        department: leave.department,
      };
      const response = await axiosInstance.post(ENDPOINTS.LEAVE.CREATE, payload);
      return mapApiLeaveToModel(response.data);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateLeaveStatus(id: string, status: "Approved" | "Rejected"): Promise<any> {
    try {
      const response = await axiosInstance.put(ENDPOINTS.LEAVE.UPDATE_STATUS(id), { status });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getLeaveQuota(employeeId: string): Promise<any[]> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.LEAVE.QUOTA(employeeId));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // ── Leave Types / Policies ──────────────────────────────────────────────
  async getLeaveTypes(): Promise<any[]> {
    try {
      const response = await axiosInstance.get("/leaves/types");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createLeaveType(type: any): Promise<any> {
    try {
      const response = await axiosInstance.post("/leaves/types", type);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateLeaveType(id: string, type: any): Promise<any> {
    try {
      const response = await axiosInstance.put(`/leaves/types/${id}`, type);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteLeaveType(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/leaves/types/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // ── Calendar Events ─────────────────────────────────────────────────────
  async getEvents(): Promise<any[]> {
    try {
      const response = await axiosInstance.get("/leaves/events");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createEvent(event: { title: string; date: string; type: string }): Promise<any> {
    try {
      const response = await axiosInstance.post("/leaves/events", event);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteEvent(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/leaves/events/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
