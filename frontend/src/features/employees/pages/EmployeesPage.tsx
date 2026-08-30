import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Filter, Search, Download, Eye, Edit3, Mail, Trash2 } from "lucide-react";
import { hasPermission, PERMISSIONS } from "../../../auth";
import {
  PageHeader,
  Card,
  Btn,
  Badge,
  Avatar,
  Field,
  ReadOnlyBanner,
  ModalShell,
  inputCls,
} from "../../../components/ui";
import { useClickOutside } from "../../../hooks";
import { BulkOnboardingWizard } from "../components/BulkOnboardingWizard";
import { OrgChartView } from "../components/OrgChartView";
import type { Employee, Department, Designation } from "../../../types";
import { useEmployeesStore } from "../../../store";
import { useEmployeesQuery, useOrgChartQuery } from "../../../hooks/useEmployeesQuery";
import {
  useDepartmentsQuery,
  useDesignationsQuery,
  useOrgMutations,
} from "../../../hooks/useOrgQuery";
import { removeEmployee, saveEmployee } from "../../../store/actions/employeeActions";
import { PaginationControls } from "../../../components/ui/PaginationControls";

function DepartmentsPage({
  employees,
  departments,
  createDepartment,
  deleteDepartment,
  canEdit,
  toast,
  triggerConfirm,
}: {
  employees: Employee[];
  departments: Department[];
  createDepartment: (name: string, head?: string) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
  canEdit: boolean;
  toast: (m: string, tone?: "success" | "error" | "info") => void;
  triggerConfirm: (msg: string, fn: () => void, title?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [head, setHead] = useState(employees[0]?.name || "");
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createDepartment(name.trim(), head);
      toast("Department created");
      setOpen(false);
      setName("");
    } catch (err: any) {
      toast(err.message || "Failed to create department", "error");
    } finally {
      setLoading(false);
    }
  };
  const deleteDept = (dept: Department) => {
    triggerConfirm(
      `Delete department "${dept.name}"? This action cannot be undone.`,
      async () => {
        setLoading(true);
        try {
          await deleteDepartment(dept.id || dept.name);
          toast(`Department "${dept.name}" deleted`);
        } catch (err: any) {
          toast(err.message || "Failed to delete department", "error");
        } finally {
          setLoading(false);
        }
      },
      "Delete Department",
    );
  };
  const selectedDeptEmployees = selectedDept
    ? employees.filter((e) => e.department === selectedDept)
    : [];
  return (
    <div>
      {!canEdit && <ReadOnlyBanner />}
      <PageHeader
        title="Departments"
        subtitle="Click a department to view its members."
        action={
          canEdit && (
            <Btn onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Department
            </Btn>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => {
          const deptEmps = employees.filter((e) => e.department === d.name);
          return (
            <Card key={d.name} className="cursor-pointer hover:border-primary/50 transition-all">
              <div className="flex items-start justify-between">
                <button className="flex-1 text-left" onClick={() => setSelectedDept(d.name)}>
                  <div className="text-lg font-bold">{d.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Head: {d.head}</div>
                </button>
                <div className="flex items-center gap-2">
                  <Badge tone="indigo">{deptEmps.length} members</Badge>
                  {canEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDept(d);
                      }}
                      title="Delete department"
                      className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <button className="mt-4 w-full text-left" onClick={() => setSelectedDept(d.name)}>
                <div className="flex -space-x-2 mb-3">
                  {deptEmps.slice(0, 4).map((e) => (
                    <div key={e.id} className="ring-2 ring-[color:var(--color-card)] rounded-full">
                      <Avatar src={e.avatar} name={e.name} size={30} />
                    </div>
                  ))}
                  {deptEmps.length > 4 && (
                    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-muted text-[10px] font-bold ring-2 ring-[color:var(--color-card)]">
                      +{deptEmps.length - 4}
                    </div>
                  )}
                </div>
                {deptEmps.length > 0 && (
                  <div className="text-xs text-primary font-semibold hover:underline">
                    View all members →
                  </div>
                )}
              </button>
            </Card>
          );
        })}
      </div>
      {open && (
        <ModalShell title="New Department" onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <Field label="Department Name *">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="e.g. Product"
              />
            </Field>
            <Field label="Department Head">
              <select value={head} onChange={(e) => setHead(e.target.value)} className={inputCls}>
                {employees.map((x) => (
                  <option key={x.id}>{x.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
            <Btn onClick={save}>Create</Btn>
          </div>
        </ModalShell>
      )}
      {selectedDept && (
        <ModalShell
          title={`${selectedDept} — Team Members`}
          onClose={() => setSelectedDept(null)}
          wide
        >
          <div className="space-y-1">
            {selectedDeptEmployees.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                No employees in this department.
              </div>
            )}
            {selectedDeptEmployees.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-muted/40 transition"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={e.avatar} name={e.name} size={36} />
                  <div>
                    <div className="font-semibold text-sm">{e.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.designation} · {e.id}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground hidden sm:block">{e.email}</span>
                  <Badge
                    tone={
                      e.status === "Active" ? "green" : e.status === "On Leave" ? "amber" : "slate"
                    }
                  >
                    {e.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between items-center pt-4 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {selectedDeptEmployees.length} member{selectedDeptEmployees.length !== 1 ? "s" : ""}{" "}
              total
            </span>
            <Btn variant="outline" onClick={() => setSelectedDept(null)}>
              Close
            </Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function DesignationsPage({
  employees,
  designations,
  createDesignation,
  deleteDesignation,
  canEdit,
  toast,
  triggerConfirm,
}: {
  employees: Employee[];
  designations: Designation[];
  createDesignation: (name: string, band: string) => Promise<void>;
  deleteDesignation: (id: string) => Promise<void>;
  canEdit: boolean;
  toast: (m: string, tone?: "success" | "error" | "info") => void;
  triggerConfirm: (msg: string, fn: () => void, title?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [band, setBand] = useState("L3");
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createDesignation(name.trim(), band);
      toast("Designation created");
      setOpen(false);
      setName("");
      setBand("L3");
    } catch (err: any) {
      toast(err.message || "Failed to create designation", "error");
    } finally {
      setLoading(false);
    }
  };
  const deleteDesig = (desig: Designation) => {
    triggerConfirm(
      `Delete designation "${desig.name}"? This cannot be undone.`,
      async () => {
        setLoading(true);
        try {
          await deleteDesignation(desig.id || desig.name);
          toast(`Designation "${desig.name}" deleted`);
        } catch (err: any) {
          toast(err.message || "Failed to delete designation", "error");
        } finally {
          setLoading(false);
        }
      },
      "Delete Designation",
    );
  };
  return (
    <div>
      {!canEdit && <ReadOnlyBanner />}
      <PageHeader
        title="Designations"
        subtitle="Job titles and role levels."
        action={
          canEdit && (
            <Btn onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Designation
            </Btn>
          )
        }
      />
      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Band</th>
              <th className="px-4 py-3">Holders</th>
              <th className="px-4 py-3">Avg Monthly Salary</th>
              {canEdit && <th className="px-4 py-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {designations.map((d) => {
              const holders = employees.filter((e) => e.designation === d.name);
              const avg = holders.length
                ? Math.round(holders.reduce((a, b) => a + (b.salary || 0), 0) / holders.length)
                : 0;
              return (
                <tr key={d.name} className="border-b border-border/60">
                  <td className="px-4 py-3 font-semibold">{d.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone="sky">{d.band}</Badge>
                  </td>
                  <td className="px-4 py-3">{holders.length}</td>
                  <td className="px-4 py-3">₹{avg.toLocaleString("en-IN")}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteDesig(d)}
                        title="Delete"
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive ml-auto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {open && (
        <ModalShell title="New Designation" onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <Field label="Title *">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="e.g. Staff Engineer"
              />
            </Field>
            <Field label="Band">
              <select value={band} onChange={(e) => setBand(e.target.value)} className={inputCls}>
                {["L1", "L2", "L3", "L4", "L5", "L6", "L7"].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
            <Btn onClick={save}>Create</Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function OrgChartContainer({ departments }: { departments: Department[] }) {
  const { data: orgEmployees = [], isLoading } = useOrgChartQuery();
  if (isLoading)
    return <div className="p-8 text-center text-muted-foreground">Loading Org Chart...</div>;
  return <OrgChartView employees={orgEmployees} departments={departments} />;
}

export function EmployeesPage(p: {
  sub: string;
  user: any;
  toast: any;
  triggerConfirm: any;
  onAddEmployee: () => void;
  onEditEmployee: (e: Employee) => void;
  onMessageEmployee: (e: Employee) => void;
  onView: (e: Employee) => void;
  setActive: (id: string) => void;
  searchParams?: { page: number; search: string; department: string; status: string };
}) {
  const {
    sub,
    onAddEmployee,
    onEditEmployee,
    onMessageEmployee,
    onView,
    user,
    toast,
    triggerConfirm,
  } = p;

  const canView = hasPermission(user, PERMISSIONS.EMPLOYEES_LIST_VIEW);
  const canCreate = hasPermission(user, PERMISSIONS.EMPLOYEES_LIST_CREATE);
  const canEdit = hasPermission(user, PERMISSIONS.EMPLOYEES_LIST_EDIT);
  const canDelete = hasPermission(user, PERMISSIONS.EMPLOYEES_LIST_DELETE);
  const canExport = hasPermission(user, PERMISSIONS.EMPLOYEES_LIST_EXPORT);
  const canViewSalary =
    ["SuperAdmin", "CompanyOwner", "HRAdmin", "Accountant"].includes(user.role) ||
    hasPermission(user, PERMISSIONS.EMPLOYEES_SALARY_VIEW) ||
    hasPermission(user, "employees:salary:view") ||
    hasPermission(user, PERMISSIONS.PAYROLL_PROCESS_VIEW) ||
    hasPermission(user, "payroll:process:view");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [q, setQ] = useState(p.searchParams?.search || "");
  const [debouncedQ, setDebouncedQ] = useState(p.searchParams?.search || "");
  const [dept, setDept] = useState(p.searchParams?.department || "All");
  const [status, setStatus] = useState<"All" | Employee["status"]>(
    (p.searchParams?.status as any) || "All",
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useClickOutside<HTMLDivElement>(() => setFilterOpen(false));

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  // Reset page to 1 on filter or search change
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, dept, status]);

  const {
    employees = [],
    total = 0,
    totalPages = 0,
    isLoading: isEmployeesLoading,
  } = useEmployeesQuery({
    page,
    limit: pageSize,
    search: debouncedQ.trim() || undefined,
    department: dept === "All" ? undefined : dept,
    status: status === "All" ? undefined : status,
  });

  const { data: departments = [] } = useDepartmentsQuery();
  const { data: designations = [] } = useDesignationsQuery();
  const {
    createDepartment: createDeptMutation,
    deleteDepartment: deleteDeptMutation,
    createDesignation: createDesigMutation,
    deleteDesignation: deleteDesigMutation,
  } = useOrgMutations();

  const createDepartment = async (name: string, head?: string) => {
    await createDeptMutation.mutateAsync({ name, head });
  };
  const deleteDepartment = async (id: string) => {
    await deleteDeptMutation.mutateAsync(id);
  };
  const createDesignation = async (name: string, band: string) => {
    await createDesigMutation.mutateAsync({ name, band });
  };
  const deleteDesignation = async (id: string) => {
    await deleteDesigMutation.mutateAsync(id);
  };
  const selfEmp = employees.find((e) => e.name === user.name);
  const scopeToTeam = user.role === "Manager";
  const visibleEmployees = scopeToTeam
    ? employees.filter(
        (e) => e.department === user.department || (selfEmp && e.managerId === selfEmp.id),
      )
    : employees;

  const navigate = useNavigate();

  useEffect(() => {
    navigate({
      search: ((prev: any) => ({
        ...prev,
        search: q || undefined,
        department: dept === "All" ? undefined : dept,
        status: status === "All" ? undefined : status,
      })) as any,
      replace: true,
    });
  }, [q, dept, status, navigate]);

  if (sub === "employees.departments")
    return (
      <DepartmentsPage
        employees={visibleEmployees}
        departments={departments}
        createDepartment={createDepartment}
        deleteDepartment={deleteDepartment}
        canEdit={canEdit}
        toast={toast}
        triggerConfirm={triggerConfirm}
      />
    );
  if (sub === "employees.designations")
    return (
      <DesignationsPage
        employees={visibleEmployees}
        designations={designations}
        createDesignation={createDesignation}
        deleteDesignation={deleteDesignation}
        canEdit={canEdit}
        toast={toast}
        triggerConfirm={triggerConfirm}
      />
    );
  if (sub === "employees.onboarding")
    return (
      <BulkOnboardingWizard
        onClose={() => p.setActive("employees.list")}
        toast={toast}
      />
    );
  if (sub === "employees.orgchart")
    return <OrgChartContainer departments={departments} />;

  const filtered = visibleEmployees;

  const exportCSV = () => {
    const header = [
      "ID",
      "Name",
      "Email",
      "Department",
      "Designation",
      "Status",
      "Joined",
      ...(canViewSalary ? ["Monthly Salary"] : []),
    ];
    const rows = filtered.map((e) => [
      e.id,
      e.name,
      e.email,
      e.department,
      e.designation,
      e.status,
      e.joined,
      ...(canViewSalary ? [e.salary] : []),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("Employee list exported");
  };

  return (
    <div>
      {!canEdit && <ReadOnlyBanner />}
      <PageHeader
        title={scopeToTeam ? `My Team - ${user.department}` : "Employees"}
        subtitle={`${total} ${scopeToTeam ? "team members" : "total employees"}`}
        action={
          <>
            <div ref={filterRef} className="relative">
              <Btn variant="outline" onClick={() => setFilterOpen((o) => !o)}>
                <Filter className="h-4 w-4" /> Filter
                {(dept !== "All" || status !== "All") && (
                  <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Btn>
              {filterOpen && (
                <div className="absolute right-0 top-11 z-20 w-64 rounded-xl border border-border bg-popover p-4 shadow-xl animate-in slide-in-from-top-2 fade-in duration-150">
                  <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
                    Filters
                  </div>
                  <div className="space-y-3">
                    <Field label="Department">
                      <select
                        aria-label="Department Filter"
                        value={dept}
                        onChange={(e) => setDept(e.target.value)}
                        className={inputCls}
                      >
                        <option>All</option>
                        {departments.map((d) => (
                          <option key={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select
                        aria-label="Status Filter"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className={inputCls}
                      >
                        <option>All</option>
                        <option>Active</option>
                        <option>On Leave</option>
                        <option>Inactive</option>
                      </select>
                    </Field>
                  </div>
                  <div className="mt-4 flex justify-between">
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDept("All");
                        setStatus("All");
                      }}
                    >
                      Reset
                    </Btn>
                    <Btn size="sm" onClick={() => setFilterOpen(false)}>
                      Apply
                    </Btn>
                  </div>
                </div>
              )}
            </div>
            {canExport && (
              <Btn variant="outline" onClick={exportCSV}>
                <Download className="h-4 w-4" /> Export
              </Btn>
            )}
            {canCreate && (
              <Btn onClick={onAddEmployee}>
                <Plus className="h-4 w-4" /> Add Employee
              </Btn>
            )}
          </>
        }
      />
      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email…"
              className={inputCls + " pl-9"}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Designation</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                {canViewSalary && (
                  <th className="px-4 py-3 font-semibold">Monthly Salary</th>
                )}
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border/60 transition-colors hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={e.avatar} name={e.name} />
                      <div>
                        <div className="font-semibold">{e.name}</div>
                        <div className="text-xs text-muted-foreground">{e.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{e.department}</td>
                  <td className="px-4 py-3">{e.designation}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.joined}</td>
                  {canViewSalary && (
                    <td className="px-4 py-3 font-semibold">
                      {e.salary !== null && e.salary !== undefined
                        ? `₹${Number(e.salary).toLocaleString("en-IN")}`
                        : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        e.status === "Active"
                          ? "green"
                          : e.status === "On Leave"
                            ? "amber"
                            : "slate"
                      }
                    >
                      {e.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canView && (
                        <button
                          onClick={() => onView(e)}
                          title="View"
                          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => onEditEmployee(e)}
                          title="Edit"
                          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-[color:var(--color-warning)]/15 hover:text-[color:var(--color-warning)]"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => onMessageEmployee(e)}
                          title="Message"
                          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-[color:var(--color-info)]/15 hover:text-[color:var(--color-info)]"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() =>
                            triggerConfirm(
                              `Remove ${e.name} from the system?`,
                              () => removeEmployee(e.id, { push: toast }),
                              "Remove Employee",
                            )
                          }
                          title="Delete"
                          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-sm text-muted-foreground">
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-4 py-2">
          <PaginationControls
            page={page}
            limit={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={(newPage) => setPage(newPage)}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            isLoading={isEmployeesLoading}
          />
        </div>
      </Card>
    </div>
  );
}
