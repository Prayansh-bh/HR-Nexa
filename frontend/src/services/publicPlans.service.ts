import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";
import { PublicPlansResponse } from "../components/landing/data/plans";

export const publicPlansService = {
  async getPublicPlans(): Promise<PublicPlansResponse> {
    try {
      const response = await axiosInstance.get<PublicPlansResponse>(
        ENDPOINTS.PUBLIC.PLANS,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
};
