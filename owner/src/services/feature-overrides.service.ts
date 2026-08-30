import axiosInstance from '../api/axios';
import { handleApiError } from '../utils/apiError';

export interface TenantFeatureOverviewItem {
  featureKey: string;
  featureName: string;
  category: string;
  planIncluded: boolean;
  override: {
    enabled: boolean;
    reason?: string | null;
    notes?: string | null;
    grantedBy?: string | null;
    expiresAt?: string | null;
    revokedAt?: string | null;
  } | null;
  effectiveEnabled: boolean;
}

export const featureOverridesService = {
  async getCompanyFeatures(
    companyId: string,
  ): Promise<{ companyId: string; features: TenantFeatureOverviewItem[] }> {
    try {
      const response = await axiosInstance.get(
        `/companies/${companyId}/feature-overrides`,
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getEffectiveFeaturesMap(
    companyId: string,
  ): Promise<{ companyId: string; effectiveFeatures: Record<string, boolean> }> {
    try {
      const response = await axiosInstance.get(
        `/companies/${companyId}/feature-overrides/effective`,
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async setTenantOverride(
    companyId: string,
    featureKey: string,
    data: {
      enabled: boolean;
      reason?: string;
      notes?: string;
      expiresAt?: string | null;
    },
  ): Promise<any> {
    try {
      const response = await axiosInstance.put(
        `/companies/${companyId}/feature-overrides/${featureKey}`,
        data,
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async removeTenantOverride(
    companyId: string,
    featureKey: string,
  ): Promise<any> {
    try {
      const response = await axiosInstance.delete(
        `/companies/${companyId}/feature-overrides/${featureKey}`,
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
