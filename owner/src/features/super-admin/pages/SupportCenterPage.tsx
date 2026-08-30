import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getBusinessDateString } from "../../../utils/date.utils";
import { ticketsService, SupportTicket } from "../../../services/tickets.service";
import { trialRequestsService, TrialRequestItem } from "../../../services/trialRequests.service";
import { useCompaniesQuery } from "../../../hooks/useCompaniesQuery";
import { getStatusTone, getAvailableStatusOptions } from "../../../utils/ticketStatus.utils";
import { useHasPermission } from "../../../auth/useHasPermission";
import { PERMISSIONS } from "../../../auth/permissions";
import {
  Sparkles,
  LifeBuoy,
  Building2,
  Mail,
  Phone,
  Users,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
  RefreshCw,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";
const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const btnCls =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition hover:brightness-110 px-3 py-1.5 text-xs bg-primary text-white";

function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex gap-2">{action}</div>}
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "rose" | "indigo" | "sky";
}) {
  const tones = {
    slate: "bg-muted text-muted-foreground",
    green: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    amber: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    rose: "bg-destructive/15 text-destructive",
    indigo: "bg-primary/15 text-primary",
    sky: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}
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

function normalize(val?: string | null): string {
  if (!val) return "";
  return String(val).trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
}

export function SupportCenterPage({ toast }: { toast?: any }) {
  const queryClient = useQueryClient();
  const canDelete = useHasPermission(PERMISSIONS.SUPPORT_TICKETS_DELETE);
  const canCreate = useHasPermission(PERMISSIONS.SUPPORT_TICKETS_CREATE);
  const canMessage = useHasPermission(PERMISSIONS.SUPPORT_TICKETS_MESSAGE);
  const canStatus = useHasPermission(PERMISSIONS.SUPPORT_TICKETS_STATUS);
  const canResolve = useHasPermission(PERMISSIONS.SUPPORT_TICKETS_RESOLVE);
  const canClose = useHasPermission(PERMISSIONS.SUPPORT_TICKETS_CLOSE);
  const statusFlags = { canStatus, canResolve, canClose };
  const { companies } = useCompaniesQuery();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");

  const [chatTicket, setChatTicket] = useState<SupportTicket | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const [newCompany, setNewCompany] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newPriority, setNewPriority] = useState("Medium");
  const [newAssignedTo, setNewAssignedTo] = useState("Support Team");
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null);

  // ─── Trial Requests & Inbound Leads State ───
  const [activeTab, setActiveTab] = useState<"tickets" | "trials">("tickets");
  const [trialRequests, setTrialRequests] = useState<TrialRequestItem[]>([]);
  const [trialTotal, setTrialTotal] = useState(0);
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialFilterStatus, setTrialFilterStatus] = useState("ALL");
  const [trialSearch, setTrialSearch] = useState("");
  const [selectedTrialLead, setSelectedTrialLead] = useState<TrialRequestItem | null>(null);
  const [updatingTrialStatusId, setUpdatingTrialStatusId] = useState<string | null>(null);
  const [adminNotesInput, setAdminNotesInput] = useState("");

  const loadTrialRequests = async () => {
    try {
      setTrialLoading(true);
      const res = await trialRequestsService.getTrialRequests({
        status: trialFilterStatus,
        search: trialSearch,
      });
      if (res && Array.isArray(res.data)) {
        setTrialRequests(res.data);
        setTrialTotal(res.total || res.data.length);
      }
    } catch {
      toast?.("Failed to load trial inquiries", "error");
    } finally {
      setTrialLoading(false);
    }
  };

  const handleUpdateTrialStatus = async (id: string, newStatus: string, notes?: string) => {
    try {
      setUpdatingTrialStatusId(id);
      await trialRequestsService.updateStatus(id, newStatus, notes);
      toast?.(`Trial inquiry status updated to "${newStatus}"`, "success");
      setTrialRequests((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: newStatus as any,
                adminNotes: notes !== undefined ? notes : item.adminNotes,
              }
            : item,
        ),
      );
      if (selectedTrialLead && selectedTrialLead.id === id) {
        setSelectedTrialLead((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus as any,
                adminNotes: notes !== undefined ? notes : prev.adminNotes,
              }
            : null,
        );
      }
    } catch (err: any) {
      toast?.(err?.message || "Failed to update status", "error");
    } finally {
      setUpdatingTrialStatusId(null);
    }
  };

  useEffect(() => {
    if (activeTab === "trials") {
      loadTrialRequests();
    }
  }, [activeTab, trialFilterStatus, trialSearch]);

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      setDeletingTicketId(ticketId);
      await ticketsService.deleteTicket(ticketId);
      toast?.("Support ticket deleted successfully", "success");
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setDeleteTargetId(null);
      await loadTickets();
    } catch (err: any) {
      toast?.(err?.message || "Failed to delete ticket", "error");
    } finally {
      setDeletingTicketId(null);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      setUpdatingStatusId(ticketId);
      await ticketsService.updateTicketStatus(ticketId, newStatus);
      toast?.(`Ticket status updated to "${newStatus}"`, "success");
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await loadTickets();
      if (chatTicket && chatTicket.id === ticketId) {
        setChatTicket((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err: any) {
      toast?.(err?.message || "Failed to update ticket status", "error");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [companies]);

  useEffect(() => {
    if (chatTicket) {
      loadChatMessages(chatTicket.id);
    }
  }, [chatTicket]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [chatMessages, loadingChat]);

  const loadChatMessages = async (ticketId: string) => {
    try {
      setLoadingChat(true);
      const data = await ticketsService.getTicketMessages(ticketId);
      setChatMessages(data);
    } catch {
      toast?.("Failed to load chat messages", "error");
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
    } catch {
      toast?.("Failed to send message", "error");
    }
  };

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await ticketsService.getAllTickets();
      const extracted = extractTicketsArray(data);
      setTickets(extracted);
    } catch {
      toast?.("Failed to load tickets", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.trim() || !newSubject.trim()) return;
    const newId = `T-${Date.now().toString().slice(-4)}`;
    const today = getBusinessDateString();
    try {
      await ticketsService.createTicket({
        id: newId,
        company: newCompany,
        subject: newSubject,
        priority: newPriority,
        assignedTo: newAssignedTo,
        status: "Open",
        date: today,
        attachments: 0,
      });
      toast?.("Ticket created successfully", "success");
      setShowCreate(false);
      setNewCompany("");
      setNewSubject("");
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      loadTickets();
    } catch {
      toast?.("Failed to create ticket", "error");
    }
  };

  const filtered = tickets.filter((t) => {
    if (!t) return false;
    const statusNorm = normalize(t.status);
    const priorityNorm = normalize(t.priority);

    if (filterStatus !== "All" && statusNorm !== normalize(filterStatus)) return false;
    if (filterPriority !== "All" && priorityNorm !== normalize(filterPriority)) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Support Desk Center"
          subtitle="Monitor and resolve enterprise customer tickets"
        />
        <div className="flex h-60 items-center justify-center">
          <div className="text-muted-foreground text-sm font-medium">Loading tickets...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={activeTab === "tickets" ? "Support Desk Center" : "Inbound Trial Requests & Leads"}
        subtitle={
          activeTab === "tickets"
            ? "Monitor and resolve enterprise customer support tickets"
            : "Review inbound 14-day free trial inquiries and manage prospective client onboarding"
        }
        action={
          activeTab === "tickets" && canCreate ? (
            <button onClick={() => setShowCreate(true)} className={btnCls}>
              + New Support Ticket
            </button>
          ) : activeTab === "trials" ? (
            <button onClick={loadTrialRequests} className={btnCls + " bg-muted text-foreground hover:bg-muted/80"}>
              <RefreshCw className={`w-3.5 h-3.5 ${trialLoading ? "animate-spin" : ""}`} />
              Refresh Leads
            </button>
          ) : undefined
        }
      />

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("tickets")}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "tickets"
              ? "bg-primary text-white shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          Support Tickets ({tickets.length})
        </button>

        <button
          onClick={() => setActiveTab("trials")}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "trials"
              ? "bg-primary text-white shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          Trial Inquiries & Leads ({trialTotal})
        </button>
      </div>

      {activeTab === "tickets" ? (
        /* ─── TAB 1: SUPPORT TICKETS ─── */
        <div className={cardCls + " p-0 overflow-hidden"}>
          <div className="p-4 border-b border-border flex flex-wrap items-center gap-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs sm:text-sm outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Priority:</span>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs sm:text-sm outline-none"
              >
                <option value="All">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm border-collapse">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-4 font-semibold">Ticket ID</th>
                  <th className="p-4 font-semibold">Company</th>
                  <th className="p-4 font-semibold">Subject</th>
                  <th className="p-4 font-semibold">Priority</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground font-medium">
                      No support tickets found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => {
                    const allowedStatuses = getAvailableStatusOptions(t.status, statusFlags);
                    const canChangeStatus = allowedStatuses.length > 0;
                    return (
                      <tr key={t.id} className="hover:bg-muted/30 transition">
                        <td className="p-4 font-mono font-bold whitespace-nowrap">{t.id}</td>
                        <td className="p-4 font-semibold whitespace-nowrap">{t.company}</td>
                        <td className="p-4">{t.subject}</td>
                        <td className="p-4 whitespace-nowrap">
                          <Badge
                            tone={t.priority === "Critical" || t.priority === "High" ? "rose" : "amber"}
                          >
                            {t.priority}
                          </Badge>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <select
                            value={t.status}
                            disabled={!canChangeStatus || updatingStatusId === t.id}
                            onChange={(e) => handleStatusChange(t.id, e.target.value)}
                            className="rounded border border-input bg-background px-2 py-1 text-xs font-semibold outline-none cursor-pointer hover:border-primary disabled:opacity-50"
                          >
                            {allowedStatuses.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4 text-right space-x-3 whitespace-nowrap">
                          <button
                            onClick={() => setChatTicket(t)}
                            className="text-primary hover:underline text-xs font-semibold"
                          >
                            Open Chat
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTargetId(t.id)}
                              className="text-destructive hover:underline text-xs font-semibold"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ─── TAB 2: TRIAL INQUIRIES & LEADS ─── */
        <div className="space-y-4">
          <div className={cardCls + " p-0 overflow-hidden"}>
            <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-muted/20">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={trialSearch}
                    onChange={(e) => setTrialSearch(e.target.value)}
                    placeholder="Search by name, company, email..."
                    className={inputCls + " pl-9"}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Status:</span>
                  <select
                    value={trialFilterStatus}
                    onChange={(e) => setTrialFilterStatus(e.target.value)}
                    className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending Review</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="PROVISIONED">Provisioned</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>

              <span className="text-xs text-muted-foreground font-medium">
                Total Leads: <strong className="text-foreground">{trialTotal}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm border-collapse">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 font-semibold">Requester</th>
                    <th className="p-4 font-semibold">Company & Team</th>
                    <th className="p-4 font-semibold">Contact Info</th>
                    <th className="p-4 font-semibold">Selected Modules</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Requested At</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {trialLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground font-medium">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading trial inquiries...
                      </td>
                    </tr>
                  ) : trialRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground font-medium">
                        No trial requests match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    trialRequests.map((lead) => (
                      <tr key={lead.id} className="hover:bg-muted/30 transition">
                        <td className="p-4 font-medium text-foreground">
                          <div className="font-semibold text-sm">{lead.fullName}</div>
                          <div className="text-muted-foreground text-[11px]">{lead.workEmail}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-foreground">{lead.companyName}</div>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-medium">
                            {lead.teamSize}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <div className="text-foreground font-mono">{lead.phoneNumber}</div>
                          <a
                            href={`mailto:${lead.workEmail}`}
                            className="text-primary hover:underline text-[11px] block mt-0.5"
                          >
                            Send Email
                          </a>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {lead.selectedModulesList && lead.selectedModulesList.length > 0 ? (
                              lead.selectedModulesList.map((mod) => (
                                <span
                                  key={mod}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium border border-blue-200/50 dark:border-blue-800/40"
                                >
                                  {mod}
                                </span>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-[11px]">All Core Modules</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <select
                            value={lead.status}
                            disabled={updatingTrialStatusId === lead.id}
                            onChange={(e) => handleUpdateTrialStatus(lead.id, e.target.value)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold outline-none cursor-pointer transition ${
                              lead.status === "PENDING"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                : lead.status === "CONTACTED"
                                  ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                                  : lead.status === "PROVISIONED"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                    : "bg-rose-500/10 text-rose-600 border-rose-500/30"
                            }`}
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="CONTACTED">CONTACTED</option>
                            <option value="PROVISIONED">PROVISIONED</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>
                        </td>
                        <td className="p-4 text-muted-foreground whitespace-nowrap">
                          {new Date(lead.createdAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedTrialLead(lead);
                              setAdminNotesInput(lead.adminNotes || "");
                            }}
                            className="px-3 py-1 text-xs font-semibold bg-muted hover:bg-muted/80 rounded-lg text-foreground transition"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card p-6 shadow-2xl overflow-y-auto animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-4">Create New Ticket</h3>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-muted-foreground block mb-1">
                  Company
                </label>
                <select
                  required
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select Company...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground block mb-1">
                  Subject
                </label>
                <input
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className={inputCls}
                  placeholder="Describe the issue briefly"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground block mb-1">
                  Priority
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className={inputCls}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground block mb-1">
                  Assign To
                </label>
                <input
                  value={newAssignedTo}
                  onChange={(e) => setNewAssignedTo(e.target.value)}
                  className={inputCls}
                  placeholder="Support Team"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className={btnCls + " !bg-secondary !text-secondary-foreground"}
                >
                  Cancel
                </button>
                <button type="submit" className={btnCls}>
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {chatTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl flex flex-col h-[520px] overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Ticket Support Room — {chatTicket.id}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {chatTicket.company} • {chatTicket.subject}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const allowedStatuses = getAvailableStatusOptions(chatTicket.status, statusFlags);
                  const canChangeStatus = allowedStatuses.length > 0;
                  return (
                    <select
                      value={chatTicket.status}
                      disabled={!canChangeStatus || updatingStatusId === chatTicket.id}
                      onChange={(e) => handleStatusChange(chatTicket.id, e.target.value)}
                      className="rounded border border-input bg-background px-2 py-1 text-xs font-semibold outline-none cursor-pointer hover:border-primary disabled:opacity-50"
                    >
                      {allowedStatuses.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  );
                })()}
                <button
                  onClick={() => setChatTicket(null)}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground transition"
                >
                  Close
                </button>
              </div>
            </div>
            <div
              ref={chatContainerRef}
              className="flex-1 p-4 overflow-y-auto space-y-3 bg-muted/5 flex flex-col"
            >
              {loadingChat ? (
                <div className="text-center text-xs text-muted-foreground my-auto py-8">
                  Loading chat history...
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground my-auto py-8">
                  No messages recorded.
                </div>
              ) : (
                chatMessages.map((msg) => {
                  return (
                    <div
                      key={msg.id}
                      className="flex flex-col items-start"
                    >
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
                  );
                })
              )}
            </div>
            {canMessage && (
              <form
                onSubmit={handleSendChatMessage}
                className="p-3 border-t border-border bg-card flex gap-2"
              >
                <input
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Type support reply..."
                  className={inputCls + " flex-1"}
                  disabled={loadingChat}
                />
                <button
                  type="submit"
                  className={btnCls + " !h-9 px-4 shrink-0"}
                  disabled={loadingChat || !newMessageText.trim()}
                >
                  Send
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-destructive mb-2">Delete Support Ticket?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              This will remove ticket <span className="font-semibold text-foreground">{deleteTargetId}</span> from active support views. The ticket's message history will be retained for audit purposes.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 text-xs font-semibold border border-input rounded-lg hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTicket(deleteTargetId)}
                disabled={deletingTicketId === deleteTargetId}
                className="px-4 py-2 text-xs font-semibold bg-destructive text-white rounded-lg hover:bg-destructive/90 disabled:opacity-50"
              >
                {deletingTicketId === deleteTargetId ? "Deleting..." : "Delete Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TRIAL LEAD DETAILS MODAL ─── */}
      {selectedTrialLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-500/10 text-primary">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-foreground">Trial Lead Profile</h3>
                  <p className="text-xs text-muted-foreground">ID: {selectedTrialLead.id}</p>
                </div>
              </div>

              <select
                value={selectedTrialLead.status}
                onChange={(e) => handleUpdateTrialStatus(selectedTrialLead.id, e.target.value, adminNotesInput)}
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold outline-none"
              >
                <option value="PENDING">PENDING</option>
                <option value="CONTACTED">CONTACTED</option>
                <option value="PROVISIONED">PROVISIONED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-muted/40 p-3.5 rounded-2xl border border-border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Full Name</span>
                  <strong className="text-sm text-foreground">{selectedTrialLead.fullName}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Company Name</span>
                  <strong className="text-sm text-foreground">{selectedTrialLead.companyName}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Work Email</span>
                  <a
                    href={`mailto:${selectedTrialLead.workEmail}`}
                    className="text-primary font-semibold hover:underline"
                  >
                    {selectedTrialLead.workEmail}
                  </a>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Phone / WhatsApp</span>
                  <span className="font-mono text-foreground">{selectedTrialLead.phoneNumber}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Team Size</span>
                  <span className="text-foreground font-medium">{selectedTrialLead.teamSize}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Submission Date</span>
                  <span className="text-foreground font-medium">
                    {new Date(selectedTrialLead.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-semibold text-muted-foreground block mb-1.5">Selected Modules:</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTrialLead.selectedModulesList && selectedTrialLead.selectedModulesList.length > 0 ? (
                    selectedTrialLead.selectedModulesList.map((m) => (
                      <span
                        key={m}
                        className="px-2.5 py-1 rounded-lg text-xs bg-blue-500/10 text-primary font-semibold border border-primary/20"
                      >
                        {m}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground">All Core Modules</span>
                  )}
                </div>
              </div>

              {selectedTrialLead.message && (
                <div>
                  <span className="font-semibold text-muted-foreground block mb-1">Requester Notes / Message:</span>
                  <div className="p-3 bg-muted/50 rounded-xl border border-border italic text-muted-foreground leading-relaxed">
                    "{selectedTrialLead.message}"
                  </div>
                </div>
              )}

              <div>
                <label className="font-semibold text-muted-foreground block mb-1.5">SuperAdmin Internal Notes:</label>
                <textarea
                  value={adminNotesInput}
                  onChange={(e) => setAdminNotesInput(e.target.value)}
                  placeholder="Add private team notes, call logs, onboarding status..."
                  rows={3}
                  className="w-full rounded-xl border border-input bg-background p-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-border">
              <button
                onClick={() => setSelectedTrialLead(null)}
                className="px-4 py-2 text-xs font-semibold border border-input rounded-xl hover:bg-accent"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleUpdateTrialStatus(selectedTrialLead.id, selectedTrialLead.status, adminNotesInput)
                  }
                  disabled={updatingTrialStatusId === selectedTrialLead.id}
                  className={btnCls + " !h-9 px-4"}
                >
                  {updatingTrialStatusId === selectedTrialLead.id ? "Saving..." : "Save Notes & Status"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
