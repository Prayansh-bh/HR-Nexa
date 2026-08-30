import { create } from "zustand";
import { recruitmentService, EvaluationData } from "../services/recruitment.service";

export interface JobRequisition {
  id: string;
  title: string;
  dept: string;
  departmentId?: string;
  designationId?: string;
  hiringManager?: string;
  openings: number;
  status: string;
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
}

export interface Candidate {
  id: string;
  name: string;
  position: string;
  status: "Applied" | "Screening" | "Interview" | "Offer" | "Hired" | "Rejected";
  score: number | null; // null = not yet evaluated
  resume: string;
  email?: string;
  evaluation?: EvaluationData | null;
}

export interface RecruitmentStore {
  requisitions: JobRequisition[];
  candidates: Candidate[];
  isLoading: boolean;
  error: string | null;

  setRequisitions: (
    update: JobRequisition[] | ((prev: JobRequisition[]) => JobRequisition[]),
  ) => void;
  setCandidates: (update: Candidate[] | ((prev: Candidate[]) => Candidate[])) => void;

  fetchRequisitions: () => Promise<void>;
  addRequisition: (reqData: Omit<JobRequisition, "id" | "status">) => Promise<void>;
  updateRequisition: (id: string, reqData: Partial<JobRequisition>) => Promise<void>;
  deleteRequisition: (id: string) => Promise<void>;

  fetchCandidates: () => Promise<void>;
  addCandidate: (candData: { name: string; email: string; position: string }) => Promise<void>;
  updateCandidateStage: (id: string, stage: Candidate["status"]) => Promise<void>;
  submitEvaluation: (candidateId: string, data: EvaluationData) => Promise<void>;
  fetchEvaluation: (candidateId: string) => Promise<EvaluationData | null>;
}

export const useRecruitmentStore = create<RecruitmentStore>()((set, get) => ({
  requisitions: [],
  candidates: [],
  isLoading: false,
  error: null,

  setRequisitions: (update) =>
    set((state) => ({
      requisitions: typeof update === "function" ? update(state.requisitions) : update,
    })),
  setCandidates: (update) =>
    set((state) => ({
      candidates: typeof update === "function" ? update(state.candidates) : update,
    })),

  fetchRequisitions: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await recruitmentService.getJobPostings();
      const rawList = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.data)
          ? (res as any).data
          : [];
      const formatted: JobRequisition[] = rawList.map((j: any) => ({
        id: j.id,
        title: j.title,
        dept: j.department,
        departmentId: j.departmentId || undefined,
        designationId: j.designationId || undefined,
        hiringManager: j.hiringManager || undefined,
        openings: j.openings || j.applicantsCount || 0,
        status: j.status,
        location: j.location,
        type: j.type,
        priority: j.priority,
        minSalary: j.minSalary ?? undefined,
        maxSalary: j.maxSalary ?? undefined,
        currency: j.currency,
        budgetJustification: j.budgetJustification || undefined,
        jobDescription: j.jobDescription || undefined,
        skillsRequired: j.skillsRequired ? JSON.parse(j.skillsRequired) : [],
        experienceRequired: j.experienceRequired || undefined,
        educationRequired: j.educationRequired || undefined,
        expectedJoiningDate: j.expectedJoiningDate || undefined,
      }));
      set({ requisitions: formatted, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch requisitions",
        isLoading: false,
      });
    }
  },

  addRequisition: async (reqData) => {
    await recruitmentService.createJobPosting({
      title: reqData.title,
      department: reqData.dept,
      departmentId: reqData.departmentId,
      designationId: reqData.designationId,
      hiringManager: reqData.hiringManager,
      status: "Open",
      openings: reqData.openings,
      location: reqData.location,
      type: reqData.type,
      priority: reqData.priority,
      minSalary: reqData.minSalary,
      maxSalary: reqData.maxSalary,
      currency: reqData.currency,
      budgetJustification: reqData.budgetJustification,
      jobDescription: reqData.jobDescription,
      skillsRequired: reqData.skillsRequired,
      experienceRequired: reqData.experienceRequired,
      educationRequired: reqData.educationRequired,
      expectedJoiningDate: reqData.expectedJoiningDate,
    });
    await get().fetchRequisitions();
  },

  deleteRequisition: async (id) => {
    await recruitmentService.deleteJobPosting(id);
    await get().fetchRequisitions();
  },

  updateRequisition: async (id, reqData) => {
    await recruitmentService.updateJobPosting(id, {
      title: reqData.title,
      department: reqData.dept,
      departmentId: reqData.departmentId,
      designationId: reqData.designationId,
      hiringManager: reqData.hiringManager,
      status: reqData.status,
      openings: reqData.openings,
      location: reqData.location,
      type: reqData.type,
      priority: reqData.priority,
      minSalary: reqData.minSalary,
      maxSalary: reqData.maxSalary,
      currency: reqData.currency,
      budgetJustification: reqData.budgetJustification,
      jobDescription: reqData.jobDescription,
      skillsRequired: reqData.skillsRequired,
      experienceRequired: reqData.experienceRequired,
      educationRequired: reqData.educationRequired,
      expectedJoiningDate: reqData.expectedJoiningDate,
    });
    await get().fetchRequisitions();
  },

  fetchCandidates: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await recruitmentService.getCandidates();
      const rawList = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.data)
          ? (res as any).data
          : [];
      const formatted: Candidate[] = rawList.map((c: any) => ({
        id: c.id,
        name: c.name,
        position: c.jobTitle,
        status: c.stage as Candidate["status"],
        score: typeof c.score === "number" ? c.score : null, // never default to 80
        resume: c.resume || "",
        email: c.email,
        evaluation: c.evaluations?.[0] || null,
      }));
      set({ candidates: formatted, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch candidates",
        isLoading: false,
      });
    }
  },

  addCandidate: async (candData) => {
    const requisitions = get().requisitions;
    const matchingReq = requisitions.find((r) => r.title === candData.position);
    const jobId = matchingReq ? matchingReq.id : "default-job";
    await recruitmentService.createCandidate(
      candData.name,
      candData.email,
      jobId,
      candData.position,
    );
    await get().fetchCandidates();
  },

  updateCandidateStage: async (id, stage) => {
    await recruitmentService.updateCandidateStage(id, stage);
    await get().fetchCandidates();
  },

  submitEvaluation: async (candidateId, data) => {
    await recruitmentService.submitEvaluation(candidateId, data);
    await get().fetchCandidates();
  },

  fetchEvaluation: async (candidateId) => {
    return recruitmentService.getEvaluation(candidateId);
  },
}));
