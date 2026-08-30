import React, { useState, useMemo, useEffect, useRef } from "react";
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
import {
  useRecruitmentStore,
  Candidate,
  JobRequisition,
} from "../../../store";
import { ModalShell } from "../../../components/ui";
import { printHTML } from "../../../lib/pdf-export";
import { recruitmentService } from "../../../services/recruitment.service";
import { employeeService } from "../../../services/employee.service";
import { useDepartmentsQuery, useDesignationsQuery } from "../../../hooks/useOrgQuery";
import { OfferConfigurationModal } from "../components/OfferConfigurationModal";

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

export function RecruitmentPage({
  toast,
  employees,
  setEmployees,
  requisitions: propRequisitions,
  candidates: propCandidates,
  addRequisition: propAddRequisition,
  deleteRequisition: propDeleteRequisition,
  addCandidate: propAddCandidate,
  updateCandidateStage: propUpdateCandidateStage,
}: {
  toast: (m: string) => void;
  employees?: any[];
  setEmployees?: any;
  requisitions?: any[];
  candidates?: any[];
  addRequisition?: (req: any) => Promise<void>;
  deleteRequisition?: (id: string) => Promise<void>;
  addCandidate?: (cand: any) => Promise<void>;
  updateCandidateStage?: (id: string, stage: any) => Promise<void>;
}) {
  const storeRequisitions = useRecruitmentStore((s) => s.requisitions);
  const storeCandidates = useRecruitmentStore((s) => s.candidates);
  const fetchRequisitions = useRecruitmentStore((s) => s.fetchRequisitions);
  const fetchCandidates = useRecruitmentStore((s) => s.fetchCandidates);
  const storeAddRequisition = useRecruitmentStore((s) => s.addRequisition);
  const storeDeleteRequisition = useRecruitmentStore((s) => s.deleteRequisition);
  const storeAddCandidate = useRecruitmentStore((s) => s.addCandidate);
  const storeUpdateCandidateStage = useRecruitmentStore((s) => s.updateCandidateStage);
  const storeUpdateRequisition = useRecruitmentStore((s) => s.updateRequisition);
  const storeSubmitEvaluation = useRecruitmentStore((s) => s.submitEvaluation);
  const { data: fetchedDepts = [] } = useDepartmentsQuery();
  const { data: fetchedDesigs = [], isLoading: desigLoading } = useDesignationsQuery();

  const deptList = fetchedDepts;
  const desigList = fetchedDesigs;

  // Modal state
  const [reqModal, setReqModal] = useState(false);
  const [candModal, setCandModal] = useState(false);
  const [evalModal, setEvalModal] = useState<{ candidateId: string; candidateName: string } | null>(
    null,
  );
  const [loadingReq, setLoadingReq] = useState(false);
  const [loadingCand, setLoadingCand] = useState(false);
  const [loadingEval, setLoadingEval] = useState(false);

  const [editingRequisitionId, setEditingRequisitionId] = useState<string | null>(null);
  const [deptSearch, setDeptSearch] = useState("");
  const [desigSearch, setDesigSearch] = useState("");
  const [deptOpen, setDeptOpen] = useState(false);
  const [desigOpen, setDesigOpen] = useState(false);

  // Offer modal state
  const [offerModal, setOfferModal] = useState<{
    candidate: Candidate;
    job: JobRequisition | null;
  } | null>(null);
  const [formOffer, setFormOffer] = useState({
    annualCTC: "800000",
    designation: "",
    joiningDate: "",
    expiryDate: "",
    terms: "Standard probation period of 3 months applies. Governed by company policies.",
  });
  const [compensationPreview, setCompensationPreview] = useState<any | null>(null);
  const [loadingOfferPreview, setLoadingOfferPreview] = useState(false);
  const [generatingOffer, setGeneratingOffer] = useState(false);
  const [viewingOffer, setViewingOffer] = useState<{ candidateName: string; offer: any } | null>(null);

  // Full requisition form
  const emptyReqForm = {
    title: "",
    dept: "",
    departmentId: "",
    designationId: "",
    hiringManager: "",
    openings: 1,
    location: "Remote",
    type: "Full-Time",
    priority: "Medium",
    minSalary: "",
    maxSalary: "",
    currency: "INR",
    budgetJustification: "",
    jobDescription: "",
    skillsRequired: "",
    experienceRequired: "",
    educationRequired: "",
    expectedJoiningDate: "",
  };
  const [formReq, setFormReq] = useState(emptyReqForm);

  // Evaluation form
  const emptyEvalForm = {
    technicalSkills: 5,
    communication: 5,
    experienceMatch: 5,
    culturalFit: 5,
    problemSolving: 5,
    leadership: 5,
    overallRecommendation: "Yes",
    notes: "",
  };
  const [formEval, setFormEval] = useState(emptyEvalForm);

  const [formCand, setFormCand] = useState({ name: "", email: "", position: "", jobId: "" });

  // Live preview score calculation (mirrors backend formula)
  const previewScore = (() => {
    const {
      technicalSkills: ts,
      communication: comm,
      experienceMatch: exp,
      culturalFit: cult,
      problemSolving: ps,
      leadership: lead,
    } = formEval;
    const weighted = ts * 1.2 + exp * 1.2 + comm * 1.0 + ps * 1.0 + cult * 0.8 + lead * 0.8;
    const maxPossible = 10 * (1.2 + 1.2 + 1.0 + 1.0 + 0.8 + 0.8);
    return Math.round((weighted / maxPossible) * 100 * 10) / 10;
  })();

  useEffect(() => {
    if (propRequisitions === undefined) fetchRequisitions();
    if (propCandidates === undefined) fetchCandidates();
  }, []);

  const requisitions = propRequisitions !== undefined ? propRequisitions : storeRequisitions;
  const candidates = propCandidates !== undefined ? propCandidates : storeCandidates;

  const addReq = async () => {
    if (!formReq.title.trim() || !formReq.dept.trim()) {
      toast("Job Title and Department are required");
      return;
    }
    const minS = formReq.minSalary ? Number(formReq.minSalary) : undefined;
    const maxS = formReq.maxSalary ? Number(formReq.maxSalary) : undefined;
    if (minS !== undefined && maxS !== undefined && minS > maxS) {
      toast("Minimum salary cannot exceed maximum salary");
      return;
    }
    if (minS !== undefined && minS < 0) {
      toast("Salary cannot be negative");
      return;
    }

    setLoadingReq(true);
    try {
      const matchedDesig = desigList.find(
        (d) => d.id === formReq.designationId || d.name === formReq.designationId,
      );
      const payload = {
        title: formReq.title.trim(),
        dept: formReq.dept.trim(),
        departmentId: formReq.departmentId || undefined,
        designationId: matchedDesig?.id || (formReq.designationId?.match(/^[0-9a-f-]{36}$/i) ? formReq.designationId : undefined),
        hiringManager: formReq.hiringManager?.trim() || undefined,
        openings: Number(formReq.openings) || 1,
        location: formReq.location?.trim() || "Remote",
        type: formReq.type || "Full-Time",
        priority: formReq.priority || "Medium",
        minSalary: minS,
        maxSalary: maxS,
        currency: formReq.currency || "INR",
        budgetJustification: formReq.budgetJustification?.trim() || undefined,
        jobDescription: formReq.jobDescription?.trim() || undefined,
        skillsRequired: formReq.skillsRequired
          ? formReq.skillsRequired
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        experienceRequired: formReq.experienceRequired?.trim() || undefined,
        educationRequired: formReq.educationRequired?.trim() || undefined,
        expectedJoiningDate: formReq.expectedJoiningDate || undefined,
      };

      if (editingRequisitionId) {
        await storeUpdateRequisition(editingRequisitionId, {
          ...payload,
          status: requisitions.find((r) => r.id === editingRequisitionId)?.status || "Open",
        });
        toast("Job Requisition updated successfully");
      } else {
        if (propAddRequisition) await propAddRequisition(payload);
        else await storeAddRequisition(payload);
        toast("Job Requisition submitted successfully");
      }
      setReqModal(false);
      setEditingRequisitionId(null);
      setFormReq(emptyReqForm);
    } catch (err: any) {
      toast(err.message || "Failed to save job requisition");
    } finally {
      setLoadingReq(false);
    }
  };

  const openEditReq = (r: any) => {
    setEditingRequisitionId(r.id);
    setFormReq({
      title: r.title,
      dept: r.dept,
      departmentId: r.departmentId || "",
      designationId: r.designationId || "",
      hiringManager: r.hiringManager || "",
      openings: r.openings,
      location: r.location || "Remote",
      type: r.type || "Full-Time",
      priority: r.priority || "Medium",
      minSalary: r.minSalary != null ? String(r.minSalary) : "",
      maxSalary: r.maxSalary != null ? String(r.maxSalary) : "",
      currency: r.currency || "INR",
      budgetJustification: r.budgetJustification || "",
      jobDescription: r.jobDescription || "",
      skillsRequired: Array.isArray(r.skillsRequired) ? r.skillsRequired.join(", ") : "",
      experienceRequired: r.experienceRequired || "",
      educationRequired: r.educationRequired || "",
      expectedJoiningDate: r.expectedJoiningDate || "",
    });
    setDeptSearch("");
    setDesigSearch("");
    setDeptOpen(false);
    setDesigOpen(false);
    setReqModal(true);
  };

  const addCand = async () => {
    if (!formCand.name.trim() || !formCand.email.trim()) {
      toast("Candidate Name and Contact Email are required");
      return;
    }
    if (!formCand.jobId && !formCand.position.trim()) {
      toast("Please select a job position for the candidate");
      return;
    }
    setLoadingCand(true);
    try {
      if (propAddCandidate) await propAddCandidate(formCand);
      else await storeAddCandidate(formCand);
      toast("Candidate added to pipeline");
      setCandModal(false);
      setFormCand({ name: "", email: "", position: "", jobId: "" });
    } catch (err: any) {
      toast(err.message || "Failed to add candidate");
    } finally {
      setLoadingCand(false);
    }
  };

  const openOfferModalForCandidate = (candId: string) => {
    const c = candidates.find((cand) => cand.id === candId);
    if (!c) return;
    const job = requisitions.find((r) => r.title === c.position) || null;
    const defaultCTC = job?.minSalary ? String(job.minSalary) : "800000";
    setFormOffer({
      annualCTC: defaultCTC,
      designation: c.position || job?.title || "Software Engineer",
      joiningDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      terms: "Standard probation period of 3 months applies. Governed by company policies.",
    });
    setCompensationPreview(null);
    setOfferModal({ candidate: c, job });
  };

  const handlePreviewCompensation = async () => {
    if (!offerModal) return;
    const ctc = Number(formOffer.annualCTC);
    if (!ctc || ctc <= 0) {
      toast("Please enter a valid Annual CTC");
      return;
    }
    setLoadingOfferPreview(true);
    try {
      const preview = await recruitmentService.previewOffer(offerModal.candidate.id, {
        annualCTC: ctc,
        designation: formOffer.designation,
        joiningDate: formOffer.joiningDate,
        expiryDate: formOffer.expiryDate,
      });
      setCompensationPreview(preview);
      toast("Compensation breakdown calculated successfully");
    } catch (err: any) {
      toast(err.message || "Failed to calculate compensation breakdown");
    } finally {
      setLoadingOfferPreview(false);
    }
  };

  const handleGenerateOffer = async () => {
    if (!offerModal) return;
    const ctc = Number(formOffer.annualCTC);
    if (!ctc || ctc <= 0) {
      toast("Please enter a valid Annual CTC");
      return;
    }
    if (!formOffer.designation.trim()) {
      toast("Designation is required");
      return;
    }
    if (!formOffer.joiningDate.trim()) {
      toast("Joining date is required");
      return;
    }

    setGeneratingOffer(true);
    try {
      const result = await recruitmentService.generateOffer(offerModal.candidate.id, {
        annualCTC: ctc,
        designation: formOffer.designation,
        joiningDate: formOffer.joiningDate,
        expiryDate: formOffer.expiryDate,
        terms: formOffer.terms,
      });
      toast(`Offer letter generated for ${offerModal.candidate.name} & saved to Offer Letters (No email sent)`);
      setOfferModal(null);
      await fetchCandidates();
      if (result?.offer) {
        setViewingOffer({ candidateName: offerModal.candidate.name, offer: result.offer });
      }
    } catch (err: any) {
      toast(err.message || "Failed to generate offer letter");
    } finally {
      setGeneratingOffer(false);
    }
  };

  const handleViewCandidateOffer = async (candId: string, candName: string) => {
    try {
      const offer = await recruitmentService.getCandidateOffer(candId);
      if (offer && offer.document) {
        setViewingOffer({ candidateName: candName, offer });
      } else {
        toast(`No generated offer letter found for ${candName}`);
      }
    } catch (err: any) {
      toast(err.message || "Failed to retrieve offer letter");
    }
  };

  const moveCandidate = async (id: string, nextStatus: any) => {
    try {
      if (nextStatus === "Offer") {
        openOfferModalForCandidate(id);
        return;
      }

      if (propUpdateCandidateStage) await propUpdateCandidateStage(id, nextStatus);
      else await storeUpdateCandidateStage(id, nextStatus);
      toast(`Moved to ${nextStatus}`);
      if (nextStatus === "Hired") {
        const c = candidates.find((cand) => cand.id === id);
        if (c) {
          try {
            await employeeService.createEmployee({
              name: c.name,
              department: "Engineering",
              designation: c.position || "Software Engineer",
              type: "Full-Time",
              status: "Active",
              email: c.email || `${c.name.toLowerCase().replace(/\s+/g, ".")}@company.com`,
              phone: "+91-9876543210",
              salary: 800000,
            });
            if (setEmployees) {
              const refreshed = await employeeService.getEmployees();
              setEmployees(Array.isArray(refreshed) ? refreshed : (refreshed?.data || []));
            }
            toast(`${c.name} hired & saved to Employee Database`);
          } catch (e: any) {
            console.error("Hire auto-create error:", e);
          }
        }
      }
    } catch (err: any) {
      toast(err.message || "Failed to move candidate");
    }
  };

  const deleteReq = async (id: string) => {
    try {
      if (propDeleteRequisition) await propDeleteRequisition(id);
      else await storeDeleteRequisition(id);
      toast("Requisition deleted");
    } catch (err: any) {
      toast(err.message || "Failed to delete requisition");
    }
  };

  const openEvalModal = (candidateId: string, candidateName: string) => {
    const existing = candidates.find((c) => c.id === candidateId)?.evaluation;
    setFormEval(
      existing
        ? {
            technicalSkills: existing.technicalSkills ?? 5,
            communication: existing.communication ?? 5,
            experienceMatch: existing.experienceMatch ?? 5,
            culturalFit: existing.culturalFit ?? 5,
            problemSolving: existing.problemSolving ?? 5,
            leadership: existing.leadership ?? 5,
            overallRecommendation: existing.overallRecommendation ?? "Yes",
            notes: existing.notes ?? "",
          }
        : emptyEvalForm,
    );
    setEvalModal({ candidateId, candidateName });
  };

  const submitEval = async () => {
    if (!evalModal) return;
    setLoadingEval(true);
    try {
      await storeSubmitEvaluation(evalModal.candidateId, {
        ...formEval,
        technicalSkills: Number(formEval.technicalSkills),
        communication: Number(formEval.communication),
        experienceMatch: Number(formEval.experienceMatch),
        culturalFit: Number(formEval.culturalFit),
        problemSolving: Number(formEval.problemSolving),
        leadership: Number(formEval.leadership),
      });
      toast(`Evaluation saved — Score: ${previewScore}%`);
      setEvalModal(null);
    } catch (err: any) {
      toast(err.message || "Failed to save evaluation");
    } finally {
      setLoadingEval(false);
    }
  };

  const filteredDepts = deptList.filter((d) => {
    const name = typeof d === "string" ? d : d.name;
    return name?.toLowerCase().includes(deptSearch.toLowerCase());
  });
  const filteredDesigs = desigList.filter((d) =>
    d.name?.toLowerCase().includes(desigSearch.toLowerCase()),
  );

  const ScoreChip = ({ score }: { score: number | null }) => {
    if (score === null)
      return (
        <span className="text-[10px] font-semibold text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
          — Not Evaluated
        </span>
      );
    const color =
      score >= 80
        ? "text-green-400 bg-green-500/10"
        : score >= 60
          ? "text-amber-400 bg-amber-500/10"
          : "text-red-400 bg-red-500/10";
    return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>{score}%</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Recruitment & Job Pipelines</h1>
          <p className="text-sm text-muted-foreground">
            Manage hiring requests and active pipelines via Kanban boards.
          </p>
        </div>
        <div className="flex gap-2">
          <Btn
            variant="outline"
            onClick={() => {
              setEditingRequisitionId(null);
              setFormReq(emptyReqForm);
              setDeptSearch("");
              setDesigSearch("");
              setDeptOpen(false);
              setDesigOpen(false);
              setReqModal(true);
            }}
          >
            <Plus size={16} /> Raise Requisition
          </Btn>
          <Btn
            onClick={() => {
              const defaultReq = requisitions.find((r) => r.status === "Open") || requisitions[0];
              setFormCand({
                name: "",
                email: "",
                position: defaultReq?.title || "",
                jobId: defaultReq?.id || "",
              });
              setCandModal(true);
            }}
          >
            <UserPlus size={16} /> Add Candidate
          </Btn>
        </div>
      </div>

      {/* Kanban Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"].map((stage) => {
          const list = [...candidates.filter((c) => c.status === stage)].sort(
            (a, b) => (b.score ?? -1) - (a.score ?? -1),
          );
          return (
            <div
              key={stage}
              className="bg-muted/30 border border-border rounded-2xl p-4 min-h-[300px] flex flex-col gap-3"
            >
              <div className="flex justify-between items-center border-b border-border pb-2 mb-1">
                <span className="text-xs font-bold uppercase text-muted-foreground tracking-wide">
                  {stage}
                </span>
                <Badge tone="indigo">{list.length}</Badge>
              </div>
              {list.map((c) => (
                <div
                  key={c.id}
                  className="bg-card border border-border rounded-xl p-3 shadow-sm hover:border-primary transition"
                >
                  <div className="font-bold text-sm">{c.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.position}</div>
                  <div className="mt-2">
                    <ScoreChip score={c.score} />
                  </div>
                  {c.status === "Offer" && (
                    <button
                      onClick={() => handleViewCandidateOffer(c.id, c.name)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition"
                    >
                      <FileText size={12} /> View Offer Letter
                    </button>
                  )}
                  <div className="flex justify-between items-center mt-3 gap-1">
                    <button
                      onClick={() => openEvalModal(c.id, c.name)}
                      className="text-[10px] font-semibold text-primary hover:underline"
                      title={c.evaluation ? "Re-evaluate" : "Evaluate"}
                    >
                      {c.evaluation ? "✏ Re-evaluate" : "+ Evaluate"}
                    </button>
                    <select
                      value={c.status}
                      onChange={(e) => moveCandidate(c.id, e.target.value as any)}
                      className="text-[10px] bg-muted border border-border rounded outline-none p-1 font-semibold"
                    >
                      {["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"].map(
                        (s) => (
                          <option key={s}>{s}</option>
                        ),
                      )}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Active Requisitions */}
      <div className={cardCls + " space-y-4"}>
        <h3 className="font-bold flex items-center gap-2">
          <Briefcase size={18} /> Active Requisitions
        </h3>
        <div className="space-y-2">
          {requisitions.map((r) => (
            <div
              key={r.id}
              className="flex justify-between items-center p-3 bg-muted/40 rounded-xl border border-border text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{r.title}</div>
                <div className="text-xs text-muted-foreground">
                  {r.dept}
                  {r.location ? ` · ${r.location}` : ""} · {r.openings || 1} opening
                  {(r.openings || 1) > 1 ? "s" : ""}
                  {r.minSalary
                    ? ` · ${r.currency || "INR"} ${Number(r.minSalary).toLocaleString()}${r.maxSalary ? `–${Number(r.maxSalary).toLocaleString()}` : ""}`
                    : ""}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-3 shrink-0">
                {r.priority && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.priority === "Critical" ? "bg-red-500/10 text-red-400" : r.priority === "High" ? "bg-orange-500/10 text-orange-400" : r.priority === "Medium" ? "bg-amber-500/10 text-amber-400" : "bg-muted text-muted-foreground"}`}
                  >
                    {r.priority}
                  </span>
                )}
                <Badge tone={r.status === "Open" ? "green" : "amber"}>{r.status}</Badge>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditReq(r)}
                    className="p-1 hover:text-primary transition-colors"
                    title="Edit"
                  >
                    <Pen className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteReq(r.id)}
                    className="p-1 hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Raise Requisition Modal ── */}
      {reqModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-5">
              {editingRequisitionId ? "Edit Job Requisition" : "New Job Requisition"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Row 1 */}
              <Field label="Job Title *" className="md:col-span-2">
                <input
                  value={formReq.title}
                  onChange={(e) => setFormReq((p) => ({ ...p, title: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. Lead Backend Engineer"
                />
              </Field>
              {/* Department — searchable dropdown, independent */}
              <Field label="Department *">
                <div className="relative">
                  <div className="flex items-center gap-1">
                    <input
                      value={deptOpen ? deptSearch : formReq.dept || deptSearch}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDeptSearch(val);
                        const matched = deptList.find(
                          (d) => (typeof d === "string" ? d : d.name)?.toLowerCase() === val.toLowerCase(),
                        );
                        const matchedId = matched ? (typeof matched === "string" ? "" : matched.id || "") : "";
                        setFormReq((p) => ({
                          ...p,
                          dept: val,
                          departmentId: matchedId || "",
                        }));
                        setDeptOpen(true);
                      }}
                      onFocus={() => {
                        setDeptSearch(formReq.dept || "");
                        setDeptOpen(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setDeptOpen(false), 200);
                      }}
                      className={inputCls}
                      placeholder="Type or select department..."
                    />
                    {(formReq.dept || formReq.departmentId) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormReq((p) => ({ ...p, dept: "", departmentId: "" }));
                          setDeptSearch("");
                        }}
                        className="px-2 py-1 text-xs text-muted-foreground hover:text-destructive shrink-0"
                        title="Clear Department"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {deptOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {deptList.length === 0 ? (
                        <div className="px-3 py-2.5 text-xs text-muted-foreground italic">
                          No configured departments found. (Free-text department allowed)
                        </div>
                      ) : filteredDepts.length === 0 ? (
                        <div className="px-3 py-2.5 text-xs text-muted-foreground italic">
                          No matching configured departments. (Free-text allowed)
                        </div>
                      ) : (
                        filteredDepts.map((d, idx) => {
                          const deptName = typeof d === "string" ? d : d.name;
                          const deptId = typeof d === "string" ? "" : d.id || "";
                          return (
                            <button
                              key={deptId || idx}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition flex items-center justify-between"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setFormReq((p) => ({ ...p, departmentId: deptId || "", dept: deptName }));
                                setDeptSearch("");
                                setDeptOpen(false);
                              }}
                            >
                              <span>{deptName}</span>
                              {formReq.departmentId === deptId && (
                                <span className="text-xs text-primary font-bold">✓</span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                {formReq.dept && <p className="text-xs text-primary mt-1">✓ {formReq.dept}</p>}
              </Field>

              {/* Designation — searchable dropdown, independent */}
              <Field label="Designation">
                <div className="relative">
                  {desigLoading ? (
                    <div
                      className={
                        inputCls + " flex items-center gap-2 text-muted-foreground text-xs"
                      }
                    >
                      <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />{" "}
                      Loading designations...
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <input
                          value={
                            desigOpen
                              ? desigSearch
                              : desigList.find((d) => (d.id && d.id === formReq.designationId) || d.name === formReq.designationId)?.name ||
                                formReq.designationId ||
                                desigSearch
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            setDesigSearch(val);
                            const matched = desigList.find((d) => d.name?.toLowerCase() === val.toLowerCase());
                            setFormReq((p) => ({ ...p, designationId: (matched ? matched.id : val) || "" }));
                            setDesigOpen(true);
                          }}
                          onFocus={() => {
                            setDesigSearch(
                              desigList.find((d) => (d.id && d.id === formReq.designationId) || d.name === formReq.designationId)?.name ||
                                formReq.designationId ||
                                "",
                            );
                            setDesigOpen(true);
                          }}
                          onBlur={() => {
                            setTimeout(() => setDesigOpen(false), 200);
                          }}
                          className={inputCls}
                          placeholder="Type or select designation..."
                        />
                        {formReq.designationId && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormReq((p) => ({ ...p, designationId: "" }));
                              setDesigSearch("");
                            }}
                            className="px-2 py-1 text-xs text-muted-foreground hover:text-destructive shrink-0"
                            title="Clear Designation"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {desigOpen && (
                        <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {desigList.length === 0 ? (
                            <div className="px-3 py-2.5 text-xs text-muted-foreground italic">
                              No designations found
                            </div>
                          ) : filteredDesigs.length === 0 ? (
                            <div className="px-3 py-2.5 text-xs text-muted-foreground italic">
                              No matching designations found
                            </div>
                          ) : (
                            filteredDesigs.map((d, idx) => {
                              const desigVal = d.id || "";
                              return (
                                <button
                                  key={desigVal || idx}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition flex items-center justify-between"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setFormReq((p) => ({ ...p, designationId: desigVal || "" }));
                                    setDesigSearch("");
                                    setDesigOpen(false);
                                  }}
                                >
                                  <span>
                                    {d.name}{" "}
                                    {d.band ? (
                                      <span className="text-muted-foreground text-xs">({d.band})</span>
                                    ) : null}
                                  </span>
                                  {formReq.designationId === d.id && (
                                    <span className="text-xs text-primary font-bold">✓</span>
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {formReq.designationId && (
                  <p className="text-xs text-primary mt-1">
                    ✓ {desigList.find((d) => (d.id && d.id === formReq.designationId) || d.name === formReq.designationId)?.name || formReq.designationId}
                  </p>
                )}
              </Field>
              {/* Row 2 */}
              <Field label="Employment Type">
                <select
                  value={formReq.type}
                  onChange={(e) => setFormReq((p) => ({ ...p, type: e.target.value }))}
                  className={inputCls}
                >
                  {["Full-Time", "Part-Time", "Contract", "Internship"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <select
                  value={formReq.priority}
                  onChange={(e) => setFormReq((p) => ({ ...p, priority: e.target.value }))}
                  className={inputCls}
                >
                  {["Low", "Medium", "High", "Critical"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Location">
                <input
                  value={formReq.location}
                  onChange={(e) => setFormReq((p) => ({ ...p, location: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. Remote / Bangalore"
                />
              </Field>
              <Field label="Hiring Manager">
                <input
                  value={formReq.hiringManager}
                  onChange={(e) => setFormReq((p) => ({ ...p, hiringManager: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. Arjun Sharma"
                />
              </Field>
              <Field label="Open Positions">
                <input
                  type="number"
                  min="1"
                  value={formReq.openings}
                  onChange={(e) => setFormReq((p) => ({ ...p, openings: Number(e.target.value) }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Expected Joining Date">
                <input
                  type="date"
                  value={formReq.expectedJoiningDate}
                  onChange={(e) =>
                    setFormReq((p) => ({ ...p, expectedJoiningDate: e.target.value }))
                  }
                  className={inputCls}
                />
              </Field>
              {/* Budget */}
              <Field label="Min Salary">
                <input
                  type="number"
                  min="0"
                  value={formReq.minSalary}
                  onChange={(e) => setFormReq((p) => ({ ...p, minSalary: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. 600000"
                />
              </Field>
              <Field label="Max Salary">
                <input
                  type="number"
                  min="0"
                  value={formReq.maxSalary}
                  onChange={(e) => setFormReq((p) => ({ ...p, maxSalary: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. 1200000"
                />
              </Field>
              <Field label="Currency">
                <select
                  value={formReq.currency}
                  onChange={(e) => setFormReq((p) => ({ ...p, currency: e.target.value }))}
                  className={inputCls}
                >
                  {["INR", "USD", "EUR", "GBP", "AED", "SGD"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Experience Required">
                <input
                  value={formReq.experienceRequired}
                  onChange={(e) =>
                    setFormReq((p) => ({ ...p, experienceRequired: e.target.value }))
                  }
                  className={inputCls}
                  placeholder="e.g. 3-5 years"
                />
              </Field>
              <Field label="Education Required">
                <input
                  value={formReq.educationRequired}
                  onChange={(e) => setFormReq((p) => ({ ...p, educationRequired: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. B.Tech / MBA"
                />
              </Field>
              <Field label="Skills Required (comma-separated)">
                <input
                  value={formReq.skillsRequired}
                  onChange={(e) => setFormReq((p) => ({ ...p, skillsRequired: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. Node.js, PostgreSQL, Docker"
                />
              </Field>
              <Field label="Budget Justification" className="md:col-span-2">
                <textarea
                  value={formReq.budgetJustification}
                  onChange={(e) =>
                    setFormReq((p) => ({ ...p, budgetJustification: e.target.value }))
                  }
                  className={inputCls + " h-16 resize-none"}
                  placeholder="Optional — reasons for this budget range"
                />
              </Field>
              <Field label="Job Description" className="md:col-span-2">
                <textarea
                  value={formReq.jobDescription}
                  onChange={(e) => setFormReq((p) => ({ ...p, jobDescription: e.target.value }))}
                  className={inputCls + " h-24 resize-none"}
                  placeholder="Full job description..."
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Btn variant="outline" onClick={() => setReqModal(false)} disabled={loadingReq}>
                Cancel
              </Btn>
              <Btn onClick={addReq} disabled={loadingReq}>
                {loadingReq && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                <span>
                  {loadingReq
                    ? editingRequisitionId
                      ? "Updating..."
                      : "Submitting..."
                    : editingRequisitionId
                      ? "Save Changes"
                      : "Submit Requisition"}
                </span>
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Candidate Modal ── */}
      {candModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Add Pipeline Candidate</h3>
            <div className="space-y-4">
              <Field label="Candidate Name *">
                <input
                  value={formCand.name}
                  onChange={(e) => setFormCand((p) => ({ ...p, name: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. Rohan Das"
                  disabled={loadingCand}
                />
              </Field>
              <Field label="Contact Email *">
                <input
                  type="email"
                  value={formCand.email}
                  onChange={(e) => setFormCand((p) => ({ ...p, email: e.target.value }))}
                  className={inputCls}
                  placeholder="rohan@gmail.com"
                  disabled={loadingCand}
                />
              </Field>
              <Field label="Position Applied *">
                {requisitions.length === 0 ? (
                  <div className="p-3 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    No active job requisitions found. Please create a requisition before adding candidates.
                  </div>
                ) : (
                  <select
                    value={formCand.jobId || formCand.position}
                    onChange={(e) => {
                      const selectedReq = requisitions.find(
                        (r) => r.id === e.target.value || r.title === e.target.value,
                      );
                      setFormCand((p) => ({
                        ...p,
                        jobId: selectedReq?.id || "",
                        position: selectedReq?.title || e.target.value,
                      }));
                    }}
                    className={inputCls}
                    disabled={loadingCand}
                  >
                    <option value="">Select position...</option>
                    {requisitions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title} ({r.dept})
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Btn variant="outline" onClick={() => setCandModal(false)} disabled={loadingCand}>
                Cancel
              </Btn>
              <Btn
                onClick={addCand}
                disabled={loadingCand || (requisitions.length === 0 && !formCand.position)}
              >
                {loadingCand && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                <span>{loadingCand ? "Adding..." : "Add to Pipeline"}</span>
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Candidate Evaluation Modal ── */}
      {evalModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h3 className="text-lg font-bold">Candidate Evaluation</h3>
                <p className="text-sm text-muted-foreground">{evalModal.candidateName}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-primary">{previewScore}%</div>
                <div className="text-xs text-muted-foreground">Live Score</div>
              </div>
            </div>
            {/* Score sliders */}
            <div className="space-y-4">
              {(
                [
                  { key: "technicalSkills", label: "Technical Skills", weight: "×1.2" },
                  { key: "experienceMatch", label: "Experience Match", weight: "×1.2" },
                  { key: "communication", label: "Communication", weight: "×1.0" },
                  { key: "problemSolving", label: "Problem Solving", weight: "×1.0" },
                  { key: "culturalFit", label: "Cultural Fit", weight: "×0.8" },
                  { key: "leadership", label: "Leadership", weight: "×0.8" },
                ] as const
              ).map(({ key, label, weight }) => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium">
                      {label} <span className="text-xs text-muted-foreground">{weight}</span>
                    </span>
                    <span className="font-bold text-primary">
                      {formEval[key as keyof typeof formEval]}/10
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={formEval[key as keyof typeof formEval] as number}
                    onChange={(e) => setFormEval((p) => ({ ...p, [key]: Number(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0</span>
                    <span>10</span>
                  </div>
                </div>
              ))}
              <Field label="Overall Recommendation">
                <select
                  value={formEval.overallRecommendation}
                  onChange={(e) =>
                    setFormEval((p) => ({ ...p, overallRecommendation: e.target.value }))
                  }
                  className={inputCls}
                >
                  {["Strong Yes", "Yes", "Maybe", "No"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Notes (optional)">
                <textarea
                  value={formEval.notes}
                  onChange={(e) => setFormEval((p) => ({ ...p, notes: e.target.value }))}
                  className={inputCls + " h-20 resize-none"}
                  placeholder="Interview observations, concerns, highlights..."
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Btn variant="outline" onClick={() => setEvalModal(null)} disabled={loadingEval}>
                Cancel
              </Btn>
              <Btn onClick={submitEval} disabled={loadingEval}>
                {loadingEval && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                <span>{loadingEval ? "Saving..." : "Save Evaluation"}</span>
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Offer Configuration & Generation Modal ── */}
      {offerModal && (
        <OfferConfigurationModal
          candidateId={offerModal.candidate.id}
          candidateName={offerModal.candidate.name}
          jobTitle={offerModal.candidate.position}
          candidateScore={offerModal.candidate.score}
          candidates={candidates}
          requisitions={requisitions}
          toast={toast}
          onClose={() => setOfferModal(null)}
          onSuccess={async (res) => {
            const candName = offerModal.candidate.name;
            setOfferModal(null);
            await fetchCandidates();
            if (res?.offer) {
              setViewingOffer({ candidateName: candName, offer: res.offer });
            }
          }}
        />
      )}

      {/* ── Generated Offer Letter Viewer Modal ── */}
      {viewingOffer && (
        <ModalShell
          title={`Offer Letter — ${viewingOffer.candidateName}`}
          onClose={() => setViewingOffer(null)}
          wide
        >
          <div className="space-y-4">
            <div className="bg-muted/30 border border-border rounded-xl p-4 flex justify-between items-center">
              <div>
                <div className="font-bold text-sm">{viewingOffer.candidateName}</div>
                <div className="text-xs text-muted-foreground">
                  Designation: {viewingOffer.offer.designation} · CTC: ₹{Number(viewingOffer.offer.annualCTC).toLocaleString("en-IN")}
                </div>
              </div>
              <div className="flex gap-2">
                <Btn
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const snap = viewingOffer.offer.compensationSnapshot || {};
                    const breakdown = snap.breakdown || [];
                    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Offer Letter - ${viewingOffer.candidateName}</title>
<style>
body{font-family:Georgia,serif;color:#1e293b;padding:48px;line-height:1.6;background:#fff;max-width:800px;margin:0 auto}
.header{display:flex;justify-content:space-between;border-bottom:2px solid #7c3aed;padding-bottom:16px;margin-bottom:24px}
.title{text-align:center;font-size:20px;font-weight:700;color:#7c3aed;text-transform:uppercase;margin:24px 0}
table{width:100%;border-collapse:collapse;margin:20px 0;font-size:13px}
th,td{padding:8px 12px;border:1px solid #e2e8f0;text-align:left}
th{background:#f8fafc}
.total{background:#ede9fe;font-weight:bold}
.sig{margin-top:48px;display:flex;justify-content:space-between}
</style></head><body>
<div class="header"><div><h2>HR NEXA</h2><div>Employment Offer</div></div><div>Date: ${new Date(viewingOffer.offer.createdAt || Date.now()).toLocaleDateString("en-IN")}</div></div>
<div class="title">Letter of Offer</div>
<p>Dear <strong>${viewingOffer.candidateName}</strong>,</p>
<p>We are pleased to offer you the position of <strong>${viewingOffer.offer.designation}</strong> with an Annual CTC of <strong>₹${Number(viewingOffer.offer.annualCTC).toLocaleString("en-IN")}</strong>.</p>
<p>Expected Joining Date: <strong>${viewingOffer.offer.joiningDate}</strong></p>
<table>
<thead><tr><th>Component</th><th style="text-align:right">Monthly (₹)</th><th style="text-align:right">Annual (₹)</th></tr></thead>
<tbody>
${breakdown.filter((b: any) => b.category === "EARNING" || b.category === "BENEFIT").map((b: any) => `<tr><td>${b.name}</td><td style="text-align:right">₹${Number(b.monthly).toLocaleString("en-IN")}</td><td style="text-align:right">₹${Number(b.annual).toLocaleString("en-IN")}</td></tr>`).join("")}
<tr class="total"><td>Total Annual CTC</td><td style="text-align:right">₹${Number(viewingOffer.offer.monthlyCTC).toLocaleString("en-IN")}</td><td style="text-align:right">₹${Number(viewingOffer.offer.annualCTC).toLocaleString("en-IN")}</td></tr>
</tbody>
</table>
<div class="sig"><div><div>Sincerely,</div><div style="margin-top:40px;font-weight:bold">HR Manager</div></div><div><div>Accepted:</div><div style="margin-top:40px;font-weight:bold">${viewingOffer.candidateName}</div></div></div>
<script>window.onload=()=>{window.print()}</script>
</body></html>`;
                    printHTML(html);
                  }}
                >
                  <Download className="h-4 w-4" /> Print / Save PDF
                </Btn>
              </div>
            </div>

            <div className="border border-border rounded-xl p-6 bg-card space-y-4">
              <div className="text-center font-bold text-lg text-primary uppercase tracking-wider">
                Offer Letter Summary
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-muted/40 p-2.5 rounded-lg">
                  <span className="text-muted-foreground block">Status:</span>
                  <strong className="text-green-600 uppercase">{viewingOffer.offer.status}</strong>
                </div>
                <div className="bg-muted/40 p-2.5 rounded-lg">
                  <span className="text-muted-foreground block">Annual CTC:</span>
                  <strong>₹{Number(viewingOffer.offer.annualCTC).toLocaleString("en-IN")}</strong>
                </div>
                <div className="bg-muted/40 p-2.5 rounded-lg">
                  <span className="text-muted-foreground block">Joining Date:</span>
                  <strong>{viewingOffer.offer.joiningDate}</strong>
                </div>
                <div className="bg-muted/40 p-2.5 rounded-lg">
                  <span className="text-muted-foreground block">Document Ref:</span>
                  <strong>{viewingOffer.offer.documentId?.slice(0, 8) || "Archived"}</strong>
                </div>
              </div>
              <div className="text-xs text-muted-foreground text-center pt-2">
                This offer letter is permanently stored in the company's <strong>Offer Letters</strong> document repository.
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
