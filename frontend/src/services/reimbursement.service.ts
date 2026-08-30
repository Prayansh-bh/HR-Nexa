import axiosInstance from "../api/axios";
import { handleApiError } from "../utils/apiError";
import type { PaginatedResponse } from "../types/pagination";

export interface ExpenseCategoryModel {
  id: string;
  companyId: string;
  name: string;
  code: string;
  description?: string;
  maxLimit?: number;
  requireReceipt: boolean;
  isTaxable: boolean;
  isActive: boolean;
}

export interface ExpenseClaimItemModel {
  id?: string;
  categoryId: string;
  amount: number;
  approvedAmount?: number;
  expenseDate: string;
  merchant?: string;
  description?: string;
  taxTreatment?: "TAXABLE" | "NON_TAXABLE";
  receiptDocumentId?: string;
  remarks?: string;
  category?: ExpenseCategoryModel;
  receiptDocument?: any;
}

export interface ExpenseClaimModel {
  id: string;
  companyId: string;
  employeeId: string;
  fiscalYearId: string;
  claimNumber: string;
  title: string;
  description?: string;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "PAYABLE" | "PAID" | "REJECTED" | "CORRECTION_REQUIRED" | "CANCELLED";
  paymentStatus: "UNPAID" | "PROCESSING" | "PAID";
  paymentMethod?: "PAYROLL" | "BANK_TRANSFER" | "OFF_CYCLE";
  totalAmount: number;
  approvedAmount: number;
  paidAmount: number;
  taxableAmount: number;
  nonTaxableAmount: number;
  submittedAt?: string;
  reviewedById?: string;
  reviewedAt?: string;
  approvedAt?: string;
  payableAt?: string;
  paidAt?: string;
  paymentReference?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  items: ExpenseClaimItemModel[];
  fiscalYear?: any;
  employee?: {
    id: string;
    name: string;
    email: string;
    department?: any;
  };
}

export const reimbursementService = {
  async getCategories(): Promise<ExpenseCategoryModel[]> {
    try {
      const response = await axiosInstance.get("/expense-claims/categories");
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createCategory(data: Partial<ExpenseCategoryModel>): Promise<ExpenseCategoryModel> {
    try {
      const response = await axiosInstance.post("/expense-claims/categories", data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateCategory(id: string, data: Partial<ExpenseCategoryModel>): Promise<ExpenseCategoryModel> {
    try {
      const response = await axiosInstance.put(`/expense-claims/categories/${id}`, data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getMyClaims(fiscalYearId?: string): Promise<PaginatedResponse<ExpenseClaimModel>> {
    try {
      const response = await axiosInstance.get("/expense-claims/my", {
        params: { fiscalYearId },
      });
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

  async createMyClaim(data: {
    fiscalYearId: string;
    title: string;
    description?: string;
    items: ExpenseClaimItemModel[];
  }): Promise<ExpenseClaimModel> {
    try {
      const response = await axiosInstance.post("/expense-claims/my", data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateMyClaimDraft(
    id: string,
    data: {
      title?: string;
      description?: string;
      items?: ExpenseClaimItemModel[];
    },
  ): Promise<ExpenseClaimModel> {
    try {
      const response = await axiosInstance.put(`/expense-claims/my/${id}`, data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async submitMyClaim(id: string): Promise<ExpenseClaimModel> {
    try {
      const response = await axiosInstance.post(`/expense-claims/my/${id}/submit`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getTenantClaims(params?: {
    fiscalYearId?: string;
    employeeId?: string;
    status?: string;
    paymentStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<ExpenseClaimModel>> {
    try {
      const response = await axiosInstance.get("/expense-claims", { params });
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

  async getClaimById(id: string): Promise<ExpenseClaimModel> {
    try {
      const response = await axiosInstance.get(`/expense-claims/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async reviewClaim(
    id: string,
    data: {
      decision: "APPROVED" | "REJECTED" | "CORRECTION_REQUIRED";
      remarks?: string;
      itemApprovals?: Array<{ itemId: string; approvedAmount: number; taxTreatment?: "TAXABLE" | "NON_TAXABLE"; remarks?: string }>;
    },
  ): Promise<ExpenseClaimModel> {
    try {
      const response = await axiosInstance.post(`/expense-claims/${id}/review`, data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async payClaim(
    id: string,
    data: {
      paymentMethod: "PAYROLL" | "BANK_TRANSFER" | "OFF_CYCLE";
      paymentReference?: string;
      remarks?: string;
    },
  ): Promise<ExpenseClaimModel> {
    try {
      const response = await axiosInstance.post(`/expense-claims/${id}/pay`, data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
