import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";
import { PaginatedResponse } from "../types/pagination";

export interface DocumentQueryParams {
  category?: string;
  employeeId?: string;
  verificationStatus?: string;
  docType?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const documentService = {
  async getDocuments(
    params?: DocumentQueryParams | string,
  ): Promise<PaginatedResponse<any>> {
    try {
      let queryStr = "";
      if (typeof params === "string") {
        queryStr = `employeeId=${encodeURIComponent(params)}`;
      } else if (params) {
        const searchParams = new URLSearchParams();
        if (params.category) searchParams.append("category", params.category);
        if (params.employeeId) searchParams.append("employeeId", params.employeeId);
        if (params.verificationStatus)
          searchParams.append("verificationStatus", params.verificationStatus);
        if (params.docType) searchParams.append("docType", params.docType);
        if (params.status) searchParams.append("status", params.status);
        if (params.search) searchParams.append("search", params.search);
        if (params.page) searchParams.append("page", String(params.page));
        if (params.limit) searchParams.append("limit", String(params.limit));
        queryStr = searchParams.toString();
      }

      const response = await axiosInstance.get(
        `${ENDPOINTS.DOCUMENT.GET_ALL}${queryStr ? "?" + queryStr : ""}`,
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async uploadDocument(
    employeeId: string,
    docType: string,
    fileName: string,
    size: string,
    fileData?: string,
  ): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.DOCUMENT.UPLOAD, {
        employeeId,
        docType,
        fileName,
        size,
        fileData,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteDocument(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(ENDPOINTS.DOCUMENT.DELETE(id));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async previewEmployeeOffer(data: {
    employeeId: string;
    annualCTC: number;
    designation?: string;
    joiningDate?: string;
    expiryDate?: string;
  }): Promise<any> {
    try {
      const response = await axiosInstance.post("/documents/preview-employee-offer", data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async generateEmployeeOffer(data: {
    employeeId: string;
    annualCTC: number;
    designation: string;
    joiningDate: string;
    expiryDate?: string;
    terms?: string;
  }): Promise<any> {
    try {
      const response = await axiosInstance.post("/documents/generate-employee-offer", data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getDocumentContent(documentId: string): Promise<string> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.DOCUMENT.DOWNLOAD(documentId), {
        responseType: "text",
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};

