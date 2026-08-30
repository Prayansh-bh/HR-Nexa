import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";
import { mapApiDepartmentToModel } from "../mappers/department.mapper";
import type { Department } from "../types";

export const departmentService = {
  async getDepartments(): Promise<Department[]> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.DEPARTMENT.GET_ALL);
      const rawData = Array.isArray(response.data)
        ? response.data
        : (response.data as any)?.data && Array.isArray((response.data as any).data)
          ? (response.data as any).data
          : [];
      return rawData.map(mapApiDepartmentToModel);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createDepartment(name: string, head?: string): Promise<Department> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.DEPARTMENT.CREATE, { name, head });
      return mapApiDepartmentToModel(response.data);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteDepartment(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(ENDPOINTS.DEPARTMENT.DELETE(id));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
