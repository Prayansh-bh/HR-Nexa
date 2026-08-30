import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";
import type { PaginatedResponse } from "../types/pagination";

export interface PlatformRecruitmentOverview {
  totalOpenJobs: number;
  totalCandidates: number;
  interviewsScheduled: number;
  offersSent: number;
  hiredCount: number;
  offerAcceptanceRate: number;
  jobsPostedThisMonth: number;
  candidatesHiredThisMonth: number;
  companiesCurrentlyHiring: number;
  pipelineStageDistribution: Array<{ stage: string; count: number }>;
  topHiringDepartments: Array<{ department: string; openJobs: number }>;
  topHiringCompanies: Array<{ companyName: string; openJobs: number; candidates: number }>;
  hiringTrends: Array<{ month: string; jobsPosted: number; candidatesApplied: number }>;
}

export interface EvaluationData {
  technicalSkills: number;
  communication: number;
  experienceMatch: number;
  culturalFit: number;
  problemSolving: number;
  leadership: number;
  overallRecommendation: string;
  notes?: string;
}

export const recruitmentService = {
  async getPlatformOverview(): Promise<PlatformRecruitmentOverview> {
    try {
      const response = await axiosInstance.get("/recruitment/platform/overview");
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getJobPostings(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<any>> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.RECRUITMENT.JOBS_GET_ALL, { params });
      const raw = response.data;
      if (raw && Array.isArray(raw.data)) {
        return {
          data: raw.data,
          total: Number(raw.total) >= 0 ? Number(raw.total) : raw.data.length,
          page: Number(raw.page) > 0 ? Number(raw.page) : 1,
          limit: Number(raw.limit) > 0 ? Number(raw.limit) : 50,
          totalPages: Number(raw.totalPages) >= 0 ? Number(raw.totalPages) : 1,
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

  async createJobPosting(data: {
    title: string;
    department: string;
    departmentId?: string;
    designationId?: string;
    hiringManager?: string;
    status?: string;
    openings?: number;
    location?: string;
    type?: string;
    priority?: string;
    minSalary?: number;
    maxSalary?: number;
    currency?: string;
    budgetJustification?: string;
    jobDescription?: string;
    skillsRequired?: string[];
    experienceRequired?: string;
    educationRequired?: string;
    expectedJoiningDate?: string;
  }): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.RECRUITMENT.JOBS_CREATE, data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteJobPosting(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(ENDPOINTS.RECRUITMENT.JOBS_DELETE(id));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateJobPosting(
    id: string,
    data: {
      title?: string;
      department?: string;
      departmentId?: string;
      designationId?: string;
      hiringManager?: string;
      status?: string;
      openings?: number;
      location?: string;
      type?: string;
      priority?: string;
      minSalary?: number;
      maxSalary?: number;
      currency?: string;
      budgetJustification?: string;
      jobDescription?: string;
      skillsRequired?: string[];
      experienceRequired?: string;
      educationRequired?: string;
      expectedJoiningDate?: string;
    },
  ): Promise<any> {
    try {
      const response = await axiosInstance.put(ENDPOINTS.RECRUITMENT.JOBS_UPDATE(id), data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getCandidates(params?: {
    page?: number;
    limit?: number;
    jobId?: string;
  }): Promise<PaginatedResponse<any>> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.RECRUITMENT.CANDIDATES_GET_ALL, { params });
      const raw = response.data;
      if (raw && Array.isArray(raw.data)) {
        return {
          data: raw.data,
          total: Number(raw.total) >= 0 ? Number(raw.total) : raw.data.length,
          page: Number(raw.page) > 0 ? Number(raw.page) : 1,
          limit: Number(raw.limit) > 0 ? Number(raw.limit) : 50,
          totalPages: Number(raw.totalPages) >= 0 ? Number(raw.totalPages) : 1,
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

  async createCandidate(
    name: string,
    email: string,
    jobId?: string,
    position?: string,
  ): Promise<any> {
    try {
      const payload: any = {
        name,
        email,
      };
      if (jobId) payload.jobId = jobId;
      if (position) payload.position = position;

      const response = await axiosInstance.post(
        ENDPOINTS.RECRUITMENT.CANDIDATES_CREATE,
        payload,
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateCandidateStage(id: string, stage: string): Promise<any> {
    try {
      const response = await axiosInstance.put(ENDPOINTS.RECRUITMENT.CANDIDATES_UPDATE_STAGE(id), {
        stage,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async submitEvaluation(candidateId: string, data: EvaluationData): Promise<any> {
    try {
      const response = await axiosInstance.post(
        ENDPOINTS.RECRUITMENT.CANDIDATES_EVALUATION(candidateId),
        data,
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getEvaluation(candidateId: string): Promise<EvaluationData | null> {
    try {
      const response = await axiosInstance.get(
        ENDPOINTS.RECRUITMENT.CANDIDATES_EVALUATION(candidateId),
      );
      return response.data;
    } catch (error) {
      return null;
    }
  },

  async previewOffer(
    candidateId: string,
    data: {
      annualCTC: number;
      designation?: string;
      joiningDate?: string;
      expiryDate?: string;
    },
  ): Promise<any> {
    try {
      const response = await axiosInstance.post(
        ENDPOINTS.RECRUITMENT.CANDIDATE_OFFER_PREVIEW(candidateId),
        data,
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async generateOffer(
    candidateId: string,
    data: {
      annualCTC: number;
      designation: string;
      joiningDate: string;
      expiryDate?: string;
      terms?: string;
    },
  ): Promise<any> {
    try {
      const response = await axiosInstance.post(
        ENDPOINTS.RECRUITMENT.CANDIDATE_OFFER_GENERATE(candidateId),
        data,
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getCandidateOffer(candidateId: string): Promise<any> {
    try {
      const response = await axiosInstance.get(
        ENDPOINTS.RECRUITMENT.CANDIDATE_OFFER_GET(candidateId),
      );
      return response.data;
    } catch (error) {
      return null;
    }
  },

  async getOffers(page?: number, limit?: number): Promise<any> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.RECRUITMENT.OFFERS_GET_ALL, {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
