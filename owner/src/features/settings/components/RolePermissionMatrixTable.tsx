import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  Save,
  Info,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Lock,
} from "lucide-react";
import { PERMISSION_CATEGORIES } from "../constants/permissions.registry";
import { authService } from "../../../services/auth.service";
import { companyService } from "../../../services/company.service";
import { featureOverridesService } from "../../../services/feature-overrides.service";
import type { SaaSCompany } from "../../../store/companyStore";
import { Btn, Badge } from "../../../components/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { PermissionGate, PERMISSIONS } from "../../../auth";
import { useUIStore } from "../../../store/uiStore";
import { RolePermissionAccordionView } from "./RolePermissionAccordionView";

const PERMISSION_TO_FEATURE: Record<string, string> = {
  // Support / Helpdesk
  'support:tickets:view': 'MODULE_HELPDESK',
  'support:tickets:create': 'MODULE_HELPDESK',
  'support:tickets:message': 'MODULE_HELPDESK',
  'support:tickets:status': 'MODULE_HELPDESK',
  'support:tickets:resolve': 'MODULE_HELPDESK',
  'support:tickets:close': 'MODULE_HELPDESK',
  'support:tickets:delete': 'MODULE_HELPDESK',
  // Assets
  'assets:view': 'MODULE_ASSETS',
  'assets:manage': 'MODULE_ASSETS',
  // Recruitment
  'recruitment:jobs:view': 'MODULE_RECRUITMENT',
  'recruitment:jobs:create': 'MODULE_RECRUITMENT',
  'recruitment:jobs:edit': 'MODULE_RECRUITMENT',
  'recruitment:candidates:view': 'MODULE_RECRUITMENT',
  'recruitment:candidates:add': 'MODULE_RECRUITMENT',
  'recruitment:candidates:movestage': 'MODULE_RECRUITMENT',
  'recruitment:candidates:hire': 'MODULE_RECRUITMENT',
  // Performance
  'performance:reviews:view': 'MODULE_PERFORMANCE',
  'performance:cycles:manage': 'MODULE_PERFORMANCE',
  // DPR
  'dpr:view': 'MODULE_DPR',
  'dpr:submit': 'MODULE_DPR',
  'dpr:approve': 'MODULE_DPR',
  'dpr:manage': 'MODULE_DPR',
  // Exit
  'exit:view': 'MODULE_EXIT',
  'exit:submit': 'MODULE_EXIT',
  'exit:approve': 'MODULE_EXIT',
  'exit:manage': 'MODULE_EXIT',
  'exit:settle': 'MODULE_EXIT',
  // Chatbox
  'chatbox:access': 'MODULE_MESSAGING',
  // Attendance
  'attendance:geo:config': 'ATTENDANCE_GEO',
  'attendance:geo:bypass': 'ATTENDANCE_GEO',
  'attendance:devices:manage': 'ATTENDANCE_BIOMETRIC',
  'attendance:devices:sync': 'ATTENDANCE_BIOMETRIC',
  // Payroll & Statutory & Tax & Expenses
  'payroll:statutory:view': 'PAYROLL_STATUTORY',
  'tax:declarations:view': 'TAX_DECLARATIONS',
  'tax:declarations:submit': 'TAX_DECLARATIONS',
  'tax:declarations:manage': 'TAX_DECLARATIONS',
  'expenses:view': 'EXPENSE_CLAIMS',
  'expenses:submit': 'EXPENSE_CLAIMS',
  'expenses:approve': 'EXPENSE_CLAIMS',
  'expenses:manage': 'EXPENSE_CLAIMS',
  'expenses:pay': 'EXPENSE_CLAIMS',
  // Audit
  'system:audit:view': 'ADVANCED_AUDIT',
  'system:audit:read': 'ADVANCED_AUDIT',
  'system:audit:delete': 'ADVANCED_AUDIT',
};

interface MatrixPermissionRowProps {
  action: { id: string; label: string; description?: string };
  roles: { id: string; name: string; description: string | null; isSystem: boolean }[];
  isFeatureEntitled: boolean;
  activeTooltip: boolean;
  onTooltipEnter: () => void;
  onTooltipLeave: () => void;
  onToggle: (roleId: string, actionId: string) => void;
  checkedRolesKey: string;
}

