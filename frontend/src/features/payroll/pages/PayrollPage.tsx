import { useState, useMemo, useEffect } from "react";
import { getBusinessDateString } from "../../../utils/date.utils";
import { hasPermission, isSuperAdmin, PERMISSIONS } from "../../../auth";
import {
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  LockKeyhole,
  Check,
  Info,
  Plus,
  Trash2,
  Eye,
  Edit3,
  Download,
  FileText,
  PieChart,
  Search,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import {
  PageHeader,
  Card,
  Btn,
  Badge,
  Avatar,
  Field,
  Row,
  ReadOnlyBanner,
  ModalShell,
  inputCls,
  dateInputProps,
} from "../../../components/ui";
import type { Employee, Holiday, BadgeTone } from "../../../types";
import { printHTML } from "../../../lib/pdf-export";
import { downloadCSV } from "../../../lib/csv-export";
import { escapeHtml } from "../../../utils/htmlEscape";
import { maskAccountNumber } from "../../../utils/maskAccountNumber";
import { resolvePayslipCompanyName, getCompanyInitials } from "../../../utils/tenantBranding.utils";
import { useEmployeesQuery } from "../../../hooks/useEmployeesQuery";
import { useAttendanceQuery } from "../../../hooks/useAttendanceQuery";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePayrollQuery,
  usePayrollInputsQuery,
  usePayrollInputsMutations,
  PAYROLL_QUERY_KEYS,
} from "../../../hooks/usePayrollQuery";
import { usePayrollStore } from "../../../store";
import { payrollService } from "../../../services/payroll.service";

