import axiosInstance from '../api/axios';
import { handleApiError } from '../utils/apiError';

export interface SubmitTrialRequestPayload {
  fullName: string;
  workEmail: string;
  phoneNumber: string;
  companyName: string;
  teamSize: string;
  selectedModules?: string[];
  message?: string;
}

export interface SubmitTrialRequestResponse {
  success: boolean;
  id: string;
  message: string;
  companyName: string;
  workEmail: string;
}

export const trialRequestService = {
  /**
   * Submits a 14-day free trial request / lead.
   */
  async submitTrialRequest(
    payload: SubmitTrialRequestPayload,
  ): Promise<SubmitTrialRequestResponse> {
    try {
      const response = await axiosInstance.post<SubmitTrialRequestResponse>(
        '/trial-requests',
        payload,
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
