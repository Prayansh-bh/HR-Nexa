import React, { useState, useMemo, useEffect, useRef } from "react";
import { getBusinessDateString } from "../../../utils/date.utils";
import {
  Building2,
  Users,
  CreditCard,
  ShieldAlert,
  Cpu,
  FileClock,
  Activity,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Wallet,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Trash2,
  Edit3,
  Eye,
  Download,
  Plus,
  Search,
  Filter,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Send,
  Lock,
  Sparkles,
  MapPin,
  Check,
  ChevronRight,
  CalendarPlus,
  FileCheck,
  Layers,
  FileSpreadsheet,
  KanbanSquare,
  UserCheck,
  Briefcase,
  Mail,
  MessageSquare,
  ShieldCheck,
  HelpCircle,
  Inbox,
  PieChart,
  Sliders,
  ToggleLeft,
  ToggleRight,
  ArrowRight,
  UserPlus,
  Info,
  Pen,
  Loader2,
  Server,
  AlertTriangle,
  RotateCcw,
  Shield,
} from "lucide-react";
import { ticketsService, SupportTicket } from "../../../services/tickets.service";
import { getStatusTone } from "../../../utils/ticketStatus.utils";
import { useHasPermission } from "../../../auth/useHasPermission";
import { PERMISSIONS } from "../../../auth/permissions";
import { ModalShell } from "../../../components/ui";
import { Unauthorized } from "../../../auth/Unauthorized";

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";

function Field({
  label,
  children,
  className = "",
  error,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  error?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
      {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
    </div>
  );
}

function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger" | "success";
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "btn-gradient hover:brightness-110",
    success: "bg-[color:var(--color-success)] text-white shadow-md hover:brightness-110",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    outline: "border border-border bg-card hover:border-primary hover:text-primary",
    danger: "bg-destructive text-destructive-foreground shadow-md hover:brightness-110",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-muted text-muted-foreground",
    green: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    amber: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    rose: "bg-destructive/15 text-destructive",
    indigo: "bg-primary/15 text-primary",
    sky: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

function extractTicketsArray(res: any): SupportTicket[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.items)) return res.items;
  if (Array.isArray(res.tickets)) return res.tickets;
  return [];
}

