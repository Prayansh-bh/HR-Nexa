import axiosInstance from "../api/axios";
import { handleApiError } from "../utils/apiError";
import { PaginatedResponse } from "../types/pagination";

export interface ReviewCycle {
  id: string;
  name: string;
  description: string;
  reviewType: string;
  startDate: string;
  endDate: string;
  deadline: string;
  status: "Draft" | "Scheduled" | "Active" | "Completed" | "Archived" | "Cancelled";
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceCriterion {
  id: string;
  name: string;
  weight: number;
  description: string;
}

export interface PerformanceCriterionScore {
  id: string;
  reviewId: string;
  criterionId: string;
  selfScore: number;
  managerScore: number;
  hrScore: number;
  remarks: string;
  criterion: PerformanceCriterion;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  employee: any;
  managerId: string | null;
  manager: any;
  reviewCycleId: string;
  reviewCycle: ReviewCycle;
  status:
    | "Draft"
    | "Self Review"
    | "Manager Review"
    | "HR Review"
    | "Approved"
    | "Completed"
    | "Archived"
    | "Cancelled";
  selfRating: number;
  managerRating: number;
  hrRating: number;
  attendanceRating: number;
  finalRating: number;
  selfFeedback: string;
  managerFeedback: string;
  hrRemarks: string;
  promotionRecommended: boolean;
  incrementRecommended: boolean;
  trainingRecommended: boolean;
  evidencePath: string | null;
  scores: PerformanceCriterionScore[];
  updatedAt: string;
}

export interface KPIDefinition {
  id: string;
  name: string;
  department: string;
  weight: number;
  measurementType: "Manual" | "Automatic" | "Attendance Driven";
  target: number;
  currentValue: number;
  active: boolean;
}

export interface PerformanceGoal {
  id: string;
  employeeId: string;
  employee?: any;
  title: string;
  description: string;
  targetDate: string;
  progress: number;
  status: "In Progress" | "Completed" | "Behind";
}

export interface CreateReviewCyclePayload {
  name: string;
  description?: string;
  reviewType?: string;
  startDate: string;
  endDate: string;
  deadline: string;
  status?: string;
  participantScope?: "ALL" | "SELECTED";
  participantIds?: string[];
  companyId?: string;
}

export const reviewCycleService = {
  // ── Review Cycles ──────────────────────────────────────────────────────────
  async getCycles(
    params?: { status?: string; page?: number; limit?: number } | string,
  ): Promise<PaginatedResponse<ReviewCycle>> {
    try {
      let queryStr = "";
      if (typeof params === "string") {
        queryStr = `status=${encodeURIComponent(params)}`;
      } else if (params) {
        const searchParams = new URLSearchParams();
        if (params.status) searchParams.append("status", params.status);
        if (params.page) searchParams.append("page", String(params.page));
        if (params.limit) searchParams.append("limit", String(params.limit));
        queryStr = searchParams.toString();
      }

      const response = await axiosInstance.get(
        `/performance/cycles${queryStr ? "?" + queryStr : ""}`,
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createCycle(cycle: CreateReviewCyclePayload): Promise<ReviewCycle> {
    try {
      const response = await axiosInstance.post("/performance/cycles", cycle);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateCycle(id: string, cycle: Partial<ReviewCycle>): Promise<ReviewCycle> {
    try {
      const response = await axiosInstance.put(`/performance/cycles/${id}`, cycle);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteCycle(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/performance/cycles/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getReviews(filters: {
    employeeId?: string;
    managerId?: string;
    reviewCycleId?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<PaginatedResponse<PerformanceReview>> {
    try {
      const params = new URLSearchParams();
      if (filters.employeeId) params.append("employeeId", filters.employeeId);
      if (filters.managerId) params.append("managerId", filters.managerId);
      if (filters.reviewCycleId) params.append("reviewCycleId", filters.reviewCycleId);
      if (filters.status) params.append("status", filters.status);
      if (filters.page) params.append("page", String(filters.page));
      if (filters.limit) params.append("limit", String(filters.limit));

      const queryStr = params.toString();
      const response = await axiosInstance.get(`/performance/reviews${queryStr ? "?" + queryStr : ""}`);
      const raw = response.data;
      if (Array.isArray(raw)) {
        return {
          data: raw,
          total: raw.length,
          page: 1,
          limit: raw.length,
          totalPages: 1,
        };
      }
      return {
        data: Array.isArray(raw?.data) ? raw.data : [],
        total: raw?.total ?? 0,
        page: raw?.page ?? 1,
        limit: raw?.limit ?? 50,
        totalPages: raw?.totalPages ?? 1,
      };
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getReviewById(id: string): Promise<PerformanceReview> {
    try {
      const response = await axiosInstance.get(`/performance/reviews/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async provisionReviewsForCycle(cycleId: string): Promise<PerformanceReview[]> {
    try {
      const response = await axiosInstance.post(`/performance/reviews/cycle/${cycleId}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async submitSelfReview(
    id: string,
    feedback: string,
    scores: { criterionId: string; score: number; remarks?: string }[],
  ): Promise<PerformanceReview> {
    try {
      const response = await axiosInstance.post(`/performance/reviews/${id}/self`, {
        feedback,
        scores,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async submitManagerReview(
    id: string,
    feedback: string,
    promotion: boolean,
    increment: boolean,
    training: boolean,
    scores: { criterionId: string; score: number; remarks?: string }[],
  ): Promise<PerformanceReview> {
    try {
      const response = await axiosInstance.post(`/performance/reviews/${id}/manager`, {
        feedback,
        promotion,
        increment,
        training,
        scores,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async overrideHrReview(
    id: string,
    remarks: string,
    scores: { criterionId: string; score: number; remarks?: string }[],
  ): Promise<PerformanceReview> {
    try {
      const response = await axiosInstance.post(`/performance/reviews/${id}/override`, {
        remarks,
        scores,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async approveReview(id: string): Promise<PerformanceReview> {
    try {
      const response = await axiosInstance.post(`/performance/reviews/${id}/approve`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async completeReview(id: string): Promise<PerformanceReview> {
    try {
      const response = await axiosInstance.post(`/performance/reviews/${id}/complete`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // ── Criteria ───────────────────────────────────────────────────────────────
  async getCriteria(): Promise<PerformanceCriterion[]> {
    try {
      const response = await axiosInstance.get("/performance/criteria");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  // ── Configurable KPIs ──────────────────────────────────────────────────────
  async getKPIs(department?: string): Promise<KPIDefinition[]> {
    try {
      const response = await axiosInstance.get(
        `/performance/kpis${department ? "?department=" + department : ""}`,
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createKPI(kpi: Partial<KPIDefinition>): Promise<KPIDefinition> {
    try {
      const response = await axiosInstance.post("/performance/kpis", kpi);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateKPI(id: string, kpi: Partial<KPIDefinition>): Promise<KPIDefinition> {
    try {
      const response = await axiosInstance.put(`/performance/kpis/${id}`, kpi);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteKPI(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/performance/kpis/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // ── Goals ──────────────────────────────────────────────────────────────────
  async getGoals(
    employeeId?: string,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<PerformanceGoal>> {
    try {
      const params = new URLSearchParams();
      if (employeeId) params.append("employeeId", employeeId);
      if (options?.page) params.append("page", String(options.page));
      if (options?.limit) params.append("limit", String(options.limit));

      const queryStr = params.toString();
      const response = await axiosInstance.get(
        `/performance/goals${queryStr ? "?" + queryStr : ""}`,
      );
      const raw = response.data;
      if (Array.isArray(raw)) {
        return {
          data: raw,
          total: raw.length,
          page: 1,
          limit: raw.length,
          totalPages: 1,
        };
      }
      return {
        data: Array.isArray(raw?.data) ? raw.data : [],
        total: raw?.total ?? 0,
        page: raw?.page ?? 1,
        limit: raw?.limit ?? 50,
        totalPages: raw?.totalPages ?? 1,
      };
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createGoal(goal: Partial<PerformanceGoal>): Promise<PerformanceGoal> {
    try {
      const response = await axiosInstance.post("/performance/goals", goal);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateGoal(id: string, goal: Partial<PerformanceGoal>): Promise<PerformanceGoal> {
    try {
      const response = await axiosInstance.put(`/performance/goals/${id}`, goal);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteGoal(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/performance/goals/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // ── Dashboard Analytics ────────────────────────────────────────────────────
  async getPerformanceAnalytics(): Promise<any> {
    try {
      const response = await axiosInstance.get("/performance/analytics");
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
