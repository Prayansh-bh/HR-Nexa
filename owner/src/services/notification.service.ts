import axiosInstance from "../api/axios";
import { ENDPOINTS } from "../constants/endpoints";
import { handleApiError } from "../utils/apiError";
import { mapApiAnnouncementToModel } from "../mappers/announcement.mapper";

export interface AuditLogItem {
  id: string;
  userId: string | null;
  userName: string;
  action: string;
  details: string | any;
  companyId?: string | null;
  timestamp?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedAuditLogsResponse {
  data: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  severity: "critical" | "warning" | "success" | "info";
  category: "subscription" | "backup" | "security" | "billing" | "system";
  targetRole?: string | null;
  company?: string | null;
  reason?: string | null;
  recommendedAction?: string | null;
  linkUrl?: string | null;
  read: boolean;
  timestamp: string;
  createdAt?: string;
}

export const notificationService = {
  async getSystemNotifications(): Promise<{
    notifications: SystemNotification[];
    unreadCount: number;
  }> {
    try {
      const response = await axiosInstance.get("/system/notifications");
      return {
        notifications: Array.isArray(response.data?.notifications)
          ? response.data.notifications
          : [],
        unreadCount: response.data?.unreadCount ?? 0,
      };
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updatePreferences(prefs: any): Promise<any> {
    try {
      const response = await axiosInstance.put("/auth/me/preferences", { preferences: prefs });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async broadcastSystemNotification(payload: {
    title: string;
    message: string;
    severity?: string;
    category?: string;
    targetRole?: string;
    company?: string;
    reason?: string;
    recommendedAction?: string;
    linkUrl?: string;
  }): Promise<SystemNotification> {
    try {
      const response = await axiosInstance.post("/system/notifications/broadcast", payload);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async markNotificationRead(id: string): Promise<any> {
    try {
      const response = await axiosInstance.put(`/system/notifications/${id}/read`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async markAllNotificationsRead(): Promise<any> {
    try {
      const response = await axiosInstance.put("/system/notifications/mark-all-read");
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteNotification(id: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(`/system/notifications/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getAnnouncements(): Promise<any[]> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.SYSTEM.ANNOUNCEMENTS);
      return Array.isArray(response.data) ? response.data.map(mapApiAnnouncementToModel) : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createAnnouncement(
    data:
      | { type?: string; title: string; content: string; scheduledFor?: string; duration?: string }
      | string,
    content?: string,
  ): Promise<any> {
    try {
      const cleanPayload: any = typeof data === "string" ? { title: data, content: content || "" } : { ...data };
      if (cleanPayload.scheduledFor) {
        const parsed = new Date(cleanPayload.scheduledFor);
        if (!isNaN(parsed.getTime())) {
          cleanPayload.scheduledFor = parsed.toISOString();
        } else {
          delete cleanPayload.scheduledFor;
        }
      }
      const response = await axiosInstance.post(ENDPOINTS.SYSTEM.ANNOUNCEMENTS, cleanPayload);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getAuditLogs(params?: { page?: number; limit?: number }): Promise<PaginatedAuditLogsResponse> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.SYSTEM.AUDIT_LOGS, {
        params: {
          page: params?.page || 1,
          limit: params?.limit || 50,
        },
      });
      if (Array.isArray(response.data)) {
        return {
          data: response.data,
          total: response.data.length,
          page: 1,
          limit: response.data.length,
          totalPages: 1,
        };
      }
      return {
        data: Array.isArray(response.data?.data) ? response.data.data : [],
        total: response.data?.total ?? 0,
        page: response.data?.page ?? 1,
        limit: response.data?.limit ?? 50,
        totalPages: response.data?.totalPages ?? 1,
      };
    } catch (error) {
      return handleApiError(error);
    }
  },

  async logAction(action: string, details: string): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.SYSTEM.AUDIT_LOGS, { action, details });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getSuperAdminChatContacts(): Promise<any[]> {
    try {
      const response = await axiosInstance.get("/system/super-admin/chat-contacts");
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getMessages(): Promise<any[]> {
    try {
      const response = await axiosInstance.get(ENDPOINTS.SYSTEM.MESSAGES);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async sendMessage(receiverId: string, subject: string, body: string): Promise<any> {
    try {
      const response = await axiosInstance.post(ENDPOINTS.SYSTEM.MESSAGES, {
        receiverId,
        subject,
        body,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async markMessageRead(id: string): Promise<any> {
    try {
      const response = await axiosInstance.put(ENDPOINTS.SYSTEM.MARK_MESSAGE_READ(id));
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteConversation(contactId: string): Promise<any> {
    try {
      const response = await axiosInstance.delete(
        `/system/messages/conversation/${encodeURIComponent(contactId)}`,
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
