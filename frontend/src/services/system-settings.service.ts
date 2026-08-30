import axiosInstance from "../api/axios";
import { handleApiError } from "../utils/apiError";

export interface GlobalSettings {
  timeZone: string;
  currency: string;
  dateFormat: string;
  defaultLanguage: string;
  sessionTimeoutMins: number;
  trialDays: number;
  strictPasswordPolicy: boolean;
  requireOtpLogin: boolean;
  requireCompanyApproval: boolean;
  maintenanceMode: boolean;
}

export interface RuntimeSettings {
  timeZone: string;
  currency: string;
  dateFormat: string;
  defaultLanguage: string;
}

export const systemSettingsService = {
  /** SuperAdmin full platform settings (10 fields) */
  async getSettings(): Promise<GlobalSettings> {
    try {
      const response = await axiosInstance.get("/system/settings");
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /** Safe runtime configuration for all authenticated users (Timezone, Currency, DateFormat, Language) */
  async getRuntimeSettings(): Promise<RuntimeSettings> {
    try {
      const response = await axiosInstance.get("/system/runtime-settings");
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  /** Update platform settings (SuperAdmin only) */
  async updateSettings(data: Partial<GlobalSettings>): Promise<GlobalSettings> {
    try {
      const response = await axiosInstance.put("/system/settings", data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};

