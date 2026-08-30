import { useState, useEffect, useRef } from "react";
import { hasPermission, isSuperAdmin, PERMISSIONS } from "../../../auth";
import { Plus, FileText, Eye, Download, Upload, FolderOpen, Printer, Trash2, Search } from "lucide-react";
import {
  PageHeader,
  Card,
  Btn,
  Badge,
  Field,
  ModalShell,
  inputCls,
  PaginationControls,
  SearchablePaginatedSelect,
  SelectOption,
} from "../../../components/ui";
import type { DocRecord, Employee } from "../../../types";
import { PaginatedResponse } from "../../../types/pagination";
import { printHTML } from "../../../lib/pdf-export";
import {
  useDocumentsQuery,
  useDeleteDocumentMutation,
  useUploadDocumentMutation,
  downloadDocumentFile,
  fetchDocumentContent,
} from "../../../hooks/useDocumentsQuery";
import { employeeService } from "../../../services/employee.service";
import { OfferConfigurationModal } from "../../recruitment/components/OfferConfigurationModal";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useUIStore } from "../../../store";
import { getCompanyInitials } from "../../../utils/tenantBranding.utils";

const queryEmployeesForSelect = async (
  search: string,
  page: number,
  limit: number,
): Promise<PaginatedResponse<SelectOption>> => {
  const res = await employeeService.getEmployees({
    search: search.trim() || undefined,
    page,
    limit,
  });

  const options: SelectOption[] = (res.data || []).map((emp) => ({
    value: emp.id,
    label: emp.name,
    sublabel: `${emp.designation || "Employee"} • ${emp.department || "General"}`,
  }));

  return {
    data: options,
    total: res.total,
    page: res.page,
    limit: res.limit,
    totalPages: res.totalPages,
  };
};

