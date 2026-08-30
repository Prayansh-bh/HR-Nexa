import React, { useState, useEffect } from "react";
import {
  FileCheck,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  FileText,
  User,
  Shield,
} from "lucide-react";
import {
  usePendingDocumentsQuery,
  useVerifyDocumentMutation,
  useRejectDocumentMutation,
  downloadDocumentFile,
} from "../../../hooks/useDocumentsQuery";
import { ModalShell, PaginationControls } from "../../../components/ui";
import { useLocalStorage } from "../../../hooks";
import { hasPermission, PERMISSIONS } from "../../../auth";
import type { AuthUser } from "../../../types";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";

export function ViewerDocumentCheckPage({ toast }: { toast?: (m: string) => void }) {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [rejectDoc, setRejectDoc] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Debounce search input (300ms) and reset page to 1 on query change
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    documents: queue = [],
    total = 0,
    totalPages = 1,
    isLoading,
    isError,
    error,
    refetch,
  } = usePendingDocumentsQuery({
    search: debouncedSearch,
    page,
    limit: pageSize,
  });

  const verifyMutation = useVerifyDocumentMutation();
  const rejectMutation = useRejectDocumentMutation();

  const isAuthorizedToAudit = hasPermission(user, PERMISSIONS.DOCUMENTS_VERIFY);

  // Auto-recover if page exceeds totalPages
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleDownload = async (doc: any) => {
    setDownloadingId(doc.id);
    try {
      await downloadDocumentFile(doc.id, doc.fileName || `${doc.title || "document"}.pdf`);
      if (toast) {
        toast(`Downloading file "${doc.fileName || doc.title}"...`);
      }
    } catch (err: any) {
      console.error("Download error", err);
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        "Physical file is not available on storage server.";
      if (toast) {
        toast(`Download failed: ${errMsg}`);
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleVerify = async (doc: any) => {
    try {
      await verifyMutation.mutateAsync({ id: doc.id });
      if (toast) {
        toast(`Document "${doc.title || doc.fileName}" verified successfully.`);
      }
    } catch (err: any) {
      console.error("Verification failed", err);
    }
  };

  const handleOpenRejectModal = (doc: any) => {
    setRejectDoc(doc);
    setRejectReason("");
    setRejectError(null);
  };

  const handleConfirmReject = async () => {
    if (!rejectReason || rejectReason.trim().length < 5) {
      setRejectError("A valid rejection reason (minimum 5 characters) is required.");
      return;
    }

    try {
      await rejectMutation.mutateAsync({ id: rejectDoc.id, reason: rejectReason.trim() });
      if (toast) {
        toast(`Document "${rejectDoc.title || rejectDoc.fileName}" has been rejected.`);
      }
      setRejectDoc(null);
      setRejectReason("");
    } catch (err: any) {
      setRejectError(err?.response?.data?.message || "Failed to reject document.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-primary" />
            Document Verification Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Audit employee identity proof documents (PAN, Aadhaar, Passport, degree certificates).
          </p>
        </div>

        {/* Live Search */}
        <div className="relative min-w-[280px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee or document..."
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition shadow-sm"
          />
        </div>
      </div>

      {/* Role Notice */}
      {!isAuthorizedToAudit && (
        <div className="flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs text-sky-700 dark:text-sky-300 font-medium">
          <Shield className="h-4 w-4 shrink-0 text-sky-500" />
          <span>
            You are viewing this queue in Read-Only mode ({user?.role || "Viewer"}). Document verification actions are restricted to HR Admin and Company Owner roles.
          </span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={cardCls + " animate-pulse flex justify-between items-center"}>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted/60 rounded w-1/4" />
              </div>
              <div className="h-8 bg-muted rounded w-24" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className={cardCls + " border-destructive/30 bg-destructive/5 text-center py-8 space-y-2"}>
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <div className="font-bold text-destructive text-sm">Failed to load verification queue</div>
          <div className="text-xs text-muted-foreground">
            {(error as any)?.response?.data?.message || "An unexpected network error occurred."}
          </div>
          <button
            onClick={() => refetch()}
            className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {/* Verification Items List */}
      {!isLoading && !isError && (
        <div className="space-y-3">
          {queue.map((doc: any) => {
            const employeeName = doc.employee?.name || "Unknown Employee";
            const employeeEmail = doc.employee?.email || "";
            const isDownloading = downloadingId === doc.id;
            const isProcessing =
              (verifyMutation.isPending && verifyMutation.variables?.id === doc.id) ||
              (rejectMutation.isPending && rejectMutation.variables?.id === doc.id);

            return (
              <div key={doc.id} className={cardCls + " flex flex-col md:flex-row md:items-center justify-between gap-4"}>
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-base text-foreground truncate">
                      {doc.title || doc.docType || "Employee Identity Document"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <Clock className="w-3 h-3" /> Pending Audit
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1 font-medium text-foreground/80">
                      <User className="w-3.5 h-3.5 text-primary" /> {employeeName}
                      {employeeEmail ? ` (${employeeEmail})` : ""}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> File: {doc.fileName}
                    </span>
                    {doc.size && (
                      <>
                        <span>•</span>
                        <span>Size: {doc.size}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isDownloading}
                    onClick={() => handleDownload(doc)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition shadow-sm"
                    title="Download/Preview Document"
                  >
                    {isDownloading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-primary" />
                    )}
                    Download
                  </button>

                  {isAuthorizedToAudit && (
                    <>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleOpenRejectModal(doc)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold shadow-sm hover:brightness-110 disabled:opacity-50 transition"
                      >
                        {rejectMutation.isPending && rejectMutation.variables?.id === doc.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        Reject
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleVerify(doc)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-sm hover:brightness-110 disabled:opacity-50 transition"
                      >
                        {verifyMutation.isPending && verifyMutation.variables?.id === doc.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Verify
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty Queue Placeholder */}
          {queue.length === 0 && (
            <div className={cardCls + " text-center py-12 text-muted-foreground space-y-2"}>
              <FileCheck className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <div className="font-semibold text-sm">
                {debouncedSearch ? `No pending documents found matching "${debouncedSearch}"` : "Queue is clear"}
              </div>
              <div className="text-xs">
                {debouncedSearch
                  ? "Try searching with a different term like employee name or document type."
                  : "No employee identity document validations are currently pending."}
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="pt-2">
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
          </div>
        </div>
      )}

      {/* Mandatory Rejection Reason Modal */}
      {rejectDoc && (
        <ModalShell title={`Reject Document — ${rejectDoc.title || rejectDoc.fileName}`} onClose={() => setRejectDoc(null)}>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Please state the mandatory reason for rejecting this document (e.g. illegible copy, expired document, wrong name).
            </p>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Rejection Reason (minimum 5 characters) <span className="text-destructive">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter mandatory rejection reason..."
                rows={3}
                className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:border-primary focus:outline-none transition"
              />
              {rejectError && <div className="text-xs text-destructive mt-1 font-medium">{rejectError}</div>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectDoc(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending}
                onClick={handleConfirmReject}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:brightness-110 disabled:opacity-50 transition"
              >
                {rejectMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
