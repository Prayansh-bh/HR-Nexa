import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";

export interface CreateCheckoutOrderPayload {
  company: string;
  plan: string;
  cycle: 'Monthly' | 'Annual';
  ownerName: string;
  ownerEmail: string;
  contact?: string;
  gst?: string;
  address?: string;
}

export interface CheckoutOrderResponse {
  orderId: string;
  amountMinor: number;
  currency: string;
  keyId: string;
  company: string;
  planName: string;
  cycle: string;
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerificationResult {
  success: boolean;
  status: 'PROVISIONED' | 'ALREADY_PROVISIONED' | 'PROVISIONING_IN_PROGRESS';
  companyId?: string | null;
  subscriptionId?: string | null;
  redirectUrl?: string;
  message?: string;
}

export const checkoutService = {
  async createCheckoutOrder(
    payload: CreateCheckoutOrderPayload,
  ): Promise<CheckoutOrderResponse> {
    try {
      const response = await axiosInstance.post<CheckoutOrderResponse>(
        ENDPOINTS.PUBLIC.CHECKOUT_ORDER,
        payload,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  async verifyPayment(
    payload: VerifyPaymentPayload,
  ): Promise<VerificationResult> {
    try {
      const response = await axiosInstance.post<VerificationResult>(
        ENDPOINTS.PUBLIC.CHECKOUT_VERIFY,
        payload,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
};
