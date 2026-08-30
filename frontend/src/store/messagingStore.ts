import { create } from "zustand";
import { Message, Broadcast, AuthUser } from "../types";
import { notificationService } from "../services/notification.service";

export interface MessagingStore {
  messages: Message[];
  broadcasts: Broadcast[];
  lastSeenAnnouncements: Record<string, number>;
  activeContactEmail: string | null;
  initializedUserId: string | null;
  currentUserId: string | null;
  currentUserEmail: string | null;
  unreadMessagesCount: number;
  isLoading: boolean;
  error: string | null;

  initialize: (user: AuthUser) => Promise<void>;
  handleIncomingMessage: (rawMsg: any) => void;
  clear: () => void;

  setMessages: (update: Message[] | ((prev: Message[]) => Message[])) => void;
  setBroadcasts: (update: Broadcast[] | ((prev: Broadcast[]) => Broadcast[])) => void;
  setLastSeenAnnouncements: (userName: string, val: number) => void;
  setActiveContactEmail: (email: string | null) => void;

  fetchAnnouncements: () => Promise<void>;
  createAnnouncement: (title: string | any, content?: string) => Promise<void>;
  fetchMessages: () => Promise<void>;
  sendMessage: (receiverId: string, subject: string, body: string) => Promise<void>;
  markMessageRead: (id: string) => Promise<void>;
  deleteConversation: (receiverId: string, contactEmail?: string) => Promise<void>;
}

function computeUnreadCount(
  messages: Message[],
  userId: string | null,
  userEmail: string | null,
): number {
  if (!userId && !userEmail) return 0;
  const emailLower = (userEmail || "").toLowerCase();
  return messages.filter((m) => {
    if (m.read) return false;
    const isToUser = Boolean(
      (m.toUserId && userId && m.toUserId === userId) ||
        ((m.toEmail || m.to || "").toLowerCase() === emailLower && emailLower !== ""),
    );
    return isToUser;
  }).length;
}

