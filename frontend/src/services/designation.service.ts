import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";
import { mapApiDesignationToModel } from "../mappers/designation.mapper";
import type { Designation } from "../types";

export const designationService = {
  async getDesignations(): Promise<Designation[]> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.DESIGNATION.GET_ALL);
      const rawData = Array.isArray(response.data)
        ? response.data
        : (response.data as any)?.data && Array.isArray((response.data as any).data)
          ? (response.data as any).data
          : [];
      return rawData.map(mapApiDesignationToModel);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getDesignationsByDepartment(departmentId: string): Promise<Designation[]> {
    try {
      const response = await axiosInstance.get(
        ENDPOINTS.DESIGNATION.GET_BY_DEPARTMENT(departmentId),
      );
      return Array.isArray(response.data) ? response.data.map(mapApiDesignationToModel) : [];
    } catch (error) {
      return [];
    }
  },

  async createDesignation(name: string, band: string): Promise<Designation> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.DESIGNATION.CREATE, { name, band });
      return mapApiDesignationToModel(response.data);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteDesignation(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(ENDPOINTS.DESIGNATION.DELETE(id));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
