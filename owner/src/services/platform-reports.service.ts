import axiosInstance from "../api/axios";
import { handleApiError } from "../utils/apiError";

export interface PlatformReportType {
  id: string;
  title: string;
  category: string;
  description: string;
}

export interface GeneratedReportResult {
  metadata: {
    reportType: string;
    generatedAt: string;
    generatedBy: string;
    appliedFilters: {
      company: string;
      search: string;
      startDate: string;
      endDate: string;
    };
    totalRecords: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  data: any[];
}

export const platformReportsService = {
  async getReportTypes(): Promise<PlatformReportType[]> {
    try {
      const response = await axiosInstance.get("/platform/reports/types");
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async generateReport(params: {
    reportType: string;
    search?: string;
    company?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<GeneratedReportResult> {
    try {
      const response = await axiosInstance.get("/platform/reports/generate", { params });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async downloadExport(params: {
    reportType: string;
    format: "csv" | "excel" | "pdf";
    search?: string;
    company?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<void> {
    try {
      const response = await axiosInstance.get("/platform/reports/export", {
        params,
        responseType: "blob",
      });

      const disposition = response.headers["content-disposition"];
      let filename = `${params.reportType}_report.${params.format === "pdf" ? "html" : params.format === "excel" ? "csv" : "csv"}`;
      if (disposition && disposition.includes("filename=")) {
        const matches = /filename="([^"]+)"/.exec(disposition);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      handleApiError(error);
    }
  },
};
