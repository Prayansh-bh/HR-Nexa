import React from "react";
import { Check, CheckCheck } from "lucide-react";
import { Avatar } from "../../../components/ui";
import type { Message, AuthUser } from "../../../types";

interface MessageBubbleProps {
  message: Message;
  currentUser: AuthUser;
  senderName: string;
  senderAvatar: string;
}

export function MessageBubble({
  message,
  currentUser,
  senderName,
  senderAvatar,
}: MessageBubbleProps) {
  const senderEmail = message.fromEmail || message.from;
  const isMine = senderEmail === currentUser.email || message.from === currentUser.name;

  // Role check for showing read receipts
  // Prompt instructions:
  // "For HR Admin create Inbox... Show employee readed message."
  // "For Employees(Manager, Accountant, Viewer / HR Staff) create same inbox... Do not show whether HR Admin readed or not."
  const isHRAdminOrSuperAdmin = currentUser.role === "HRAdmin" || currentUser.role === "SuperAdmin";

  // Format timestamp
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const formatDate = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div
      className={`flex gap-3 mb-4 max-w-[88%] md:max-w-[78%] ${
        isMine ? "ml-auto flex-row-reverse" : "mr-auto flex-row"
      }`}
    >
      <Avatar initials={senderAvatar || senderName?.slice(0, 2).toUpperCase() || "U"} />

      <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
        {/* Header Name & Timestamp */}
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-xs font-semibold text-foreground/80">
            {isMine ? "You" : senderName}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDate(message.timestamp)} {formatTime(message.timestamp)}
          </span>
        </div>

        {/* Message Bubble Card */}
        <div
          className={`rounded-2xl px-4 py-3 shadow-sm text-sm border ${
            isMine
              ? "bg-primary text-primary-foreground border-primary/20 rounded-tr-none"
              : "bg-card text-card-foreground border-border/70 rounded-tl-none"
          }`}
        >
          {/* Subject line if available */}
          {message.subject && (
            <div
              className={`font-bold mb-1 border-b pb-1 text-xs uppercase tracking-wider ${
                isMine
                  ? "border-primary-foreground/20 text-primary-foreground/90"
                  : "border-border/60 text-foreground/90"
              }`}
            >
              {message.subject}
            </div>
          )}

          {/* Message Body */}
          <div className="whitespace-pre-wrap leading-relaxed break-words">{message.body}</div>

          {/* Footer - Read Status for HR Admin & Super Admin on sent messages */}
          {isMine && isHRAdminOrSuperAdmin && (
            <div className="flex items-center justify-end gap-1.5 mt-1.5 pt-1 border-t border-primary-foreground/15 text-[11px] text-primary-foreground/80">
              {message.read ? (
                <>
                  <CheckCheck className="h-3.5 w-3.5 text-sky-200 inline" />
                  <span className="font-semibold text-[10px] text-sky-100">Read</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 opacity-70 inline" />
                  <span className="opacity-80 text-[10px]">Delivered</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
