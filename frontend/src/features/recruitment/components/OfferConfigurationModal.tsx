import { useState, useEffect } from "react";
import { Loader2, FileText, UserCheck, Users } from "lucide-react";
import { Btn, Field, inputCls, SearchablePaginatedSelect, SelectOption } from "../../../components/ui";
import { recruitmentService } from "../../../services/recruitment.service";
import { documentService } from "../../../services/document.service";
import { employeeService } from "../../../services/employee.service";
import { useAuthStore } from "../../../store/authStore";
import { hasPermission, PERMISSIONS } from "../../../auth";
import type { Candidate, JobRequisition } from "../../../store";
import type { Employee } from "../../../types";
import { PaginatedResponse } from "../../../types/pagination";

const queryEmployeesForOffer = async (
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

export interface OfferConfigurationModalProps {
  candidateId?: string;
  candidateName?: string;
  jobTitle?: string;
  candidateScore?: number | null;
  candidates?: Candidate[];
  requisitions?: JobRequisition[];
  toast: (msg: string) => void;
  onClose: () => void;
  onSuccess: (result?: any) => void;
}

export function OfferConfigurationModal({
  candidateId: initialCandidateId,
  candidateName: initialCandidateName,
  jobTitle: initialJobTitle,
  candidateScore: initialScore,
  candidates: providedCandidates,
  requisitions: providedRequisitions = [],
  toast,
  onClose,
  onSuccess,
}: OfferConfigurationModalProps) {
  const user = useAuthStore((s) => s.user);
  const canViewCandidates = hasPermission(user, PERMISSIONS.RECRUITMENT_CANDIDATES_VIEW);

  // Mode selection for Documents: Candidate vs Employee (defaults to employee on plans without recruitment)
  const [recipientType, setRecipientType] = useState<"candidate" | "employee">(
    !initialCandidateId && !canViewCandidates ? "employee" : "candidate"
  );

  // Candidates list state
  const [candidateList, setCandidateList] = useState<Candidate[]>(providedCandidates || []);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(initialCandidateId || "");

  // Employees selection state (SearchablePaginatedSelect)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedEmployeeOption, setSelectedEmployeeOption] = useState<SelectOption | null>(null);

  // Modal form state
  const [formOffer, setFormOffer] = useState({
    annualCTC: "800000",
    designation: initialJobTitle || "Software Engineer",
    joiningDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    terms: "Standard probation period of 3 months applies. Governed by company policies.",
  });

  const [compensationPreview, setCompensationPreview] = useState<any | null>(null);
  const [loadingOfferPreview, setLoadingOfferPreview] = useState(false);
  const [generatingOffer, setGeneratingOffer] = useState(false);

  // Load Candidates when in Mode B & recipientType === 'candidate' & user has permission
  useEffect(() => {
    if (!initialCandidateId && recipientType === "candidate" && candidateList.length === 0 && canViewCandidates) {
      setLoadingCandidates(true);
      recruitmentService
        .getCandidates()
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setCandidateList(list);
          if (list.length > 0) {
            setSelectedCandidateId(list[0].id);
          }
        })
        .catch((err) => console.error("Failed to load candidates:", err))
        .finally(() => setLoadingCandidates(false));
    }
  }, [initialCandidateId, recipientType, candidateList.length, canViewCandidates]);

  // Active recipient reference
  const activeCandidate = initialCandidateId
    ? { id: initialCandidateId, name: initialCandidateName || "Candidate", position: initialJobTitle || "", score: initialScore }
    : candidateList.find((c) => c.id === selectedCandidateId) || candidateList[0];

  // Auto-populate when active candidate changes
  useEffect(() => {
    if (!initialCandidateId && recipientType === "candidate" && activeCandidate) {
      const job = providedRequisitions.find((r) => r.title === activeCandidate.position) || null;
      const defaultCTC = job?.minSalary ? String(job.minSalary) : "800000";
      setFormOffer((p) => ({
        ...p,
        annualCTC: defaultCTC,
        designation: activeCandidate.position || job?.title || "Software Engineer",
      }));
      setCompensationPreview(null);
    }
  }, [selectedCandidateId, initialCandidateId, recipientType]);

  const handleEmployeeSelect = async (empId: string, opt?: SelectOption) => {
    setSelectedEmployeeId(empId);
    setSelectedEmployeeOption(opt || null);
    setCompensationPreview(null);
    if (empId) {
      try {
        const emp = await employeeService.getEmployee(empId);
        if (emp) {
          const defaultCTC = emp.salary ? String(emp.salary * 12) : "800000";
          setFormOffer((p) => ({
            ...p,
            annualCTC: defaultCTC,
            designation: emp.designation || "Employee",
          }));
        }
      } catch {
        // use fallback designation
      }
    }
  };

  const activeJob = activeCandidate
    ? providedRequisitions.find((r) => r.title === activeCandidate.position) || null
    : null;

  const targetId = recipientType === "candidate" ? activeCandidate?.id : selectedEmployeeId;
  const targetName = recipientType === "candidate" ? activeCandidate?.name : selectedEmployeeOption?.label || "Employee";

  const handlePreviewCompensation = async () => {
    if (!targetId) {
      toast("Please select a recipient first");
      return;
    }
    const ctc = Number(formOffer.annualCTC);
    if (!ctc || ctc <= 0) {
      toast("Please enter a valid Annual CTC");
      return;
    }
    setLoadingOfferPreview(true);
    try {
      let preview;
      if (initialCandidateId || recipientType === "candidate") {
        // Candidate Flow (Recruitment Service API)
        preview = await recruitmentService.previewOffer(targetId, {
          annualCTC: ctc,
          designation: formOffer.designation,
          joiningDate: formOffer.joiningDate,
          expiryDate: formOffer.expiryDate,
        });
      } else {
        // Active Employee Flow (Documents Service API)
        preview = await documentService.previewEmployeeOffer({
          employeeId: targetId,
          annualCTC: ctc,
          designation: formOffer.designation,
          joiningDate: formOffer.joiningDate,
          expiryDate: formOffer.expiryDate,
        });
      }
      setCompensationPreview(preview);
      toast("Compensation breakdown calculated successfully");
    } catch (err: any) {
      toast(err.message || "Failed to calculate compensation breakdown");
    } finally {
      setLoadingOfferPreview(false);
    }
  };

  const handleGenerateOffer = async () => {
    if (!targetId) {
      toast("Please select a recipient first");
      return;
    }
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
      let result;
      if (initialCandidateId || recipientType === "candidate") {
        // Candidate Flow (Recruitment Service API)
        result = await recruitmentService.generateOffer(targetId, {
          annualCTC: ctc,
          designation: formOffer.designation,
          joiningDate: formOffer.joiningDate,
          expiryDate: formOffer.expiryDate,
          terms: formOffer.terms,
        });
      } else {
        // Employee Flow (Documents Service API)
        result = await documentService.generateEmployeeOffer({
          employeeId: targetId,
          annualCTC: ctc,
          designation: formOffer.designation,
          joiningDate: formOffer.joiningDate,
          expiryDate: formOffer.expiryDate,
          terms: formOffer.terms,
        });
      }

      toast(`Offer letter generated for ${targetName} & saved to Offer Letters`);
      onSuccess(result);
    } catch (err: any) {
      toast(err.message || "Failed to generate offer letter");
    } finally {
      setGeneratingOffer(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4 border-b border-border pb-3">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <FileText className="text-primary h-5 w-5" /> Issue & Generate Offer Letter
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure compensation and generate a formal offer letter
              {targetName ? (
                <> for <strong className="text-foreground">{targetName}</strong>.</>
              ) : (
                "."
              )}
            </p>
          </div>
          {recipientType === "candidate" && activeCandidate?.score !== undefined && activeCandidate?.score !== null && (
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Evaluation Score:</span>
              <div className="text-sm font-bold text-primary">{activeCandidate.score}%</div>
            </div>
          )}
        </div>

        {/* Recipient Type Toggle & Selection (Mode B: Shown if candidateId was not preselected) */}
        {!initialCandidateId && (
          <div className="mb-4 bg-primary/5 border border-primary/20 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Select Recipient Category *
              </span>
              <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-1">
                {canViewCandidates && (
                  <button
                    type="button"
                    onClick={() => setRecipientType("candidate")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${
                      recipientType === "candidate"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <UserCheck className="h-3.5 w-3.5" /> Candidate (Pre-Hire)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setRecipientType("employee")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${
                    recipientType === "employee"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" /> Active Employee
                </button>
              </div>
            </div>

            {recipientType === "candidate" ? (
              <Field label="Select Candidate *">
                {loadingCandidates ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading candidates...
                  </div>
                ) : candidateList.length === 0 ? (
                  <div className="text-xs text-destructive py-1">
                    No active candidates found in pipeline. Switch to Active Employee or add candidate first.
                  </div>
                ) : (
                  <select
                    value={selectedCandidateId}
                    onChange={(e) => setSelectedCandidateId(e.target.value)}
                    className={inputCls}
                    disabled={generatingOffer || loadingOfferPreview}
                  >
                    {candidateList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.position || "Candidate"} ({c.status || (c as any).stage || "Pipeline"})
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            ) : (
              <Field label="Select Active Employee *">
                <SearchablePaginatedSelect
                  value={selectedEmployeeId}
                  placeholder="Search and select active employee..."
                  searchPlaceholder="Search employees by name, designation..."
                  emptyText="No matching active employees found."
                  queryFn={queryEmployeesForOffer}
                  initialSelectedOption={selectedEmployeeOption || undefined}
                  disabled={generatingOffer || loadingOfferPreview}
                  onChange={handleEmployeeSelect}
                />
              </Field>
            )}
          </div>
        )}

        {/* Requisition Budget Guidance */}
        {recipientType === "candidate" && activeJob && (
          <div className="bg-muted/40 border border-border rounded-xl p-3 mb-4 text-xs flex justify-between items-center">
            <div>
              <span className="text-muted-foreground">Requisition:</span>{" "}
              <strong>{activeJob.title}</strong> ({activeJob.dept})
            </div>
            <div>
              <span className="text-muted-foreground">Budget Range:</span>{" "}
              <strong className="text-primary">
                {activeJob.minSalary ? `₹${Number(activeJob.minSalary).toLocaleString("en-IN")}` : "₹0"}
                {activeJob.maxSalary ? ` – ₹${Number(activeJob.maxSalary).toLocaleString("en-IN")}` : ""}
              </strong>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Annual CTC (INR) *">
              <input
                type="number"
                value={formOffer.annualCTC}
                onChange={(e) => setFormOffer((p) => ({ ...p, annualCTC: e.target.value }))}
                className={inputCls}
                placeholder="e.g. 800000"
                disabled={generatingOffer || loadingOfferPreview}
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                {Number(formOffer.annualCTC) > 0
                  ? `≈ ₹${Math.round(Number(formOffer.annualCTC) / 12).toLocaleString("en-IN")} / month`
                  : "Enter agreed annual CTC"}
              </span>
            </Field>
            <Field label="Designation *">
              <input
                type="text"
                value={formOffer.designation}
                onChange={(e) => setFormOffer((p) => ({ ...p, designation: e.target.value }))}
                className={inputCls}
                placeholder="e.g. Senior Software Engineer"
                disabled={generatingOffer || loadingOfferPreview}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Expected Joining Date *">
              <input
                type="date"
                value={formOffer.joiningDate}
                onChange={(e) => setFormOffer((p) => ({ ...p, joiningDate: e.target.value }))}
                className={inputCls}
                disabled={generatingOffer || loadingOfferPreview}
              />
            </Field>
            <Field label="Offer Expiry Date (optional)">
              <input
                type="date"
                value={formOffer.expiryDate}
                onChange={(e) => setFormOffer((p) => ({ ...p, expiryDate: e.target.value }))}
                className={inputCls}
                disabled={generatingOffer || loadingOfferPreview}
              />
            </Field>
          </div>

          <Field label="Terms & Conditions / Probation">
            <textarea
              value={formOffer.terms}
              onChange={(e) => setFormOffer((p) => ({ ...p, terms: e.target.value }))}
              className={inputCls + " h-16 resize-none"}
              placeholder="Probation details, background check requirements, etc."
              disabled={generatingOffer || loadingOfferPreview}
            />
          </Field>

          {/* Preview Button */}
          <div className="flex justify-end">
            <Btn
              variant="outline"
              size="sm"
              onClick={handlePreviewCompensation}
              disabled={loadingOfferPreview || generatingOffer || !targetId}
            >
              {loadingOfferPreview && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{loadingOfferPreview ? "Calculating..." : "Preview Compensation Breakdown"}</span>
            </Btn>
          </div>

          {/* Compensation Breakdown Table */}
          {compensationPreview && (
            <div className="border border-primary/20 bg-primary/5 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Compensation Breakdown Preview
                </span>
                <span className="text-xs text-muted-foreground">
                  Monthly CTC: <strong>₹{compensationPreview.monthlyCTC?.toLocaleString("en-IN")}</strong>
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 font-semibold border-b border-border">
                    <tr>
                      <th className="p-2">Component</th>
                      <th className="p-2 text-right">Monthly (₹)</th>
                      <th className="p-2 text-right">Annual (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {compensationPreview.breakdown
                      ?.filter((b: any) => b.category === "EARNING" || b.category === "BENEFIT")
                      .map((b: any, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="p-2 font-medium">{b.name}</td>
                          <td className="p-2 text-right">₹{b.monthly?.toLocaleString("en-IN")}</td>
                          <td className="p-2 text-right">₹{b.annual?.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    <tr className="bg-primary/10 font-bold text-primary">
                      <td className="p-2">Total Annual Cost to Company (CTC)</td>
                      <td className="p-2 text-right">₹{compensationPreview.monthlyCTC?.toLocaleString("en-IN")}</td>
                      <td className="p-2 text-right">₹{compensationPreview.annualCTC?.toLocaleString("en-IN")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6 border-t border-border pt-4">
          <Btn variant="outline" onClick={onClose} disabled={generatingOffer}>
            Cancel
          </Btn>
          <Btn onClick={handleGenerateOffer} disabled={generatingOffer || !targetId}>
            {generatingOffer && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{generatingOffer ? "Generating Offer..." : "Generate & Save Offer Letter"}</span>
          </Btn>
        </div>
      </div>
    </div>
  );
}