export const useMessagingStore = create<MessagingStore>()((set, get) => ({
  messages: [],
  broadcasts: [],
  lastSeenAnnouncements: {},
  activeContactEmail: null,
  initializedUserId: null,
  currentUserId: null,
  currentUserEmail: null,
  unreadMessagesCount: 0,
  isLoading: false,
  error: null,

  initialize: async (user: AuthUser) => {
    // Idempotency check using User.id
    if (get().initializedUserId === user.id) {
      return;
    }
    set({
      initializedUserId: user.id,
      currentUserId: user.id,
      currentUserEmail: user.email,
    });
    await Promise.all([get().fetchAnnouncements(), get().fetchMessages()]);
  },

  handleIncomingMessage: (rawMsg: any) => {
    if (!rawMsg || !rawMsg.id) return;
    const normalized: Message = {
      id: rawMsg.id,
      to: rawMsg.receiver?.email || rawMsg.toEmail || rawMsg.to || "",
      from: rawMsg.sender?.email || rawMsg.fromEmail || rawMsg.from || "",
      toEmail: rawMsg.receiver?.email || rawMsg.toEmail || rawMsg.to || "",
      fromEmail: rawMsg.sender?.email || rawMsg.fromEmail || rawMsg.from || "",
      toUserId: rawMsg.receiverId || rawMsg.receiver?.id || "",
      fromUserId: rawMsg.senderId || rawMsg.sender?.id || "",
      senderName: rawMsg.sender?.name || rawMsg.sender?.email || rawMsg.from || "",
      receiverName: rawMsg.receiver?.name || rawMsg.receiver?.email || rawMsg.to || "",
      subject: rawMsg.subject || "",
      body: rawMsg.body || "",
      timestamp: rawMsg.timestamp || rawMsg.createdAt || new Date().toISOString(),
      read: Boolean(rawMsg.read),
    };

    set((state) => {
      const exists = state.messages.some((m) => m.id === normalized.id);
      const updatedMessages = exists
        ? state.messages.map((m) => (m.id === normalized.id ? normalized : m))
        : [...state.messages, normalized];

      const unreadCount = computeUnreadCount(
        updatedMessages,
        state.currentUserId,
        state.currentUserEmail,
      );

      return {
        messages: updatedMessages,
        unreadMessagesCount: unreadCount,
      };
    });
  },

  clear: () => {
    set({
      messages: [],
      broadcasts: [],
      lastSeenAnnouncements: {},
      activeContactEmail: null,
      initializedUserId: null,
      currentUserId: null,
      currentUserEmail: null,
      unreadMessagesCount: 0,
      isLoading: false,
      error: null,
    });
  },

  setMessages: (update) =>
    set((state) => {
      const nextMessages = typeof update === "function" ? update(state.messages) : update;
      return {
        messages: nextMessages,
        unreadMessagesCount: computeUnreadCount(
          nextMessages,
          state.currentUserId,
          state.currentUserEmail,
        ),
      };
    }),

  setBroadcasts: (update) =>
    set((state) => ({
      broadcasts: typeof update === "function" ? update(state.broadcasts) : update,
    })),

  setLastSeenAnnouncements: (userName: string, val: number) =>
    set((state) => ({
      lastSeenAnnouncements: {
        ...state.lastSeenAnnouncements,
        [userName]: val,
      },
    })),

  setActiveContactEmail: (email: string | null) => set({ activeContactEmail: email }),

  fetchAnnouncements: async () => {
    try {
      const data = await notificationService.getAnnouncements();
      if (Array.isArray(data)) {
        set({ broadcasts: data });
      }
    } catch {
      // keep existing fallback
    }
  },

  createAnnouncement: async (title: any, content?: string) => {
    await notificationService.createAnnouncement(title, content);
    await get().fetchAnnouncements();
  },

  fetchMessages: async () => {
    try {
      const data = await notificationService.getMessages();
      if (Array.isArray(data)) {
        const normalized: Message[] = data.map((m: any) => ({
          id: m.id,
          to: m.receiver?.email || "",
          from: m.sender?.email || "",
          toEmail: m.receiver?.email || "",
          fromEmail: m.sender?.email || "",
          toUserId: m.receiverId || m.receiver?.id || "",
          fromUserId: m.senderId || m.sender?.id || "",
          senderName: m.sender?.name || m.sender?.email || "",
          receiverName: m.receiver?.name || m.receiver?.email || "",
          subject: m.subject || "",
          body: m.body || "",
          timestamp: m.timestamp || m.createdAt || new Date().toISOString(),
          read: Boolean(m.read),
        }));

        set((state) => ({
          messages: normalized,
          unreadMessagesCount: computeUnreadCount(
            normalized,
            state.currentUserId,
            state.currentUserEmail,
          ),
        }));
      }
    } catch (err: any) {
      if (err?.response?.status === 403) {
        set({ error: "403 Permission Denied: Missing required permission" });
      }
    }
  },

  sendMessage: async (receiverId, subject, body) => {
    try {
      await notificationService.sendMessage(receiverId, subject, body);
      await get().fetchMessages();
    } catch (error) {
      console.error("Failed to send message", error);
      throw error;
    }
  },

  markMessageRead: async (id) => {
    try {
      // Optimistic update
      set((state) => {
        const updated = state.messages.map((m) => (m.id === id ? { ...m, read: true } : m));
        return {
          messages: updated,
          unreadMessagesCount: computeUnreadCount(
            updated,
            state.currentUserId,
            state.currentUserEmail,
          ),
        };
      });
      await notificationService.markMessageRead(id);
    } catch (error) {
      console.error("Failed to mark message as read", error);
    }
  },

  deleteConversation: async (receiverId: string, contactEmail?: string) => {
    try {
      if (contactEmail) {
        const emailLower = contactEmail.toLowerCase();
        set((state) => {
          const updated = state.messages.filter((m) => {
            const fromLower = (m.fromEmail || m.from || "").toLowerCase();
            const toLower = (m.toEmail || m.to || "").toLowerCase();
            return fromLower !== emailLower && toLower !== emailLower;
          });
          return {
            messages: updated,
            unreadMessagesCount: computeUnreadCount(
              updated,
              state.currentUserId,
              state.currentUserEmail,
            ),
          };
        });
      }
      await notificationService.deleteConversation(receiverId);
      await get().fetchMessages();
    } catch (error) {
      console.error("Failed to delete conversation", error);
      throw error;
    }
  },
}));
