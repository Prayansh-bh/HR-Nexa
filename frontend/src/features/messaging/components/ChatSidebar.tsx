import React, { useState } from "react";
import { Search, Plus, MessageSquare, Shield, Users, Trash2 } from "lucide-react";
import { Avatar, Badge, Btn } from "../../../components/ui";
import type { Message, AuthUser } from "../../../types";
import type { ContactUser } from "./NewChatModal";

export interface ConversationThread {
  contactUserId?: string;
  contactEmail: string;
  contactName: string;
  contactRole: string;
  contactAvatar: string;
  lastMessage: Message;
  unreadCount: number;
}

interface ChatSidebarProps {
  threads: ConversationThread[];
  activeContactEmail: string | null;
  currentUser: AuthUser;
  onSelectThread: (email: string) => void;
  onDeleteThread?: (email: string) => void;
  onOpenNewChat: () => void;
}

export function ChatSidebar({
  threads,
  activeContactEmail,
  currentUser,
  onSelectThread,
  onDeleteThread,
  onOpenNewChat,
}: ChatSidebarProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filteredThreads = threads.filter((t) => {
    const matchesSearch =
      t.contactName.toLowerCase().includes(search.toLowerCase()) ||
      t.contactEmail.toLowerCase().includes(search.toLowerCase()) ||
      t.lastMessage.body.toLowerCase().includes(search.toLowerCase());

    if (filter === "unread") {
      return matchesSearch && t.unreadCount > 0;
    }
    return matchesSearch;
  });

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

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border rounded-l-xl overflow-hidden">
      {/* Top Header */}
      <div className="p-4 border-b border-border/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-base text-foreground">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span>{currentUser.role === "SuperAdmin" ? "Platform Support" : "Tenant Chat"}</span>
          </div>
          <Btn size="sm" onClick={onOpenNewChat} className="rounded-lg text-xs gap-1">
            <Plus className="h-4 w-4" /> New Chat
          </Btn>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-muted/40 border border-border/70 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 pt-1">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              filter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            All ({threads.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              filter === "unread"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            Unread ({threads.filter((t) => t.unreadCount > 0).length})
          </button>
        </div>
      </div>

      {/* Conversation Thread List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {filteredThreads.map((thread) => {
          const isActive = thread.contactEmail === activeContactEmail;
          return (
            <div
              key={thread.contactEmail}
              onClick={() => onSelectThread(thread.contactEmail)}
              className={`p-3.5 cursor-pointer transition flex items-start gap-3 group relative ${
                isActive
                  ? "bg-primary/10 border-l-4 border-primary"
                  : thread.unreadCount > 0
                    ? "bg-primary/5 hover:bg-muted/40"
                    : "hover:bg-muted/30"
              }`}
            >
              <Avatar
                initials={thread.contactAvatar || thread.contactName.slice(0, 2).toUpperCase()}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="font-semibold text-xs text-foreground truncate max-w-[120px]">
                    {thread.contactName}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(thread.lastMessage.timestamp)}
                  </span>
                </div>

                <div className="flex items-center gap-1 mb-1">
                  <Badge tone={getRoleTone(thread.contactRole)}>
                    {thread.contactRole === "Viewer" ? "HR Staff" : thread.contactRole}
                  </Badge>
                </div>

                <div
                  className={`text-xs truncate ${
                    thread.unreadCount > 0 ? "font-bold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {thread.lastMessage.fromEmail === currentUser.email ? "You: " : ""}
                  {thread.lastMessage.body}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {thread.unreadCount > 0 && (
                  <span className="h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground font-bold text-[10px] flex items-center justify-center shadow-sm">
                    {thread.unreadCount}
                  </span>
                )}
                {onDeleteThread && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteThread(thread.contactEmail);
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition"
                    title="Delete Conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredThreads.length === 0 && (
          <div className="p-8 text-center text-xs text-muted-foreground">
            {search ? "No conversations found" : "No messages yet. Start a chat!"}
          </div>
        )}
      </div>
    </div>
  );
}
