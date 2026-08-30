import React, { useEffect, useRef } from "react";
import { MessageSquare, Shield, Mail, Phone, Trash2, ArrowLeft } from "lucide-react";
import { Avatar, Badge, Btn, Card } from "../../../components/ui";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import type { Message, AuthUser } from "../../../types";
import type { ContactUser } from "./NewChatModal";

interface ChatWindowProps {
  activeContact: ContactUser | null;
  messages: Message[];
  currentUser: AuthUser;
  onSendMessage: (subject: string, body: string) => Promise<void>;
  onDeleteConversation?: () => void;
  onBackToSidebar?: () => void;
}

export function ChatWindow({
  activeContact,
  messages,
  currentUser,
  onSendMessage,
  onDeleteConversation,
  onBackToSidebar,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll strictly inside the internal message thread container
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeContact?.email, messages.length]);

  if (!activeContact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-card rounded-r-xl border-l border-border/60 min-h-[500px]">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
          <MessageSquare className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold mb-1">Select a Conversation</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Choose an employee or admin contact from the list on the left or start a new chat to
          communicate.
        </p>
      </div>
    );
  }

  const getRoleTone = (role: string) => {
    switch (role) {
      case "SuperAdmin":
        return "purple";
      case "HRAdmin":
        return "blue";
      case "Manager":
        return "amber";
      case "Accountant":
        return "green";
      case "Viewer":
        return "purple";
      default:
        return "slate";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-card rounded-r-xl overflow-hidden border-l border-border/60">
      {/* Header (fixed at top) */}
      <div className="p-4 border-b border-border/80 flex items-center justify-between bg-card shrink-0">
        <div className="flex items-center gap-3">
          {onBackToSidebar && (
            <button
              onClick={onBackToSidebar}
              className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <Avatar initials={activeContact.avatar || activeContact.name.slice(0, 2).toUpperCase()} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-foreground">{activeContact.name}</h2>
              <Badge tone={getRoleTone(activeContact.role)}>
                {activeContact.role === "Viewer" ? "HR Staff" : activeContact.role}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>{activeContact.email}</span>
              {activeContact.department && <span>• {activeContact.department}</span>}
            </div>
          </div>
        </div>

        {onDeleteConversation && (
          <button
            onClick={onDeleteConversation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 transition border border-destructive/20"
            title="Delete Conversation"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Delete Chat</span>
          </button>
        )}
      </div>

      {/* Messages Thread Container with Visible Internal Scrollbar */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto custom-chat-scrollbar p-4 md:p-6 bg-muted/10 space-y-3 flex flex-col justify-start"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground text-xs p-6">
            <Mail className="h-8 w-8 mb-2 opacity-30 text-primary" />
            <p className="font-medium text-foreground">No messages yet with {activeContact.name}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Send a message below to start the conversation.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              currentUser={currentUser}
              senderName={
                (msg.fromEmail || msg.from) === currentUser.email
                  ? currentUser.name
                  : activeContact.name
              }
              senderAvatar={
                (msg.fromEmail || msg.from) === currentUser.email
                  ? currentUser.initials || currentUser.name.slice(0, 2).toUpperCase()
                  : activeContact.avatar || activeContact.name.slice(0, 2).toUpperCase()
              }
            />
          ))
        )}
      </div>

      {/* Message Composer (fixed at bottom) */}
      <div className="shrink-0 border-t border-border/80 bg-card">
        <MessageComposer
          recipientName={activeContact.name}
          onSend={(subject, body) => onSendMessage(subject, body)}
        />
      </div>
    </div>
  );
}
