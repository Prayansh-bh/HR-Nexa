import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";
import { mapApiLeaveToModel } from "../mappers/leave.mapper";
import type { LeaveRequest } from "../types";

export const leaveService = {
  async getLeaves(employeeId?: string, status?: string): Promise<LeaveRequest[]> {
    try {
      const params = new URLSearchParams();
      if (employeeId) params.append("employeeId", employeeId);
      if (status) params.append("status", status);

      const response = await axiosInstance.get(
        `${ENDPOINTS.LEAVE.GET_ALL}${params.toString() ? "?" + params.toString() : ""}`,
      );
      const rawList = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
          ? response.data.data
          : [];
      return rawList.map(mapApiLeaveToModel);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createLeave(leave: any): Promise<LeaveRequest> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.LEAVE.CREATE, leave);
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
