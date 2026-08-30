import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";
import { mapApiEmployeeToModel } from "../mappers/employee.mapper";
import type { Employee, OrgChartEmployee } from "../types";

export const employeeService = {
  async getEmployees(search?: string, department?: string, status?: string): Promise<Employee[]> {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (department) params.append("department", department);
      if (status) params.append("status", status);

      const response = await axiosInstance.get(
        `${ENDPOINTS.EMPLOYEE.GET_ALL}${params.toString() ? "?" + params.toString() : ""}`,
      );
      const rawData = Array.isArray(response.data)
        ? response.data
        : (response.data as any)?.data && Array.isArray((response.data as any).data)
          ? (response.data as any).data
          : [];
      return rawData.map(mapApiEmployeeToModel);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getOrgChart(): Promise<OrgChartEmployee[]> {
    try {
      const response = await axiosInstance.get<OrgChartEmployee[]>("/employees/orgchart");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getEmployee(id: string): Promise<Employee> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.EMPLOYEE.GET_ONE(id));
      return mapApiEmployeeToModel(response.data);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createEmployee(employee: any): Promise<Employee> {
    try {
      const { department, ...rest } = employee;
      const cleanData: any = {};
      Object.keys(rest).forEach((key) => {
        const val = rest[key];
        if (val === "") {
          cleanData[key] = undefined;
        } else {
          cleanData[key] = val;
        }
      });
      const response = await axiosInstance.post(ENDPOINTS.EMPLOYEE.CREATE, {
        ...cleanData,
        departmentName: department,
      });
      return mapApiEmployeeToModel(response.data);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateEmployee(id: string, employee: any): Promise<Employee> {
    try {
      const { department, ...rest } = employee;
      const cleanData: any = {};
      Object.keys(rest).forEach((key) => {
        const val = rest[key];
        if (val === "") {
          cleanData[key] = undefined;
        } else {
          cleanData[key] = val;
        }
      });
      const response = await axiosInstance.put(ENDPOINTS.EMPLOYEE.UPDATE(id), {
        ...cleanData,
        departmentName: department,
      });
      return mapApiEmployeeToModel(response.data);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteEmployee(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(ENDPOINTS.EMPLOYEE.DELETE(id));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