const MatrixPermissionRow = React.memo(function MatrixPermissionRow({
  action,
  roles,
  isFeatureEntitled,
  activeTooltip,
  onTooltipEnter,
  onTooltipLeave,
  onToggle,
  checkedRolesKey,
}: MatrixPermissionRowProps) {
  const checkedSet = useMemo(
    () => new Set(checkedRolesKey ? checkedRolesKey.split("|") : []),
    [checkedRolesKey],
  );

  return (
    <tr
      className={`transition border-b border-border/30 ${
        !isFeatureEntitled ? "bg-muted/10 opacity-75" : "hover:bg-muted/30"
      }`}
    >
      <td className="py-2.5 px-4 pl-12 sticky left-0 z-10 bg-card border-r border-border">
        <div className="flex items-center gap-2 group relative">
          <span
            className={`font-medium ${
              !isFeatureEntitled ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {action.label}
          </span>
          {!isFeatureEntitled && (
            <span
              className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 cursor-help"
              title="Feature disabled by company plan & no override active. Grant override in Company Management."
            >
              <Lock className="w-2.5 h-2.5" /> Plan Locked
            </span>
          )}
          {action.description && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center p-0.5 rounded-full text-muted-foreground hover:text-primary transition focus:outline-none cursor-help shrink-0"
                    aria-label={`Info: ${action.label}`}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="start"
                  sideOffset={6}
                  className="max-w-xs z-50 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-800 p-3 text-xs leading-relaxed shadow-2xl border border-slate-700 font-normal animate-in fade-in zoom-in-95 duration-150"
                >
                  {action.description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <span className="text-[10px] text-muted-foreground/60 font-mono hidden sm:inline ml-auto">
            {action.id}
          </span>
        </div>
      </td>

      {roles.map((roleObj) => {
        const checked = roleObj.name === "SuperAdmin" || checkedSet.has(roleObj.id);
        const isSuper = roleObj.name === "SuperAdmin";
        return (
          <td
            key={roleObj.id}
            className="py-2.5 px-2 text-center border-r border-border/40"
          >
            {isFeatureEntitled ? (
              <button
                type="button"
                disabled={isSuper}
                onClick={() => onToggle(roleObj.id, action.id)}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition ${
                  checked
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border bg-muted/20 text-transparent hover:border-muted-foreground/40"
                } ${isSuper ? "opacity-80 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <Check className="h-4 w-4 stroke-[3]" />
              </button>
            ) : (
              <div
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-700/40 bg-slate-900/30 text-slate-500 cursor-not-allowed opacity-60"
                title="Feature is locked for this tenant. Grant an override in Company Management to activate."
              >
                <Lock className="h-3 w-3" />
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
});

interface RolePermissionMatrixTableProps {
  toast: (msg: string) => void;
}

export const RolePermissionMatrixTable: React.FC<RolePermissionMatrixTableProps> = ({ toast }) => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [companies, setCompanies] = useState<SaaSCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  const [roles, setRoles] = useState<
    { id: string; name: string; description: string | null; isSystem: boolean }[]
  >([]);
  const [selectedRole, setSelectedRole] = useState<string>(""); // Role ID
  const [viewMode, setViewMode] = useState<"matrix" | "accordion">("matrix");
  const [roleTab, setRoleTab] = useState<"system" | "custom">("system");
  const [searchQuery, setSearchQuery] = useState("");
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [effectiveFeatures, setEffectiveFeatures] = useState<Record<string, boolean>>({});

  const systemRoles = useMemo(() => roles.filter((r) => r.isSystem), [roles]);
  const customRoles = useMemo(() => roles.filter((r) => !r.isSystem), [roles]);
  const visibleRoles = useMemo(() => {
    if (roleTab === "custom") {
      return customRoles;
    }
    return systemRoles.length > 0 ? systemRoles : roles;
  }, [roleTab, systemRoles, customRoles, roles]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    employees: true,
    payroll: true,
    recruitment: true,
    reports: true,
    settings: true,
    chatbox: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Custom role creation state
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  // Confirmation Dialog state
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  const isSuperAdmin = currentUser?.role === "SuperAdmin";

  const loadVersionRef = React.useRef(0);

  // 1. Fetch current profile details on mount
  useEffect(() => {
    let isMounted = true;
    authService
      .getProfile()
      .then((profile) => {
        if (isMounted) {
          setCurrentUser(profile);
        }
      })
      .catch((err) => {
        console.error("Failed to get profile:", err);
        if (isMounted) {
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch list of companies if current user is platform SuperAdmin
  useEffect(() => {
    let isMounted = true;
    if (isSuperAdmin) {
      companyService
        .getCompanies()
        .then((list) => {
          if (!isMounted) return;
          const compList = Array.isArray(list) ? list : [];
          setCompanies(compList);
          if (compList.length > 0) {
            setSelectedCompanyId(compList[0].companyId);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          toast(`Failed to load companies: ${err?.message || "Network Error"}`);
        });
    }
  }, [isSuperAdmin]);

  // 3. Re-load roles and permissions whenever the selected company context or user changes
  useEffect(() => {
    if (!currentUser) return;

    if (isSuperAdmin) {
      // Clear previous company data immediately on company change to prevent editing stale roles
      setRoles([]);
      setSelectedRole("");
      setMatrix({});
      if (selectedCompanyId) {
        void loadData(selectedCompanyId);
      } else {
        // SuperAdmin with no company selected (initial mount, zero companies, or platform context): load platform/default roles
        void loadData();
      }
      return;
    }

    // Non-SuperAdmin tenant
    void loadData();
  }, [selectedCompanyId, currentUser, isSuperAdmin]);

  const loadData = async (companyId?: string) => {
    const version = ++loadVersionRef.current;
    try {
      setLoading(true);
      // Fetch dynamic roles list from database
      const rolesList = await authService.getRoles(companyId);
      if (version !== loadVersionRef.current) return;

      const filtered = (rolesList || []).filter((r: any) => r.name !== "SuperAdmin");

      // Fetch current permission assignment matrix from database
      const matrixData = await authService.getRolePermissionsMatrix(companyId);
      if (version !== loadVersionRef.current) return;

      setRoles(filtered);
      if (filtered && filtered.length > 0) {
        setSelectedRole(filtered[0].id);
      }
      setMatrix(matrixData || {});

      // Fetch company's effective features map if companyId is provided
      if (companyId) {
        try {
          const featRes = await featureOverridesService.getEffectiveFeaturesMap(companyId);
          if (version === loadVersionRef.current) {
            setEffectiveFeatures(featRes.effectiveFeatures || {});
          }
        } catch {
          if (version === loadVersionRef.current) {
            setEffectiveFeatures({});
          }
        }
      } else {
        setEffectiveFeatures({});
      }
    } catch (err: any) {
      if (version === loadVersionRef.current) {
        toast(`Failed to load roles/permissions: ${err?.message || "Error"}`);
      }
    } finally {
      if (version === loadVersionRef.current) {
        setLoading(false);
      }
    }
  };

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Debounce search query by 150ms to keep input instant while preventing heavy filtering thrashing
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Precomputed Role Lookup Map for O(1) identity checks
  const rolesById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; description: string | null; isSystem: boolean }>();
    for (const r of roles) {
      map.set(r.id, r);
    }
    return map;
  }, [roles]);

  // Precomputed Permission Sets for O(1) membership checks
  const rolePermSets = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const role of roles) {
      const perms = matrix[role.id] || matrix[role.name] || [];
      map.set(role.id, new Set(perms));
    }
    return map;
  }, [roles, matrix]);

  // Filter Categories and SubModules by debounced search query
  const filteredCategories = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return PERMISSION_CATEGORIES;
    const q = debouncedSearchQuery.toLowerCase().trim();
    return PERMISSION_CATEGORIES.map((cat) => {
      const matchingSub = cat.subModules
        .map((sub) => {
          const matchingActions = sub.actions.filter(
            (act) =>
              act.label.toLowerCase().includes(q) ||
              act.id.toLowerCase().includes(q) ||
              (act.description && act.description.toLowerCase().includes(q)),
          );
          if (matchingActions.length > 0 || sub.name.toLowerCase().includes(q)) {
            return { ...sub, actions: matchingActions.length > 0 ? matchingActions : sub.actions };
          }
          return null;
        })
        .filter(Boolean) as typeof cat.subModules;

      if (matchingSub.length > 0 || cat.name.toLowerCase().includes(q)) {
        return { ...cat, subModules: matchingSub };
      }
      return null;
    }).filter(Boolean) as typeof PERMISSION_CATEGORIES;
  }, [debouncedSearchQuery]);

  // Check if a role has a permission action with O(1) lookup
  const hasPermission = useCallback(
    (roleId: string, actionId: string): boolean => {
      const roleObj = rolesById.get(roleId);
      if (roleObj?.name === "SuperAdmin") return true; // SuperAdmin override
      return rolePermSets.get(roleId)?.has(actionId) ?? false;
    },
    [rolesById, rolePermSets],
  );

  // Toggle single permission for a role (referentially stable via functional state update)
  const togglePermission = useCallback(
    (roleId: string, actionId: string) => {
      const roleObj = rolesById.get(roleId);
      if (roleObj?.name === "SuperAdmin") return; // Cannot disable SuperAdmin root

      const featKey = PERMISSION_TO_FEATURE[actionId];
      const isFeatureEntitled =
        featKey && selectedCompanyId ? (effectiveFeatures[featKey] ?? true) : true;
      if (!isFeatureEntitled) {
        toast(
          "This feature is locked by the company's plan and has no active override. Grant a Tenant Feature Override in Company Management to activate.",
        );
        return;
      }

      setMatrix((prev) => {
        const current = prev[roleId] || prev[roleObj?.name || ""] || [];
        const updated = current.includes(actionId)
          ? current.filter((id) => id !== actionId)
          : [...current, actionId];
        return { ...prev, [roleId]: updated };
      });
    },
    [rolesById, selectedCompanyId, effectiveFeatures, toast],
  );

  // Toggle all permissions in a submodule for a role
  const toggleSubModuleAll = useCallback(
    (roleId: string, actionIds: string[]) => {
      const roleObj = rolesById.get(roleId);
      if (roleObj?.name === "SuperAdmin") return;

      setMatrix((prev) => {
        const current = new Set(prev[roleId] || prev[roleObj?.name || ""] || []);
        const allChecked = actionIds.every((id) => current.has(id));
        if (allChecked) {
          actionIds.forEach((id) => current.delete(id));
        } else {
          actionIds.forEach((id) => current.add(id));
        }
        return { ...prev, [roleId]: Array.from(current) };
      });
    },
    [rolesById],
  );

  // Create custom role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      setSaving(true);
      const companyId = isSuperAdmin ? selectedCompanyId : undefined;
      await authService.createRole(newRoleName.trim(), newRoleDesc.trim(), [], companyId);
      toast(`Role "${newRoleName}" created successfully! Configure permissions below.`);
      setNewRoleName("");
      setNewRoleDesc("");
      setCreateOpen(false);
      setRoleTab("custom");
      await loadData(companyId);
    } catch (err: any) {
      toast(`Failed to create role: ${err.message || "Error"}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete dynamic custom role
  const handleDeleteRole = (roleId: string, roleName: string) => {
    useUIStore.getState().setConfirmState({
      open: true,
      title: "Delete Role",
      message: `Are you sure you want to delete the role "${roleName}"? Any users assigned to this role may lose their access permissions.`,
      confirmText: "Delete Role",
      cancelText: "Cancel",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          setSaving(true);
          const companyId = isSuperAdmin ? selectedCompanyId : undefined;
          await authService.deleteRole(roleId, companyId);
          toast(`Role "${roleName}" deleted successfully.`);
          await loadData(companyId);
        } catch (err: any) {
          toast(`Failed to delete role: ${err.response?.data?.message || err.message || "Error"}`);
        } finally {
          setSaving(false);
        }
      },
    });
  };

  // Save changes for selected role or entire matrix
  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      const companyId = isSuperAdmin ? selectedCompanyId : undefined;

      if (viewMode === "accordion") {
        const roleObj = roles.find((r) => r.id === selectedRole);
        const perms = matrix[selectedRole] || matrix[roleObj?.name || ""] || [];
        await authService.updateRolePermissions(selectedRole, perms, companyId);
        const roleName = roleObj?.name || selectedRole;
        toast(`Permissions saved successfully for ${roleName}`);
      } else {
        // Save for all dynamic roles (skip SuperAdmin root bypass)
        for (const roleObj of roles) {
          if (roleObj.name !== "SuperAdmin") {
            const perms = matrix[roleObj.id] || matrix[roleObj.name] || [];
            await authService.updateRolePermissions(roleObj.id, perms, companyId);
          }
        }
        toast("Role & Permission matrix updated and synced in real-time");
      }
      await loadData(companyId);
      try {
        const { useAuthStore } = await import("../../../store/authStore");
        await useAuthStore.getState().refreshEffectivePermissions();
      } catch (err) {
        console.error("Failed to refresh active session effective permissions:", err);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new Event("permissions-updated"));
      }
    } catch (err: any) {
      toast(`Failed to save permissions: ${err.message || "Error"}`);
    } finally {
      setSaving(false);
      setConfirmSaveOpen(false);
    }
  };

  if (loading && !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <div className="text-sm font-semibold text-muted-foreground">
          Loading Role & Permission Matrix...
        </div>
      </div>
    );
  }

  const selectedRoleObj = roles.find((r) => r.id === selectedRole);
  const selectedCompanyName = companies.find((c) => c.companyId === selectedCompanyId)?.name || "Unknown";

  return (
    <div className="space-y-6">
      {/* Platform SuperAdmin Company Selector Context */}
      {isSuperAdmin && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-muted/40 border border-border rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-primary shrink-0">
              Target Company Context:
            </span>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="h-10 w-full sm:max-w-md rounded-xl border border-input bg-background px-3 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition truncate"
            >
              {companies.length === 0 ? (
                <option value="">System Default Roles (Platform Context)</option>
              ) : (
                <>
                  <option value="">-- System Default Roles (Platform) --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.companyId}>
                      {c.name} ({c.companyId})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
          <span className="text-xs text-muted-foreground font-medium shrink-0 flex items-center gap-1">
            <span>⚡</span>{" "}
            {selectedCompanyId
              ? `Managing permissions on behalf of tenant: ${selectedCompanyName}`
              : "Managing system-wide default platform roles"}
          </span>
        </div>
      )}

      {/* Top Controls Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Role &amp; Permission Management</h1>
              <p className="text-xs text-muted-foreground">
                Granular matrix control with real-time backend synchronization.
              </p>
            </div>
          </div>
          {isSuperAdmin && companies.length > 0 && (
            <div className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 w-fit">
              Managing permissions for: {selectedCompanyName}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Create Custom Role Trigger */}
          <Btn
            onClick={() => setCreateOpen(true)}
            className="py-2 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Custom Role</span>
          </Btn>

          {/* Mode Toggle */}
          <div className="flex items-center bg-muted/60 border border-border p-1 rounded-xl text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("matrix")}
              className={`px-3 py-1.5 rounded-lg transition ${viewMode === "matrix" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Matrix Grid View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("accordion")}
              className={`px-3 py-1.5 rounded-lg transition ${viewMode === "accordion" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Single Role Accordion
            </button>
          </div>

          {viewMode === "accordion" && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-muted-foreground">Role:</span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              >
                <optgroup label="System Built-in Roles">
                  {systemRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </optgroup>
                {customRoles.length > 0 && (
                  <optgroup label="Custom Tenant Roles">
                    {customRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          <PermissionGate permission={PERMISSIONS.SETTINGS_ROLES_EDIT}>
            <Btn
              onClick={() => setConfirmSaveOpen(true)}
              disabled={saving || loading || roles.length === 0}
              className="py-2 shrink-0"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{saving ? "Saving..." : "Save Changes"}</span>
            </Btn>
          </PermissionGate>
        </div>
      </div>

      {/* Confirmation Dialog Overlay */}
      {confirmSaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-indigo-500" />
              Confirm Permission Updates
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to save these permission configuration changes?
              {isSuperAdmin ? (
                <span className="block mt-2 font-bold text-indigo-600 dark:text-indigo-400">
                  ⚠️ You are modifying permissions on behalf of company: "{selectedCompanyName}".
                </span>
              ) : (
                " This will take effect immediately and force active sessions to re-authenticate silently."
              )}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setConfirmSaveOpen(false)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition"
              >
                Cancel
              </button>
              <Btn
                onClick={handleSaveChanges}
                disabled={saving || loading || roles.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2"
              >
                {saving ? "Saving..." : "Confirm & Save"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Role Creation Form Overlay */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateRole}
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4"
          >
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-500" />
              Create Custom Role
            </h2>
            {isSuperAdmin && (
              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20">
                Creating role for company: {selectedCompanyName}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Role Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Technical Director"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-muted/20 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Approve engineering requirements and reviews"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-muted/20 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition"
              >
                Cancel
              </button>
              <Btn
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2"
              >
                Create Role
              </Btn>
            </div>
          </form>
        </div>
      )}

      {/* System Roles vs Custom Roles Tab Control */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border text-xs font-semibold">
          <button
            type="button"
            onClick={() => setRoleTab("system")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition ${
              roleTab === "system"
                ? "bg-card text-foreground shadow-sm font-bold border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
            <span>System Roles</span>
            <span className="rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.2 text-[10px] font-bold">
              {systemRoles.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRoleTab("custom")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition ${
              roleTab === "custom"
                ? "bg-card text-foreground shadow-sm font-bold border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Custom Roles</span>
            <span className="rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.2 text-[10px] font-bold">
              {customRoles.length}
            </span>
          </button>
        </div>

        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          {roleTab === "system" ? (
            <span>Built-in system roles with standard enterprise defaults. Protected from deletion.</span>
          ) : (
            <span>Tenant-specific custom roles with granular permission configuration.</span>
          )}
        </div>
      </div>

      {/* Instant Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Start typing permission name or type..."
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-xs text-muted-foreground hover:text-foreground font-semibold px-3 py-2 border border-border bg-card rounded-xl"
          >
            Clear Search
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <div className="text-sm font-semibold text-muted-foreground">
            {isSuperAdmin && selectedCompanyId
              ? "Loading Tenant Matrix..."
              : "Loading Roles & Permission Matrix..."}
          </div>
        </div>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-border rounded-2xl bg-card space-y-3">
          <ShieldCheck className="h-10 w-10 text-muted-foreground/50" />
          <h3 className="text-sm font-bold text-foreground">No Roles Configured</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {isSuperAdmin && selectedCompanyId
              ? "This tenant does not have any custom or assigned roles configured yet. You can create a custom role above."
              : "No system or custom roles found in this context. You can create a new role above."}
          </p>
        </div>
      ) : visibleRoles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-border rounded-2xl bg-card space-y-3">
          <ShieldCheck className="h-10 w-10 text-muted-foreground/50" />
          <h3 className="text-sm font-bold text-foreground">
            {roleTab === "custom" ? "No Custom Roles Configured" : "No System Roles Found"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {roleTab === "custom"
              ? "This company does not have any custom roles created yet. You can click 'New Custom Role' above to define a tailored role."
              : "No system roles configured for this context."}
          </p>
        </div>
      ) : viewMode === "matrix" ? (
        <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider">
                  <th className="p-4 min-w-[280px] sticky left-0 z-20 bg-muted/90 backdrop-blur border-r border-border">
                    Permissions & Actions
                  </th>
                  {visibleRoles.map((roleObj) => (
                    <th
                      key={roleObj.id}
                      className="p-4 text-center min-w-[130px] border-r border-border/60 relative group"
                    >
                      <div className="flex items-center justify-center gap-1.5 font-bold text-foreground">
                        <span>{roleObj.name}</span>
                        {!roleObj.isSystem && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRole(roleObj.id, roleObj.name)}
                            className="text-red-500 hover:text-red-700 transition font-bold text-sm ml-1 select-none"
                            title={`Delete ${roleObj.name} role`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                            roleObj.isSystem
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                          }`}
                        >
                          {roleObj.isSystem ? "System" : "Custom"}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground normal-case font-mono mt-0.5">
                        {(matrix[roleObj.id] || []).length} active
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredCategories.map((category) => {
                  const isExpanded = expandedCategories[category.id] !== false;
                  const totalCategoryActions = category.subModules.flatMap((s: any) => s.actions);

                  return (
                    <React.Fragment key={category.id}>
                      {/* Category Header Row */}
                      <tr className="bg-muted/20 font-bold border-t border-b border-border">
                        <td className="p-3 sticky left-0 z-10 bg-muted/30 backdrop-blur border-r border-border">
                          <button
                            type="button"
                            onClick={() => toggleCategoryExpand(category.id)}
                            className="flex items-center gap-2 text-foreground hover:text-primary transition"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="text-xs uppercase tracking-wider">
                              {category.name}
                            </span>
                            <span className="ml-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                              {totalCategoryActions.length}
                            </span>
                          </button>
                        </td>
                        {visibleRoles.map((roleObj) => (
                          <td
                            key={roleObj.id}
                            className="p-3 text-center border-r border-border/60"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                toggleSubModuleAll(
                                  roleObj.id,
                                  totalCategoryActions.map((a: any) => a.id),
                                )
                              }
                              title={`Select/Deselect all for ${roleObj.name}`}
                              className="text-[11px] text-muted-foreground hover:text-primary font-semibold"
                            >
                              Toggle All
                            </button>
                          </td>
                        ))}
                      </tr>

                      {/* Category Submodules & Actions */}
                      {isExpanded &&
                        category.subModules.map((subModule: any) => (
                          <React.Fragment key={subModule.id}>
                            {/* Submodule Sub-Header */}
                            <tr className="bg-muted/10 font-semibold border-b border-border/40">
                              <td className="py-2 px-4 pl-8 sticky left-0 z-10 bg-muted/20 backdrop-blur border-r border-border text-foreground font-bold">
                                ▼ {subModule.name}
                              </td>
                              {visibleRoles.map((roleObj) => (
                                <td
                                  key={roleObj.id}
                                  className="py-2 px-2 text-center border-r border-border/40"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleSubModuleAll(
                                        roleObj.id,
                                        subModule.actions.map((a: any) => a.id),
                                      )
                                    }
                                    className="text-[10px] text-primary/80 hover:text-primary font-medium"
                                  >
                                    Select Section
                                  </button>
                                </td>
                              ))}
                            </tr>

                            {/* Actions Rows */}
                            {subModule.actions.map((action: any) => {
                              const featKey = PERMISSION_TO_FEATURE[action.id];
                              const isFeatureEntitled =
                                featKey && selectedCompanyId
                                ? (effectiveFeatures[featKey] ?? true)
                                : true;
                              const checkedRolesKey = visibleRoles
                                .filter(
                                  (r) =>
                                    r.name === "SuperAdmin" ||
                                    rolePermSets.get(r.id)?.has(action.id),
                                )
                                .map((r) => r.id)
                                .join("|");

                              return (
                                <MatrixPermissionRow
                                  key={action.id}
                                  action={action}
                                  roles={visibleRoles}
                                  isFeatureEntitled={isFeatureEntitled}
                                  activeTooltip={activeTooltip === action.id}
                                  onTooltipEnter={() => setActiveTooltip(action.id)}
                                  onTooltipLeave={() => setActiveTooltip(null)}
                                  onToggle={togglePermission}
                                  checkedRolesKey={checkedRolesKey}
                                />
                              );
                            })}
                          </React.Fragment>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <RolePermissionAccordionView
          selectedRole={selectedRole}
          selectedRoleObj={selectedRoleObj}
          matrix={matrix}
          filteredCategories={filteredCategories}
          effectiveFeatures={effectiveFeatures}
          selectedCompanyId={selectedCompanyId}
          permissionToFeature={PERMISSION_TO_FEATURE}
          hasPermission={hasPermission}
          togglePermission={togglePermission}
          toggleSubModuleAll={toggleSubModuleAll}
        />
      )}
    </div>
  );
};
