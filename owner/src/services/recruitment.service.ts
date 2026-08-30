import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";

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

  async getJobPostings(): Promise<any[]> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.RECRUITMENT.JOBS_GET_ALL);
      return response.data;
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

  async getCandidates(): Promise<any[]> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.RECRUITMENT.CANDIDATES_GET_ALL);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createCandidate(
    name: string,
    email: string,
    jobId: string,
    position: string,
  ): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.RECRUITMENT.CANDIDATES_CREATE, {
        name,
        email,
        jobId,
        position,
      });
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
};
