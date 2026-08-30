import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";

export interface Invoice {
  id: string;
  type: string;
  company: string;
  date: string;
  amount: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentRefund {
  id: string;
  paymentRecordId: string;
  gateway: string;
  gatewayPaymentId: string;
  gatewayRefundId?: string | null;
  amount: number;
  amountMinor: number;
  currency: string;
  status: 'REQUESTED' | 'PENDING' | 'PROCESSED' | 'FAILED' | string;
  reason?: string | null;
  receipt?: string | null;
  requestedBy?: string | null;
  requestedAt: string;
  processedAt?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId?: string;
  company: string;
  amount: number;
  refundedAmount?: number;
  paymentMethod: string;
  transactionId: string;
  gatewayPaymentId?: string | null;
  status: string;
  type: string;
  refunds?: PaymentRefund[];
  createdAt?: string;
  updatedAt?: string;
}

export const billingService = {
  async getInvoices(): Promise<Invoice[]> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.BILLING.INVOICES_GET_ALL);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createInvoice(invoice: {
    id: string;
    type: string;
    company: string;
    date: string;
    amount: number;
    status: string;
  }): Promise<Invoice> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.BILLING.INVOICES_GET_ALL, invoice);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getPayments(): Promise<PaymentRecord[]> {
    try {
      const response = await axiosInstance.get("/billing/payments");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async processPayment(data: {
    invoiceId?: string;
    company: string;
    amount: number;
    paymentMethod: string;
  }): Promise<PaymentRecord> {
    try {
      const response = await axiosInstance.post("/billing/payments", data);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async processRefund(paymentId: string): Promise<PaymentRecord> {
    try {
      const response = await axiosInstance.post(`/billing/refunds/${paymentId}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
