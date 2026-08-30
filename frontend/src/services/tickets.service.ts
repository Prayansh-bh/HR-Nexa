import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";

export interface SupportTicket {
  id: string;
  company: string;
  subject: string;
  priority: string;
  assignedTo: string;
  status: string;
  attachments: number;
  date: string;
}

export const ticketsService = {
  async getAllTickets(): Promise<SupportTicket[]> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.TICKETS.GET_ALL);
      const raw = response.data;
      if (Array.isArray(raw)) return raw;
      if (raw && Array.isArray(raw.data)) return raw.data;
      return [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createTicket(
    ticket: Partial<SupportTicket> & { subject: string },
  ): Promise<SupportTicket> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.TICKETS.CREATE, ticket);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateTicketStatus(id: string, status: string): Promise<SupportTicket> {
    try {
      const response = await axiosInstance.put(ENDPOINTS.TICKETS.UPDATE_STATUS(id), { status });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getTicketMessages(id: string): Promise<any[]> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.TICKETS.GET_MESSAGES(id));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async sendTicketMessage(id: string, message: string): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.TICKETS.ADD_MESSAGE(id), {
        message,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteTicket(id: string): Promise<{ success: boolean; id: string }> {
    try {
      const response = await axiosInstance.delete(ENDPOINTS.TICKETS.DELETE(id));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
