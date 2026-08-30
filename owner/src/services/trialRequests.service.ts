import axiosInstance from '../api/axios';
import { handleApiError } from '../utils/apiError';

export interface TrialRequestItem {
  id: string;
  fullName: string;
  workEmail: string;
  phoneNumber: string;
  companyName: string;
  teamSize: string;
  selectedModules: string;
  selectedModulesList: string[];
  message: string | null;
  status: 'PENDING' | 'CONTACTED' | 'PROVISIONED' | 'REJECTED';
  adminNotes: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTrialRequests {
  data: TrialRequestItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const trialRequestsService = {
  async getTrialRequests(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<PaginatedTrialRequests> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', String(params.page));
      if (params?.limit) queryParams.append('limit', String(params.limit));
      if (params?.status) queryParams.append('status', params.status);
      if (params?.search) queryParams.append('search', params.search);

      const response = await axiosInstance.get<PaginatedTrialRequests>(
        `/trial-requests?${queryParams.toString()}`,
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateStatus(
    id: string,
    status: string,
    adminNotes?: string,
  ): Promise<any> {
    try {
      const response = await axiosInstance.patch(`/trial-requests/${id}/status`, {
        status,
        adminNotes,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