export function DocumentsPage(p: {
  sub: string;
  onViewDoc: (d: DocRecord) => void;
  toast: any;
  user: any;
  company: string;
}) {
  const { sub, onViewDoc, toast, user, company } = p;
  const queryClient = useQueryClient();

  const titleMap: Record<string, { title: string; type: DocRecord["type"] }> = {
    "documents.offer": { title: "Offer Letters", type: "Offer" },
    "documents.appointment": { title: "Appointment Letters", type: "Appointment" },
    "documents.experience": { title: "Experience Letters", type: "Experience" },
  };

  const current = titleMap[sub] || titleMap["documents.offer"];
  const { title, type } = current;

  // Pagination & Search state
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

  // Reset page to 1 and search on tab change
  useEffect(() => {
    setPage(1);
    setSearch("");
    setDebouncedSearch("");
  }, [sub]);

  // Modal states
  const [open, setOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [selectedEmpOption, setSelectedEmpOption] = useState<SelectOption | null>(null);

  const {
    documents: list = [],
    total = 0,
    totalPages = 1,
    isLoading,
  } = useDocumentsQuery({
    category: "HR_LETTER",
    docType: type,
    search: debouncedSearch || undefined,
    page,
    limit: pageSize,
  });

  const { mutateAsync: deleteDocument } = useDeleteDocumentMutation();
  const { mutateAsync: uploadDocument } = useUploadDocumentMutation();

  // Auto-recover if page exceeds totalPages
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  if (sub === "documents.employee")
    return (
      <EmployeeDocsPage
        canEdit={hasPermission(user, PERMISSIONS.EMPLOYEES_PROFILE_DOCS_UPLOAD) || isSuperAdmin(user)}
        scopeToSelf={user.role === "Employee"}
        userName={user.name}
        user={user}
        toast={toast}
        deleteDocument={deleteDocument}
        uploadDocument={uploadDocument}
      />
    );

  const [viewingDoc, setViewingDoc] = useState<any | null>(null);

  const handleViewDoc = (d: any) => {
    setViewingDoc(d);
    if (onViewDoc) onViewDoc(d);
  };

  const generate = async () => {
    if (!selectedEmpId) {
      toast("Please select an employee.", "error");
      return;
    }

    let empName = selectedEmpOption?.label || "Employee";
    let designation = "Employee";
    let salary = 0;

    try {
      const fullEmp = await employeeService.getEmployee(selectedEmpId);
      if (fullEmp) {
        empName = fullEmp.name;
        designation = fullEmp.designation || "Employee";
        salary = fullEmp.salary || 0;
      }
    } catch {
      // Use option info if single fetch fails
    }

    const issuedDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const fileName = `${type.toLowerCase()}_letter_${empName.replace(/\s+/g, "_").toLowerCase()}.html`;

    const docRecord: any = {
      id: `${type.toUpperCase()}-${selectedEmpId}-${Date.now()}`,
      employee: empName,
      type: type as "Offer" | "Appointment" | "Experience",
      issued: issuedDate,
      salary,
      designation,
    };

    const effectiveCompany = company || user?.companyName || user?.company || "Company";
    const body = letterBodyFor(docRecord, effectiveCompany).replace(/\n/g, "<br/>");
    const escapeHtml = (unsafe: string) => unsafe.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m] || m));
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${type} Letter - ${empName}</title>
<style>
body{font-family:Georgia,serif;color:#1f2937;margin:0;padding:60px;background:#fff;max-width:800px;line-height:1.7}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #7c3aed;padding-bottom:24px;margin-bottom:32px}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:48px;height:48px;background:linear-gradient(135deg,#7c3aed,#c026d3);border-radius:12px;display:grid;place-items:center;color:#fff;font-weight:800;font-family:sans-serif}
.logo-text h2{margin:0;font-size:18px;font-weight:800;color:#1e1b4b}
.logo-text p{margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em}
.title-block{text-align:right}
.title-block h1{margin:0;font-size:24px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:0.05em}
.title-block p{margin:4px 0 0;font-size:12px;color:#6b7280}
.recipient{margin-bottom:24px;font-size:14px;line-height:1.6}
.recipient strong{color:#111827}
.content{margin-bottom:32px;font-size:14px;color:#374151}
.content p{margin-bottom:16px}
.highlight-box{background:#f5f3ff;border-left:4px solid #7c3aed;padding:16px;margin:20px 0;border-radius:0 8px 8px 0}
.highlight-box table{width:100%;border-collapse:collapse}
.highlight-box td{padding:6px 0;font-size:13px}
.highlight-box td:first-child{color:#6b7280;width:40%}
.highlight-box td:last-child{font-weight:600;color:#1e1b4b}
.signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px;padding-top:24px;border-top:1px solid #e5e7eb}
.sig-block{font-size:12px;color:#6b7280}
.sig-line{border-bottom:1px solid #9ca3af;height:40px;margin-bottom:8px}
.footer{margin-top:48px;padding-top:16px;border-top:1px solid #f3f4f6;text-align:center;font-size:11px;color:#9ca3af}
</style>
</head>
<body>
<div class="header">
  <div class="brand">
    <div class="logo">${escapeHtml(getCompanyInitials(effectiveCompany))}</div>
    <div class="logo-text">
      <h2>${escapeHtml(effectiveCompany)}</h2>
      <p>Human Resource Management</p>
    </div>
  </div>
  <div class="title-block">
    <h1>${type} Letter</h1>
    <p>Ref: ${escapeHtml(docRecord.id)}</p>
  </div>
</div>
<div class="recipient">
  <p>Date: <strong>${issuedDate}</strong></p>
  <p>To,<br/><strong>${escapeHtml(empName)}</strong><br/>${escapeHtml(designation)}</p>
</div>
<div class="content">
  ${body}
</div>
<div class="signatures">
  <div class="sig-block">
    <div class="sig-line"></div>
    <p><strong>Authorized Signatory</strong><br/>${escapeHtml(effectiveCompany)}</p>
  </div>
  <div class="sig-block">
    <div class="sig-line"></div>
    <p><strong>Employee Acceptance</strong><br/>${escapeHtml(empName)}</p>
  </div>
</div>
<div class="footer">
  <p>This is a computer-generated document and carries official validity within ${escapeHtml(effectiveCompany)}.</p>
</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const file = new File([blob], fileName, { type: "text/html" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("employeeId", selectedEmpId);
    formData.append("category", "HR_LETTER");
    formData.append("docType", type);
    formData.append("title", `${type} Letter - ${empName}`);

    await uploadDocument(formData);
    toast(`${type} letter generated for ${empName}`);
    setOpen(false);
    setSelectedEmpId("");
    setSelectedEmpOption(null);
  };

  const handleDelete = (id: string) => {
    useUIStore.getState().setConfirmState({
      open: true,
      title: `Delete ${type} Letter`,
      message: `Are you sure you want to delete this ${type.toLowerCase()} letter? This action cannot be undone.`,
      confirmText: "Delete Letter",
      cancelText: "Cancel",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await deleteDocument(id);
          toast(`${type} letter deleted successfully`);
        } catch (err: any) {
          toast(err?.message || "Failed to delete document", "error");
        }
      },
    });
  };

  const canEdit = hasPermission(user, PERMISSIONS.EMPLOYEES_PROFILE_DOCS_UPLOAD) || isSuperAdmin(user);

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle={type === "Offer" ? "Generate and manage candidate offer letters." : "Generate and manage employee documents."}
        action={
          canEdit && (
            <Btn onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> {type === "Offer" ? "Generate Offer" : "Generate"}
            </Btn>
          )
        }
      />

      {/* Professional Search & Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border/80 rounded-2xl p-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            className="w-full h-10 rounded-xl border border-input/80 bg-background pl-10 pr-9 text-sm text-foreground placeholder:text-muted-foreground/70 transition-all focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15 shadow-2xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground text-xs p-1 rounded-md hover:bg-muted transition"
              title="Clear search"
              type="button"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-between sm:justify-end px-1 sm:px-0">
          <span className="font-semibold text-foreground/80">
            {total} {total === 1 ? "document" : "documents"}
          </span>
          {debouncedSearch && (
            <span className="text-[11px] bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full border border-primary/20">
              Filtered
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map((d: any) => (
          <Card key={d.id} className="relative">
            {canEdit && (
              <button
                onClick={() => handleDelete(d.id)}
                title={`Delete ${type}`}
                className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl btn-gradient">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">
                  {d.employee?.name || d.title || d.fileName}
                </div>
                <div className="text-xs text-muted-foreground">
                  Issued {d.uploadedAt?.slice(0, 10)}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Btn variant="outline" size="sm" onClick={() => handleViewDoc(d)}>
                <Eye className="h-4 w-4" /> View
              </Btn>
              <Btn
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await downloadDocumentFile(d.id, d.fileName || `${type.toLowerCase()}_letter.html`);
                  } catch {
                    // fallback
                  }
                }}
              >
                <Download className="h-4 w-4" /> Download
              </Btn>
            </div>
          </Card>
        ))}
        {isLoading && (
          <div className="md:col-span-2 lg:col-span-3 flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && list.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3 text-center py-12 text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
            <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-1">
              <Search className="h-5 w-5" />
            </div>
            <p className="font-medium text-foreground">
              {debouncedSearch
                ? `No ${type.toLowerCase()} letters found matching "${debouncedSearch}"`
                : `No ${type.toLowerCase()} letters yet`}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm">
              {debouncedSearch
                ? "Try adjusting your search query or clear the filter."
                : "Generate official letters for your employees or candidates using the button above."}
            </p>
            {debouncedSearch && (
              <Btn variant="outline" size="sm" onClick={() => setSearch("")} className="mt-2">
                Clear Search
              </Btn>
            )}
          </Card>
        )}
      </div>

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

      {viewingDoc && (
        <DocumentViewerModal
          doc={viewingDoc}
          company={viewingDoc?.company?.name || company || user?.companyName || user?.company || "Company"}
          onClose={() => setViewingDoc(null)}
        />
      )}

      {open && type === "Offer" && (
        <OfferConfigurationModal
          toast={toast}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: ["documents"] });
          }}
        />
      )}

      {open && type !== "Offer" && (
        <ModalShell title={`Generate ${type} Letter`} onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <Field label="Select Employee *">
              <SearchablePaginatedSelect
                value={selectedEmpId}
                placeholder="Search and select employee..."
                searchPlaceholder="Search employees by name, designation..."
                emptyText="No matching employees found."
                queryFn={queryEmployeesForSelect}
                initialSelectedOption={selectedEmpOption || undefined}
                onChange={(val, opt) => {
                  setSelectedEmpId(val);
                  setSelectedEmpOption(opt || null);
                }}
              />
            </Field>
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              This will create a merged letter using the employee's designation, salary, and join
              date.
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
            <Btn onClick={generate} disabled={!selectedEmpId}>
              Generate
            </Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function EmployeeDocsPage({
  canEdit,
  scopeToSelf,
  userName,
  user,
  toast,
  deleteDocument,
  uploadDocument,
}: {
  canEdit: boolean;
  scopeToSelf: boolean;
  userName: string;
  user?: any;
  toast: (m: string, tone?: "success" | "error" | "info") => void;
  deleteDocument: (id: string) => Promise<any>;
  uploadDocument: (fd: FormData) => Promise<any>;
}) {
  const [open, setOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [selectedEmpOption, setSelectedEmpOption] = useState<SelectOption | null>(null);
  const [docType, setDocType] = useState("Aadhaar Card");
  const [fileName, setFileName] = useState("");
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Pagination & Search state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    documents: visibleDocs = [],
    total = 0,
    totalPages = 1,
    isLoading,
  } = useDocumentsQuery({
    category: "EMPLOYEE",
    search: debouncedSearch || undefined,
    page,
    limit: pageSize,
  });

  // Auto-recover if page exceeds totalPages
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileObj(file);
    }
  };

  const upload = async () => {
    if (!fileObj) {
      toast("Please select a file to upload.", "error");
      return;
    }
    if (!docType.trim()) {
      toast("Please select a document type.", "error");
      return;
    }

    let targetEmpId = selectedEmpId;
    if (!targetEmpId) {
      if (scopeToSelf) {
        targetEmpId = user?.employee?.id || "";
      }
    }

    if (!targetEmpId) {
      toast("No employee selected or found.", "error");
      return;
    }

    const targetEmpName = selectedEmpOption?.label || userName || "employee";

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", fileObj);
      formData.append("employeeId", targetEmpId);
      formData.append("category", "EMPLOYEE");
      formData.append("docType", docType);
      if (fileName.trim()) {
        formData.append("title", fileName.trim());
      }

      await uploadDocument(formData);
      toast(`Document uploaded successfully for ${targetEmpName}`);
      setOpen(false);
      setDocType("Aadhaar Card");
      setFileName("");
      setFileObj(null);
      setSelectedEmpId("");
      setSelectedEmpOption(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to upload document";
      toast(msg, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    useUIStore.getState().setConfirmState({
      open: true,
      title: "Delete Document",
      message: "Are you sure you want to delete this document? This action cannot be undone.",
      confirmText: "Delete Document",
      cancelText: "Cancel",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await deleteDocument(id);
          toast("Document deleted successfully");
        } catch (err: any) {
          const msg = err?.response?.data?.message || err?.message || "Failed to delete document";
          toast(msg, "error");
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={scopeToSelf ? "My Documents" : "Employee Documents"}
        subtitle={
          scopeToSelf
            ? "Your personal documents stored securely."
            : "All employee personal documents."
        }
        action={
          canEdit && (
            <Btn onClick={() => setOpen(true)}>
              <Upload className="h-4 w-4" /> Upload Document
            </Btn>
          )
        }
      />

      <Card className="!p-0 overflow-hidden shadow-xs border border-border/80 rounded-2xl">
        {/* Professional Search & Filter Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/80 bg-muted/20 p-3.5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee documents..."
              className="w-full h-10 rounded-xl border border-input/80 bg-background pl-10 pr-9 text-sm text-foreground placeholder:text-muted-foreground/70 transition-all focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15 shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground text-xs p-1 rounded-md hover:bg-muted transition"
                title="Clear search"
                type="button"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-between sm:justify-end px-1 sm:px-0">
            <span className="font-semibold text-foreground/80">
              {total} {total === 1 ? "document" : "documents"}
            </span>
            {debouncedSearch && (
              <span className="text-[11px] bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full border border-primary/20">
                Filtered
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                {!scopeToSelf && <th className="px-4 py-3">Employee</th>}
                <th className="px-4 py-3">Document Type</th>
                <th className="px-4 py-3">File Name</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocs.map((d) => (
                <tr key={d.id} className="border-b border-border/60">
                  {!scopeToSelf && <td className="px-4 py-3 font-semibold">{d.employee?.name}</td>}
                  <td className="px-4 py-3">
                    <Badge tone="indigo">{d.docType}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{d.fileName}</td>
                  <td className="px-4 py-3">{d.uploadedAt?.slice(0, 10)}</td>
                  <td className="px-4 py-3">{d.size}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={async () => {
                          try {
                            toast("Downloading document...");
                            await downloadDocumentFile(d.id, d.fileName);
                          } catch (err) {
                            console.error("Download failed:", err);
                            toast("Failed to download document.");
                          }
                        }}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              )}
              {!isLoading && visibleDocs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">
                    {debouncedSearch
                      ? `No documents found matching "${debouncedSearch}".`
                      : "No documents uploaded yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
        <ModalShell title="Upload Document" onClose={() => setOpen(false)}>
          <div className="space-y-4">
            {!scopeToSelf && (
              <Field label="Select Employee *">
                <SearchablePaginatedSelect
                  value={selectedEmpId}
                  placeholder="Search and select employee..."
                  searchPlaceholder="Search employees by name, designation..."
                  emptyText="No matching employees found."
                  queryFn={queryEmployeesForSelect}
                  initialSelectedOption={selectedEmpOption || undefined}
                  onChange={(val, opt) => {
                    setSelectedEmpId(val);
                    setSelectedEmpOption(opt || null);
                  }}
                />
              </Field>
            )}
            <Field label="Document Type">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className={inputCls}
              >
                {[
                  "Aadhaar Card",
                  "PAN Card",
                  "Passport",
                  "Degree Certificate",
                  "Experience Certificate",
                  "Bank Passbook",
                  "Offer Letter Copy",
                  "Other",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="File Name (optional)">
              <input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className={inputCls}
                placeholder="e.g. aadhaar_john.pdf"
              />
            </Field>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground">Select File</span>
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 bg-muted/20 relative">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <FolderOpen className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm font-semibold text-primary">Choose File to Upload</span>
                <span className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG up to 10MB</span>
                {fileObj && (
                  <div className="mt-4 p-2 bg-card rounded border border-border text-xs w-full max-w-[280px] text-center truncate">
                    <span className="font-semibold">{fileObj.name}</span> (
                    {Math.round(fileObj.size / 1024)} KB)
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpen(false)} disabled={isUploading}>
              Cancel
            </Btn>
            <Btn onClick={upload} disabled={isUploading || (!scopeToSelf && !selectedEmpId)}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Upload
                </>
              )}
            </Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function getNormalizedDocDetails(doc: any) {
  const docType = doc.type || doc.docType || "Document";
  const empName =
    typeof doc.employee === "object"
      ? doc.employee?.name || doc.title || "Employee"
      : doc.employee || doc.title || "Employee";
  const designation =
    typeof doc.employee === "object"
      ? (typeof doc.employee?.designation === "object"
          ? doc.employee?.designation?.name
          : doc.employee?.designation) ||
        doc.designation ||
        "Employee"
      : doc.designation || "Employee";
  const salaryVal =
    typeof doc.employee === "object" ? doc.employee?.salary || doc.salary || 0 : doc.salary || 0;
  const salary = typeof salaryVal === "number" ? salaryVal : parseFloat(salaryVal) || 0;
  const issued =
    doc.issued ||
    (doc.uploadedAt
      ? String(doc.uploadedAt).slice(0, 10)
      : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }));

  return { docType, empName, designation, salary, issued };
}

function letterBodyFor(doc: any, fallbackCompany: string): string {
  const { docType, empName, designation, salary, issued } = getNormalizedDocDetails(doc);
  const company = doc?.company?.name || fallbackCompany || "Company";
  const annualSalary = salary * 12;

  if (docType === "Offer") {
    return `Dear ${empName},\n\nWe are pleased to offer you the position of <b>${designation}</b> at ${company}. Based on our discussions and your qualifications, we believe you will be a valuable addition to our team.\n\n<b>Compensation:</b> Your annual gross salary will be <b>₹${annualSalary.toLocaleString("en-IN")}</b> (₹${salary.toLocaleString("en-IN")} per month), payable monthly, subject to statutory deductions.\n\n<b>Reporting date:</b> ${issued}. Please confirm your acceptance by countersigning this offer.\n\nWe look forward to welcoming you.`;
  }
  if (docType === "Appointment") {
    return `Dear ${empName},\n\nFurther to your acceptance of our offer, we are delighted to formally appoint you as <b>${designation}</b> at ${company}, effective <b>${issued}</b>.\n\nYour total annual compensation of <b>₹${annualSalary.toLocaleString("en-IN")}</b> (₹${salary.toLocaleString("en-IN")} per month) will be governed by the company's HR policies. This appointment is subject to satisfactory completion of the probation period and applicable statutory verifications.\n\nWelcome aboard.`;
  }
  return `To Whom It May Concern,\n\nThis is to certify that <b>${empName}</b> was employed with ${company} as <b>${designation}</b>. During the tenure, ${empName.split(" ")[0]} demonstrated professionalism, integrity, and strong contribution to the team.\n\nWe wish ${empName.split(" ")[0]} every success in future endeavors.\n\nIssued on: ${issued}`;
}

function generateDocumentPDF(doc: any, company: string) {
  const { docType, empName, issued } = getNormalizedDocDetails(doc);
  const body = letterBodyFor(doc, company).replace(/\n/g, "<br/>");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${docType} - ${empName}</title>
<style>
body{font-family:Georgia,serif;color:#1f2937;margin:0;padding:60px;background:#fff;max-width:800px;line-height:1.7}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #7c3aed;padding-bottom:24px;margin-bottom:32px}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:48px;height:48px;background:linear-gradient(135deg,#7c3aed,#c026d3);border-radius:12px;display:grid;place-items:center;color:#fff;font-weight:800;font-family:sans-serif}
h2{margin:0;font-size:22px;font-family:sans-serif}
.meta{font-size:12px;color:#6b7280;font-family:sans-serif}
.title{text-align:center;text-transform:uppercase;letter-spacing:.15em;color:#7c3aed;font-weight:800;font-family:sans-serif;margin:30px 0}
.body{font-size:15px}
.sig{margin-top:60px}
.footer{margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;font-family:sans-serif}
</style></head><body>
<div class="header"><div class="brand"><div class="logo">HR</div><div><h2>${company}</h2><div class="meta">HR Department</div></div></div>
<div style="text-align:right"><div class="meta">Ref: ${doc.id}</div><div class="meta">Date: ${issued}</div></div></div>
<div class="title">${docType} Letter</div>
<div class="body">${body}</div>
<div class="sig">
  <div>Sincerely,</div>
  <div style="margin-top:40px;font-weight:700">HR Manager</div>
  <div class="meta">${company}</div>
</div>
<div class="footer">This is a system-generated document.</div>
<script>window.onload = () => { window.print(); }</script>
</body></html>`;
  printHTML(html);
}

export function DocumentViewerModal({
  doc,
  company,
  onClose,
}: {
  doc: any;
  company: string;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const docType = doc.docType || doc.type || "Document";
  const isOffer = docType === "Offer";

  // Clean candidate / employee title for modal header
  let rawEmpName = typeof doc.employee === "object" ? doc.employee?.name : doc.employee;
  if (!rawEmpName && doc.title) {
    rawEmpName = doc.title.replace(/^Offer Letter\s*[-–—]\s*/i, "").trim();
  }
  const displayName = rawEmpName || doc.title || "Document";

  useEffect(() => {
    let active = true;
    if (isOffer && doc.id) {
      setLoading(true);
      setError(null);
      fetchDocumentContent(doc.id)
        .then((data) => {
          if (active) {
            setContent(typeof data === "string" ? data : JSON.stringify(data));
            setLoading(false);
          }
        })
        .catch((err) => {
          if (active) {
            console.error("Failed to load document content:", err);
            setError(err?.message || "Failed to load offer document content");
            setLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [doc.id, isOffer]);

  const handlePrint = () => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      }
    } catch (e) {
      console.warn("Direct iframe print unavailable or blocked, falling back to printHTML:", e);
    }
    if (content) {
      printHTML(content);
    } else {
      generateDocumentPDF(doc, company);
    }
  };

  return (
    <ModalShell title={`${docType} Letter — ${displayName}`} onClose={onClose} wide>
      <div className="rounded-xl border border-border bg-[color:var(--color-surface-muted)] p-4 max-h-[65vh] overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              Loading official offer letter...
            </span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-destructive">
            <p className="font-semibold">Unable to load offer letter</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        ) : content ? (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden min-h-[500px]">
            <iframe
              ref={iframeRef}
              title={`Offer Letter - ${displayName}`}
              srcDoc={content}
              className="w-full h-[550px] border-0 rounded-lg bg-white"
              sandbox="allow-same-origin allow-scripts allow-modals"
            />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto bg-card rounded-lg p-8 shadow-sm">
            <div className="flex items-center justify-between border-b-2 border-primary pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg btn-gradient font-bold">
                  HR
                </div>
                <div>
                  <div className="font-bold">{company}</div>
                  <div className="text-xs text-muted-foreground">HR Department</div>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>Ref: {doc.id}</div>
                <div>Date: {getNormalizedDocDetails(doc).issued}</div>
              </div>
            </div>
            <div className="text-center uppercase tracking-widest text-primary font-bold my-6">
              {docType} Letter
            </div>
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ fontFamily: "Georgia, serif" }}
              dangerouslySetInnerHTML={{ __html: letterBodyFor(doc, company).replace(/\n/g, "<br/>") }}
            />
            <div className="mt-10">
              <div>Sincerely,</div>
              <div className="mt-8 font-bold">HR Manager</div>
              <div className="text-xs text-muted-foreground">{company}</div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Btn variant="outline" onClick={onClose}>
          Close
        </Btn>
        <Btn onClick={handlePrint} disabled={loading || Boolean(error)}>
          <Printer className="h-4 w-4" /> Print / Save PDF
        </Btn>
      </div>
    </ModalShell>
  );
}