export function PayrollPage(p: {
  sub?: string;
  mode?: "generate" | "process" | "structure" | "slips" | "history" | "reports" | string;
  user: any;
  toast: any;
  triggerConfirm: any;
}) {
  const { sub, mode, toast, user, triggerConfirm } = p;
  const resolvedMode = mode || sub || "payroll.generate";
  const isGenerateMode = resolvedMode === "generate" || resolvedMode === "payroll.generate";
  const isProcessMode = resolvedMode === "process" || resolvedMode === "payroll.process";

  const { data: employeesData, employees: employeesProp } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data) ? (employeesData as any).data : (Array.isArray(employeesProp) ? employeesProp : [])));
  const { data: salarySlipsData, slips: salarySlipsProp } = usePayrollQuery();
  const salarySlips =
    Array.isArray(salarySlipsProp) && salarySlipsProp.length > 0
      ? salarySlipsProp
      : Array.isArray(salarySlipsData)
      ? salarySlipsData
      : salarySlipsData && Array.isArray((salarySlipsData as any).data)
      ? (salarySlipsData as any).data
      : Array.isArray(salarySlipsProp)
      ? salarySlipsProp
      : [];

  const salaryComponents = usePayrollStore((s) => s.salaryComponents);
  const setSalaryComponents = usePayrollStore((s) => s.setSalaryComponents);
  const setSalarySlips = usePayrollStore((s) => s.setSalarySlips);
  const payrollHistory = usePayrollStore((s) => s.payrollHistory);
  const setPayrollHistory = usePayrollStore((s) => s.setPayrollHistory);

  const canGenerate = hasPermission(user, PERMISSIONS.PAYROLL_PROCESS_GENERATE) || isSuperAdmin(user);
  const canProcess = hasPermission(user, PERMISSIONS.PAYROLL_PROCESS_RUN) || isSuperAdmin(user);
  const canEdit = isGenerateMode ? canGenerate : (isProcessMode ? canProcess : false);
  const canEditStructure = hasPermission(user, PERMISSIONS.EMPLOYEES_SALARY_EDIT) || hasPermission(user, PERMISSIONS.EMPLOYEES_SALARY_VIEW) || hasPermission(user, PERMISSIONS.PAYROLL_PROCESS_RUN) || isSuperAdmin(user);
  const scopeToTeam = user.role === "Manager";
  const scopeToSelf = user.role === "Employee";
  const visibleEmployees = scopeToTeam
    ? employees.filter((e) => e.department === user.department)
    : scopeToSelf
      ? employees.filter((e) =>
          Boolean(
            (user.id && (e.userId === user.id || (e as any).user?.id === user.id)) ||
            (user.employeeId && e.id === user.employeeId) ||
            (user.email && e.email?.toLowerCase() === user.email?.toLowerCase()) ||
            (user.name && e.name === user.name)
          )
        )
      : employees;

  if (resolvedMode === "payroll.structure" || resolvedMode === "structure")
    return (
      <SalaryStructure
        canEdit={canEditStructure}
        toast={toast}
        salaryComponents={salaryComponents}
        setSalaryComponents={setSalaryComponents}
        triggerConfirm={triggerConfirm}
      />
    );
  if (resolvedMode === "payroll.slips" || resolvedMode === "slips")
    return (
      <SalarySlips
        employees={visibleEmployees}
        isSelf={!!scopeToSelf}
        isTeam={!!scopeToTeam}
        salarySlips={salarySlips}
        setSalarySlips={setSalarySlips}
        salaryComponents={salaryComponents}
        canGenerate={canEdit}
        toast={toast}
      />
    );
  if (resolvedMode === "payroll.history" || resolvedMode === "history")
    return (
      <PayrollHistory
        isSelf={!!scopeToSelf}
        payrollHistory={payrollHistory}
        visibleEmployees={visibleEmployees}
        salarySlips={salarySlips}
        toast={toast}
        canProcess={canProcess}
      />
    );
  if (resolvedMode === "payroll.reports" || resolvedMode === "reports")
    return <PayrollReportsPage employees={employees} salarySlips={salarySlips} toast={toast} />;

  const currentDate = new Date();
  const currentMonthLabel = currentDate.toLocaleString("en-IN", { month: "long", year: "numeric" });
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const lastDayStr = getBusinessDateString(lastDayOfMonth);

  const [month, setMonth] = useState(currentMonthLabel);
  const [payDate, setPayDate] = useState(lastDayStr);
  const [step, setStep] = useState(1);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [processed, setProcessed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await payrollService.calculatePayroll({
          month,
        });
        if (active) {
          setPreviewData(data);
          const allWarnings = data.flatMap((item: any) => item.warnings || []);
          setWarnings(allWarnings);
        }
      } catch (err: any) {
        toast(err.message || "Failed to fetch preview calculations", "error");
      } finally {
        if (active) setLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [month]);

  const previewMap = useMemo(() => {
    const map = new Map<string, any>();
    (previewData || []).forEach((item: any) => {
      if (item && item.employeeId) {
        map.set(item.employeeId, item);
      }
    });
    return map;
  }, [previewData]);

  const getPreviewForEmployee = (empId: string) => {
    return (
      previewMap.get(empId) || {
        fixedBaseSalary: 0,
        basicSalary: 0,
        gross: 0,
        deductions: 0,
        net: 0,
        lopDays: 0,
        lopDeductAmount: 0,
        lopDeductDays: 0,
        components: [],
      }
    );
  };

  const total = previewData.reduce((s, item) => s + (item.gross || 0), 0);
  const totalDeductions = previewData.reduce((s, item) => s + (item.deductions || 0), 0);
  const totalNet = previewData.reduce((s, item) => s + (item.net || 0), 0);

  const handleValidate = () => {
    setStep(2);
  };

  const handleExecute = async () => {
    if (processed) return;
    setLoading(true);
    try {
      if (isGenerateMode) {
        await payrollService.generatePayroll({
          month,
          payDate,
        });
        setProcessed(true);
        setStep(3);
        toast(`Draft Payroll Generated for ${month} - ${visibleEmployees.length} employees. Ready for Accountant review.`);
      } else {
        await payrollService.processPayroll({
          month,
          payDate,
        });
        await usePayrollStore.getState().fetchPayroll(month);
        setPayrollHistory((prev) => {
          const exists = prev.find((h: any) => h.month === month);
          if (exists)
            return prev.map((h: any) =>
              h.month === month
                ? { ...h, total: totalNet, employees: visibleEmployees.length, status: "Locked" }
                : h,
            );
          return [
            { month, employees: visibleEmployees.length, total: totalNet, status: "Locked" },
            ...prev,
          ];
        });
        setProcessed(true);
        setStep(3);
        toast(`Payroll Approved & Locked for ${month} - ${visibleEmployees.length} employees`);
      }
    } catch (err: any) {
      toast(err.message || (isGenerateMode ? "Failed to generate draft payroll" : "Failed to process payroll"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={isGenerateMode ? "Generate Payroll" : "Process Payroll"}
        subtitle={
          isGenerateMode
            ? "Prepare and generate draft monthly payroll (Sync Attendance & LOP -> Preview -> Save Draft)."
            : "Review draft payroll, verify statutory deductions, approve and lock period."
        }
      />
      {!canEdit && <ReadOnlyBanner />}

      <div className="mb-6 flex gap-4 border-b border-border pb-4">
        <div
          className={`flex items-center gap-2 font-bold ${step >= 1 ? "text-primary" : "text-muted-foreground"}`}
        >
          <div
            className={`grid h-6 w-6 place-items-center rounded-full text-xs ${step >= 1 ? "bg-primary text-white" : "bg-muted"}`}
          >
            1
          </div>{" "}
          {isGenerateMode ? "Preview" : "Review Draft"}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
        <div
          className={`flex items-center gap-2 font-bold ${step >= 2 ? "text-primary" : "text-muted-foreground"}`}
        >
          <div
            className={`grid h-6 w-6 place-items-center rounded-full text-xs ${step >= 2 ? "bg-primary text-white" : "bg-muted"}`}
          >
            2
          </div>{" "}
          Validate
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
        <div
          className={`flex items-center gap-2 font-bold ${step === 3 ? "text-primary" : "text-muted-foreground"}`}
        >
          <div
            className={`grid h-6 w-6 place-items-center rounded-full text-xs ${step === 3 ? "bg-primary text-white" : "bg-muted"}`}
          >
            3
          </div>{" "}
          {isGenerateMode ? "Save Draft" : "Lock"}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {step === 1 && (
            <>
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Payroll Month">
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className={inputCls}
                  >
                    <option>July 2026</option>
                    <option>June 2026</option>
                    <option>May 2026</option>
                  </select>
                </Field>
                <Field label="Pay Date">
                  <input {...dateInputProps(payDate, setPayDate)} className={inputCls} />
                </Field>
              </div>
              <div className="rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Fixed Base</th>
                      <th className="px-4 py-3">Basic Salary</th>
                      <th className="px-4 py-3">LOP Days</th>
                      <th className="px-4 py-3">LOP Deduction</th>
                      <th className="px-4 py-3">Gross</th>
                      <th className="px-4 py-3">Deductions</th>
                      <th className="px-4 py-3">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEmployees.map((e) => {
                      const preview = getPreviewForEmployee(e.id);
                      const fixedBase = preview.fixedBaseSalary ?? e.salary ?? 0;
                      const basic = preview.basicSalary ?? 0;
                      const lopDays = preview.lopDays ?? preview.lopDeductDays ?? 0;
                      const lopDeductAmount = preview.lopDeductAmount ?? 0;
                      const gross = preview.gross ?? 0;
                      const totalDeduct = preview.deductions ?? 0;
                      const net = preview.net ?? 0;
                      return (
                        <tr key={e.id} className="border-b border-border/60">
                          <td className="px-4 py-3 font-semibold">{e.name}</td>
                          <td className="px-4 py-3">₹{fixedBase.toLocaleString()}</td>
                          <td className="px-4 py-3">₹{basic.toLocaleString()}</td>
                          <td
                            className={`px-4 py-3 ${lopDays > 0 ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}
                          >
                            {lopDays}
                          </td>
                          <td
                            className={`px-4 py-3 ${lopDeductAmount > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}`}
                          >
                            {lopDeductAmount > 0 ? `-₹${lopDeductAmount.toLocaleString()}` : "-"}
                          </td>
                          <td className="px-4 py-3 font-semibold">₹{gross.toLocaleString()}</td>
                          <td className="px-4 py-3 text-destructive">
                            -₹{totalDeduct.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-bold">₹{net.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="p-4">
              <h3 className="font-bold mb-4">Validation Results</h3>
              {warnings.length === 0 ? (
                <div className="flex items-center gap-3 text-green-600 bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                  <CheckCircle2 className="h-6 w-6" />
                  <div>
                    <div className="font-bold">All Checks Passed!</div>
                    <div className="text-sm mt-1">
                      {isGenerateMode
                        ? "No negative pay, KYC verified. Ready to save draft payroll."
                        : "No negative pay, all statutory deductions verified. Ready to lock."}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-amber-600 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                    <AlertCircle className="h-6 w-6" />
                    <div>
                      <div className="font-bold">Warnings Found ({warnings.length})</div>
                      <div className="text-sm mt-1">
                        Review the issues below before proceeding.
                      </div>
                    </div>
                  </div>
                  <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="p-8 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-500/20 text-green-600 mb-4">
                {isGenerateMode ? <Check className="h-8 w-8" /> : <LockKeyhole className="h-8 w-8" />}
              </div>
              <h2 className="text-xl font-bold">
                {isGenerateMode ? "Draft Payroll Generated Successfully" : "Payroll Approved & Locked Successfully"}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {isGenerateMode
                  ? `The draft payroll calculation for ${month} has been saved. The Accountant can now review and approve it under Process Payroll.`
                  : "Slips have been generated, statutory deductions committed, and the period is sealed."}
              </p>
            </div>
          )}
        </Card>

        <Card>
          <div className="text-sm font-bold">Summary - {month}</div>
          <div className="mt-4 space-y-3 text-sm">
            <Row k="Employees" v={String(visibleEmployees.length)} />
            <Row k="Gross Total" v={`₹${total.toLocaleString()}`} />
            <Row k="Total Deductions" v={`-₹${totalDeductions.toLocaleString()}`} />
            <div className="border-t border-border pt-3">
              <Row k="Net Payable" v={`₹${totalNet.toLocaleString()}`} bold />
            </div>
          </div>
          {canEdit && step === 1 && (
            <Btn className="mt-6 w-full py-2.5" onClick={handleValidate}>
              <CheckCircle2 className="h-4 w-4" /> Run Validation
            </Btn>
          )}
          {canEdit && step === 2 && (
            <div className="mt-6 flex gap-2">
              <Btn
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Back
              </Btn>
              <Btn className="flex-1" onClick={handleExecute} disabled={loading}>
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : isGenerateMode ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <LockKeyhole className="h-4 w-4" />
                )}
                <span>
                  {loading
                    ? isGenerateMode
                      ? "Generating..."
                      : "Processing..."
                    : isGenerateMode
                    ? "Save & Generate Draft"
                    : "Approve & Lock Payroll"}
                </span>
              </Btn>
            </div>
          )}
          {step === 3 && (
            <Btn className="mt-6 w-full py-2.5" variant="outline" disabled>
              <Check className="h-4 w-4" /> {isGenerateMode ? "Draft Saved" : "Locked"}
            </Btn>
          )}
        </Card>
      </div>
    </div>
  );
}

function SalaryStructure({
  canEdit,
  toast,
  salaryComponents,
  setSalaryComponents,
  triggerConfirm,
}: {
  canEdit: boolean;
  toast: (m: string) => void;
  salaryComponents: any[];
  setSalaryComponents: (c: any[] | ((p: any[]) => any[])) => void;
  triggerConfirm: (msg: string, fn: () => void, title?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [f, setF] = useState({ name: "", type: "Earning", value: "", formula: "fixed" });
  const add = () => {
    if (!f.name.trim()) return;
    setSalaryComponents((prev) => [...prev, { ...f, name: f.name.trim() }]);
    toast("Component added");
    setOpen(false);
    setF({ name: "", type: "Earning", value: "", formula: "fixed" });
  };
  const handleDelete = (name: string) => {
    triggerConfirm(
      `Are you sure you want to delete the salary component "${name}"?`,
      () => {
        setSalaryComponents((prev) => prev.filter((c: any) => c.name !== name));
        toast(`Component "${name}" deleted`);
      },
      "Delete Component",
    );
  };
  return (
    <div>
      {!canEdit && <ReadOnlyBanner />}
      <PageHeader
        title="Salary Structure"
        subtitle="Define components and formulas applied to all new salary slips."
        action={
          <>
            <Btn variant="outline" onClick={() => setGuideOpen(true)}>
              <Info className="h-4 w-4" /> Formula Guide
            </Btn>
            {canEdit && (
              <Btn onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Add Component
              </Btn>
            )}
          </>
        }
      />
      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3">Component</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Formula / Value</th>
              {canEdit && <th className="px-4 py-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {salaryComponents.map((c: any) => (
              <tr key={c.name} className="border-b border-border/60">
                <td className="px-4 py-3 font-semibold">{c.name}</td>
                <td className="px-4 py-3">
                  <Badge tone={c.type === "Earning" ? "green" : "rose"}>{c.type}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.value || c.formula || "–"}</td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(c.name)}
                      title="Delete component"
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive ml-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {open && (
        <ModalShell title="Add Salary Component" onClose={() => setOpen(false)}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field className="md:col-span-2" label="Component Name *">
              <input
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
                className={inputCls}
                placeholder="e.g. Medical Allowance"
              />
            </Field>
            <Field label="Type">
              <select
                value={f.type}
                onChange={(e) => setF({ ...f, type: e.target.value })}
                className={inputCls}
              >
                <option>Earning</option>
                <option>Deduction</option>
              </select>
            </Field>
            <Field label="Formula / Value">
              <input
                value={f.value}
                onChange={(e) => setF({ ...f, value: e.target.value })}
                className={inputCls}
                placeholder="e.g. 5% of Basic or fixed ₹2000"
              />
            </Field>
          </div>
          <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-600">
            ⚠️ New components apply to future salary slips only. Existing slips are not affected.
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
            <Btn onClick={add}>Add Component</Btn>
          </div>
        </ModalShell>
      )}
      {guideOpen && (
        <ModalShell title="Salary Structure Formula Guide" onClose={() => setGuideOpen(false)}>
          <div className="space-y-4 text-sm text-foreground">
            <p>
              The payroll engine automatically evaluates the <b>Formula / Value</b> field when
              generating a salary slip.
            </p>
            <div className="space-y-2">
              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <div className="font-bold text-primary">Fixed Amount</div>
                <div className="text-muted-foreground mt-1">
                  Example: <code>250</code>, <code>5000</code>
                </div>
                <div className="text-xs mt-1">
                  The exact amount will be added or deducted every month regardless of the gross
                  salary.
                </div>
              </div>
              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <div className="font-bold text-primary">Percentage of Gross</div>
                <div className="text-muted-foreground mt-1">
                  Example: <code>10%</code>, <code>5.5%</code>
                </div>
                <div className="text-xs mt-1">
                  Calculates the value as a percentage of the total Gross Salary.
                </div>
              </div>
              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <div className="font-bold text-primary">Percentage of Basic</div>
                <div className="text-muted-foreground mt-1">
                  Example: <code>12% of basic</code>, <code>10% basic</code>
                </div>
                <div className="text-xs mt-1">
                  Calculates the value as a percentage of the <b>Basic Salary</b> component.
                </div>
              </div>
              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <div className="font-bold text-primary">Dynamic Balance</div>
                <div className="text-muted-foreground mt-1">If no formula is set (left empty)</div>
                <div className="text-xs mt-1">
                  The engine distributes any remaining Gross Salary or Deductions evenly across all
                  dynamic components to balance the slip.
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Btn onClick={() => setGuideOpen(false)}>Got It</Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function SalarySlips({
  employees,
  isSelf,
  isTeam,
  salarySlips,
  setSalarySlips,
  salaryComponents,
  canGenerate,
  toast,
}: {
  employees: Employee[];
  isSelf?: boolean;
  isTeam?: boolean;
  salarySlips: any[];
  setSalarySlips: (s: any[] | ((p: any[]) => any[])) => void;
  salaryComponents: any[];
  canGenerate?: boolean;
  toast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const queryClient = useQueryClient();
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("July 2026");
  const [genOpen, setGenOpen] = useState(false);
  const [viewSlip, setViewSlip] = useState<any | null>(null);
  const [editSlip, setEditSlip] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [estCalculation, setEstCalculation] = useState<{
    gross: number;
    deductions: number;
    net: number;
  } | null>(null);

  const months = [
    "July 2026",
    "June 2026",
    "May 2026",
    "April 2026",
    "March 2026",
    "February 2026",
  ];

  useEffect(() => {
    if (!selectedEmp || !genOpen) {
      setEstCalculation(null);
      return;
    }
    let active = true;
    payrollService
      .calculatePayroll({
        month: selectedMonth,
        adjustments: {
          [selectedEmp.id]: {
            LOPDays: 0,
            overtimeHours: 0,
            bonus: 0,
            deductions: 0,
            ptOverride: 0,
            remarks: "",
          },
        },
      })
      .then((data) => {
        if (active) {
          const empSlip = data.find((s) => s.employeeId === selectedEmp.id);
          if (empSlip) {
            setEstCalculation({
              gross: empSlip.gross,
              deductions: empSlip.deductions,
              net: empSlip.net,
            });
          }
        }
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, [selectedEmp, selectedMonth, genOpen]);

  const generateSlip = async () => {
    if (!selectedEmp) return;
    setLoading(true);
    try {
      await payrollService.processPayroll({
        month: selectedMonth,
        payDate: getBusinessDateString(),
        status: "APPROVED",
        adjustments: {
          [selectedEmp.id]: {
            LOPDays: 0,
            overtimeHours: 0,
            bonus: 0,
            deductions: 0,
            ptOverride: 0,
            remarks: "",
          },
        },
      });

      await queryClient.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.all });
      await usePayrollStore.getState().fetchPayroll(selectedMonth);
      toast(`Salary slip generated for ${selectedEmp.name} – ${selectedMonth}`);
      setGenOpen(false);
    } catch (err: any) {
      toast(err.message || "Failed to generate slip", "error");
    } finally {
      setLoading(false);
    }
  };

  const numberToWords = (num: number): string => {
    const a = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const b = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];

    if (num === 0) return "Zero";

    const chunk = (n: number): string => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
      return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + chunk(n % 100) : "");
    };

    let words = "";
    let temp = num;
    if (Math.floor(temp / 10000000)) {
      words += chunk(Math.floor(temp / 10000000)) + " Crore ";
      temp %= 10000000;
    }
    if (Math.floor(temp / 100000)) {
      words += chunk(Math.floor(temp / 100000)) + " Lakh ";
      temp %= 100000;
    }
    if (Math.floor(temp / 1000)) {
      words += chunk(Math.floor(temp / 1000)) + " Thousand ";
      temp %= 1000;
    }
    if (temp) {
      words += chunk(temp);
    }
    return words.trim() + " Only";
  };

  const getSlipComponents = (slip: any) => {
    let comps = slip.components;
    if (!comps || comps.length === 0) {
      const basicAmt = slip.basicSalary || Math.round(slip.gross * 0.5);
      const totalAllowances = slip.gross - basicAmt;
      const pfAmt = Math.round(basicAmt * 0.12);
      const ptAmt = 250;
      const tdsAmt = Math.max(0, slip.deductions - pfAmt - ptAmt);
      comps = [
        { name: "Basic Salary", type: "Earning", amount: basicAmt },
        { name: "HRA", type: "Earning", amount: Math.round(basicAmt * 0.4) },
        {
          name: "Special Allowance",
          type: "Earning",
          amount: Math.max(0, totalAllowances - Math.round(basicAmt * 0.4)),
        },
        { name: "Provident Fund", type: "Deduction", amount: pfAmt },
        { name: "Professional Tax", type: "Deduction", amount: ptAmt },
        { name: "TDS", type: "Deduction", amount: tdsAmt },
      ];
    }
    return comps;
  };

  const downloadSlip = (slip: any) => {
    const emp = employees.find((e) => e.id === slip.employeeId);
    const companyName = resolvePayslipCompanyName(slip, emp);
    const companyInitials = getCompanyInitials(companyName);
    const comps = getSlipComponents(slip);

    const earnings = comps.filter((c: any) => c.type === "Earning");
    const deductions = comps.filter((c: any) => c.type === "Deduction");

    const workingDays = slip.adjustments?.workingDays || 27;
    const presentDays =
      slip.adjustments?.presentDays || Math.max(0, workingDays - (slip.adjustments?.LOPDays || 0));
    const lopDays = slip.adjustments?.LOPDays || 0;
    const paidDays = Math.max(0, workingDays - lopDays);

    const amountInWords = numberToWords(slip.net);
    const baseSalary = emp?.salary || 0;
    const lopDeductionAmt = Math.abs(slip.adjustments?.lopDeduction || slip.adjustments?.LOPDeduction || 0);
    const lopDivisor = slip.adjustments?.lopDivisor || slip.adjustments?.divisor;
    const dailyRate = lopDivisor ? Math.round(baseSalary / lopDivisor) : (lopDays > 0 && lopDeductionAmt > 0 ? Math.round(lopDeductionAmt / lopDays) : 0);

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payslip – ${escapeHtml(slip.employeeName)}</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, Segoe UI, Roboto, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 30px;
      background: #fff;
      line-height: 1.5;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-box {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      border-radius: 10px;
      display: grid;
      place-items: center;
      color: #fff;
      font-weight: 800;
      font-size: 16px;
    }
    .logo-text h2 {
      font-size: 20px;
      margin: 0;
      font-weight: 700;
      color: #0f172a;
    }
    .logo-text span {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .header-title {
      text-align: right;
    }
    .header-title h1 {
      font-size: 20px;
      margin: 0;
      color: #4f46e5;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .header-title span {
      font-size: 13px;
      color: #64748b;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1.1fr 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
    }
    .card {
      border: 1px solid #f1f5f9;
      background: #f8fafc;
      border-radius: 10px;
      padding: 16px;
    }
    .card-title {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin: 0 0 10px 0;
    }
    .details-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 12px;
    }
    .details-row span:first-child {
      color: #64748b;
    }
    .details-row span:last-child {
      font-weight: 600;
      color: #1e293b;
    }
    .attendance-row {
      display: flex;
      justify-content: space-around;
      background: #f1f5f9;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 20px;
      text-align: center;
    }
    .attendance-item {
      font-size: 12px;
    }
    .attendance-item span {
      display: block;
      color: #64748b;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
    }
    .attendance-item b {
      font-size: 14px;
      color: #0f172a;
    }
    .table-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 8px 10px;
      font-size: 12px;
      border-bottom: 1px solid #e2e8f0;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      color: #475569;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
    }
    .right {
      text-align: right;
    }
    .bold-row {
      font-weight: 700;
      background: #f8fafc;
    }
    .net-payable-card {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: #fff;
      padding: 20px;
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 25px;
    }
    .net-title {
      font-weight: 600;
      font-size: 14px;
      opacity: 0.9;
    }
    .net-words {
      font-size: 11px;
      opacity: 0.8;
      margin-top: 4px;
      font-style: italic;
    }
    .net-val {
      font-size: 26px;
      font-weight: 800;
    }
    .sign-section {
      display: flex;
      justify-content: space-between;
      margin-top: 50px;
      padding-top: 20px;
    }
    .sign-block {
      text-align: center;
      width: 200px;
    }
    .sign-line {
      border-top: 1px solid #cbd5e1;
      margin-top: 40px;
      padding-top: 6px;
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .footer {
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 15px;
      font-size: 10px;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-area">
        <div class="logo-box">${escapeHtml(companyInitials)}</div>
        <div class="logo-text">
          <h2>${escapeHtml(companyName)}</h2>
          <span>Official Salary Statement</span>
        </div>
      </div>
      <div class="header-title">
        <h1>Payslip</h1>
        <span>For the month of ${escapeHtml(slip.month)}</span>
      </div>
    </div>

    <div class="details-grid">
      <div class="card">
        <h3 class="card-title">Employee Details</h3>
        <div class="details-row"><span>Employee Name</span><span>${escapeHtml(slip.employeeName)}</span></div>
        <div class="details-row"><span>Employee ID</span><span>${escapeHtml(slip.employeeId)}</span></div>
        <div class="details-row"><span>Department</span><span>${escapeHtml(emp?.department || "—")}</span></div>
        <div class="details-row"><span>Designation</span><span>${escapeHtml(emp?.designation || "—")}</span></div>
        <div class="details-row"><span>Joining Date</span><span>${escapeHtml(emp?.joined ? new Date(emp.joined).toLocaleDateString() : "—")}</span></div>
      </div>
      <div class="card">
        <h3 class="card-title">Salary & LOP Basis</h3>
        <div class="details-row"><span>Base Salary (CTC)</span><span>₹${escapeHtml(baseSalary.toLocaleString())}</span></div>
        ${dailyRate > 0 ? `<div class="details-row"><span>Daily Rate ${lopDivisor ? `(1/${escapeHtml(lopDivisor)})` : ""}</span><span>₹${escapeHtml(dailyRate.toLocaleString())}</span></div>` : ""}
        <div class="details-row"><span>LOP Days Applied</span><span>${escapeHtml(lopDays)}</span></div>
        <div class="details-row"><span>LOP Deduction</span><span style="color: #ef4444; font-weight: 700;">-₹${escapeHtml(lopDeductionAmt.toLocaleString())}</span></div>
        <div class="details-row"><span>Effective Gross</span><span>₹${escapeHtml(slip.gross.toLocaleString())}</span></div>
      </div>
      <div class="card">
        <h3 class="card-title">Compliance & Bank</h3>
        <div class="details-row"><span>PAN Number</span><span>${escapeHtml(emp?.pan || "—")}</span></div>
        <div class="details-row"><span>UAN Number</span><span>${escapeHtml(emp?.uan || "—")}</span></div>
        <div class="details-row"><span>Bank Name</span><span>${escapeHtml(emp?.bankName || "Bank details not configured")}</span></div>
        <div class="details-row"><span>Account Number</span><span>${escapeHtml(maskAccountNumber(emp?.accountNumber || emp?.accountNo))}</span></div>
        <div class="details-row"><span>Payment Mode</span><span>Bank Transfer</span></div>
      </div>
    </div>

    <div class="attendance-row">
      <div class="attendance-item"><span>Calendar Days</span><b>31</b></div>
      <div class="attendance-item"><span>Working Days</span><b>${escapeHtml(workingDays)}</b></div>
      <div class="attendance-item"><span>Present Days</span><b>${escapeHtml(presentDays)}</b></div>
      <div class="attendance-item"><span>Loss of Pay</span><b>${escapeHtml(lopDays)}</b></div>
      <div class="attendance-item"><span>Paid Days</span><b>${escapeHtml(paidDays)}</b></div>
    </div>

    <div class="table-container">
      <div>
        <table>
          <thead>
            <tr>
              <th>Earnings Description</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${earnings
        .map(
          (c: any) => `
              <tr>
                <td>${escapeHtml(c.name)}</td>
                <td class="right">₹${escapeHtml(c.amount.toLocaleString())}</td>
              </tr>
            `,
        )
        .join("")}
            <tr class="bold-row">
              <td>Gross Earnings</td>
              <td class="right">₹${escapeHtml(slip.gross.toLocaleString())}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <table>
          <thead>
            <tr>
              <th>Deductions Description</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${deductions
        .map(
          (c: any) => `
              <tr>
                <td>${escapeHtml(c.name)}</td>
                <td class="right">₹${escapeHtml(c.amount.toLocaleString())}</td>
              </tr>
            `,
        )
        .join("")}
            <tr class="bold-row">
              <td>Total Deductions</td>
              <td class="right">₹${escapeHtml(slip.deductions.toLocaleString())}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="net-payable-card">
      <div>
        <div class="net-title">Net Salary Payable</div>
        <div class="net-words">Amount in words: ${escapeHtml(amountInWords)}</div>
      </div>
      <div class="net-val">₹${escapeHtml(slip.net.toLocaleString())}</div>
    </div>

    <div class="sign-section">
      <div class="sign-block">
        <div class="sign-line">Employee Signature</div>
      </div>
      <div class="sign-block">
        <div class="sign-line">Authorized Signatory for ${escapeHtml(companyName)}</div>
      </div>
    </div>

    <div class="footer">
      This is a computer-generated payslip and does not require a physical signature. Confidential document.
    </div>
  </div>
  <script>window.onload=()=>window.print()<\/script>
</body>
</html>`;
    printHTML(html);
  };

  // Group slips by employee
  const slipsByEmp: Record<string, any[]> = {};
  (salarySlips || []).forEach((s: any) => {
    if (!slipsByEmp[s.employeeId]) slipsByEmp[s.employeeId] = [];
    slipsByEmp[s.employeeId].push(s);
  });

  return (
    <div>
      <PageHeader
        title={isSelf ? "My Salary Slips" : isTeam ? "Team Salary Slips" : "Salary Slips"}
        subtitle={isSelf ? "Download your monthly payslips." : "Manage and generate salary slips."}
        action={
          canGenerate && (
            <Btn onClick={() => setGenOpen(true)}>
              <FileText className="h-4 w-4" /> Generate Slip
            </Btn>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {employees.map((e) => {
          const empSlips = (slipsByEmp[e.id] || []).sort(
            (a: any, b: any) =>
              new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
          );
          const latest = empSlips[0];
          return (
            <Card key={e.id}>
              <div className="flex items-center gap-3">
                <Avatar src={e.avatar} name={e.name} />
                <div className="min-w-0">
                  <div className="truncate font-bold">{e.name}</div>
                  <div className="text-xs text-muted-foreground">{e.designation}</div>
                </div>
                <Badge tone={empSlips.length > 0 ? "green" : "slate"}>
                  {empSlips.length} slip{empSlips.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              {latest ? (
                <div className="mt-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary-glow/5 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">{latest.month} – Net Pay</div>
                  <div className="text-2xl font-bold">₹{latest.net.toLocaleString()}</div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground text-center">
                  No slips generated
                </div>
              )}
              <div className="mt-4 flex gap-2 flex-wrap">
                {empSlips.slice(0, 3).map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => setViewSlip(s)}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-muted transition"
                  >
                    <FileText className="h-3 w-3" />
                    {s.month}
                  </button>
                ))}
              </div>
              {latest && (
                <div className={`mt-3 grid ${canGenerate ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
                  <Btn variant="outline" size="sm" onClick={() => setViewSlip(latest)}>
                    <Eye className="h-4 w-4" /> View
                  </Btn>
                  {canGenerate && (
                    <Btn variant="outline" size="sm" onClick={() => setEditSlip(latest)}>
                      <Edit3 className="h-4 w-4" /> Edit
                    </Btn>
                  )}
                  <Btn variant="outline" size="sm" onClick={() => downloadSlip(latest)}>
                    <Download className="h-4 w-4" /> PDF
                  </Btn>
                </div>
              )}
            </Card>
          );
        })}
        {employees.length === 0 && (
          <Card className="md:col-span-3 text-center py-12 text-sm text-muted-foreground">
            No employees found.
          </Card>
        )}
      </div>

      {genOpen && (
        <ModalShell title="Generate Salary Slip" onClose={() => setGenOpen(false)}>
          <div className="space-y-4">
            <Field label="Select Employee *">
              <select
                className={inputCls}
                value={selectedEmp?.id || ""}
                onChange={(e) =>
                  setSelectedEmp(employees.find((emp) => emp.id === e.target.value) || null)
                }
              >
                <option value="">— Select Employee —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} – {e.department}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Month *">
              <select
                className={inputCls}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {months.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            {selectedEmp && estCalculation && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross Salary</span>
                  <span className="font-semibold">₹{estCalculation.gross.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Deductions</span>
                  <span className="text-destructive">
                    -₹{estCalculation.deductions.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-1">
                  <span className="font-semibold">Est. Net Pay</span>
                  <span className="font-bold">₹{estCalculation.net.toLocaleString()}</span>
                </div>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Components from current salary structure will be applied to this slip.
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setGenOpen(false)}>
              Cancel
            </Btn>
            <Btn onClick={generateSlip} disabled={!selectedEmp}>
              <FileText className="h-4 w-4" /> Generate Slip
            </Btn>
          </div>
        </ModalShell>
      )}
      {viewSlip && (() => {
        const emp = employees.find((e) => e.id === viewSlip.employeeId);
        const companyName = resolvePayslipCompanyName(viewSlip, emp);
        return (
          <ModalShell title={`Payslip – ${viewSlip.employeeName}`} onClose={() => setViewSlip(null)}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Employer</span>
                <span className="font-semibold text-foreground">{companyName}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Month</span>
                <span className="font-semibold text-foreground">{viewSlip.month}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Employee ID</span>
                <span className="font-semibold text-foreground">{viewSlip.employeeId}</span>
              </div>
            {(() => {
              const emp = employees.find((e) => e.id === viewSlip.employeeId);
              const baseSalary = emp?.salary || 0;
              const lopDays = viewSlip.adjustments?.LOPDays || 0;
              const lopDeductionAmt = Math.abs(viewSlip.adjustments?.lopDeduction || viewSlip.adjustments?.LOPDeduction || 0);
              const lopDivisor = viewSlip.adjustments?.lopDivisor || viewSlip.adjustments?.divisor;
              const dailyRate = lopDivisor ? Math.round(baseSalary / lopDivisor) : (lopDays > 0 && lopDeductionAmt > 0 ? Math.round(lopDeductionAmt / lopDays) : 0);

              if (lopDays > 0) {
                return (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/30 p-3 mt-2 text-xs flex justify-between items-center text-red-800 dark:text-red-300">
                    <div>
                      <span className="font-semibold">Loss of Pay (LOP) Deduction:</span>
                      <div className="text-muted-foreground mt-0.5">
                        {lopDays} days absent {dailyRate > 0 ? `at daily rate of ₹${dailyRate.toLocaleString()}` : ""}
                      </div>
                    </div>
                    <span className="font-bold">-₹{lopDeductionAmt.toLocaleString()}</span>
                  </div>
                );
              }
              return null;
            })()}
            <div className="mt-3 rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2 text-left">Component</th>
                    <th className="px-3 py-2 text-right">Earnings</th>
                    <th className="px-3 py-2 text-right">Deductions</th>
                  </tr>
                </thead>
                <tbody>
                  {getSlipComponents(viewSlip).map((c: any) => (
                    <tr key={c.name} className="border-t border-border/60">
                      <td className="px-3 py-2">{c.name}</td>
                      <td className="px-3 py-2 text-right">
                        {c.type === "Earning" ? `₹${c.amount.toLocaleString()}` : "–"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {c.type === "Deduction" ? `-₹${c.amount.toLocaleString()}` : "–"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-muted/40 font-bold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">₹{viewSlip.gross.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      -₹{viewSlip.deductions.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="rounded-xl bg-gradient-to-r from-primary to-primary-glow p-4 flex justify-between items-center text-white">
              <span className="font-semibold">Net Pay</span>
              <span className="text-2xl font-bold">₹{viewSlip.net.toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setViewSlip(null)}>
              Close
            </Btn>
            <Btn onClick={() => downloadSlip(viewSlip)}>
              <Download className="h-4 w-4" /> Download PDF
            </Btn>
          </div>
        </ModalShell>
        );
      })()}

      {editSlip && (
        <ModalShell
          title={`Edit Payslip - ${editSlip.employeeName}`}
          onClose={() => setEditSlip(null)}
        >
          <div className="space-y-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Month</span>
              <span className="font-semibold text-foreground">{editSlip.month}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Employee ID</span>
              <span className="font-semibold text-foreground">{editSlip.employeeId}</span>
            </div>

            <div className="space-y-3 mt-2">
              <h4 className="font-semibold border-b border-border pb-1">Earnings</h4>
              {editSlip.components
                .filter((c: any) => c.type === "Earning")
                .map((c: any, i: number) => (
                  <Field key={i} label={c.name}>
                    <input
                      type="number"
                      value={c.amount}
                      onChange={(e) => {
                        const amt = Number(e.target.value) || 0;
                        const newComps = editSlip.components.map((comp: any) =>
                          comp.name === c.name ? { ...comp, amount: amt } : comp,
                        );
                        const gross = newComps
                          .filter((x: any) => x.type === "Earning")
                          .reduce((s: number, x: any) => s + x.amount, 0);
                        const deductions = newComps
                          .filter((x: any) => x.type === "Deduction")
                          .reduce((s: number, x: any) => s + x.amount, 0);
                        setEditSlip({
                          ...editSlip,
                          components: newComps,
                          gross,
                          deductions,
                          net: gross - deductions,
                        });
                      }}
                      className={inputCls}
                    />
                  </Field>
                ))}
              <h4 className="font-semibold border-b border-border pb-1 mt-4">Deductions</h4>
              {editSlip.components
                .filter((c: any) => c.type === "Deduction")
                .map((c: any, i: number) => (
                  <Field key={i} label={c.name}>
                    <input
                      type="number"
                      value={c.amount}
                      onChange={(e) => {
                        const amt = Number(e.target.value) || 0;
                        const newComps = editSlip.components.map((comp: any) =>
                          comp.name === c.name ? { ...comp, amount: amt } : comp,
                        );
                        const gross = newComps
                          .filter((x: any) => x.type === "Earning")
                          .reduce((s: number, x: any) => s + x.amount, 0);
                        const deductions = newComps
                          .filter((x: any) => x.type === "Deduction")
                          .reduce((s: number, x: any) => s + x.amount, 0);
                        setEditSlip({
                          ...editSlip,
                          components: newComps,
                          gross,
                          deductions,
                          net: gross - deductions,
                        });
                      }}
                      className={inputCls}
                    />
                  </Field>
                ))}
            </div>

            <div className="mt-4 rounded-xl border border-border p-3 grid grid-cols-2 gap-2 text-center bg-muted/20">
              <div>
                <div className="text-xs text-muted-foreground">Gross</div>
                <div className="font-bold text-foreground">₹{editSlip.gross.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Deductions</div>
                <div className="font-bold text-destructive">
                  -₹{editSlip.deductions.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-gradient-to-r from-primary to-primary-glow p-4 flex justify-between items-center text-white">
              <span className="font-semibold">Net Pay</span>
              <span className="text-2xl font-bold">₹{editSlip.net.toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setEditSlip(null)}>
              Cancel
            </Btn>
            <Btn
              onClick={async () => {
                try {
                  const basicComp = editSlip.components.find(
                    (c: any) => c.name === "Basic Salary" || c.name === "Basic",
                  );
                  const basicSalary = basicComp
                    ? basicComp.amount
                    : Math.round(editSlip.gross * 0.5);

                  const updatedSlip = await payrollService.updateSlip(editSlip.id, {
                    basicSalary,
                    allowances: editSlip.components
                      .filter(
                        (c: any) =>
                          c.type === "Earning" && c.name !== "Basic Salary" && c.name !== "Basic",
                      )
                      .reduce((s: number, x: any) => s + x.amount, 0),
                    deductions: editSlip.deductions,
                    netSalary: editSlip.net,
                    components: editSlip.components,
                  });

                  setSalarySlips((prev: any) =>
                    prev.map((s: any) => (s.id === editSlip.id ? { ...s, ...updatedSlip } : s)),
                  );
                  setEditSlip(null);
                  toast("Salary slip updated successfully and persisted to backend.");
                } catch (err: any) {
                  toast(err.message || "Failed to persist salary slip modifications.", "error");
                }
              }}
            >
              Save Changes
            </Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function PayrollHistory({
  isSelf,
  payrollHistory,
  visibleEmployees,
  salarySlips,
  toast,
  canProcess,
}: {
  isSelf?: boolean;
  payrollHistory: any[];
  visibleEmployees: Employee[];
  salarySlips: any[];
  toast?: (m: string, type?: string) => void;
  canProcess?: boolean;
}) {
  const queryClient = useQueryClient();
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [disburseModalMonth, setDisburseModalMonth] = useState<{
    month: string;
    employees: number;
    total: number;
  } | null>(null);
  const [disburseDate, setDisburseDate] = useState<string>(getBusinessDateString());
  const [disburseRef, setDisburseRef] = useState<string>("");
  const [isSubmittingDisburse, setIsSubmittingDisburse] = useState<boolean>(false);

  // Group database slips by month to build tenant-isolated history rows dynamically
  const historyRows = useMemo(() => {
    const monthGroups = new Map<
      string,
      { month: string; employees: number; total: number; status: string }
    >();

    (salarySlips || []).forEach((slip: any) => {
      const month = slip.month;
      const existing = monthGroups.get(month);
      const isPaid = (slip.status || "").toUpperCase() === "PAID" || slip.status === "Paid";
      if (existing) {
        existing.employees += 1;
        existing.total += slip.netSalary || slip.net || 0;
        if (!isPaid) {
          existing.status = "Locked";
        }
      } else {
        monthGroups.set(month, {
          month,
          employees: 1,
          total: slip.netSalary || slip.net || 0,
          status: isPaid ? "Paid" : "Locked",
        });
      }
    });

    return Array.from(monthGroups.values()).sort((a, b) => {
      // Sort months descending (e.g. July 2026, June 2026)
      const aDate = new Date(`1 ${a.month}`);
      const bDate = new Date(`1 ${b.month}`);
      return bDate.getTime() - aDate.getTime();
    });
  }, [salarySlips]);

  const filtered = historyRows;

  const downloadMonthSlips = (month: string, kind: string, slips: any[]) => {
    if (slips.length === 0) {
      if (toast) toast("No slips found for this month.", "info");
      return;
    }
    if (kind === "PDF") {
      const slipsHtml = slips
        .map((s) => {
          const emp = visibleEmployees.find((e) => e.id === s.employeeId);
          const cName = resolvePayslipCompanyName(s, emp);
          const cInitials = getCompanyInitials(cName);
          const cRows = (s.components || [])
            .map((c: any) => `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.type)}</td><td>${escapeHtml(c.amount)}</td></tr>`)
            .join("");
          return `<div style="page-break-after:always;padding:40px;font-family:-apple-system,sans-serif;color:#333"><div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:15px;margin-bottom:15px"><div style="display:flex;align-items:center;gap:12px"><div style="width:36px;height:36px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:8px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:14px">${escapeHtml(cInitials)}</div><div><h2 style="margin:0;font-size:18px;color:#0f172a">${escapeHtml(cName)}</h2><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Official Salary Statement</span></div></div><div style="text-align:right"><h3 style="margin:0;color:#7c3aed;font-size:18px">Payslip</h3><span style="font-size:12px;color:#6b7280">${escapeHtml(s.month)}</span></div></div><h4 style="color:#1e293b;margin:0 0 10px 0">Employee: ${escapeHtml(s.employeeName)} (${escapeHtml(s.employeeId)})</h4><table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:14px"><thead><tr><th style="border:1px solid #e5e7eb;padding:10px;text-align:left;background:#f9fafb;text-transform:uppercase;color:#6b7280">Component</th><th style="border:1px solid #e5e7eb;padding:10px;text-align:left;background:#f9fafb;text-transform:uppercase;color:#6b7280">Type</th><th style="border:1px solid #e5e7eb;padding:10px;text-align:left;background:#f9fafb;text-transform:uppercase;color:#6b7280">Amount</th></tr></thead><tbody>${cRows}</tbody></table><h3 style="margin-top:20px">Net Pay: ₹${escapeHtml(s.net.toLocaleString())}</h3><div style="margin-top:30px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:11px;color:#94a3b8;text-align:center">Authorized Signatory for ${escapeHtml(cName)}</div></div>`;
        })
        .join("");
      const html = `<html><head><title>Slips - ${escapeHtml(month)}</title></head><body>${slipsHtml}<script>window.onload=()=>window.print()</script></body></html>`;
      printHTML(html);
    } else {
      const headers = ["Employee ID", "Employee Name", "Gross", "Deductions", "Net Pay"];
      const rows = slips.map((s) => [s.employeeId, s.employeeName, s.gross, s.deductions, s.net]);
      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      downloadCSV(`Slips_${month.replace(" ", "_")}.csv`, csvContent);
    }
  };

  return (
    <div>
      <PageHeader
        title={isSelf ? "My Payroll History" : "Payroll History"}
        subtitle="Past payroll cycles and generated slips."
      />
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Month</th>
                {!isSelf && <th className="px-4 py-3">Employees</th>}
                <th className="px-4 py-3">Total Net Pay</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={isSelf ? 4 : 5}
                    className="px-4 py-8 text-center text-muted-foreground text-sm"
                  >
                    No payroll history records found.
                  </td>
                </tr>
              ) : (
                filtered.flatMap((h: any) => {
                  const hSlips = (salarySlips || []).filter((s: any) => s.month === h.month);
                  const isExpanded = expandedMonth === h.month;
                  return [
                    <tr
                      key={h.month}
                      className="border-b border-border/60 hover:bg-muted/20 transition cursor-pointer"
                      onClick={() => setExpandedMonth(isExpanded ? null : h.month)}
                    >
                      <td className="px-4 py-3 font-semibold flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {h.month}
                      </td>
                      {!isSelf && <td className="px-4 py-3">{h.employees}</td>}
                      <td className="px-4 py-3">₹{(h.total || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge tone={h.status === "Paid" ? "green" : "amber"}>
                          {h.status || "Locked"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div
                          className="flex justify-end gap-2 items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canProcess && !isSelf && h.status !== "Paid" && (
                            <Btn
                              variant="success"
                              size="sm"
                              onClick={() => {
                                setDisburseModalMonth({
                                  month: h.month,
                                  employees: h.employees,
                                  total: h.total,
                                });
                                setDisburseDate(getBusinessDateString());
                                setDisburseRef("");
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4" /> Mark as Paid
                            </Btn>
                          )}
                          <Btn
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadMonthSlips(h.month, "PDF", hSlips)}
                          >
                            <Download className="h-4 w-4" /> PDF
                          </Btn>
                          <Btn
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadMonthSlips(h.month, "CSV", hSlips)}
                          >
                            <Download className="h-4 w-4" /> CSV
                          </Btn>
                        </div>
                      </td>
                    </tr>,
                    isExpanded && (
                      <tr
                        key={h.month + "-expanded"}
                        className="bg-muted/10 border-b border-border/60"
                      >
                        <td colSpan={isSelf ? 4 : 5} className="p-4">
                          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                            <h4 className="font-bold mb-3 text-sm">
                              Employee Breakdowns - {h.month}
                            </h4>
                            {hSlips.length === 0 ? (
                              <div className="text-sm text-muted-foreground">
                                No slips recorded for this month.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {hSlips.map((s: any) => (
                                  <div
                                    key={s.id}
                                    className="flex flex-col rounded-lg border border-border px-3 py-2 text-sm bg-muted/20"
                                  >
                                    <div className="font-semibold">{s.employeeName}</div>
                                    <div className="text-xs text-muted-foreground flex justify-between mt-1">
                                      <span>Gross: ₹{s.gross.toLocaleString()}</span>
                                      <span>
                                        Net:{" "}
                                        <span className="font-bold text-foreground">
                                          ₹{s.net.toLocaleString()}
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {disburseModalMonth && (
        <ModalShell
          title={`Confirm Salary Disbursement - ${disburseModalMonth.month}`}
          onClose={() => setDisburseModalMonth(null)}
        >
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-2">
              <div className="flex justify-between text-muted-foreground">
                <span>Payroll Cycle</span>
                <span className="font-semibold text-foreground">{disburseModalMonth.month}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total Employees</span>
                <span className="font-semibold text-foreground">{disburseModalMonth.employees}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total Net Payable</span>
                <span className="font-bold text-foreground text-base">
                  ₹{disburseModalMonth.total.toLocaleString()}
                </span>
              </div>
            </div>

            <Field label="Disbursement / Payment Date">
              <input
                type="date"
                value={disburseDate}
                onChange={(e) => setDisburseDate(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Payment Reference / UTR Number (Optional)">
              <input
                type="text"
                value={disburseRef}
                onChange={(e) => setDisburseRef(e.target.value)}
                className={inputCls}
                placeholder="e.g. HDFC-NEFT-90182391"
              />
            </Field>

            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Confirming payout will mark all {disburseModalMonth.employees} employee salary slips for{" "}
                <strong>{disburseModalMonth.month}</strong> as <strong>PAID</strong> and record an immutable audit trail.
              </span>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Btn
              variant="outline"
              onClick={() => setDisburseModalMonth(null)}
              disabled={isSubmittingDisburse}
            >
              Cancel
            </Btn>
            <Btn
              variant="success"
              onClick={async () => {
                setIsSubmittingDisburse(true);
                try {
                  await payrollService.markMonthAsPaid({
                    month: disburseModalMonth.month,
                    payDate: disburseDate,
                    paymentReference: disburseRef,
                  });
                  await usePayrollStore.getState().fetchPayroll(disburseModalMonth.month);
                  queryClient.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.all });
                  if (toast) {
                    toast(
                      `Salary disbursement confirmed for ${disburseModalMonth.month}. All slips marked as PAID.`,
                      "success",
                    );
                  }
                  setDisburseModalMonth(null);
                } catch (err: any) {
                  if (toast) {
                    toast(err.message || "Failed to mark payroll as paid.", "error");
                  }
                } finally {
                  setIsSubmittingDisburse(false);
                }
              }}
              disabled={isSubmittingDisburse}
            >
              {isSubmittingDisburse ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Confirm Payout
                </>
              )}
            </Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function PayrollReportsPage({
  employees,
  salarySlips,
  toast,
}: {
  employees: Employee[];
  salarySlips?: any[];
  toast: (m: string, tone?: "success" | "error" | "info") => void;
}) {
  const [selectedMonth, setSelectedMonth] = useState("July 2026");
  const months = [
    "July 2026",
    "June 2026",
    "May 2026",
    "April 2026",
    "March 2026",
    "February 2026",
  ];

  // Helper for backend-authoritative component snapshot extraction
  const getComponentAmount = (slip: any, nameMatches: string[]): number => {
    if (!slip || !slip.components || !Array.isArray(slip.components)) return 0;
    const comp = slip.components.find((c: any) =>
      nameMatches.some((m) => c.name?.toLowerCase().includes(m.toLowerCase()))
    );
    return comp && typeof comp.amount === "number" ? comp.amount : 0;
  };

  const monthSlips = (salarySlips || []).filter((s) => s.month === selectedMonth);
  const activeEmployees = employees.filter((e) => e.status === "Active");

  // Consume processed payroll metrics for selected month rather than fabricating from raw employee.salary
  const monthlyPayroll = monthSlips.reduce((sum, s) => sum + (s.gross || 0), 0);
  const annualPayroll = monthlyPayroll * 12;
  const depts = Array.from(new Set(employees.map((e) => e.department)));

  const generate = (name: string, kind: string) => {
    if (monthSlips.length === 0) {
      toast(`No processed payroll data available for ${selectedMonth}. Please process payroll first.`, "error");
      return;
    }

    let headers: string[] = [];
    let rows: any[][] = [];

    if (name === "PF Returns (ECR)") {
      headers = [
        "UAN",
        "Member Name",
        "Gross Wages",
        "EPF Wages",
        "EPS Wages",
        "EDLI Wages",
        "EPF Contrib Remitted (12%)",
        "EPS Contrib (8.33%)",
        "EPF EPS Diff (3.67%)",
        "NCP Days",
        "Refund of Advances",
      ];
      monthSlips.forEach((slip) => {
        const emp = employees.find((e) => e.id === slip.employeeId);
        if (!emp || !emp.uan) return;

        // Authoritative PF contribution snapshot from backend calculation engine
        const epfContrib = getComponentAmount(slip, ["provident fund", "pf"]);
        const basicPercentage = slip.adjustments?.basicPercentage || 50;
        const epfWage = slip.basicSalary ?? Math.round(slip.gross * (basicPercentage / 100));
        const epsWage = Math.min(15000, epfWage);
        const epsContrib = Math.min(1250, Math.round(epsWage * 0.0833));
        const epfDiff = Math.max(0, epfContrib - epsContrib);

        rows.push([
          emp.uan,
          slip.employeeName,
          slip.gross,
          epfWage,
          epsWage,
          epfWage,
          epfContrib,
          epsContrib,
          epfDiff,
          slip.lopDays || 0,
          0,
        ]);
      });
    } else if (name === "ESI Returns") {
      headers = [
        "IP Number (ESIC)",
        "IP Name",
        "No of Days Worked",
        "Total Monthly Wages",
        "Reason Code",
        "Last Working Day",
      ];
      monthSlips.forEach((slip) => {
        const emp = employees.find((e) => e.id === slip.employeeId);
        if (!emp || !emp.esic) return;
        const esiContrib = getComponentAmount(slip, ["esi", "employee state insurance"]);
        if (esiContrib <= 0 && slip.gross > 21000) return;

        const workingDays = slip.lopDivisor || 30;
        const daysWorked = slip.adjustments?.presentDays ?? Math.max(0, workingDays - (slip.lopDays || 0));
        rows.push([emp.esic, slip.employeeName, daysWorked, slip.gross, 0, ""]);
      });
    } else if (name === "TDS Returns (Form 24Q)") {
      headers = [
        "PAN",
        "Employee Name",
        "Gross Salary",
        "Exemptions",
        "Net Taxable",
        "TDS Deducted",
      ];
      monthSlips.forEach((slip) => {
        const emp = employees.find((e) => e.id === slip.employeeId);
        if (!emp || !emp.pan) return;
        const tds = getComponentAmount(slip, ["tds", "tax deducted at source"]);
        const approvedDeductions = slip.adjustments?.approvedTaxDeductions || 0;
        const annualGross = Math.round(slip.gross * 12);
        const netTaxable = Math.max(0, annualGross - approvedDeductions);

        if (tds > 0 || approvedDeductions > 0) {
          rows.push([emp.pan, slip.employeeName, slip.gross, approvedDeductions, netTaxable, tds]);
        }
      });
    } else if (name === "Bank Transfer File") {
      headers = ["Account Name", "Bank Name", "Account Number", "IFSC", "Transfer Amount"];
      monthSlips.forEach((slip) => {
        const emp = employees.find((e) => e.id === slip.employeeId);
        if (!emp) return;
        const bankName = emp.bankName || (emp as any).bankName;
        const accNo = emp.accountNumber || (emp as any).accountNo;
        const ifsc = emp.ifscCode || (emp as any).ifsc;

        if (!accNo || !ifsc || accNo === "N/A" || ifsc === "N/A") {
          // Fail safely when bank credentials are missing: exclude from transfer file instead of fabricating fake credentials
          return;
        }

        rows.push([
          slip.employeeName,
          bankName || "Not Configured",
          accNo,
          ifsc,
          slip.net,
        ]);
      });
    } else if (name === "CTC Breakup Report") {
      headers = [
        "Employee ID",
        "Employee Name",
        "Gross",
        "PF (Employer)",
        "ESI (Employer)",
        "Total CTC",
      ];
      monthSlips.forEach((slip) => {
        const emp = employees.find((e) => e.id === slip.employeeId);
        if (!emp) return;
        const pf = getComponentAmount(slip, ["employer pf"]) || getComponentAmount(slip, ["provident fund", "pf"]);
        const esi = getComponentAmount(slip, ["employer esi"]) || (getComponentAmount(slip, ["esi"]) > 0 ? Math.round(slip.gross * 0.0325) : 0);
        const ctc = slip.gross + pf + esi;
        rows.push([slip.employeeId, slip.employeeName, slip.gross, pf, esi, ctc]);
      });
    } else {
      headers = ["Employee ID", "Employee Name", "Gross", "Deductions", "Net Pay"];
      monthSlips.forEach((slip) =>
        rows.push([slip.employeeId, slip.employeeName, slip.gross, slip.deductions, slip.net]),
      );
    }

    if (rows.length === 0) {
      toast(`No reportable records found for ${name} in ${selectedMonth}.`, "info");
      return;
    }

    if (kind === "PDF") {
      const tableHtml = `<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      const html = `<html><head><title>${escapeHtml(name)}</title><style>body{font-family:-apple-system,sans-serif;padding:40px;color:#333}h1{color:#7c3aed;margin-bottom:5px}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}th,td{border:1px solid #e5e7eb;padding:10px;text-align:left}th{background:#f9fafb;text-transform:uppercase;color:#6b7280}.footer{margin-top:30px;font-size:10px;color:#9ca3af;text-align:center}</style></head><body><h1>${escapeHtml(name)}</h1><p style="color:#6b7280;margin:0">Payroll Cycle: ${escapeHtml(selectedMonth)} | Generated: ${escapeHtml(new Date().toLocaleString())}</p>${tableHtml}<div class="footer">Confidential System Generated Report - Not for external distribution.</div><script>window.onload=()=>window.print()</script></body></html>`;
      printHTML(html);
    } else {
      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      downloadCSV(
        `${name.toLowerCase().replace(/\s+/g, "_")}_${selectedMonth.replace(" ", "_")}.csv`,
        csvContent,
      );
    }
  };
  return (
    <div>
      <PageHeader
        title="Payroll Reports"
        subtitle="Statutory returns, bank transfers, and payroll analytics."
        action={
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-medium shadow-sm outline-none"
          >
            {months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        }
      />

      {monthSlips.length === 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="font-semibold">No Processed Payroll Data</div>
          <div>No processed payroll records exist for {selectedMonth}. Reports require a completed batch payroll run.</div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        {[
          {
            label: "Monthly Payroll",
            value: `₹${monthlyPayroll.toLocaleString()}`,
            tone: "indigo" as BadgeTone,
          },
          {
            label: "Annual Payroll",
            value: `₹${annualPayroll.toLocaleString()}`,
            tone: "sky" as BadgeTone,
          },
          {
            label: "Active Employees",
            value: String(activeEmployees.length),
            tone: "green" as BadgeTone,
          },
        ].map((s) => (
          <Card key={s.label} className="!p-4">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <Badge tone={s.tone}>{s.label.split(" ")[0]}</Badge>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {[
          {
            name: "Monthly Payroll Register",
            desc: "Complete salary disbursement for the current month",
          },
          { name: "PF Returns (ECR)", desc: "Employee contribution summary for EPFO filing" },
          { name: "ESI Returns", desc: "Employee State Insurance contribution report" },
          { name: "TDS Returns (Form 24Q)", desc: "Tax deduction at source quarterly filing" },
          { name: "Bank Transfer File", desc: "NEFT/RTGS transfer list for payroll disbursement" },
          { name: "CTC Breakup Report", desc: "Full cost-to-company breakup per employee" },
        ].map((r) => (
          <Card key={r.name}>
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg btn-gradient shrink-0">
                <PieChart className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm">{r.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{r.desc}</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Btn variant="outline" size="sm" onClick={() => generate(r.name, "PDF")}>
                <Download className="h-4 w-4" /> PDF
              </Btn>
              <Btn variant="outline" size="sm" onClick={() => generate(r.name, "Excel")}>
                <Download className="h-4 w-4" /> Excel
              </Btn>
            </div>
          </Card>
        ))}
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="border-b border-border px-4 py-3 text-sm font-bold">
          Department-wise Payroll Cost ({selectedMonth})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Headcount</th>
                <th className="px-4 py-3">Annual Payroll</th>
                <th className="px-4 py-3">Monthly Payroll</th>
              </tr>
            </thead>
            <tbody>
              {depts.map((dept) => {
                const emps = employees.filter((e) => e.department === dept && e.status === "Active");
                const deptSlips = monthSlips.filter((s) => {
                  const emp = employees.find((e) => e.id === s.employeeId);
                  return emp && emp.department === dept;
                });
                const departmentMonthlyPayroll = deptSlips.reduce((sum, s) => sum + (s.gross || 0), 0);
                const departmentAnnualPayroll = departmentMonthlyPayroll * 12;
                return (
                  <tr key={dept} className="border-b border-border/60">
                    <td className="px-4 py-3 font-semibold">{dept}</td>
                    <td className="px-4 py-3">{emps.length}</td>
                    <td className="px-4 py-3">₹{departmentAnnualPayroll.toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold">
                      ₹{departmentMonthlyPayroll.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function PayrollInputsPage({
  toast,
}: {
  toast: (m: string, tone?: "success" | "error" | "info") => void;
}) {
  const [selectedMonth, setSelectedMonth] = useState("2026-07");
  const { data: employeesData, employees: employeesProp, isLoading: employeesLoading } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data) ? (employeesData as any).data : (Array.isArray(employeesProp) ? employeesProp : [])));
  const { records: attendanceRecords = [] } = useAttendanceQuery();

  const {
    data: inputsData,
    isLoading: inputsLoading,
    isError: inputsError,
    refetch: refetchInputs,
  } = usePayrollInputsQuery(selectedMonth);

  const { updatePayrollInput } = usePayrollInputsMutations();

  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All");
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    LOPDays: 0,
    overtimeHours: 0,
    bonus: 0,
    deductions: 0,
    remarks: "",
  });

  const depts = ["All", ...Array.from(new Set(employees.map((e) => e.department)))];

  const filtered = employees.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.id.toLowerCase().includes(search.toLowerCase());
    const matchesDept = dept === "All" || e.department === dept;
    return matchesSearch && matchesDept;
  });

  const getInputs = (empId: string) => {
    const found = (inputsData || []).find((inp: any) => inp.employeeId === empId);
    if (found) {
      return {
        LOPDays: found.lopDays ?? 0,
        overtimeHours: found.overtimeHours ?? 0,
        bonus: found.bonus ?? 0,
        deductions: found.deductions ?? 0,
        remarks: found.remarks || "",
      };
    }
    return { LOPDays: 0, overtimeHours: 0, bonus: 0, deductions: 0, remarks: "" };
  };

  const getCalculatedLop = (empId: string) => {
    let count = 0;
    const records = attendanceRecords.filter(
      (r) => r.employeeId === empId && r.date.startsWith(selectedMonth),
    );
    records.forEach((r) => {
      if (r.status === "Absent") count += 1;
      else if (r.status === "Half Day") count += 0.5;
    });
    return count;
  };

  const startEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setForm(getInputs(emp.id));
  };

  const save = async () => {
    if (!editingEmp) return;

    if (form.LOPDays < 0 || form.overtimeHours < 0 || form.bonus < 0 || form.deductions < 0) {
      toast("Input values cannot be negative.", "error");
      return;
    }

    setIsSaving(true);
    try {
      await updatePayrollInput.mutateAsync({
        employeeId: editingEmp.id,
        payload: {
          month: selectedMonth,
          lopDays: Number(form.LOPDays),
          overtimeHours: Number(form.overtimeHours),
          bonus: Number(form.bonus),
          deductions: Number(form.deductions),
          remarks: form.remarks,
        },
      });
      toast(`Payroll inputs saved successfully for ${editingEmp.name}`, "success");
      setEditingEmp(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to save payroll inputs";
      toast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = employeesLoading || inputsLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Inputs Coordination"
        subtitle="Set loss of pay days, overtime hours, bonuses, and special deductions before generation."
      />

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 flex-1 w-full max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputCls + " pl-9"}
              placeholder="Search by name or ID..."
            />
          </div>
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-medium outline-none"
          >
            {depts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-medium outline-none"
            />
          </div>
          <Btn variant="outline" size="sm" onClick={() => refetchInputs()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Btn>
        </div>
      </div>

      {inputsError && (
        <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Failed to load persisted payroll inputs from server.</span>
          </div>
          <Btn variant="outline" size="sm" onClick={() => refetchInputs()}>
            Retry
          </Btn>
        </div>
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading payroll inputs...</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Unpaid Leaves</th>
                  <th className="px-4 py-3">LOP Days (Override)</th>
                  <th className="px-4 py-3">Overtime Hours</th>
                  <th className="px-4 py-3">Bonus</th>
                  <th className="px-4 py-3">Deductions</th>
                  <th className="px-4 py-3">Remarks</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const inp = getInputs(e.id);
                  const calcLop = getCalculatedLop(e.id);
                  return (
                    <tr key={e.id} className="border-b border-border/60 hover:bg-muted/10 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{e.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {e.designation} | {e.department}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {calcLop > 0 ? (
                          <Badge tone="rose">
                            {calcLop} Day{calcLop !== 1 ? "s" : ""}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {inp.LOPDays > 0 ? (
                          <span className="text-amber-600 font-semibold">
                            {inp.LOPDays} Day{inp.LOPDays !== 1 ? "s" : ""} (Manual)
                          </span>
                        ) : calcLop > 0 ? (
                          <span className="text-muted-foreground">
                            {calcLop} Day{calcLop !== 1 ? "s" : ""} (Auto)
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {inp.overtimeHours > 0 ? `${inp.overtimeHours} hrs` : "-"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-600">
                        {inp.bonus > 0 ? `₹${inp.bonus.toLocaleString()}` : "-"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-destructive">
                        {inp.deductions > 0 ? `-₹${inp.deductions.toLocaleString()}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[150px] truncate text-muted-foreground">
                        {inp.remarks || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Btn variant="outline" size="sm" onClick={() => startEdit(e)}>
                          <Edit3 className="h-4 w-4" /> Edit
                        </Btn>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground text-sm">
                      No employees found matching the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {editingEmp && (
        <ModalShell
          title={`Edit Payroll Inputs - ${editingEmp.name}`}
          onClose={() => setEditingEmp(null)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs bg-muted/40 p-3 rounded-lg border border-border mb-2">
              <div>
                <span className="text-muted-foreground">Department:</span>{" "}
                <span className="font-semibold">{editingEmp.department}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Base Salary:</span>{" "}
                <span className="font-semibold">₹{(editingEmp.salary || 0).toLocaleString()}/mo</span>
              </div>
              <div>
                <span className="text-muted-foreground">Attendance LOP:</span>{" "}
                <span className="font-semibold">{getCalculatedLop(editingEmp.id)} Day(s)</span>
              </div>
              <div>
                <span className="text-muted-foreground">Month:</span>{" "}
                <span className="font-semibold">{selectedMonth}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="Manual LOP Days Override"
                error={form.LOPDays < 0 ? "Cannot be negative" : ""}
              >
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.LOPDays}
                  onChange={(e) => setForm({ ...form, LOPDays: Number(e.target.value) })}
                  className={inputCls}
                  placeholder="e.g. 1.5"
                />
              </Field>
              <Field label="Overtime Hours">
                <input
                  type="number"
                  min="0"
                  value={form.overtimeHours}
                  onChange={(e) => setForm({ ...form, overtimeHours: Number(e.target.value) })}
                  className={inputCls}
                  placeholder="e.g. 8"
                />
              </Field>
              <Field label="Bonus / Incentives (₹)">
                <input
                  type="number"
                  min="0"
                  value={form.bonus}
                  onChange={(e) => setForm({ ...form, bonus: Number(e.target.value) })}
                  className={inputCls}
                  placeholder="e.g. 5000"
                />
              </Field>
              <Field label="Extra Deductions (₹)">
                <input
                  type="number"
                  min="0"
                  value={form.deductions}
                  onChange={(e) => setForm({ ...form, deductions: Number(e.target.value) })}
                  className={inputCls}
                  placeholder="e.g. 1000"
                />
              </Field>
              <Field label="Remarks / Adjustment Reason" className="md:col-span-2">
                <textarea
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  className={inputCls + " min-h-[60px] py-2"}
                  placeholder="Reason for adjustments..."
                />
              </Field>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setEditingEmp(null)} disabled={isSaving}>
              Cancel
            </Btn>
            <Btn onClick={save} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Save Inputs
                </>
              )}
            </Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
