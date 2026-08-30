import React, { useState, useEffect, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { PageHeader } from "../../../components/ui";
import type { Message, AuthUser, Employee } from "../../../types";
import { useMessagingStore, useEmployeesStore } from "../../../store";
import { notificationService } from "../../../services/notification.service";
import { ChatSidebar, ConversationThread } from "../components/ChatSidebar";
import { ChatWindow } from "../components/ChatWindow";
import { NewChatModal, ContactUser } from "../components/NewChatModal";
import { useToast } from "../../../hooks";

interface InboxPageProps {
  user: AuthUser;
  triggerConfirm?: (msg: string, fn: () => void, title?: string) => void;
}

export function InboxPage({ user }: InboxPageProps) {
  const toast = useToast();
  const messages = useMessagingStore((s) => s.messages);
  const fetchMessages = useMessagingStore((s) => s.fetchMessages);
  const sendMessage = useMessagingStore((s) => s.sendMessage);
  const markMessageRead = useMessagingStore((s) => s.markMessageRead);
  const deleteConversation = useMessagingStore((s) => s.deleteConversation);
  const activeContactEmail = useMessagingStore((s) => s.activeContactEmail);
  const setActiveContactEmail = useMessagingStore((s) => s.setActiveContactEmail);
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);

  const [platformContacts, setPlatformContacts] = useState<ContactUser[]>([]);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "chat">("sidebar");

  // Load contacts list on mount
  useEffect(() => {
    if (user.role === "SuperAdmin") {
      notificationService.getSuperAdminChatContacts().then((data) => {
        if (Array.isArray(data)) {
          setPlatformContacts(data);
        }
      });
    } else {
      fetchEmployees();
    }
  }, [fetchEmployees, user.role]);

  // Build contacts list directly from tenant database employees or platform contacts
  const contactsList: ContactUser[] = useMemo<ContactUser[]>(() => {
    if (user.role === "SuperAdmin") {
      return platformContacts;
    }

    const employeeList: Employee[] = Array.isArray(employees)
      ? employees
      : (employees && Array.isArray((employees as any).data) ? (employees as any).data : []);

    return employeeList
      .filter((emp: Employee) => emp.user?.id) // only active user accounts
      .map((emp: Employee) => ({
        userId: emp.user!.id,
        name: emp.name,
        email: emp.email,
        role: emp.user?.role || "Employee",
        department:
          typeof emp.department === "object" ? (emp.department as any)?.name : emp.department || "",
        designation:
          typeof emp.designation === "object"
            ? (emp.designation as any)?.name
            : emp.designation || "",
        avatar: emp.avatar || emp.name.slice(0, 2).toUpperCase(),
      }));
  }, [user.role, platformContacts, employees]);

  // Build list of conversation threads from messages
  const threads = useMemo(() => {
    const threadMap = new Map<string, ConversationThread>();

    messages.forEach((msg) => {
      const fromEmail = (msg.fromEmail || msg.from || "").toLowerCase();
      const toEmail = (msg.toEmail || msg.to || "").toLowerCase();
      const userEmail = (user.email || "").toLowerCase();

      // Determine contact email and contactUserId for this message
      let contactEmail = "";
      let messageUserId = "";
      if (fromEmail === userEmail) {
        contactEmail = toEmail;
        messageUserId = msg.toUserId || "";
      } else if (toEmail === userEmail) {
        contactEmail = fromEmail;
        messageUserId = msg.fromUserId || "";
      } else {
        return;
      }

      if (!contactEmail) return;

      const contactObj = contactsList.find((c: ContactUser) => c.email.toLowerCase() === contactEmail) || {
        userId: messageUserId,
        name: (msg as any).senderName || (msg.from === user.name ? msg.to : msg.from),
        email: contactEmail,
        role: "Employee",
        avatar: (msg.from === user.name ? msg.to : msg.from).slice(0, 2).toUpperCase(),
      };

      const existing = threadMap.get(contactEmail);
      const isUnread = toEmail === userEmail && !msg.read;

      const resolvedUserId = contactObj.userId || messageUserId || existing?.contactUserId || "";

      if (!existing) {
        threadMap.set(contactEmail, {
          contactUserId: resolvedUserId,
          contactEmail: contactObj.email,
          contactName: contactObj.name,
          contactRole: contactObj.role,
          contactAvatar: contactObj.avatar || contactObj.name.slice(0, 2).toUpperCase(),
          lastMessage: msg,
          unreadCount: isUnread ? 1 : 0,
        });
      } else {
        if (isUnread) {
          existing.unreadCount += 1;
        }
        if (!existing.contactUserId && resolvedUserId) {
          existing.contactUserId = resolvedUserId;
        }
        // Messages are sorted ascending, so last message evaluated will be latest
        existing.lastMessage = msg;
      }
    });

    return Array.from(threadMap.values()).sort(
      (a, b) =>
        new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime(),
    );
  }, [messages, user, contactsList]);

  // Select active contact details
  const activeContact = useMemo(() => {
    const targetEmail = activeContactEmail || (threads.length > 0 ? threads[0].contactEmail : null);
    if (!targetEmail) return null;

    const contactMatch = contactsList.find((c: ContactUser) => c.email.toLowerCase() === targetEmail.toLowerCase());
    const threadMatch = threads.find((t) => t.contactEmail.toLowerCase() === targetEmail.toLowerCase());

    const resolvedUserId = contactMatch?.userId || threadMatch?.contactUserId || "";

    return {
      userId: resolvedUserId,
      email: targetEmail,
      name: contactMatch?.name || threadMatch?.contactName || targetEmail.split("@")[0],
      role: contactMatch?.role || threadMatch?.contactRole || "Employee",
      avatar: contactMatch?.avatar || threadMatch?.contactAvatar || targetEmail.slice(0, 2).toUpperCase(),
    };
  }, [activeContactEmail, threads, contactsList]);

  // Messages for active conversation (sorted chronologically so flow goes downwards)
  const activeMessages = useMemo(() => {
    if (!activeContact) return [];
    const contactEmailLower = activeContact.email.toLowerCase();
    const userEmailLower = user.email.toLowerCase();

    const filtered = messages.filter((msg) => {
      const fromLower = (msg.fromEmail || msg.from || "").toLowerCase();
      const toLower = (msg.toEmail || msg.to || "").toLowerCase();

      return (
        (fromLower === userEmailLower && toLower === contactEmailLower) ||
        (fromLower === contactEmailLower && toLower === userEmailLower)
      );
    });

    return filtered.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [activeContact, messages, user]);

  // Mark unread received messages as read when active contact conversation is viewed
  useEffect(() => {
    if (!activeContact) return;

    const unreadReceivedMsgs = activeMessages.filter(
      (m) => (m.toEmail || m.to).toLowerCase() === user.email.toLowerCase() && !m.read,
    );

    unreadReceivedMsgs.forEach((msg) => {
      markMessageRead(msg.id);
    });
  }, [activeContact, activeMessages, user.email, markMessageRead]);

  const handleSelectThread = (email: string) => {
    setActiveContactEmail(email);
    setMobileView("chat");
  };

  const handleSendMessage = async (subject: string, body: string) => {
    if (!activeContact || !activeContact.userId) {
      console.error("Cannot send message: active contact missing userId", activeContact);
      return;
    }
    await sendMessage(activeContact.userId, subject, body);
  };

  const handleConfirmDeleteConversation = async () => {
    if (!conversationToDelete) return;
    try {
      const contactObj = contactsList.find((c: ContactUser) => c.email.toLowerCase() === conversationToDelete.toLowerCase());
      const receiverId = contactObj?.userId || "";
      await deleteConversation(receiverId, conversationToDelete);
      if (activeContactEmail?.toLowerCase() === conversationToDelete.toLowerCase()) {
        setActiveContactEmail(null);
      }
      setConversationToDelete(null);
      toast.push("Conversation deleted successfully", "success");
    } catch (err: any) {
      console.error("Failed to delete conversation", err);
      toast.push(err?.message || "Failed to delete conversation", "error");
    }
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <PageHeader
        title="Chatbox"
        subtitle="Real-time direct messaging with employees, managers, accountants, HR staff, and super admin"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border border-border/80 rounded-xl overflow-hidden bg-card shadow-sm h-[calc(100vh-175px)] min-h-[500px]">
        {/* Sidebar Panel */}
        <div
          className={`lg:col-span-4 xl:col-span-3 h-full min-h-0 overflow-hidden ${
            mobileView === "chat" ? "hidden lg:block" : "block"
          }`}
        >
          <ChatSidebar
            threads={threads}
            activeContactEmail={activeContact?.email || null}
            currentUser={user}
            onSelectThread={handleSelectThread}
            onDeleteThread={(email) => setConversationToDelete(email)}
            onOpenNewChat={() => setIsNewChatOpen(true)}
          />
        </div>

        {/* Chat Window Panel */}
        <div
          className={`lg:col-span-8 xl:col-span-9 h-full min-h-0 flex flex-col overflow-hidden ${
            mobileView === "sidebar" ? "hidden lg:flex" : "flex"
          }`}
        >
          <ChatWindow
            activeContact={activeContact}
            messages={activeMessages}
            currentUser={user}
            onSendMessage={handleSendMessage}
            onDeleteConversation={() =>
              activeContact && setConversationToDelete(activeContact.email)
            }
            onBackToSidebar={() => setMobileView("sidebar")}
          />
        </div>
      </div>

      {/* New Chat Modal */}
      {isNewChatOpen && (
        <NewChatModal
          contacts={contactsList}
          currentUser={user}
          onClose={() => setIsNewChatOpen(false)}
          onSelectContact={(contact) => {
            setActiveContactEmail(contact.email);
            setMobileView("chat");
          }}
        />
      )}

      {/* Delete Conversation Confirmation Modal */}
      {conversationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Delete Conversation</h3>
                <p className="text-xs text-muted-foreground">Permanent chat deletion</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete all messages in your conversation with{" "}
              <strong>{conversationToDelete}</strong>? This operation cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConversationToDelete(null)}
                className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition px-4 py-2 text-xs bg-secondary text-secondary-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteConversation}
                className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition px-4 py-2 text-xs bg-destructive text-white hover:bg-destructive/90 shadow-sm"
              >
                <Trash2 className="w-4 h-4" /> Delete Conversation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
