import React, { useState } from "react";
import {
  Upload,
  XCircle,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { parseExcelFile } from "../../../utils/excelExporter";
import {
  normalizeAndValidateBulkRows,
  BulkNormalizationResult,
  CanonicalEmployeePayload,
  NormalizedPreviewRow,
} from "../utils/bulkOnboardingNormalizer";
import {
  employeeService,
  BulkCreateResponseDto,
} from "../../../services/employee.service";
import { useEmployeesStore } from "../../../store/employeesStore";
import { employeeSyncService } from "../../../services/employee-sync.service";

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

export type ImportState = "idle" | "importing" | "reconciled" | "error";

export function BulkOnboardingWizard({
  onClose,
  onSave,
  toast,
}: {
  onClose: () => void;
  onSave?: (res: BulkCreateResponseDto) => void;
  toast: (m: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [normResult, setNormResult] = useState<BulkNormalizationResult | null>(null);
  const [importStatus, setImportStatus] = useState<ImportState>("idle");
  const [backendResult, setBackendResult] = useState<BulkCreateResponseDto | null>(null);
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);

  const existingEmployees = useEmployeesStore((state) => state.employees);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;
    setFile(uploaded);
    setImportStatus("idle");
    setBackendResult(null);
    setApiErrorMessage(null);

    try {
      const rawData = await parseExcelFile(uploaded);
      const result = normalizeAndValidateBulkRows(rawData);
      setNormResult(result);

      if (result.totalRows === 0) {
        toast("The uploaded file is empty or contains no valid rows.");
      } else if (result.invalidCount > 0) {
        toast(
          `Parsed ${result.totalRows} records: ${result.validCount} valid, ${result.invalidCount} with validation errors.`,
        );
      } else {
        toast(`Successfully parsed and validated all ${result.validCount} employee records.`);
      }
    } catch {
      toast("Failed to parse file. Please ensure it is a valid .csv or .xlsx file.");
    }
  };

  const handleImport = async () => {
    if (!normResult || normResult.validEmployees.length === 0) {
      toast("No valid employee records to import. Please resolve the errors in your spreadsheet.");
      return;
    }

    if (importStatus === "importing") return;

    setImportStatus("importing");
    setApiErrorMessage(null);

    // Prepare canonical payload (preserves explicit CSV ID if supplied; server generates ID if omitted)
    const payloadEmployees: CanonicalEmployeePayload[] = normResult.validEmployees.map(
      (emp) => ({
        ...emp,
        id: emp.id || undefined,
      }),
    );

    try {
      const response = await employeeService.bulkCreateEmployees(payloadEmployees);
      setBackendResult(response);
      setImportStatus("reconciled");

      if (onSave) {
        onSave(response);
      }

      // Revalidate employee store if any employees were created
      if (response.successful > 0) {
        await useEmployeesStore.getState().fetchEmployees();
        employeeSyncService.notifyEmployeeChange();
      }

      // Truthful toast notifications
      if (response.failed === 0 && response.successful === response.total) {
        toast(`All ${response.successful} employees imported successfully!`);
      } else if (response.successful > 0) {
        toast(`Import finished: ${response.successful} created, ${response.failed} failed.`);
      } else {
        toast(`Import failed: 0 of ${response.total} records could be created.`);
      }
    } catch (err: any) {
      setImportStatus("error");
      const msg =
        err?.message ||
        "An unexpected error occurred while communicating with the server.";
      setApiErrorMessage(msg);
      toast(msg);
    }
  };

  const handleReset = () => {
    setFile(null);
    setNormResult(null);
    setImportStatus("idle");
    setBackendResult(null);
    setApiErrorMessage(null);
  };

  // Build error lookup map for reconciliation view
  const backendErrorMap = new Map<number, string>();
  if (backendResult && backendResult.errors) {
    backendResult.errors.forEach((err) => {
      backendErrorMap.set(err.index, err.reason);
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-4xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-border pb-3 mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <UserPlus className="text-primary" /> Bulk Onboarding
          </h3>
          <button
            onClick={onClose}
            disabled={importStatus === "importing"}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto space-y-5">
          {/* Upload Dropzone (visible in idle/error states) */}
          {importStatus !== "reconciled" && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Upload Spreadsheet</h4>
              <p className="text-xs text-muted-foreground">
                Upload a <code className="bg-muted px-1 py-0.5 rounded">.csv</code> or{" "}
                <code className="bg-muted px-1 py-0.5 rounded">.xlsx</code> file. Required columns:{" "}
                <strong>Name, Email, Department, Designation, Salary, Joined (YYYY-MM-DD)</strong>. Optional:{" "}
                <strong>Phone, Address, Status (Active/On Leave/Inactive), ID</strong>.
              </p>
              <div className="mt-3 border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center bg-muted/20 relative transition hover:bg-muted/40">
                <Upload className="h-9 w-9 text-muted-foreground mb-3" />
                <div className="text-sm font-semibold">Click or drag spreadsheet to upload</div>
                <div className="text-xs text-muted-foreground mt-1">.csv, .xlsx supported (case-insensitive headers)</div>
                <input
                  type="file"
                  accept=".csv, .xlsx"
                  disabled={importStatus === "importing"}
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
              {file && (
                <div className="text-xs font-medium text-primary flex items-center gap-1.5 mt-2">
                  <FileSpreadsheet size={14} /> Selected file: {file.name}
                </div>
              )}
            </div>
          )}

          {/* HTTP/API Error Banner */}
          {importStatus === "error" && apiErrorMessage && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-xs space-y-1.5 text-destructive">
              <div className="font-semibold flex items-center gap-2 text-sm">
                <ShieldAlert size={16} /> Server / Request Error
              </div>
              <p className="text-muted-foreground">{apiErrorMessage}</p>
            </div>
          )}

          {/* Reconciliation Result Banner (after POST /api/employees/bulk) */}
          {importStatus === "reconciled" && backendResult && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className="text-xs text-muted-foreground">Total Submitted</div>
                  <div className="text-2xl font-bold mt-1">{backendResult.total}</div>
                </div>
                <div className="rounded-xl border border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/10 p-4 text-center">
                  <div className="text-xs font-medium text-[color:var(--color-success)]">Successfully Created</div>
                  <div className="text-2xl font-bold text-[color:var(--color-success)] mt-1">{backendResult.successful}</div>
                </div>
                <div className={`rounded-xl border p-4 text-center ${backendResult.failed > 0 ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border bg-card"}`}>
                  <div className={`text-xs font-medium ${backendResult.failed > 0 ? "text-destructive" : "text-muted-foreground"}`}>Failed Rows</div>
                  <div className={`text-2xl font-bold mt-1 ${backendResult.failed > 0 ? "text-destructive" : "text-muted-foreground"}`}>{backendResult.failed}</div>
                </div>
              </div>

              {backendResult.failed > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs space-y-1.5 text-destructive">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle size={14} /> Backend Row Rejections
                  </div>
                  <div className="max-h-28 overflow-auto space-y-1 text-muted-foreground">
                    {backendResult.errors.map((err, idx) => (
                      <div key={idx} className="text-xs">
                        <strong className="text-foreground">Row {err.row} ({err.email || err.name || "Employee"}):</strong>{" "}
                        <span className="text-destructive font-medium">{err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview & Reconciliation Table */}
          {normResult && normResult.totalRows > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">
                  {importStatus === "reconciled" ? "Import Outcome by Row" : `Parsed Preview (${normResult.totalRows} Total Records)`}
                </h4>
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-[color:var(--color-success)] font-medium">
                    <CheckCircle2 size={13} /> {normResult.validCount} Valid
                  </span>
                  {normResult.invalidCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-destructive font-medium">
                      <AlertCircle size={13} /> {normResult.invalidCount} Invalid
                    </span>
                  )}
                </div>
              </div>

              {/* Client-side validation summary before submission */}
              {importStatus !== "reconciled" && normResult.invalidCount > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs space-y-1 text-destructive">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle size={14} /> Client Validation Errors (Skipped from submission)
                  </div>
                  <div className="max-h-20 overflow-auto space-y-0.5 text-muted-foreground">
                    {normResult.errorSummary.slice(0, 5).map((err, idx) => (
                      <div key={idx} className="text-xs">
                        <strong className="text-foreground">Row {err.rowNumber}:</strong> {err.errors.join(", ")}
                      </div>
                    ))}
                    {normResult.errorSummary.length > 5 && (
                      <div className="text-xs italic">...and {normResult.errorSummary.length - 5} more rows with errors</div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border overflow-hidden">
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-muted sticky top-0 font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Department</th>
                        <th className="px-3 py-2">Designation</th>
                        <th className="px-3 py-2">Monthly Salary</th>
                        <th className="px-3 py-2">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {normResult.previewRows.map((row: NormalizedPreviewRow, i: number) => {
                        // Determine row outcome in reconciled state
                        let statusNode = (
                          <span className="inline-flex items-center gap-1 text-[color:var(--color-success)] font-medium">
                            <CheckCircle2 size={12} /> Valid
                          </span>
                        );

                        if (!row.isValid) {
                          statusNode = (
                            <span className="inline-flex items-center gap-1 text-destructive font-medium" title={row.errors.join("; ")}>
                              <AlertCircle size={12} /> {row.errors[0]}
                            </span>
                          );
                        } else if (importStatus === "reconciled" && backendResult) {
                          // Find array index in validEmployees
                          const validIdx = normResult.validEmployees.findIndex(
                            (v) => v.email === row.email,
                          );
                          const backendReason = backendErrorMap.get(validIdx);
                          if (backendReason) {
                            statusNode = (
                              <span className="inline-flex items-center gap-1 text-destructive font-medium" title={backendReason}>
                                <AlertCircle size={12} /> Failed: {backendReason}
                              </span>
                            );
                          } else {
                            statusNode = (
                              <span className="inline-flex items-center gap-1 text-[color:var(--color-success)] font-medium">
                                <CheckCircle2 size={12} /> Created
                              </span>
                            );
                          }
                        }

                        return (
                          <tr key={i} className={row.isValid ? "hover:bg-muted/30" : "bg-destructive/5 hover:bg-destructive/10"}>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{row.rowNumber}</td>
                            <td className="px-3 py-2">{statusNode}</td>
                            <td className="px-3 py-2 font-medium">{row.name || <span className="text-muted-foreground italic">(missing)</span>}</td>
                            <td className="px-3 py-2">{row.email || <span className="text-muted-foreground italic">(missing)</span>}</td>
                            <td className="px-3 py-2">{row.department || <span className="text-muted-foreground italic">(missing)</span>}</td>
                            <td className="px-3 py-2">{row.designation || <span className="text-muted-foreground italic">(missing)</span>}</td>
                            <td className="px-3 py-2">{row.salary !== undefined ? `₹${row.salary.toLocaleString()}` : <span className="text-muted-foreground italic">(missing)</span>}</td>
                            <td className="px-3 py-2 font-mono">{row.joined || <span className="text-muted-foreground italic">(missing)</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between mt-5 border-t border-border pt-4">
          {importStatus === "reconciled" ? (
            <>
              <Btn variant="outline" onClick={handleReset}>
                <RefreshCw size={15} /> Upload Another File
              </Btn>
              <Btn variant="primary" onClick={onClose}>
                Done & View Directory <ArrowRight size={15} />
              </Btn>
            </>
          ) : (
            <>
              <Btn variant="outline" onClick={onClose} disabled={importStatus === "importing"}>
                Cancel
              </Btn>
              <Btn
                onClick={handleImport}
                disabled={!normResult || normResult.validEmployees.length === 0 || importStatus === "importing"}
              >
                {importStatus === "importing" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Importing Employees...
                  </>
                ) : (
                  <>
                    <Upload size={16} /> Import {normResult?.validCount ? `${normResult.validCount} Valid ` : ""}Employees
                  </>
                )}
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
