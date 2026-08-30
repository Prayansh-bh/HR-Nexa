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
  Trophy,
} from "lucide-react";
import {
  usePerformanceCyclesQuery,
  usePerformanceReviewsQuery,
  usePerformanceCriteriaQuery,
  usePerformanceMutations,
} from "../../../hooks/usePerformanceQuery";
import { useEmployeesQuery } from "../../../hooks/useEmployeesQuery";
import type { Employee } from "../../../types";
import { ModalShell } from "../../../components/ui";

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const cardCls =
  "rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition hover:shadow-md";

export function getRatingScaleDefinition(score: number): {
  level: string;
  name: string;
  tone: "green" | "indigo" | "sky" | "amber" | "rose";
} {
  if (score >= 4.8) return { level: "Level 5", name: "Outstanding", tone: "green" };
  if (score >= 4.3) return { level: "Level 4.5", name: "Excellent", tone: "indigo" };
  if (score >= 3.8) return { level: "Level 4", name: "Very Good", tone: "indigo" };
  if (score >= 3.3) return { level: "Level 3.5", name: "Good", tone: "sky" };
  if (score >= 2.8) return { level: "Level 3", name: "Meets Expectations", tone: "sky" };
  if (score >= 2.3) return { level: "Level 2.5", name: "Needs Improvement", tone: "amber" };
  if (score >= 1.8) return { level: "Level 2", name: "Poor", tone: "rose" };
  return { level: "Level 1", name: "Unsatisfactory", tone: "rose" };
}

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

