import axiosInstance from "../api/axios";
import { handleApiError } from "../utils/apiError";

export interface PaymentGatewayConfig {
  keyId: string | null;
}

const ENDPOINTS = {
  PAYMENT_GATEWAY: "/system/config/payment-gateway",
};

export const systemConfigService = {
  async getPaymentGatewayConfig(): Promise<PaymentGatewayConfig> {
    try {
      const res = await axiosInstance.get(ENDPOINTS.PAYMENT_GATEWAY);
      return res.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async savePaymentGatewayConfig(
    keyId: string,
    keySecret: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await axiosInstance.put(ENDPOINTS.PAYMENT_GATEWAY, { keyId, keySecret });
      return res.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
