import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";
import { useAuthStore } from "../store/authStore";
import { AuthUser } from "../types";
import { queryClient } from "../router";
import { realtimeEventsService } from "./realtimeEvents.service";
import { OWNER_APP_URL } from "../config/api";

export const authService = {
  clearImpersonationState(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem("hrms.impersonator");
    localStorage.removeItem("hrms.impersonator_role");
    localStorage.removeItem("hrms.company");
    localStorage.removeItem("hrms.impersonation.originalToken");
    localStorage.removeItem("hrms.impersonation.originalRefreshToken");
    localStorage.removeItem("hrms.impersonation.originalUser");
    window.dispatchEvent(new Event("impersonation-updated"));
  },

  async login(email: string, pass: string): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.AUTH.LOGIN, { email, password: pass });
      const data = response.data;
      if (data && data.requiresOtp) {
        return {
          requiresOtp: true,
          challengeToken: data.challengeToken,
          expiresAt: data.expiresAt,
        };
      }
      this.clearImpersonationState();
      if (data && data.user && data.user.role === 'SuperAdmin') {
        this.removeAccessToken();
        throw new Error(
          `Access Denied: Platform Owner / SuperAdmin accounts must log in at ${OWNER_APP_URL}/login`,
        );
      }
      if (data && data.access_token) {
        this.storeAccessToken(data.access_token);
        this.storeRefreshToken(data.refresh_token);
      }
      return data.user;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async verifyOtp(challengeToken: string, otp: string): Promise<any> {
    try {
      const response = await axiosInstance.post('/auth/verify-otp', { challengeToken, otp });
      const data = response.data;
      this.clearImpersonationState();
      if (data && data.user && data.user.role === 'SuperAdmin') {
        this.removeAccessToken();
        throw new Error(
          `Access Denied: Platform Owner / SuperAdmin accounts must log in at ${OWNER_APP_URL}/login`,
        );
      }
      if (data && data.access_token) {
        this.storeAccessToken(data.access_token);
        this.storeRefreshToken(data.refresh_token);
      }
      return data.user;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async resendOtp(challengeToken: string): Promise<any> {
    try {
      const response = await axiosInstance.post('/auth/resend-otp', { challengeToken });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async logout(): Promise<void> {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const refreshToken =
        typeof window !== "undefined" ? localStorage.getItem("hrms.refreshToken") : null;
      await axiosInstance.post(ENDPOINTS.AUTH.LOGOUT, { refreshToken });
    } catch {}
    this.removeAccessToken();
    useAuthStore.getState().clearAuth();
  },

  async getProfile(): Promise<any> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.AUTH.PROFILE);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async forgotPassword(email: string): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async resetPassword(resetToken: string, newPass: string): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.AUTH.RESET_PASSWORD, {
        resetToken,
        newPassword: newPass,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  storeAccessToken(token: string): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("hrms.token", token);
    }
  },

  storeRefreshToken(token: string | null | undefined): void {
    if (typeof window === "undefined") return;
    if (token) {
      localStorage.setItem("hrms.refreshToken", token);
    } else {
      localStorage.removeItem("hrms.refreshToken");
    }
  },

  removeAccessToken(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem("hrms.token");
      localStorage.removeItem("hrms.refreshToken");
      this.clearImpersonationState();
    }
  },

  removeRefreshToken(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem("hrms.refreshToken");
    }
  },

  getCurrentUser(): any {
    return null;
  },

  isAuthenticated(): boolean {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("hrms.token");
  },

  async getMyPermissions(): Promise<any> {
    try {
      const response = await axiosInstance.get("/auth/me/permissions");
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getRolePermissionsMatrix(companyId?: string): Promise<Record<string, string[]>> {
    try {
      const url = companyId
        ? `/auth/roles/permissions?companyId=${companyId}`
        : "/auth/roles/permissions";
      const response = await axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateRolePermissions(
    roleId: string,
    permissions: string[],
    companyId?: string,
  ): Promise<any> {
    try {
      const response = await axiosInstance.put(`/auth/roles-mgmt/${roleId}`, {
        permissions,
        companyId,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getRoles(companyId?: string): Promise<any[]> {
    try {
      const url = companyId ? `/auth/roles-mgmt?companyId=${companyId}` : "/auth/roles-mgmt";
      const response = await axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getAssignableRoles(): Promise<any[]> {
    try {
      const response = await axiosInstance.get("/auth/roles-mgmt/assignable");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async bootstrapRoles(companyId?: string): Promise<any[]> {
    try {
      const response = await axiosInstance.post("/auth/roles-mgmt/bootstrap", {
        companyId,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createRole(
    name: string,
    description: string,
    permissions: string[],
    companyId?: string,
  ): Promise<any> {
    try {
      const response = await axiosInstance.post("/auth/roles-mgmt", {
        name,
        description,
        permissions,
        companyId,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateRole(
    id: string,
    data: { name?: string; description?: string; permissions?: string[]; companyId?: string },
  ): Promise<any> {
    try {
      const response = await axiosInstance.put(`/auth/roles-mgmt/${id}`, data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteRole(id: string, companyId?: string): Promise<any> {
    try {
      const url = companyId
        ? `/auth/roles-mgmt/${id}?companyId=${companyId}`
        : `/auth/roles-mgmt/${id}`;
      const response = await axiosInstance.delete(url);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async refreshToken(): Promise<string> {
    const refreshToken =
      typeof window !== "undefined" ? localStorage.getItem("hrms.refreshToken") : null;
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await axiosInstance.post(ENDPOINTS.AUTH.REFRESH, {
      refreshToken,
    });
    this.storeAccessToken(response.data.access_token);
    this.storeRefreshToken(response.data.refresh_token);
    return response.data.access_token;
  },

  async impersonate(companyId: string, companyName?: string): Promise<any> {
    try {
      if (typeof window !== "undefined") {
        const existingOriginalToken = localStorage.getItem("hrms.impersonation.originalToken");
        if (!existingOriginalToken) {
          const currentToken = localStorage.getItem("hrms.token");
          const currentRefreshToken = localStorage.getItem("hrms.refreshToken");
          const currentUser = localStorage.getItem("hrms.user");

          if (currentToken) {
            localStorage.setItem("hrms.impersonation.originalToken", currentToken);
          }
          if (currentRefreshToken) {
            localStorage.setItem("hrms.impersonation.originalRefreshToken", currentRefreshToken);
          }
          if (currentUser) {
            localStorage.setItem("hrms.impersonation.originalUser", currentUser);
          }
        }
      }

      await queryClient.cancelQueries();
      queryClient.clear();

      const response = await axiosInstance.post(`/auth/impersonate/company/${companyId}`);
      const data = response.data;
      if (data && data.access_token) {
        this.storeAccessToken(data.access_token);
        this.storeRefreshToken(data.refresh_token);
        if (typeof window !== "undefined" && companyName) {
          localStorage.setItem("hrms.impersonator", companyName);
          localStorage.setItem("hrms.impersonator_role", "SuperAdmin");
        }
        realtimeEventsService.reconnect();
      }
      return data.user;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async exitImpersonation(): Promise<AuthUser> {
    if (typeof window === "undefined") {
      throw new Error("Cannot exit impersonation outside browser environment.");
    }

    const originalToken = localStorage.getItem("hrms.impersonation.originalToken");
    const originalRefreshToken = localStorage.getItem("hrms.impersonation.originalRefreshToken");

    if (!originalToken) {
      this.clearImpersonationState();
      const currentProfile = await this.getProfile().catch(() => null);
      if (currentProfile && currentProfile.role === "SuperAdmin") {
        useAuthStore.getState().setUser(currentProfile);
        return currentProfile;
      }
      throw new Error("Original SuperAdmin session is unavailable.");
    }

    await queryClient.cancelQueries();
    queryClient.clear();

    this.storeAccessToken(originalToken);
    if (originalRefreshToken) {
      this.storeRefreshToken(originalRefreshToken);
    } else {
      localStorage.removeItem("hrms.refreshToken");
    }

    let freshProfile: AuthUser | null = null;
    try {
      freshProfile = await this.getProfile();
    } catch (err) {
      this.clearImpersonationState();
      throw new Error("Restored session failed SuperAdmin profile verification.");
    }

    if (!freshProfile || freshProfile.role !== "SuperAdmin") {
      this.clearImpersonationState();
      throw new Error("Restored session failed SuperAdmin profile verification.");
    }

    useAuthStore.getState().setUser(freshProfile);
    this.clearImpersonationState();
    realtimeEventsService.reconnect();

    return freshProfile;
  },

  async getSessions(): Promise<any[]> {
    try {
      const response = await axiosInstance.get("/auth/sessions");
      return Array.isArray(response.data) ? response.data : response.data?.sessions || [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async revokeSession(sessionId: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/auth/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async revokeOtherSessions(): Promise<any> {
    try {
      const response = await axiosInstance.delete("/auth/sessions");
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async revokeAllSessions(userId?: string): Promise<any> {
    try {
      const response = await axiosInstance.post("/auth/revoke-sessions", { userId });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async changePassword(dto: { oldPassword?: string; currentPassword?: string; newPassword?: string; pass?: string }): Promise<any> {
    try {
      const response = await axiosInstance.post("/auth/change-password", dto);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async verifyEmail(token: string): Promise<any> {
    try {
      const response = await axiosInstance.post("/auth/verify-email", { token });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
