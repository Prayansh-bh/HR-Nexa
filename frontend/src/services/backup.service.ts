import axiosInstance from "../api/axios";
import { handleApiError } from "../utils/apiError";

export interface BackupRecord {
  id: string;
  name?: string;
  d: string;
  date?: string;
  s: string;
  rawSizeBytes?: number;
  t: string;
  st: string;
  status?: string;
  filename: string;
}

export const backupService = {
  async getBackups(): Promise<BackupRecord[]> {
    try {
      const response = await axiosInstance.get("/system/backups");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createBackup(): Promise<BackupRecord> {
    try {
      const response = await axiosInstance.post("/system/backups");
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async restoreBackup(filename: string): Promise<any> {
    try {
      const response = await axiosInstance.post(`/system/backups/restore/${filename}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteBackup(filename: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/system/backups/${filename}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async downloadBackup(filename: string): Promise<void> {
    try {
      const response = await axiosInstance.get(
        `/system/backups/download/${encodeURIComponent(filename)}`,
        {
          responseType: "blob",
        },
      );
      const blob = new Blob([response.data], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      if (error?.response?.data instanceof Blob) {
        const text = await error.response.data.text();
        try {
          const json = JSON.parse(text);
          throw new Error(json.message || "Failed to download backup snapshot");
        } catch {
          throw new Error(text || "Failed to download backup snapshot");
        }
      }
      return handleApiError(error);
    }
  },
};