function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className={cardCls}>
      <div className="text-xs font-semibold text-muted-foreground mb-1">
        {label}
      </div>
      <div className={`text-2xl font-bold ${color || "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
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

export function PerformanceConfigPage({ toast }: { toast: (m: string) => void }) {
  const [activeTab, setActiveTab] = useState<"cycles" | "reviews">("cycles");
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [evaluatingReview, setEvaluatingReview] = useState<any | null>(null);
  const [evaluatingRemarks, setEvaluatingRemarks] = useState("");
  const [evaluatingScores, setEvaluatingScores] = useState<Record<string, number>>({});

  const [createForm, setCreateForm] = useState<{
    name: string;
    description: string;
    reviewType: string;
    startDate: string;
    endDate: string;
    deadline: string;
    participantScope: "ALL" | "SELECTED";
    participantIds: string[];
  }>({
    name: "",
    description: "",
    reviewType: "Quarterly",
    startDate: getBusinessDateString(),
    endDate: getBusinessDateString(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
    deadline: getBusinessDateString(new Date(Date.now() + 100 * 24 * 60 * 60 * 1000)),
    participantScope: "ALL",
    participantIds: [],
  });

  const {
    data: employeesRawData,
    employees: employeesProp,
    isLoading: isLoadingEmployees,
    isError: isEmployeesError,
    refetch: refetchEmployees,
  } = useEmployeesQuery();

  const employeesData: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesRawData)
        ? employeesRawData
        : (employeesRawData && Array.isArray((employeesRawData as any).data)
            ? (employeesRawData as any).data
            : (Array.isArray(employeesProp) ? employeesProp : [])));

  // Filter eligible employees (Active or On Leave)
  const eligibleEmployees = useMemo(() => {
    return employeesData.filter(
      (e) => e.status === "Active" || e.status === "On Leave",
    );
  }, [employeesData]);

  const [participantSearch, setParticipantSearch] = useState("");
  const [participantDept, setParticipantDept] = useState("");

  const filteredParticipants = useMemo(() => {
    return eligibleEmployees.filter((emp) => {
      const matchName = emp.name.toLowerCase().includes(participantSearch.toLowerCase());
      const matchDept = participantDept ? emp.department === participantDept : true;
      return matchName && matchDept;
    });
  }, [eligibleEmployees, participantSearch, participantDept]);

  const uniqueDepartments = useMemo(() => {
    const depts = new Set<string>();
    eligibleEmployees.forEach((e) => {
      if (e.department) depts.add(e.department);
    });
    return Array.from(depts).sort();
  }, [eligibleEmployees]);

  const { cycles, isLoadingCycles } = usePerformanceCyclesQuery();
  const { reviews, isLoadingReviews } = usePerformanceReviewsQuery({
    reviewCycleId: selectedCycleId || undefined,
    limit: 100,
  });

  // Top Performer / Winner calculation with respect to Rating Scales Definition
  const completedReviews = useMemo(() => {
    return reviews.filter(
      (r: any) =>
        (r.status === "Completed" || r.status === "Approved" || r.status === "HR Review") &&
        r.finalRating &&
        r.finalRating > 0,
    );
  }, [reviews]);

  const topScorers = useMemo(() => {
    if (completedReviews.length === 0) return [];
    const sorted = [...completedReviews].sort((a: any, b: any) => {
      if (b.finalRating !== a.finalRating) {
        return b.finalRating - a.finalRating;
      }
      return (a.employee?.name || "").localeCompare(b.employee?.name || "");
    });
    const maxScore = sorted[0].finalRating;
    return sorted.filter((r: any) => r.finalRating === maxScore);
  }, [completedReviews]);
  
  const { criteria = [] } = usePerformanceCriteriaQuery();
  
  const mutations = usePerformanceMutations();

  useEffect(() => {
    if (cycles.length > 0 && !selectedCycleId) {
      setSelectedCycleId(cycles[0].id);
    }
  }, [cycles, selectedCycleId]);

  const handleCreateCycle = async () => {
    if (!createForm.name.trim()) {
      toast("Please provide a cycle name");
      return;
    }
    if (
      createForm.participantScope === "SELECTED" &&
      createForm.participantIds.length === 0
    ) {
      toast("Please select at least one participant for this cycle");
      return;
    }
    try {
      await mutations.createCycle.mutateAsync({
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        reviewType: createForm.reviewType,
        startDate: createForm.startDate,
        endDate: createForm.endDate,
        deadline: createForm.deadline,
        participantScope: createForm.participantScope,
        participantIds:
          createForm.participantScope === "SELECTED" ? createForm.participantIds : [],
      });
      toast("Performance cycle created successfully");
      setShowCreateModal(false);
      setCreateForm({
        name: "",
        description: "",
        reviewType: "Quarterly",
        startDate: getBusinessDateString(),
        endDate: getBusinessDateString(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
        deadline: getBusinessDateString(new Date(Date.now() + 100 * 24 * 60 * 60 * 1000)),
        participantScope: "ALL",
        participantIds: [],
      });
      setParticipantSearch("");
      setParticipantDept("");
    } catch (e: any) {
      const errMsg =
        e?.response?.data?.message || "Failed to create performance cycle";
      toast(typeof errMsg === "string" ? errMsg : "Failed to create performance cycle");
    }
  };

  const handleLaunchCycle = async (cycleId: string) => {
    try {
      // 1. Provision reviews for all active employees
      await mutations.provisionReviews.mutateAsync(cycleId);
      // 2. Update status of the cycle to Active
      await mutations.updateCycle.mutateAsync({ id: cycleId, cycle: { status: "Active" } });
      toast("Performance review cycle successfully launched and templates generated!");
    } catch (e) {
      toast("Failed to launch assessment cycle");
    }
  };

  const handleCompleteCycle = async (cycleId: string) => {
    try {
      await mutations.updateCycle.mutateAsync({ id: cycleId, cycle: { status: "Completed" } });
      toast("Performance cycle marked as Completed");
    } catch (e) {
      toast("Failed to update cycle status");
    }
  };

  const handleOpenEvaluate = (review: any) => {
    setEvaluatingReview(review);
    setEvaluatingRemarks(review.hrRemarks || "");
    const initialScores: Record<string, number> = {};
    review.scores?.forEach((s: any) => {
      // Default to the hrScore if overridden, managerScore if manager submitted, or attendance default
      initialScores[s.criterionId] = s.hrScore || s.managerScore || s.selfScore || 0;
    });
    setEvaluatingScores(initialScores);
  };

  const handleSaveEvaluation = async () => {
    if (!evaluatingReview) return;
    try {
      const scoresPayload = Object.entries(evaluatingScores).map(([criterionId, score]) => ({
        criterionId,
        score,
        remarks: "HR override score",
      }));

      await mutations.overrideHrReview.mutateAsync({
        id: evaluatingReview.id,
        remarks: evaluatingRemarks,
        scores: scoresPayload,
      });

      toast("HR ratings override saved successfully");
      setEvaluatingReview(null);
    } catch (e) {
      toast("Failed to save evaluation override");
    }
  };

  const handleApproveEvaluation = async () => {
    if (!evaluatingReview) return;
    try {
      await mutations.approveReview.mutateAsync(evaluatingReview.id);
      toast("Evaluation approved successfully");
      setEvaluatingReview(null);
    } catch (e) {
      toast("Failed to approve evaluation");
    }
  };

  const handleCompleteEvaluation = async () => {
    if (!evaluatingReview) return;
    try {
      await mutations.completeReview.mutateAsync(evaluatingReview.id);
      toast("Evaluation locked and completed successfully");
      setEvaluatingReview(null);
    } catch (e) {
      toast("Failed to complete evaluation");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Performance Cycles & KRAs</h1>
          <p className="text-sm text-muted-foreground">
            Setup target dates, 360-review cycles, and corporate rating definitions.
          </p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Create Cycle
          </Btn>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("cycles")}
          className={`px-4 py-2 text-sm font-semibold transition border-b-2 -mb-[2px] ${
            activeTab === "cycles"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Review Cycles
        </button>
        <button
          onClick={() => setActiveTab("reviews")}
          className={`px-4 py-2 text-sm font-semibold transition border-b-2 -mb-[2px] ${
            activeTab === "reviews"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Employee Appraisals Console
        </button>
      </div>

      {activeTab === "cycles" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={cardCls + " md:col-span-2 space-y-4"}>
            <h3 className="font-bold flex items-center gap-2">
              <Sliders size={18} /> Performance Assessment Waves
            </h3>

            {isLoadingCycles ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading cycles...
              </div>
            ) : cycles.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No review cycles configured yet. Click "Create Cycle" to start.
              </div>
            ) : (
              <div className="space-y-3">
                {cycles.map((c: any) => {
                  const cycleReviews = reviews.filter((r: any) => r.reviewCycleId === c.id);
                  const total = cycleReviews.length;
                  const selfCompleted = cycleReviews.filter((r: any) =>
                    ["Manager Review", "HR Review", "Approved", "Completed"].includes(r.status),
                  ).length;
                  const managerCompleted = cycleReviews.filter((r: any) =>
                    ["HR Review", "Approved", "Completed"].includes(r.status),
                  ).length;
                  const hrCalibrated = cycleReviews.filter((r: any) =>
                    ["Approved", "Completed"].includes(r.status),
                  ).length;
                  const completed = cycleReviews.filter(
                    (r: any) => r.status === "Completed",
                  ).length;

                  return (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row justify-between sm:items-center p-4 bg-muted/40 rounded-xl border border-border text-sm gap-3"
                    >
                      <div className="flex-1">
                        <div className="font-bold text-foreground">{c.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {c.description || "No description provided"}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                          <div>
                            Type:{" "}
                            <span className="font-semibold text-foreground">{c.reviewType}</span>
                          </div>
                          <div>
                            Duration:{" "}
                            <span className="font-semibold text-foreground">
                              {c.startDate} to {c.endDate}
                            </span>
                          </div>
                          <div>
                            Deadline:{" "}
                            <span className="font-semibold text-rose-500">{c.deadline}</span>
                          </div>
                        </div>

                        {total > 0 && (
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-xs">
                            <div className="bg-muted p-2 rounded">
                              <div className="font-bold text-lg">{total}</div>
                              <div className="text-muted-foreground">Assigned</div>
                            </div>
                            <div className="bg-muted p-2 rounded">
                              <div className="font-bold text-lg text-amber-500">
                                {selfCompleted}
                              </div>
                              <div className="text-muted-foreground">Self Done</div>
                            </div>
                            <div className="bg-muted p-2 rounded">
                              <div className="font-bold text-lg text-blue-500">
                                {managerCompleted}
                              </div>
                              <div className="text-muted-foreground">Mgr Done</div>
                            </div>
                            <div className="bg-muted p-2 rounded">
                              <div className="font-bold text-lg text-indigo-500">
                                {hrCalibrated}
                              </div>
                              <div className="text-muted-foreground">HR Done</div>
                            </div>
                            <div className="bg-muted p-2 rounded">
                              <div className="font-bold text-lg text-green-500">{completed}</div>
                              <div className="text-muted-foreground">Completed</div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end justify-start self-start sm:self-center ml-4">
                        <Badge
                          tone={
                            c.status === "Active"
                              ? "green"
                              : c.status === "Completed"
                                ? "indigo"
                                : "slate"
                          }
                        >
                          {c.status}
                        </Badge>
                        {c.status === "Draft" && (
                          <Btn
                            size="sm"
                            onClick={() => handleLaunchCycle(c.id)}
                            disabled={mutations.provisionReviews.isPending}
                          >
                            {mutations.provisionReviews.isPending ? "Launching..." : "Launch"}
                          </Btn>
                        )}
                        {c.status === "Active" && (
                          <Btn
                            size="sm"
                            variant="outline"
                            onClick={() => handleCompleteCycle(c.id)}
                          >
                            Complete
                          </Btn>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={cardCls + " space-y-4 h-fit"}>
            <h3 className="font-bold">Rating Scales Definition</h3>
            <p className="text-xs text-muted-foreground">Our corporate rating levels and scale:</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 bg-muted/30 rounded-lg">
                <span>Level 5: Outstanding</span>
                <Badge tone="green">5.0</Badge>
              </div>
              <div className="flex justify-between p-2 bg-muted/30 rounded-lg">
                <span>Level 4.5: Excellent</span>
                <Badge tone="indigo">4.5</Badge>
              </div>
              <div className="flex justify-between p-2 bg-muted/30 rounded-lg">
                <span>Level 4: Very Good</span>
                <Badge tone="indigo">4.0</Badge>
              </div>
              <div className="flex justify-between p-2 bg-muted/30 rounded-lg">
                <span>Level 3.5: Good</span>
                <Badge tone="sky">3.5</Badge>
              </div>
              <div className="flex justify-between p-2 bg-muted/30 rounded-lg">
                <span>Level 3: Meets Expectations</span>
                <Badge tone="sky">3.0</Badge>
              </div>
              <div className="flex justify-between p-2 bg-muted/30 rounded-lg">
                <span>Level 2.5: Needs Improvement</span>
                <Badge tone="amber">2.5</Badge>
              </div>
              <div className="flex justify-between p-2 bg-muted/30 rounded-lg">
                <span>Level 2: Poor</span>
                <Badge tone="rose">2.0</Badge>
              </div>
              <div className="flex justify-between p-2 bg-muted/30 rounded-lg">
                <span>Level 1: Unsatisfactory</span>
                <Badge tone="rose">1.0</Badge>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="w-full sm:w-72">
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Select Active Assessment Cycle
              </label>
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className={inputCls}
              >
                <option value="">-- Choose Cycle --</option>
                {cycles.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="text-sm text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border">
              <span className="font-semibold text-foreground">Tip:</span> Attendance rating (1.0 -
              5.0) is auto-calculated based on check-in records!
            </div>
          </div>

          {/* Assessment Winner / Top Performer Banner */}
          {selectedCycleId && topScorers.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-primary/10 to-indigo-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30 shadow-inner">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
                      {topScorers.length > 1 ? "Assessment Co-Winners / Top Performers" : "Assessment Winner / Top Performer"}
                    </span>
                    <Badge tone={getRatingScaleDefinition(topScorers[0].finalRating).tone}>
                      {getRatingScaleDefinition(topScorers[0].finalRating).level}: {getRatingScaleDefinition(topScorers[0].finalRating).name}
                    </Badge>
                  </div>
                  <div className="text-base font-bold text-foreground mt-0.5">
                    {topScorers.map((w: any) => w.employee?.name).join(", ")}
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      ({topScorers.map((w: any) => w.employee?.department?.name || w.employee?.department || "Department").join(", ")})
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-[11px] text-muted-foreground font-medium">Authoritative Rating</div>
                <div className="text-xl font-black text-amber-500">
                  {topScorers[0].finalRating.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">/ 5.0</span>
                </div>
              </div>
            </div>
          )}

          <div className={cardCls + " overflow-x-auto"}>
            {isLoadingReviews ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading employee appraisal records...
              </div>
            ) : !selectedCycleId ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Please select an assessment cycle.
              </div>
            ) : reviews.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No appraisals found for this cycle. Active templates generate when you "Launch" the
                cycle.
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Self</th>
                    <th className="py-3 px-4 text-center">Mgr</th>
                    <th className="py-3 px-4 text-center">Attendance</th>
                    <th className="py-3 px-4 text-center">Final</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r: any) => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/20 transition">
                      <td className="py-3.5 px-4 font-bold">{r.employee?.name}</td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {r.employee?.department?.name || "N/A"}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          tone={
                            r.status === "Completed"
                              ? "green"
                              : r.status === "Approved"
                                ? "indigo"
                                : r.status === "Self Review"
                                  ? "sky"
                                  : r.status === "Manager Review"
                                    ? "amber"
                                    : "slate"
                          }
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold">
                        {r.selfRating > 0 ? r.selfRating.toFixed(1) : "-"}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold">
                        {r.managerRating > 0 ? r.managerRating.toFixed(1) : "-"}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-indigo-500">
                        {(() => {
                          const attScore =
                            r.attendanceRating > 0
                              ? r.attendanceRating
                              : r.scores?.find((s: any) => s.criterion?.name === "Attendance")?.hrScore;
                          return attScore && attScore > 0 ? attScore.toFixed(1) : "-";
                        })()}
                      </td>
                      <td className="py-3.5 px-4 text-center font-extrabold text-emerald-600">
                        {r.finalRating > 0 ? r.finalRating.toFixed(1) : "-"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Btn size="sm" variant="outline" onClick={() => handleOpenEvaluate(r)}>
                          Evaluate / Override
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Create Cycle Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl my-auto">
            <h3 className="text-lg font-bold mb-4">Create Performance Cycle</h3>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <Field label="Cycle Name *">
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. 2026 Q3 Mid-Year Assessment"
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className={inputCls + " h-20 py-2 resize-none"}
                  placeholder="Describe focus areas, targets, etc."
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Review Type">
                  <select
                    value={createForm.reviewType}
                    onChange={(e) => setCreateForm({ ...createForm, reviewType: e.target.value })}
                    className={inputCls}
                  >
                    <option>Quarterly</option>
                    <option>Semi-Annual</option>
                    <option>Annual</option>
                  </select>
                </Field>
                <Field label="Start Date">
                  <input
                    type="date"
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="End Date">
                  <input
                    type="date"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Deadline">
                  <input
                    type="date"
                    value={createForm.deadline}
                    onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Participant Scope">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCreateForm((prev) => ({
                        ...prev,
                        participantScope: "ALL",
                      }))
                    }
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition ${
                      createForm.participantScope === "ALL"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-input text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Company-wide (All)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCreateForm((prev) => ({
                        ...prev,
                        participantScope: "SELECTED",
                      }))
                    }
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition ${
                      createForm.participantScope === "SELECTED"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-input text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Specific Participants
                  </button>
                </div>
              </Field>

              {createForm.participantScope === "ALL" ? (
                <div className="p-3 bg-muted/40 border border-border rounded-lg text-xs text-muted-foreground flex items-center gap-2.5">
                  <Info className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    All eligible active and on-leave employees across the company will automatically be enrolled (
                    <strong className="text-foreground">{eligibleEmployees.length}</strong> eligible).
                  </span>
                </div>
              ) : (
                <Field
                  label={
                    isLoadingEmployees
                      ? "Specific Participants (Loading...)"
                      : `Specific Participants (${createForm.participantIds.length} selected, ${filteredParticipants.length} matching)`
                  }
                >
                  <div className="border border-border rounded-lg bg-background flex flex-col overflow-hidden">
                    {isLoadingEmployees ? (
                      <div className="flex flex-col items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span>Loading eligible employees...</span>
                      </div>
                    ) : isEmployeesError ? (
                      <div className="flex flex-col items-center justify-center py-5 px-3 gap-2 text-xs text-destructive bg-destructive/5">
                        <AlertCircle className="w-5 h-5" />
                        <span>Failed to load employees.</span>
                        <Btn
                          size="sm"
                          variant="outline"
                          onClick={() => refetchEmployees()}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Retry
                        </Btn>
                      </div>
                    ) : eligibleEmployees.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground">
                        No eligible active employees found in your organization.
                      </div>
                    ) : (
                      <>
                        <div className="p-2 border-b border-border bg-muted/40 space-y-2">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                              <input
                                type="text"
                                placeholder="Search name..."
                                value={participantSearch}
                                onChange={(e) => setParticipantSearch(e.target.value)}
                                className="h-8 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs outline-none focus:border-primary"
                              />
                            </div>
                            <select
                              value={participantDept}
                              onChange={(e) => setParticipantDept(e.target.value)}
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none"
                            >
                              <option value="">All Departments</option>
                              {uniqueDepartments.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Btn
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const allIds = filteredParticipants.map((e) => e.id);
                                const newIds = Array.from(
                                  new Set([...createForm.participantIds, ...allIds]),
                                );
                                setCreateForm((prev) => ({
                                  ...prev,
                                  participantIds: newIds,
                                }));
                              }}
                            >
                              Select All Filtered
                            </Btn>
                            <Btn
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setCreateForm((prev) => ({
                                  ...prev,
                                  participantIds: [],
                                }))
                              }
                            >
                              Clear All
                            </Btn>
                          </div>
                        </div>
                        <div className="max-h-40 overflow-y-auto p-2 space-y-1">
                          {filteredParticipants.map((emp) => (
                            <label
                              key={emp.id}
                              className="flex items-center gap-2 text-sm p-1 hover:bg-muted/50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={createForm.participantIds.includes(emp.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setCreateForm((prev) => ({
                                      ...prev,
                                      participantIds: [...prev.participantIds, emp.id],
                                    }));
                                  } else {
                                    setCreateForm((prev) => ({
                                      ...prev,
                                      participantIds: prev.participantIds.filter(
                                        (id) => id !== emp.id,
                                      ),
                                    }));
                                  }
                                }}
                              />
                              {emp.name}{" "}
                              <span className="text-muted-foreground text-xs">
                                ({emp.department || "No Dept"})
                              </span>
                            </label>
                          ))}
                          {filteredParticipants.length === 0 && (
                            <div className="text-center py-4 text-xs text-muted-foreground">
                              No employees match the current filters.
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </Field>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Btn variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Btn>
              <Btn onClick={handleCreateCycle} disabled={mutations.createCycle.isPending}>
                {mutations.createCycle.isPending ? "Creating..." : "Create Cycle"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Evaluate Appraisal Modal */}
      {evaluatingReview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl my-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">Appraisal Review & Override Console</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Evaluating{" "}
                  <span className="font-semibold text-foreground">
                    {evaluatingReview.employee?.name}
                  </span>{" "}
                  for{" "}
                  <span className="font-semibold text-foreground">
                    {evaluatingReview.reviewCycle?.name}
                  </span>
                </p>
              </div>
              <Badge tone="sky">Status: {evaluatingReview.status}</Badge>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl text-xs border border-border">
                <div>
                  <div className="font-bold text-muted-foreground">Self Evaluation</div>
                  <div className="mt-1 font-semibold">
                    Self Rating:{" "}
                    {evaluatingReview.selfRating > 0
                      ? `${evaluatingReview.selfRating.toFixed(1)} / 5.0`
                      : "Not submitted"}
                  </div>
                  <div className="mt-2 text-muted-foreground italic">
                    "{evaluatingReview.selfFeedback || "No self feedback comments provided."}"
                  </div>
                </div>
                <div>
                  <div className="font-bold text-muted-foreground">Manager Evaluation</div>
                  <div className="mt-1 font-semibold">
                    Manager Rating:{" "}
                    {evaluatingReview.managerRating > 0
                      ? `${evaluatingReview.managerRating.toFixed(1)} / 5.0`
                      : "Not submitted"}
                  </div>
                  <div className="mt-2 text-muted-foreground italic">
                    "{evaluatingReview.managerFeedback || "No manager feedback comments provided."}"
                  </div>
                </div>
              </div>

              {/* Criterion Level Ratings */}
              <div className="space-y-3.5">
                <h4 className="font-bold text-sm border-b border-border pb-1">
                  Evaluated Core Criteria Scores
                </h4>

                {evaluatingReview.scores?.map((s: any) => (
                  <div
                    key={s.id}
                    className="p-3 bg-muted/20 rounded-xl border border-border text-xs space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-sm">{s.criterion?.name}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          (Weight: {s.criterion?.weight})
                        </span>
                      </div>
                      <div className="flex gap-4">
                        <span>
                          Self:{" "}
                          <strong className="text-foreground">
                            {s.selfScore > 0 ? s.selfScore.toFixed(1) : "-"}
                          </strong>
                        </span>
                        <span>
                          Mgr:{" "}
                          <strong className="text-foreground">
                            {s.managerScore > 0 ? s.managerScore.toFixed(1) : "-"}
                          </strong>
                        </span>
                        {s.criterion?.name === "Attendance" && (
                          <span className="text-indigo-500 font-semibold">
                            System Auto: {s.hrScore > 0 ? s.hrScore.toFixed(1) : "-"}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground">{s.criterion?.description}</p>

                    {/* Score Slider input */}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        Set HR Score:
                      </span>
                      <input
                        type="range"
                        min="1.0"
                        max="5.0"
                        step="0.5"
                        value={evaluatingScores[s.criterionId] || 1.0}
                        onChange={(e) =>
                          setEvaluatingScores({
                            ...evaluatingScores,
                            [s.criterionId]: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-primary h-1 bg-muted rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="font-bold text-sm bg-primary/10 text-primary px-2.5 py-0.5 rounded-lg border border-primary/20">
                        {(evaluatingScores[s.criterionId] || 1.0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Manager Submitted Recommendations Display */}
              <div className="p-3.5 bg-muted/20 rounded-xl border border-border space-y-2">
                <div className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                  <span>Manager Recommendations</span>
                  <span className="text-[10px] font-normal italic">Captured during manager evaluation</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge tone={evaluatingReview.promotionRecommended ? "green" : "slate"}>
                    {evaluatingReview.promotionRecommended ? "✓ Promotion Recommended" : "✗ No Promotion"}
                  </Badge>
                  <Badge tone={evaluatingReview.incrementRecommended ? "indigo" : "slate"}>
                    {evaluatingReview.incrementRecommended ? "✓ Salary Increment" : "✗ No Increment"}
                  </Badge>
                  <Badge tone={evaluatingReview.trainingRecommended ? "amber" : "slate"}>
                    {evaluatingReview.trainingRecommended ? "✓ Recommend Training" : "✗ No Training"}
                  </Badge>
                </div>
              </div>

              <Field label="HR Appraisal Remarks & Feedback">
                <textarea
                  value={evaluatingRemarks}
                  onChange={(e) => setEvaluatingRemarks(e.target.value)}
                  className={inputCls + " h-20 py-2 resize-none"}
                  placeholder="Enter notes, justification, or recommendations for leadership review."
                />
              </Field>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-2 mt-6 pt-4 border-t border-border">
              <div className="flex gap-2">
                <Btn variant="outline" onClick={() => setEvaluatingReview(null)}>
                  Close
                </Btn>
                <Btn
                  variant="success"
                  onClick={handleSaveEvaluation}
                  disabled={mutations.overrideHrReview.isPending}
                >
                  {mutations.overrideHrReview.isPending ? "Saving..." : "Save Override Ratings"}
                </Btn>
              </div>
              <div className="flex gap-2">
                {["HR Review", "Manager Review"].includes(evaluatingReview.status) && (
                  <Btn
                    onClick={handleApproveEvaluation}
                    disabled={mutations.approveReview.isPending}
                  >
                    Approve
                  </Btn>
                )}
                {evaluatingReview.status === "Approved" && (
                  <Btn
                    onClick={handleCompleteEvaluation}
                    disabled={mutations.completeReview.isPending}
                  >
                    Complete & Lock
                  </Btn>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
