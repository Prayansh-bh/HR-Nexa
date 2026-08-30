import React, { useState } from "react";
import {
  Layers,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Edit3,
  Copy,
  RefreshCw,
  Sliders,
  Cpu,
  ShieldCheck,
  Box,
  History,
  Search,
  Filter,
  BookOpen,
  Sparkles,
  Tag,
  DollarSign,
  Users,
  HardDrive,
  GitBranch,
  Key,
  Activity,
  Check,
  Archive,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import {
  Badge,
  PageHeader,
  cardCls,
  btnCls,
  inputCls,
} from "../../../components/ui/DashboardPrimitives";
import {
  plansService,
  SaaSPlan,
  FeatureCategory,
  FeatureItem,
  AddOn,
  PlanDashboardStats,
} from "../../../services/plans.service";
import { usePlansQuery, usePlanMutations } from "../../../hooks/usePlansQuery";

type TabId = "dashboard" | "plans" | "library" | "builder" | "addons" | "assignments" | "audit";

const MODULE_COLORS: Record<string, string> = {
  CORE: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  ATTENDANCE: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  PAYROLL: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  ENTERPRISE: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

export function PlanManagementPage({ toast }: { toast?: any }) {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const { plans, stats, library, addOns, auditLogs, isLoadingPlans, isFetchingPlans } =
    usePlansQuery();
  const mutations = usePlanMutations();

  // Search & Filters (Default to Published, with All, Draft, and Archived selectable)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Published");

  // Lifecycle Action Modal state (Archive, Restore, Permanent Delete, Delete Draft)
  const [lifecycleModal, setLifecycleModal] = useState<{
    action: "archive" | "restore" | "permanent_delete" | "delete_draft";
    plan: SaaSPlan;
  } | null>(null);
  const [isPerformingLifecycle, setIsPerformingLifecycle] = useState(false);

  // Edit Plan modal state (All fields configurable)
  const [showEditPlan, setShowEditPlan] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState("");
  const [editingMonthlyPrice, setEditingMonthlyPrice] = useState<number>(0);
  const [editingYearlyPrice, setEditingYearlyPrice] = useState<number>(0);
  const [editingSeats, setEditingSeats] = useState<number>(50);
  const [editingStorageGB, setEditingStorageGB] = useState<number>(10);
  const [editingStatus, setEditingStatus] = useState<string>("Published");
  const [editingFeatures, setEditingFeatures] = useState<{ name: string; enabled: boolean }[]>([]);

  // Build New Plan modal state (All fields configurable)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanCode, setNewPlanCode] = useState("");
  const [newPlanMonthlyPrice, setNewPlanMonthlyPrice] = useState<number>(10000);
  const [newPlanYearlyPrice, setNewPlanYearlyPrice] = useState<number>(120000);
  const [newPlanSeats, setNewPlanSeats] = useState<number>(50);
  const [newPlanStorageGB, setNewPlanStorageGB] = useState<number>(20);
  const [newPlanStatus, setNewPlanStatus] = useState<string>("Published");
  const [newPlanDescription, setNewPlanDescription] = useState("");
  const [newPlanFeatures, setNewPlanFeatures] = useState<{ name: string; enabled: boolean }[]>([]);

  // Feature & AddOn Modal states
  const [showAddFeatureModal, setShowAddFeatureModal] = useState(false);
  const [featName, setFeatName] = useState("");
  const [featKey, setFeatKey] = useState("");
  const [featModule, setFeatModule] = useState("CORE");

  const [showAddAddOnModal, setShowAddAddOnModal] = useState(false);
  const [addOnName, setAddOnName] = useState("");
  const [addOnPrice, setAddOnPrice] = useState<number>(1000);
  const [addOnCycle, setAddOnCycle] = useState("Monthly");

  const systemFeatures = library.features || [];

  // Build full feature list with toggle states from current system feature library
  const getFullFeaturesForPlan = (plan: SaaSPlan) => {
    const planFeatureMap = new Map(
      (plan.features || []).map((f) => [f.name.toLowerCase(), f.enabled]),
    );
    if (systemFeatures.length > 0) {
      return systemFeatures.map((sf) => ({
        name: sf.name,
        enabled: planFeatureMap.get(sf.name.toLowerCase()) ?? false,
      }));
    }
    return plan.features || [];
  };

  const handleOpenEdit = (plan: SaaSPlan) => {
    setShowEditPlan(plan.name);
    setEditingCode(plan.code || `PLAN_${plan.name.toUpperCase()}`);
    setEditingMonthlyPrice(plan.monthlyPrice || 0);
    setEditingYearlyPrice(plan.yearlyPrice || (plan.monthlyPrice ? plan.monthlyPrice * 12 : 0));
    setEditingSeats(plan.employeeLimit ?? 50);
    setEditingStorageGB(plan.storageLimitGB ?? 10);
    setEditingStatus(plan.status || "Published");
    setEditingFeatures(getFullFeaturesForPlan(plan));
  };

  const handleSavePlanSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditPlan) return;
    try {
      await mutations.updatePlan.mutateAsync({
        name: showEditPlan,
        payload: {
          code: editingCode,
          monthlyPrice: editingMonthlyPrice,
          yearlyPrice: editingYearlyPrice,
          employeeLimit: editingSeats,
          storageLimitGB: editingStorageGB,
          status: editingStatus,
          features: editingFeatures,
        },
      });
      toast?.(`Plan "${showEditPlan}" updated successfully`, "success");
      setShowEditPlan(null);
    } catch (err: any) {
      toast?.(err.message || "Failed to update plan", "error");
    }
  };

  const handleOpenCreateModal = () => {
    setNewPlanName("");
    setNewPlanCode("");
    setNewPlanMonthlyPrice(10000);
    setNewPlanYearlyPrice(120000);
    setNewPlanSeats(50);
    setNewPlanStorageGB(20);
    setNewPlanStatus("Published");
    setNewPlanDescription("");

    const allFeats =
      systemFeatures.length > 0
        ? systemFeatures.map((sf) => ({ name: sf.name, enabled: true }))
        : [
            { name: "Employee Directory & Profiles", enabled: true },
            { name: "Document Management", enabled: true },
            { name: "Basic Attendance & Leave", enabled: true },
            { name: "Geo-Fencing & Mobile Clock-in", enabled: true },
            { name: "Biometric Device Integration", enabled: false },
            { name: "Payroll & Payslips", enabled: true },
            { name: "PF, ESI & TDS Statutory Tax Compliance", enabled: false },
            { name: "Immutable Audit Logging", enabled: false },
            { name: "REST API & Webhooks Access", enabled: false },
          ];
    setNewPlanFeatures(allFeats);
    setShowCreateModal(true);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim()) return;
    try {
      await mutations.createPlan.mutateAsync({
        name: newPlanName.trim(),
        code: newPlanCode.trim() || `PLAN_${newPlanName.trim().toUpperCase().replace(/\s+/g, "_")}`,
        monthlyPrice: newPlanMonthlyPrice,
        yearlyPrice: newPlanYearlyPrice,
        employeeLimit: newPlanSeats,
        storageLimitGB: newPlanStorageGB,
        status: newPlanStatus,
        description: newPlanDescription,
        features: newPlanFeatures,
      });
      toast?.(`Plan "${newPlanName.trim()}" created and published successfully`, "success");
      setShowCreateModal(false);
    } catch (err: any) {
      toast?.(err.message || "Failed to create plan", "error");
    }
  };

  const handleClonePlan = async (id?: string, name?: string) => {
    const target = id || name;
    if (!target) return;
    try {
      await mutations.clonePlan.mutateAsync({ id: target, newName: `${name || target}_CLONE` });
      toast?.(`Cloned ${name || target} into draft plan`, "success");
    } catch (err: any) {
      toast?.(err.message || "Clone failed", "error");
    }
  };

  const handlePublishPlan = async (id?: string, name?: string) => {
    const target = id || name;
    if (!target) return;
    try {
      const res = await mutations.publishPlan.mutateAsync({
        id: target,
        changelog: `Published version for ${name || target}`,
      });
      toast?.(
        `Plan "${name || target}" published successfully! (Version ${res?.version || "new"} active)`,
        "success",
      );
    } catch (err: any) {
      toast?.(err.message || "Publish failed", "error");
    }
  };

  const handleExecuteLifecycleAction = async () => {
    if (!lifecycleModal) return;
    const { action, plan } = lifecycleModal;
    const target = plan.id || plan.name;
    setIsPerformingLifecycle(true);
    try {
      if (action === "archive") {
        await mutations.archivePlan.mutateAsync(target);
        toast?.(`Plan "${plan.name}" archived successfully`, "success");
      } else if (action === "restore") {
        await mutations.restorePlan.mutateAsync(target);
        toast?.(`Plan "${plan.name}" restored to Published status`, "success");
      } else if (action === "permanent_delete") {
        await mutations.permanentlyDeletePlan.mutateAsync(target);
        toast?.(`Plan "${plan.name}" permanently deleted from database`, "success");
      } else if (action === "delete_draft") {
        await mutations.deleteDraftPlan.mutateAsync(target);
        toast?.(`Draft plan "${plan.name}" deleted successfully`, "success");
      }
      setLifecycleModal(null);
    } catch (err: any) {
      toast?.(err?.message || "Operation failed", "error");
    } finally {
      setIsPerformingLifecycle(false);
    }
  };

  const handleCreateFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!featName || !featKey) return;
    try {
      await mutations.createFeature.mutateAsync({
        key: featKey.toUpperCase(),
        name: featName,
        module: featModule,
        status: "Active",
      });
      toast?.("Feature added to repository", "success");
      setShowAddFeatureModal(false);
      setFeatName("");
      setFeatKey("");
    } catch (err: any) {
      toast?.(err.message || "Failed to add feature", "error");
    }
  };

  const handleCreateAddOn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addOnName) return;
    try {
      await mutations.createAddOn.mutateAsync({
        name: addOnName,
        code: `ADD_${addOnName.toUpperCase().replace(/\s+/g, "_")}`,
        price: addOnPrice,
        billingCycle: addOnCycle,
        unit: "seats",
        maxLimit: 100,
        active: true,
      });
      toast?.("Add-on created successfully", "success");
      setShowAddAddOnModal(false);
      setAddOnName("");
    } catch (err: any) {
      toast?.(err.message || "Failed to create add-on", "error");
    }
  };

  const filteredPlans = plans.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || (p.status || "Published") === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Subscription & Feature Management"
          subtitle="Enterprise Plan Builder, Module Entitlements, Version Controls & Add-On Metering"
        />
        <div className="flex items-center gap-3">
          {isFetchingPlans && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
              <RefreshCw className="h-3 w-3 animate-spin" /> Real-time SSE Sync...
            </span>
          )}
          <button
            onClick={handleOpenCreateModal}
            className={`${btnCls} bg-primary text-white shadow-md hover:brightness-110`}
          >
            <Plus className="h-4 w-4 mr-1" /> Build New Plan
          </button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {[
          { id: "dashboard", label: "Overview Stats", icon: Activity },
          { id: "plans", label: "Plan Catalog & Tiers", icon: Layers },
          { id: "library", label: "Feature Repository", icon: Sliders },
          { id: "addons", label: "Add-Ons & Metering", icon: Box },
          { id: "audit", label: "Version Audit Trail", icon: History },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as TabId)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition -mb-px whitespace-nowrap ${
                activeTab === t.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={cardCls}>
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>Total SaaS Plans</span>
                <Layers className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold mt-2">{stats?.totalPlans ?? plans.length}</div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {stats?.publishedPlans ?? 3} Published • {stats?.draftPlans ?? 0} Draft
              </p>
            </div>
            <div className={cardCls}>
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>Active Assignments</span>
                <Users className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold mt-2">{stats?.activeCompanyAssignments ?? 1}</div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Companies subscribed across tiers
              </p>
            </div>
            <div className={cardCls}>
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>Most Popular Plan</span>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold mt-2 text-primary">
                {stats?.mostPopularPlan ?? "PREMIUM"}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Highest company adoption rate
              </p>
            </div>
            <div className={cardCls}>
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>System Features</span>
                <Cpu className="h-4 w-4 text-sky-500" />
              </div>
              <div className="text-2xl font-bold mt-2">{systemFeatures.length || 9}</div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Across 4 core functional modules
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLANS CATALOG */}
      {(activeTab === "plans" || activeTab === "dashboard") && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search plan name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={inputCls}
              >
                <option value="All">All Statuses</option>
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredPlans.map((plan) => (
              <div
                key={plan.id || plan.name}
                className={`${cardCls} relative flex flex-col justify-between hover:border-primary/40 transition`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">
                        {plan.code || `PLAN_${plan.name}`}
                      </p>
                    </div>
                    <Badge
                      tone={
                        plan.status === "Published"
                          ? "green"
                          : plan.status === "Draft"
                            ? "sky"
                            : "rose"
                      }
                    >
                      {plan.status || "Published"}
                    </Badge>
                  </div>

                  <div className="text-2xl font-bold text-primary mb-3">
                    {plan.price ||
                      (plan.monthlyPrice
                        ? `₹${plan.monthlyPrice.toLocaleString("en-IN")} / mo`
                        : "Custom")}
                  </div>

                  {/* Seats & Storage Specifications */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg border border-border/50 mb-4">
                    <div>
                      <span className="text-muted-foreground block text-[10px] font-semibold">
                        Max Seats (Employees)
                      </span>
                      <span className="font-bold text-foreground">
                        {plan.employeeLimit ?? 50} Seats
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] font-semibold">
                        Storage Allocation
                      </span>
                      <span className="font-bold text-foreground">
                        {plan.storageLimitGB ?? 10} GB
                      </span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-2 mb-6 border-t border-border pt-3">
                    <span className="text-xs font-semibold text-muted-foreground block">
                      Included Entitlements:
                    </span>
                    {(plan.features || []).map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {f.enabled ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        )}
                        <span
                          className={
                            f.enabled ? "font-medium" : "text-muted-foreground/60 line-through"
                          }
                        >
                          {f.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plan Action Bar */}
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <button
                    onClick={() => handleOpenEdit(plan)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Edit Settings & Seats
                  </button>

                  {/* 1. DRAFT ACTIONS: Publish Version */}
                  {plan.status === "Draft" && (
                    <button
                      onClick={() => handlePublishPlan(plan.id, plan.name)}
                      className="p-2 text-emerald-500 hover:text-emerald-600 rounded-lg border border-border hover:bg-emerald-500/10 transition"
                      title="Publish Plan Version"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* 2. ARCHIVED ACTIONS: Restore to Published */}
                  {plan.status === "Archived" && (
                    <button
                      onClick={() => setLifecycleModal({ action: "restore", plan })}
                      className="p-2 text-emerald-500 hover:text-emerald-600 rounded-lg border border-border hover:bg-emerald-500/10 transition"
                      title="Restore Plan to Published"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* CLONE ACTION (Available for all statuses) */}
                  <button
                    onClick={() => handleClonePlan(plan.id, plan.name)}
                    className="p-2 text-muted-foreground hover:text-foreground rounded-lg border border-border hover:bg-muted transition"
                    title="Clone Plan"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>

                  {/* 3. PUBLISHED ACTIONS: Archive Plan */}
                  {plan.status === "Published" && (
                    <button
                      onClick={() => setLifecycleModal({ action: "archive", plan })}
                      className="p-2 text-amber-500 hover:text-amber-600 rounded-lg border border-border hover:bg-amber-500/10 transition"
                      title="Archive Plan"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* 4. DRAFT ACTIONS: Delete Draft */}
                  {plan.status === "Draft" && (
                    <button
                      onClick={() => setLifecycleModal({ action: "delete_draft", plan })}
                      className="p-2 text-rose-500 hover:text-rose-600 rounded-lg border border-border hover:bg-rose-500/10 transition"
                      title="Delete Draft Plan"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* 5. ARCHIVED ACTIONS: Permanently Delete */}
                  {plan.status === "Archived" && (
                    <button
                      onClick={() => setLifecycleModal({ action: "permanent_delete", plan })}
                      className="p-2 text-rose-500 hover:text-rose-600 rounded-lg border border-border hover:bg-rose-500/10 transition"
                      title="Permanently Delete Plan"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: FEATURE LIBRARY */}
      {activeTab === "library" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">System Feature Entitlements Repository</h3>
            <button onClick={() => setShowAddFeatureModal(true)} className={btnCls}>
              + Add New Feature Code
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemFeatures.map((f) => (
              <div key={f.id || f.key} className={cardCls}>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${MODULE_COLORS[f.module] || MODULE_COLORS.CORE}`}
                  >
                    {f.module}
                  </span>
                  <Badge tone={f.status === "Active" ? "green" : "rose"}>{f.status}</Badge>
                </div>
                <h4 className="font-bold text-sm">{f.name}</h4>
                <p className="text-xs text-muted-foreground font-mono mt-1">{f.key}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ADD-ONS */}
      {activeTab === "addons" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">Configured Metered Add-Ons</h3>
            <button onClick={() => setShowAddAddOnModal(true)} className={btnCls}>
              + Create Add-On Pack
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {addOns.map((a) => (
              <div key={a.id || a.code} className={cardCls}>
                <h4 className="font-bold text-base">{a.name}</h4>
                <p className="text-xs text-muted-foreground font-mono">{a.code}</p>
                <div className="text-xl font-bold text-primary mt-2">
                  ₹{a.price.toLocaleString("en-IN")} / {a.billingCycle}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeTab === "audit" && (
        <div className={`${cardCls} p-0 overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm border-collapse">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  {["Plan Name", "Action", "Performed By", "Details", "Timestamp"].map((h) => (
                    <th key={h} className="p-3 font-semibold text-xs">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!auditLogs || auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No audit logs recorded
                    </td>
                  </tr>
                ) : (
                  (auditLogs || []).map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition">
                      <td className="p-3 font-bold text-primary text-xs">{log.planName}</td>
                      <td className="p-3 text-xs font-semibold">{log.action}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {log.performedBy || "Super Admin"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{log.details || "—"}</td>
                      <td className="p-3 text-xs font-mono text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT PLAN MODAL (FULL PARAMETER EDITING: SEATS, STORAGE, PRICES, STATUS, CODE & FEATURES) */}
      {showEditPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-xl font-bold">Edit Subscription Plan Settings</h3>
                <p className="text-xs text-muted-foreground">
                  Configure seats, storage limits, pricing, status, and feature matrix for{" "}
                  <span className="font-semibold text-primary">{showEditPlan}</span>
                </p>
              </div>
              <button
                onClick={() => setShowEditPlan(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlanSettings} className="space-y-5">
              {/* Section 1: Basic Identifiers & Status */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                  Plan Core Identifiers
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">
                      Plan Code / Identifier
                    </label>
                    <input
                      type="text"
                      value={editingCode}
                      onChange={(e) => setEditingCode(e.target.value)}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Publish Status</label>
                    <select
                      value={editingStatus}
                      onChange={(e) => setEditingStatus(e.target.value)}
                      className={inputCls}
                    >
                      <option value="Published">Published</option>
                      <option value="Draft">Draft</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Seats & Storage Entitlements */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                  Capacity & Limits (Seats & Storage)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">
                      Purchased Seats Limit (Employees)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editingSeats}
                      onChange={(e) => setEditingSeats(Number(e.target.value))}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">
                      Storage Allocation (GB)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editingStorageGB}
                      onChange={(e) => setEditingStorageGB(Number(e.target.value))}
                      className={inputCls}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Pricing Structure */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                  Pricing & Billing Rate
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">
                      Monthly Price (₹ / mo)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editingMonthlyPrice}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setEditingMonthlyPrice(val);
                        setEditingYearlyPrice(val * 12);
                      }}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">
                      Yearly Price (₹ / yr)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editingYearlyPrice}
                      onChange={(e) => setEditingYearlyPrice(Number(e.target.value))}
                      className={inputCls}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Feature Library Matrix */}
              <div className="border-t border-border pt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold">
                    Enabled Features ({(editingFeatures || []).length} total)
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400">
                    {(editingFeatures || []).filter((f) => f.enabled).length} Enabled
                  </span>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1 border border-border rounded-xl p-3">
                  {(editingFeatures || []).map((f, i) => (
                    <label
                      key={i}
                      className="flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-muted/40 p-2 rounded-lg border border-transparent hover:border-border transition"
                    >
                      <span
                        className={
                          f.enabled
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground line-through"
                        }
                      >
                        {f.name}
                      </span>
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        onChange={() =>
                          setEditingFeatures((prev) =>
                            prev.map((item, idx) =>
                              idx === i ? { ...item, enabled: !item.enabled } : item,
                            ),
                          )
                        }
                        className="rounded text-primary h-4 w-4 shrink-0"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowEditPlan(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
                >
                  Save Plan Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BUILD NEW PLAN MODAL (ALL PARAMETERS: SEATS, STORAGE, PRICES, CODE, DESCRIPTION, STATUS & FEATURES) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-xl font-bold">Build New Subscription Plan</h3>
                <p className="text-xs text-muted-foreground">
                  Configure new plan tier specs: Seats, Storage, Pricing, Status & Feature Library
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-5">
              {/* Section 1: Name & Identifiers */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                  Plan Core Identifiers
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">Plan Name *</label>
                    <input
                      value={newPlanName}
                      onChange={(e) => setNewPlanName(e.target.value)}
                      placeholder="e.g. ENTERPRISE_PLUS"
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Plan Code</label>
                    <input
                      value={newPlanCode}
                      onChange={(e) => setNewPlanCode(e.target.value)}
                      placeholder="e.g. PLAN_ENTERPRISE_PLUS"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Capacity Limits (Seats & Storage) */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                  Capacity & Limits (Seats & Storage)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">
                      Purchased Seats Limit (Employees)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newPlanSeats}
                      onChange={(e) => setNewPlanSeats(Number(e.target.value))}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">
                      Storage Allocation (GB)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newPlanStorageGB}
                      onChange={(e) => setNewPlanStorageGB(Number(e.target.value))}
                      className={inputCls}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Pricing & Status */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                  Pricing & Status
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">
                      Monthly Price (₹ / mo)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newPlanMonthlyPrice}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setNewPlanMonthlyPrice(val);
                        setNewPlanYearlyPrice(val * 12);
                      }}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">
                      Yearly Price (₹ / yr)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newPlanYearlyPrice}
                      onChange={(e) => setNewPlanYearlyPrice(Number(e.target.value))}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Status</label>
                    <select
                      value={newPlanStatus}
                      onChange={(e) => setNewPlanStatus(e.target.value)}
                      className={inputCls}
                    >
                      <option value="Published">Published</option>
                      <option value="Draft">Draft</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 4: Feature Library Matrix */}
              <div className="border-t border-border pt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold">
                    Select Features ({newPlanFeatures.length} total)
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400">
                    {(newPlanFeatures || []).filter((f) => f.enabled).length} Selected
                  </span>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1 border border-border rounded-xl p-3">
                  {newPlanFeatures.map((f, i) => (
                    <label
                      key={i}
                      className="flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-muted/40 p-2 rounded-lg border border-transparent hover:border-border transition"
                    >
                      <span
                        className={
                          f.enabled ? "font-semibold text-foreground" : "text-muted-foreground"
                        }
                      >
                        {f.name}
                      </span>
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        onChange={() =>
                          setNewPlanFeatures((prev) =>
                            prev.map((item, idx) =>
                              idx === i ? { ...item, enabled: !item.enabled } : item,
                            ),
                          )
                        }
                        className="rounded text-primary h-4 w-4 shrink-0"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
                >
                  Create & Publish Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD FEATURE MODAL */}
      {showAddFeatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-bold">Add Feature to Library</h3>
            <form onSubmit={handleCreateFeature} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Feature Name</label>
                <input
                  id="featName"
                  name="featName"
                  value={featName}
                  onChange={(e) => setFeatName(e.target.value)}
                  placeholder="e.g. AI Resume Parser"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Feature Key Code</label>
                <input
                  id="featKey"
                  name="featKey"
                  value={featKey}
                  onChange={(e) => setFeatKey(e.target.value)}
                  placeholder="e.g. AI_RESUME_PARSER"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Module</label>
                <select
                  id="featModule"
                  name="featModule"
                  value={featModule}
                  onChange={(e) => setFeatModule(e.target.value)}
                  className={inputCls}
                >
                  {["CORE", "ATTENDANCE", "PAYROLL", "ENTERPRISE"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddFeatureModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
                >
                  Add Feature
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD ADD-ON MODAL */}
      {showAddAddOnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-bold">Create Add-on Pack</h3>
            <form onSubmit={handleCreateAddOn} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Add-on Name</label>
                <input
                  id="addOnName"
                  name="addOnName"
                  value={addOnName}
                  onChange={(e) => setAddOnName(e.target.value)}
                  placeholder="e.g. Extra 20 Seats"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Price (INR)</label>
                <input
                  id="addOnPrice"
                  name="addOnPrice"
                  type="number"
                  value={addOnPrice}
                  onChange={(e) => setAddOnPrice(Number(e.target.value))}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Billing Cycle</label>
                <select
                  id="addOnCycle"
                  name="addOnCycle"
                  value={addOnCycle}
                  onChange={(e) => setAddOnCycle(e.target.value)}
                  className={inputCls}
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Yearly">Yearly</option>
                  <option value="OneTime">One-time</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAddOnModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
                >
                  Create Add-on
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIFECYCLE ACTION CONFIRMATION MODAL */}
      {lifecycleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`grid h-10 w-10 place-items-center rounded-xl shrink-0 ${
                  lifecycleModal.action === "archive"
                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                    : lifecycleModal.action === "restore"
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                }`}
              >
                {lifecycleModal.action === "archive" ? (
                  <Archive className="h-5 w-5" />
                ) : lifecycleModal.action === "restore" ? (
                  <RotateCcw className="h-5 w-5" />
                ) : (
                  <Trash2 className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {lifecycleModal.action === "archive"
                    ? `Archive Plan "${lifecycleModal.plan.name}"?`
                    : lifecycleModal.action === "restore"
                      ? `Restore Plan "${lifecycleModal.plan.name}"?`
                      : lifecycleModal.action === "permanent_delete"
                        ? `Permanently Delete Plan "${lifecycleModal.plan.name}"?`
                        : `Delete Draft Plan "${lifecycleModal.plan.name}"?`}
                </h3>
                <span className="text-xs text-muted-foreground font-mono">
                  {lifecycleModal.plan.code || `PLAN_${lifecycleModal.plan.name}`}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {lifecycleModal.action === "archive" &&
                "This will remove the plan from the public catalog and new subscription selection. Existing subscribers and historical billing records will remain completely intact."}
              {lifecycleModal.action === "restore" &&
                "This will restore the plan back to the active Published catalog and make it available for new company subscriptions."}
              {lifecycleModal.action === "permanent_delete" &&
                "This will permanently purge this archived plan, all version records, and all feature configurations from the database. This action cannot be undone."}
              {lifecycleModal.action === "delete_draft" &&
                "This permanently removes the unused draft plan and its feature configuration from the database. This action cannot be undone."}
            </p>

            {lifecycleModal.action === "permanent_delete" &&
              ((lifecycleModal.plan.assignedCompaniesCount ?? 0) > 0) && (
                <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Warning:</strong> This plan has{" "}
                    <strong>{lifecycleModal.plan.assignedCompaniesCount}</strong> active
                    company assignment(s). Deletion will be rejected by the server unless all
                    subscribers are migrated first.
                  </span>
                </div>
              )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                disabled={isPerformingLifecycle}
                onClick={() => setLifecycleModal(null)}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-xl border border-border hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPerformingLifecycle}
                onClick={handleExecuteLifecycleAction}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-sm transition disabled:opacity-50 ${
                  lifecycleModal.action === "archive"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : lifecycleModal.action === "restore"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {isPerformingLifecycle && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {lifecycleModal.action === "archive"
                  ? "Archive Plan"
                  : lifecycleModal.action === "restore"
                    ? "Restore Plan"
                    : lifecycleModal.action === "permanent_delete"
                      ? "Permanently Delete"
                      : "Delete Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlanManagementPage;
