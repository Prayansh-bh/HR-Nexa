import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "../services/notification.service";

export const MESSAGING_QUERY_KEYS = {
  messages: ["messages"] as const,
  announcements: ["announcements"] as const,
};

export function useMessagesQuery() {
  return useQuery({
    queryKey: MESSAGING_QUERY_KEYS.messages,
    queryFn: () => notificationService.getMessages(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useMessagingAnnouncementsQuery() {
  return useQuery({
    queryKey: MESSAGING_QUERY_KEYS.announcements,
    queryFn: () => notificationService.getAnnouncements(),
    staleTime: 60_000,
  });
}

export function useMessagingMutations() {
  const queryClient = useQueryClient();

  const sendMessage = useMutation({
    mutationFn: ({ receiverId, subject, body }: { receiverId: string; subject: string; body: string }) =>
      notificationService.sendMessage(receiverId, subject, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MESSAGING_QUERY_KEYS.messages });
    },
  });

  const createAnnouncement = useMutation({
    mutationFn: ({ title, content }: { title: string; content: string }) =>
      notificationService.createAnnouncement(title, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MESSAGING_QUERY_KEYS.announcements });
    },
  });

  const markMessageRead = useMutation({
    mutationFn: (id: string) => notificationService.markMessageRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MESSAGING_QUERY_KEYS.messages });
    },
  });

  return {
    sendMessage,
    createAnnouncement,
    markMessageRead,
  };
}