export function EmployeeHelpdeskPage({ toast }: { toast: (m: string) => void }) {
  const canView = useHasPermission(PERMISSIONS.SUPPORT_TICKETS_VIEW);
  const canCreate = useHasPermission(PERMISSIONS.SUPPORT_TICKETS_CREATE);
  const canDelete = useHasPermission(PERMISSIONS.SUPPORT_TICKETS_DELETE);
  const canMessage = useHasPermission(PERMISSIONS.SUPPORT_TICKETS_MESSAGE);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ subject: "", cat: "HR" });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [chatTicket, setChatTicket] = useState<SupportTicket | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const data = await ticketsService.getAllTickets();
      setTickets(extractTicketsArray(data));
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      fetchTickets();
    }
  }, [canView]);

  useEffect(() => {
    if (chatTicket) {
      loadChatMessages(chatTicket.id);
    }
  }, [chatTicket]);

  const loadChatMessages = async (ticketId: string) => {
    try {
      setLoadingChat(true);
      const data = await ticketsService.getTicketMessages(ticketId);
      setChatMessages(data);
    } catch {
      toast("Failed to load ticket conversation");
    } finally {
      setLoadingChat(false);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatTicket || !newMessageText.trim()) return;
    try {
      const sent = await ticketsService.sendTicketMessage(
        chatTicket.id,
        newMessageText.trim(),
      );
      setChatMessages((prev) => [...prev, sent]);
      setNewMessageText("");
    } catch (err: any) {
      toast(err?.message || "Failed to send message");
    }
  };

  if (!canView) {
    return <Unauthorized requiredPermission={PERMISSIONS.SUPPORT_TICKETS_VIEW} />;
  }

  const add = async () => {
    if (!form.subject.trim()) return;
    try {
      await ticketsService.createTicket({
        subject: form.subject,
        priority: "Medium",
        assignedTo: form.cat,
      });
      await fetchTickets();
      toast("Helpdesk ticket created successfully.");
      setShow(false);
      setForm({ subject: "", cat: "HR" });
    } catch (err: any) {
      toast(err?.message || "Failed to submit helpdesk ticket");
    }
  };

  const handleDelete = async (ticketId: string) => {
    try {
      setDeletingId(ticketId);
      await ticketsService.deleteTicket(ticketId);
      toast("Support ticket deleted successfully.");
      await fetchTickets();
    } catch (err: any) {
      toast(err?.message || "Failed to delete support ticket");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">HR Query Helpdesk</h1>
          <p className="text-sm text-muted-foreground">
            Raise direct query tickets, track outcomes, and check resolutions.
          </p>
        </div>
        {canCreate && (
          <Btn onClick={() => setShow(true)}>
            <Plus size={16} /> Open Ticket
          </Btn>
        )}
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {tickets.map((t) => (
            <div key={t.id} className={cardCls + " flex justify-between items-center"}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{t.subject}</span>
                  <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-semibold uppercase">
                    {t.assignedTo}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ticket ID: {t.id} | Opened: {t.date}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  tone={
                    t.status === "Resolved"
                      ? "green"
                      : t.status === "Open"
                        ? "rose"
                        : t.status === "In Progress"
                          ? "sky"
                          : "slate"
                  }
                >
                  {t.status}
                </Badge>
                {canMessage && (
                  <button
                    onClick={() => setChatTicket(t)}
                    className="p-1 text-primary hover:bg-primary/10 rounded transition text-xs font-semibold"
                    title="Open ticket conversation"
                  >
                    Open Chat
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deletingId === t.id}
                    className="p-1 text-destructive hover:bg-destructive/10 rounded transition disabled:opacity-50"
                    title="Delete ticket"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {tickets.length === 0 && (
            <div className={cardCls + " text-center py-12 text-muted-foreground"}>
              No support tickets raised yet.
            </div>
          )}
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Open Support Ticket</h3>
            <div className="space-y-4">
              <Field label="Division / Category">
                <select
                  value={form.cat}
                  onChange={(e) => setForm({ ...form, cat: e.target.value })}
                  className={inputCls}
                >
                  <option>HR</option>
                  <option>Payroll</option>
                  <option>IT Support</option>
                  <option>Admin</option>
                </select>
              </Field>
              <Field label="Subject Details">
                <input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. PF account link is missing..."
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Btn variant="outline" onClick={() => setShow(false)}>
                Cancel
              </Btn>
              <Btn onClick={add}>Submit Ticket</Btn>
            </div>
          </div>
        </div>
      )}

      {chatTicket && canMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl flex flex-col h-[520px] overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Ticket Support Room — {chatTicket.id}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {chatTicket.subject}
                </p>
              </div>
              <button
                onClick={() => setChatTicket(null)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition"
              >
                Close
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-muted/5 flex flex-col">
              {loadingChat ? (
                <div className="text-center text-xs text-muted-foreground my-auto py-8">
                  Loading chat history...
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground my-auto py-8">
                  No messages recorded.
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className="flex flex-col items-start">
                    <span className="text-[9px] text-muted-foreground mb-0.5 px-1 font-semibold">
                      {msg.sender || "User"}
                    </span>
                    <div className="max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed bg-muted text-foreground rounded-tl-none border border-border">
                      {msg.message}
                    </div>
                    <span className="text-[8px] text-muted-foreground mt-0.5 px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
            <form
              onSubmit={handleSendChatMessage}
              className="p-3 border-t border-border bg-card flex gap-2"
            >
              <input
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                placeholder="Type your message..."
                className={inputCls + " flex-1"}
                disabled={loadingChat}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition px-4 py-2 text-xs bg-primary text-white hover:brightness-110 disabled:opacity-50"
                disabled={loadingChat || !newMessageText.trim()}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 6. VIEWER / HR STAFF PAGES
// -------------------------------------------------------------
