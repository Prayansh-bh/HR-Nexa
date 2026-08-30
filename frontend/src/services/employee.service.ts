import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";
import { mapApiEmployeeToModel } from "../mappers/employee.mapper";
import type { Employee, OrgChartEmployee } from "../types";
import { PaginatedResponse } from "../types/pagination";

export interface EmployeeQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  status?: string;
}

export const employeeService = {
  async getEmployees(
    paramsOrSearch?: EmployeeQueryParams | string,
    department?: string,
    status?: string,
  ): Promise<PaginatedResponse<Employee>> {
    try {
      const searchParams = new URLSearchParams();
      let reqPage = 1;
      let reqLimit = 50;

      if (typeof paramsOrSearch === "object" && paramsOrSearch !== null) {
        if (paramsOrSearch.page) {
          reqPage = paramsOrSearch.page;
          searchParams.append("page", String(paramsOrSearch.page));
        }
        if (paramsOrSearch.limit) {
          reqLimit = paramsOrSearch.limit;
          searchParams.append("limit", String(paramsOrSearch.limit));
        }
        if (paramsOrSearch.search) searchParams.append("search", paramsOrSearch.search);
        if (paramsOrSearch.department) searchParams.append("department", paramsOrSearch.department);
        if (paramsOrSearch.status) searchParams.append("status", paramsOrSearch.status);
      } else {
        if (paramsOrSearch) searchParams.append("search", paramsOrSearch);
        if (department) searchParams.append("department", department);
        if (status) searchParams.append("status", status);
      }

      const response = await axiosInstance.get(
        `${ENDPOINTS.EMPLOYEE.GET_ALL}${searchParams.toString() ? "?" + searchParams.toString() : ""}`,
      );

      const d = response.data;
      const rawData = Array.isArray(d?.data)
        ? d.data
        : Array.isArray(d)
        ? d
        : [];
      const mappedData = rawData.map(mapApiEmployeeToModel);

      const total = typeof d?.total === "number" ? d.total : mappedData.length;
      const page = typeof d?.page === "number" ? d.page : reqPage;
      const limit = typeof d?.limit === "number" ? d.limit : reqLimit;
      const totalPages =
        typeof d?.totalPages === "number"
          ? d.totalPages
          : total === 0
          ? 0
          : Math.ceil(total / limit);

      return {
        data: mappedData,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getEmployeesList(params?: EmployeeQueryParams): Promise<Employee[]> {
    const res = await this.getEmployees(params);
    return res.data || [];
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

  async uploadAvatar(id: string, file: File): Promise<{ id: string; avatar: string; url?: string }> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await axiosInstance.post<{ id: string; avatar: string; url?: string }>(
        `/employees/${id}/avatar`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async bulkCreateEmployees(
    employees: any[],
  ): Promise<BulkCreateResponseDto> {
    try {
      const response = await axiosInstance.post<BulkCreateResponseDto>(
        ENDPOINTS.EMPLOYEE.BULK_CREATE,
        { employees },
      );
      const data = response.data;
      return {
        total: Number(data?.total ?? 0),
        successful: Number(data?.successful ?? 0),
        failed: Number(data?.failed ?? 0),
        createdEmployees: Array.isArray(data?.createdEmployees)
          ? data.createdEmployees.map(mapApiEmployeeToModel)
          : [],
        errors: Array.isArray(data?.errors) ? data.errors : [],
      };
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

export interface BulkEmployeeError {
  row: number;
  index: number;
  id?: string;
  email?: string;
  name?: string;
  reason: string;
  code?: string;
}

export interface BulkCreateResponseDto {
  total: number;
  successful: number;
  failed: number;
  createdEmployees: Employee[];
  errors: BulkEmployeeError[];
}

