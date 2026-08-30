import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { useAuthStore } from "../store/authStore";
import { documentService, DocumentQueryParams } from "../services/document.service";
import { PaginatedResponse } from "../types/pagination";

export interface UseDocumentsQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  employeeId?: string;
  docType?: string;
  status?: string;
  verificationStatus?: string;
}

export const useDocumentsQuery = (
  optionsOrCategory?: string | UseDocumentsQueryOptions,
  maybeEmployeeId?: string,
) => {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  let options: UseDocumentsQueryOptions = {};
  if (typeof optionsOrCategory === "string") {
    options = {
      category: optionsOrCategory,
      employeeId: maybeEmployeeId,
      page: 1,
      limit: 50,
    };
  } else if (optionsOrCategory && typeof optionsOrCategory === "object") {
    options = optionsOrCategory;
  }

  const page = options.page && Number(options.page) > 0 ? Math.floor(Number(options.page)) : 1;
  const limit = options.limit && Number(options.limit) > 0 ? Math.floor(Number(options.limit)) : 50;
  const search = options.search?.trim() || undefined;
  const category = options.category || undefined;
  const employeeId = options.employeeId || undefined;
  const docType = options.docType || undefined;
  const status = options.status || undefined;
  const verificationStatus = options.verificationStatus || undefined;

  const normalizedFilters = {
    page,
    limit,
    search: search || "",
    category: category || "",
    employeeId: employeeId || "",
    docType: docType || "",
    status: status || "",
    verificationStatus: verificationStatus || "",
  };

  const query = useQuery<PaginatedResponse<any>>({
    queryKey: ["documents", companyId || "default", normalizedFilters],
    queryFn: async () => {
      const res = await documentService.getDocuments({
        page,
        limit,
        search,
        category,
        employeeId,
        docType,
        status,
        verificationStatus,
      });
      return res;
    },
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
  });

  const rawData = query.data;
  const documents: any[] = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.data)
    ? rawData.data
    : [];
  const total = typeof rawData?.total === "number" ? rawData.total : documents.length;
  const totalPages =
    typeof rawData?.totalPages === "number"
      ? rawData.totalPages
      : total === 0
      ? 0
      : Math.ceil(total / limit);

  return {
    ...query,
    data: rawData,
    documents,
    total,
    totalPages,
    page: rawData?.page ?? page,
    limit: rawData?.limit ?? limit,
    pagination: rawData,
  };
};

export const usePendingDocumentsQuery = (options?: {
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const search = options?.search?.trim() || "";
  const page = options?.page && Number(options?.page) > 0 ? Math.floor(Number(options.page)) : 1;
  const limit = options?.limit && Number(options?.limit) > 0 ? Math.floor(Number(options.limit)) : 25;

  const normalizedFilters = {
    verificationStatus: "PENDING",
    search,
    page,
    limit,
  };

  const query = useQuery<PaginatedResponse<any>>({
    queryKey: ["documents", companyId || "default", normalizedFilters],
    queryFn: async () => {
      const res = await documentService.getDocuments({
        verificationStatus: "PENDING",
        search: search || undefined,
        page,
        limit,
      });
      return res;
    },
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
  });

  const rawData = query.data;
  const documents: any[] = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.data)
    ? rawData.data
    : [];
  const total = typeof rawData?.total === "number" ? rawData.total : documents.length;
  const totalPages =
    typeof rawData?.totalPages === "number"
      ? rawData.totalPages
      : total === 0
      ? 0
      : Math.ceil(total / limit);

  return {
    ...query,
    data: rawData,
    documents,
    total,
    totalPages,
    page: rawData?.page ?? page,
    limit: rawData?.limit ?? limit,
    pagination: rawData,
  };
};

export const useVerifyDocumentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const res = await axiosInstance.patch(`/documents/${encodeURIComponent(id)}/verify`, {
        note,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
};

export const useRejectDocumentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await axiosInstance.patch(`/documents/${encodeURIComponent(id)}/reject`, {
        reason,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
};

export const useUploadDocumentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await axiosInstance.post(ENDPOINTS.DOCUMENT.UPLOAD, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
};

export const useDeleteDocumentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await axiosInstance.delete(ENDPOINTS.DOCUMENT.DELETE(id));
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
};

/** Authenticated file download helper utilizing axiosInstance with Bearer JWT token */
export const downloadDocumentFile = async (documentId: string, defaultFileName: string) => {
  try {
    const response = await axiosInstance.get(ENDPOINTS.DOCUMENT.DOWNLOAD(documentId), {
      responseType: "blob",
    });

    // Check if the returned blob is actually a JSON error response
    if (response.data?.type === "application/json") {
      const text = await response.data.text();
      try {
        const json = JSON.parse(text);
        throw new Error(json.message || "Failed to download file");
      } catch (e: any) {
        if (e.message !== "Failed to download file") throw new Error(text);
        throw e;
      }
    }

    let fileName = defaultFileName || "document.pdf";
    const rawDisposition = response.headers["content-disposition"];
    const contentDisposition = rawDisposition ? String(rawDisposition) : undefined;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i,
      );
      if (filenameMatch && filenameMatch[1]) {
        fileName = decodeURIComponent(filenameMatch[1]);
      }
    }

    // Create temporary blob object URL
    const blob = new Blob([response.data], {
      type: response.headers["content-type"]
        ? String(response.headers["content-type"])
        : "application/octet-stream",
    });
    const objectUrl = window.URL.createObjectURL(blob);

    // Trigger browser download via temporary anchor element using MouseEvent
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);

    const clickEvent = new MouseEvent("click", {
      view: window,
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(clickEvent);

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(objectUrl);
    }, 300);
  } catch (error: any) {
    if (error.response?.data instanceof Blob && error.response.data.type === "application/json") {
      const errorText = await error.response.data.text();
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || "File download failed");
      } catch (e: any) {
        throw new Error(errorText || "File download failed");
      }
    }
    throw error;
  }
};

/** Authenticated document text/html content fetcher for in-modal preview */
export const fetchDocumentContent = async (documentId: string): Promise<string> => {
  const response = await axiosInstance.get(ENDPOINTS.DOCUMENT.DOWNLOAD(documentId), {
    responseType: "text",
  });
  return response.data;
};
