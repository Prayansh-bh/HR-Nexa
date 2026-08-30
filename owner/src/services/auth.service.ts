import { ownerAxios, clearOwnerSession } from "../api/axios";
import { OWNER_STORAGE_KEYS } from "../config/storage";
import { OwnerUser } from "../types/auth";
import { useOwnerAuthStore } from "../store/authStore";
import { handleApiError } from "../utils/apiError";
import { queryClient } from "../router";
import { realtimeEventsService } from "./realtimeEvents.service";

export const ownerAuthService = {
  async login(email: string, password: string): Promise<{ user: OwnerUser; access_token: string; refresh_token: string }> {
    const response = await ownerAxios.post("/auth/login", { email, password });
    const { user, access_token, refresh_token } = response.data;

    if (!user) {
      if (response.data?.requiresOtp) {
        throw new Error("Two-Factor Authentication is currently enabled on the backend. Please verify your OTP or disable 2FA in system settings.");
      }
      throw new Error("Invalid response received from authentication server.");
    }

    // Strict Platform Owner validation: Reject non-SuperAdmin logins on Owner portal
    if (user.role !== "SuperAdmin") {
      clearOwnerSession();
      throw new Error("Access Denied: Owner Portal is restricted to SuperAdmin accounts. Please use the Tenant Portal at app.hrnexa.com.");
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(OWNER_STORAGE_KEYS.TOKEN, access_token);
      localStorage.setItem(OWNER_STORAGE_KEYS.REFRESH_TOKEN, refresh_token);
      localStorage.setItem(OWNER_STORAGE_KEYS.USER, JSON.stringify(user));
    }

    useOwnerAuthStore.getState().setUser(user);
    return { user, access_token, refresh_token };
  },

  async logout(): Promise<void> {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await ownerAxios.post("/auth/logout");
    } catch {
      // Ignore network errors on logout
    } finally {
      clearOwnerSession();
      useOwnerAuthStore.getState().clearAuth();
    }
  },

  async getProfile(): Promise<OwnerUser> {
    const response = await ownerAxios.get("/auth/profile");
    return response.data;
  },

  async getMyPermissions(): Promise<{ permissions: string[] }> {
    const response = await ownerAxios.get("/auth/me/permissions");
    return response.data;
  },

  async getRolePermissionsMatrix(companyId?: string): Promise<Record<string, string[]>> {
    try {
      const url = companyId
        ? `/auth/roles/permissions?companyId=${companyId}`
        : "/auth/roles/permissions";
      const response = await ownerAxios.get(url);
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
      const response = await ownerAxios.put(`/auth/roles-mgmt/${roleId}`, {
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
      const response = await ownerAxios.get(url);
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
      const response = await ownerAxios.post("/auth/roles-mgmt", {
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

  async deleteRole(roleId: string, companyId?: string): Promise<any> {
    try {
      const url = companyId
        ? `/auth/roles-mgmt/${roleId}?companyId=${companyId}`
        : `/auth/roles-mgmt/${roleId}`;
      const response = await ownerAxios.delete(url);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async impersonate(companyId: string, companyName?: string): Promise<any> {
    try {
      const response = await ownerAxios.post(`/auth/impersonate/company/${companyId}`);
      const data = response.data;
      if (data && data.redirectUrl) {
        if (typeof window !== "undefined") {
          window.open(data.redirectUrl, "_blank");
        }
        return {
          success: true,
          redirectUrl: data.redirectUrl,
          companyName: companyName || "Company",
        };
      }
    } catch (error) {
      return handleApiError(error);
    }
  },

  async forgotPassword(email: string): Promise<any> {
    try {
      const response = await ownerAxios.post("/auth/forgot-password", { email });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async resetPassword(resetToken: string, newPassword: string): Promise<any> {
    try {
      const response = await ownerAxios.post("/auth/reset-password", {
        resetToken,
        newPassword,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<any> {
    try {
      const response = await ownerAxios.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async requestSuperAdminEmailChange(currentPassword: string, newEmail: string): Promise<{ message: string; challengeToken: string; newEmail: string }> {
    try {
      const response = await ownerAxios.post("/auth/superadmin/email-change", {
        currentPassword,
        newEmail,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async verifySuperAdminEmailChange(challengeToken: string, otp: string, newEmail: string): Promise<{ success: boolean; message: string; newEmail: string }> {
    try {
      const response = await ownerAxios.post("/auth/superadmin/email-change/verify", {
        challengeToken,
        otp,
        newEmail,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};

export const authService = ownerAuthService;
export default ownerAuthService;
