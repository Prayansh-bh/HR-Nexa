import axiosInstance from "../api/axios";
import { handleApiError } from "../utils/apiError";
import type { PaginatedResponse } from "../types/pagination";

export interface TaxDeclarationItemModel {
  id?: string;
  section: string;
  category: string;
  declaredAmount: number;
  approvedAmount?: number;
  proofDocumentId?: string;
  remarks?: string;
  proofDocument?: any;
}

export interface TaxDeclarationModel {
  id: string;
  companyId: string;
  employeeId: string;
  fiscalYearId: string;
  regime: "OLD" | "NEW";
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CORRECTION_REQUIRED";
  totalDeclared: number;
  totalApproved: number;
  remarks?: string;
  reviewedById?: string;
  reviewedAt?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
  items: TaxDeclarationItemModel[];
  fiscalYear?: any;
  employee?: {
    id: string;
    name: string;
    email: string;
    pan?: string;
    department?: any;
  };
}

export const taxDeclarationService = {
  async getMyDeclaration(fiscalYearId?: string): Promise<TaxDeclarationModel | null> {
    try {
      const response = await axiosInstance.get("/tax-declarations/my", {
        params: { fiscalYearId },
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createMyDeclaration(data: {
    fiscalYearId: string;
    regime: "OLD" | "NEW";
    items: TaxDeclarationItemModel[];
  }): Promise<TaxDeclarationModel> {
    try {
      const response = await axiosInstance.post("/tax-declarations/my", data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateMyDeclaration(data: {
    fiscalYearId: string;
    regime: "OLD" | "NEW";
    items: TaxDeclarationItemModel[];
  }): Promise<TaxDeclarationModel> {
    try {
      const response = await axiosInstance.put("/tax-declarations/my", data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async submitMyDeclaration(fiscalYearId: string): Promise<TaxDeclarationModel> {
    try {
      const response = await axiosInstance.post("/tax-declarations/my/submit", { fiscalYearId });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getTenantDeclarations(params?: {
    fiscalYearId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<TaxDeclarationModel>> {
    try {
      const response = await axiosInstance.get("/tax-declarations", { params });
      const raw = response.data;
      if (raw && Array.isArray(raw.data)) {
        return {
          data: raw.data,
          total: Number(raw.total) >= 0 ? Number(raw.total) : Number(raw.meta?.total) || raw.data.length,
          page: Number(raw.page) > 0 ? Number(raw.page) : Number(raw.meta?.page) || 1,
          limit: Number(raw.limit) > 0 ? Number(raw.limit) : Number(raw.meta?.limit) || 50,
          totalPages: Number(raw.totalPages) >= 0 ? Number(raw.totalPages) : Number(raw.meta?.totalPages) || 1,
        };
      }
      if (Array.isArray(raw)) {
        return {
          data: raw,
          total: raw.length,
          page: 1,
          limit: raw.length || 50,
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

  async getDeclarationById(id: string): Promise<TaxDeclarationModel> {
    try {
      const response = await axiosInstance.get(`/tax-declarations/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async auditDeclaration(
    id: string,
    data: {
      decision: "APPROVED" | "REJECTED" | "CORRECTION_REQUIRED";
      remarks?: string;
      itemApprovals?: Array<{ itemId: string; approvedAmount: number; remarks?: string }>;
    },
  ): Promise<TaxDeclarationModel> {
    try {
      const response = await axiosInstance.post(`/tax-declarations/${id}/audit`, data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
