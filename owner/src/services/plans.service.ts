import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";

export interface PlanFeature {
  name: string;
  enabled: boolean;
}

export interface SaaSPlan {
  id?: string;
  name: string;
  code?: string;
  description?: string;
  price: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  version?: number;
  status?: string;
  employeeLimit?: number;
  storageLimitGB?: number;
  features: PlanFeature[];
  assignedCompaniesCount?: number;
  versionsCount?: number;
  updatedAt?: string;
}

export interface FeatureCategory {
  id: string;
  name: string;
  description?: string;
  order: number;
  features?: FeatureItem[];
}

export interface FeatureItem {
  id: string;
  key: string;
  name: string;
  description?: string;
  categoryId?: string;
  category?: FeatureCategory;
  module: string;
  icon?: string;
  status: string;
}

export interface AddOn {
  id: string;
  name: string;
  code: string;
  description?: string;
  price: number;
  billingCycle: string;
  unit: string;
  maxLimit: number;
  active: boolean;
}

export interface PlanDashboardStats {
  totalPlans: number;
  publishedPlans: number;
  draftPlans: number;
  archivedPlans: number;
  activeCompanyAssignments: number;
  mostPopularPlan: string;
  highestRevenuePlan: string;
  totalFeatures: number;
  totalAddOns: number;
  recentAuditLogs: {
    id: string;
    planName: string;
    action: string;
    performedBy?: string;
    details?: string;
    timestamp: string;
  }[];
}

export const plansService = {
  async getPlans(): Promise<SaaSPlan[]> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.PLANS.GET_ALL);
      const d = response.data;
      return Array.isArray(d) ? d : Array.isArray(d?.plans) ? d.plans : [];
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  async getSelectablePlans(): Promise<Pick<SaaSPlan, "id" | "name" | "code" | "employeeLimit">[]> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.PLANS.SELECTABLE);
      const d = response.data;
      return Array.isArray(d) ? d : [];
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  async getDashboardStats(): Promise<PlanDashboardStats> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.PLANS.DASHBOARD_STATS);
      const d = response.data;
      if (!d || d.error)
        return {
          totalPlans: 3,
          publishedPlans: 3,
          draftPlans: 0,
          archivedPlans: 0,
          activeCompanyAssignments: 1,
          mostPopularPlan: "PREMIUM",
          highestRevenuePlan: "PREMIUM",
          totalFeatures: 9,
          totalAddOns: 3,
          recentAuditLogs: [],
        };
      return {
        totalPlans: typeof d.totalPlans === "number" ? d.totalPlans : 3,
        publishedPlans: typeof d.publishedPlans === "number" ? d.publishedPlans : 3,
        draftPlans: typeof d.draftPlans === "number" ? d.draftPlans : 0,
        archivedPlans: typeof d.archivedPlans === "number" ? d.archivedPlans : 0,
        activeCompanyAssignments:
          typeof d.activeCompanyAssignments === "number" ? d.activeCompanyAssignments : 1,
        mostPopularPlan: d.mostPopularPlan || "PREMIUM",
        highestRevenuePlan: d.highestRevenuePlan || "PREMIUM",
        totalFeatures: typeof d.totalFeatures === "number" ? d.totalFeatures : 9,
        totalAddOns: typeof d.totalAddOns === "number" ? d.totalAddOns : 3,
        recentAuditLogs: Array.isArray(d.recentAuditLogs) ? d.recentAuditLogs : [],
      };
    } catch (error) {
      return {
        totalPlans: 3,
        publishedPlans: 3,
        draftPlans: 0,
        archivedPlans: 0,
        activeCompanyAssignments: 1,
        mostPopularPlan: "PREMIUM",
        highestRevenuePlan: "PREMIUM",
        totalFeatures: 9,
        totalAddOns: 3,
        recentAuditLogs: [],
      };
    }
  },

  async getFeatureLibrary(): Promise<{ categories: FeatureCategory[]; features: FeatureItem[] }> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.PLANS.FEATURE_LIBRARY);
      const d = response.data;
      return {
        categories: Array.isArray(d?.categories) ? d.categories : [],
        features: Array.isArray(d?.features) ? d.features : [],
      };
    } catch (error) {
      return { categories: [], features: [] };
    }
  },

  async createFeature(data: Partial<FeatureItem>): Promise<FeatureItem> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.PLANS.CREATE_FEATURE, data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getAddOns(): Promise<AddOn[]> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.PLANS.ADD_ONS);
      const d = response.data;
      return Array.isArray(d) ? d : [];
    } catch (error) {
      return [];
    }
  },

  async createAddOn(data: Partial<AddOn>): Promise<AddOn> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.PLANS.ADD_ONS, data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async resolveCompanyFeatures(company: string): Promise<any> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.PLANS.RESOLVE(company));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getAuditLogs(): Promise<any[]> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.PLANS.AUDIT_LOGS);
      const d = response.data;
      return Array.isArray(d) ? d : [];
    } catch (error) {
      return [];
    }
  },

  async updatePlan(
    name: string,
    payload: Partial<SaaSPlan> & { features?: PlanFeature[]; price?: string },
  ): Promise<SaaSPlan> {
    try {
      const response = await axiosInstance.put(ENDPOINTS.PLANS.UPDATE(name), payload);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createPlan(
    payload: Partial<SaaSPlan> & { name: string; features: PlanFeature[]; price?: string },
  ): Promise<SaaSPlan> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.PLANS.GET_ALL, payload);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async publishPlanVersion(id: string, changelog?: string): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.PLANS.PUBLISH(id), { changelog });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async clonePlan(id: string, newName: string): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.PLANS.CLONE(id), { name: newName });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async archivePlan(nameOrId: string): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.PLANS.ARCHIVE(nameOrId));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async restorePlan(nameOrId: string): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.PLANS.RESTORE(nameOrId));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async permanentlyDeletePlan(nameOrId: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(ENDPOINTS.PLANS.PERMANENT_DELETE(nameOrId));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteDraftPlan(nameOrId: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(ENDPOINTS.PLANS.DELETE_DRAFT(nameOrId));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deletePlan(name: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(ENDPOINTS.PLANS.DELETE(name));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
