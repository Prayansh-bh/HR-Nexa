import ownerAxios from "../api/axios";

export enum IntegrationProvider {
  RAZORPAY = "RAZORPAY",
  AWS_S3 = "AWS_S3",
  SMTP_EMAIL = "SMTP_EMAIL",
}

export enum IntegrationStatus {
  CONNECTED = "CONNECTED",
  FAILED = "FAILED",
  UNTESTED = "UNTESTED",
  DISABLED = "DISABLED",
}

export interface SafeIntegrationCredentialResponse {
  id: string;
  provider: IntegrationProvider;
  name: string;
  enabled: boolean;
  companyId: string | null;
  status: IntegrationStatus;
  config: Record<string, any>;
  maskedSecrets: Record<string, string>;
  lastTestedAt: string | null;
  lastError: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntegrationCredentialPayload {
  provider: IntegrationProvider;
  name: string;
  config: Record<string, any>;
  secrets?: Record<string, any>;
}

export interface UpdateIntegrationCredentialPayload {
  name?: string;
  config?: Record<string, any>;
  secrets?: Record<string, any>;
}

export const platformIntegrationsService = {
  async listCredentials(): Promise<SafeIntegrationCredentialResponse[]> {
    try {
      const response = await ownerAxios.get("/integrations");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      throw new Error(
        error?.response?.data?.message || error?.message || "Failed to fetch platform credentials",
      );
    }
  },

  async getCredential(id: string): Promise<SafeIntegrationCredentialResponse> {
    try {
      const response = await ownerAxios.get(`/integrations/${id}`);
      return response.data;
    } catch (error: any) {
      throw new Error(
        error?.response?.data?.message || error?.message || "Failed to fetch platform credential",
      );
    }
  },

  async createCredential(
    payload: CreateIntegrationCredentialPayload,
  ): Promise<SafeIntegrationCredentialResponse> {
    try {
      const response = await ownerAxios.post("/integrations", payload);
      return response.data;
    } catch (error: any) {
      throw new Error(
        error?.response?.data?.message || error?.message || "Failed to create platform credential",
      );
    }
  },

  async updateCredential(
    id: string,
    payload: UpdateIntegrationCredentialPayload,
  ): Promise<SafeIntegrationCredentialResponse> {
    try {
      const response = await ownerAxios.patch(`/integrations/${id}`, payload);
      return response.data;
    } catch (error: any) {
      throw new Error(
        error?.response?.data?.message || error?.message || "Failed to update platform credential",
      );
    }
  },

  async setStatus(
    id: string,
    enabled: boolean,
  ): Promise<SafeIntegrationCredentialResponse> {
    try {
      const response = await ownerAxios.patch(`/integrations/${id}/status`, {
        enabled,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(
        error?.response?.data?.message || error?.message || "Failed to toggle platform credential status",
      );
    }
  },

  async deleteCredential(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await ownerAxios.delete(`/integrations/${id}`);
      return response.data;
    } catch (error: any) {
      throw new Error(
        error?.response?.data?.message || error?.message || "Failed to delete platform credential",
      );
    }
  },
};
