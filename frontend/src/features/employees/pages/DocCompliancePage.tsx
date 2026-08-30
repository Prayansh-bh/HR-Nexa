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
  useDocumentsQuery,
  useDeleteDocumentMutation,
  useUploadDocumentMutation,
  downloadDocumentFile,
} from "../../../hooks/useDocumentsQuery";
import { useToast } from "../../../hooks";
import { ModalShell, PaginationControls } from "../../../components/ui";
import { useUIStore } from "../../../store";

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

export function DocCompliancePage() {
  const { push: toast } = useToast();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input (300ms) and reset page to 1 on query change
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    documents: docs = [],
    total = 0,
    totalPages = 1,
    isLoading,
  } = useDocumentsQuery({
    category: "COMPLIANCE",
    search: debouncedSearch || undefined,
    page,
    limit: pageSize,
  });

  const { mutateAsync: uploadDocument } = useUploadDocumentMutation();
  const { mutateAsync: deleteDocument } = useDeleteDocumentMutation();

  // Auto-recover if page exceeds totalPages
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState("Compliance Handbook");
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const upload = async () => {
    if (!title.trim()) {
      toast("Please enter a document title", "error");
      return;
    }
    if (!fileObj) {
      toast("Please select a file to upload", "error");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", fileObj);
      formData.append("category", "COMPLIANCE");
      formData.append("docType", docType);
      formData.append("title", title.trim());
      if (expiryDate) formData.append("expiryDate", expiryDate);

      await uploadDocument(formData);
      toast("Compliance document uploaded successfully", "success");
      setOpen(false);
      setDocType("Compliance Handbook");
      setFileObj(null);
      setTitle("");
      setExpiryDate("");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to upload compliance document";
      toast(msg, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    useUIStore.getState().setConfirmState({
      open: true,
      title: "Delete Compliance Document",
      message: "Are you sure you want to delete this compliance document? This action cannot be undone.",
      confirmText: "Delete Document",
      cancelText: "Cancel",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await deleteDocument(id);
          toast("Compliance document deleted successfully", "success");
        } catch (err: any) {
          const msg = err?.response?.data?.message || err?.message || "Failed to delete document";
          toast(msg, "error");
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Document & Regulatory Compliance</h1>
          <p className="text-sm text-muted-foreground">
            Central directory of corporate licenses, filings, POSH regulations, and agreements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search compliance docs..."
              className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition shadow-sm"
            />
          </div>
          <Btn onClick={() => setOpen(true)} className="shrink-0">
            <Upload className="h-4 w-4" /> Upload Document
          </Btn>
        </div>
      </div>

      <div className={cardCls + " !p-0 overflow-hidden"}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <th className="px-6 py-4">Document Title</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Filing / Expiry Date</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d: any) => (
              <tr
                key={d.id}
                className="border-b border-border/60 hover:bg-muted/40 font-mono text-xs"
              >
                <td className="px-6 py-4 font-sans font-bold text-sm text-foreground">
                  {d.title || d.fileName}
                </td>
                <td className="px-6 py-4 font-sans text-muted-foreground">{d.docType}</td>
                <td className="px-6 py-4">{d.expiryDate ? d.expiryDate.slice(0, 10) : "N/A"}</td>
                <td className="px-6 py-4">
                  <Badge
                    tone={
                      d.status === "VALID" ? "green" : d.status === "EXPIRED" ? "rose" : "amber"
                    }
                  >
                    {d.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await downloadDocumentFile(d.id, d.fileName);
                        } catch (err) {
                          console.error("Download failed:", err);
                        }
                      }}
                    >
                      <Download size={14} />
                    </Btn>
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(d.id)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </td>
              </tr>
            )}
            {!isLoading && docs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                  {debouncedSearch
                    ? `No compliance documents found matching "${debouncedSearch}".`
                    : "No compliance documents uploaded yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <PaginationControls
        page={page}
        limit={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        isLoading={isLoading}
      />

      {open && (
        <ModalShell title="Upload Compliance Document" onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <Field label="Document Title *">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
                placeholder="e.g. POSH Handbook 2026"
              />
            </Field>
            <Field label="Category/Type">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className={inputCls}
              >
                {[
                  "Compliance Handbook",
                  "Legal Agreement",
                  "ISO Certificate",
                  "Statutory Filing",
                  "Other",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Expiry Date (Optional)">
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Select File *">
              <input
                type="file"
                onChange={(e) => setFileObj(e.target.files?.[0] || null)}
                className={
                  inputCls +
                  " file:mr-4 file:rounded-full file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20 cursor-pointer"
                }
              />
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpen(false)} disabled={isUploading}>
              Cancel
            </Btn>
            <Btn onClick={upload} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Upload Document
                </>
              )}
            </Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
