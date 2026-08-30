import React, { useEffect } from "react";
import { AuthUser } from "../types";
import { useMessagingStore } from "../store";
import { realtimeEventsService } from "../services/realtimeEvents.service";

interface MessagingProviderProps {
  user: AuthUser;
  children: React.ReactNode;
}

export function MessagingProvider({ user, children }: MessagingProviderProps) {
  useEffect(() => {
    if (!user || !user.id) return;

    // Idempotent initialize for the authenticated user
    useMessagingStore.getState().initialize(user);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    // Sole SSE subscriber for global messaging events across the entire app
    const unsubscribe = realtimeEventsService.subscribeEvents((event) => {
      if (event.type === "message.created") {
        if (event.payload) {
          useMessagingStore.getState().handleIncomingMessage(event.payload);
        } else {
          useMessagingStore.getState().fetchMessages();
        }
      } else if (
        event.type === "message.updated" ||
        event.type === "message.deleted" ||
        event.type === "conversation.updated"
      ) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          useMessagingStore.getState().fetchMessages();
        }, 300);
      }
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [user]);

  return <>{children}</>;
}
