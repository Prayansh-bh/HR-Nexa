import React, { useState, useMemo, useEffect } from "react";
import {
  Building2,
  Search,
  LogIn,
  Edit3,
  Key,
  Layers,
  HardDrive,
  Calendar,
  Power,
  RotateCcw,
  Trash2,
  Archive,
  Radio,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Sliders,
} from "lucide-react";
import { ManageFeatureOverridesModal } from "../components/ManageFeatureOverridesModal";
import {
  Badge,
  PageHeader,
  btnCls,
  cardCls,
  inputCls,
} from "../../../components/ui/DashboardPrimitives";
import { SaaSCompany } from "../../../store";
import { companyService } from "../../../services/company.service";
import { plansService, SaaSPlan } from "../../../services/plans.service";
import { authService } from "../../../services/auth.service";
import { DEFAULT_HRADMIN_PERMISSIONS } from "../../../types/auth";
import { useCompaniesQuery, useCompanyMutations } from "../../../hooks/useCompaniesQuery";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../../../store/authStore";
import { OWNER_STORAGE_KEYS } from "../../../config/storage";
import { useUIStore } from "../../../store/uiStore";

export function CompanyManagementPage({
  toast,
  setUser,
  selectedId,
  initialModal,
  onViewCompany,
  initialCompanyId,
  defaultTab,
}: {
  toast?: any;
  setUser?: any;
  selectedId?: string;
  initialModal?:
    | "edit"
    | "change_plan"
    | "add_storage"
    | "confirm_trial"
    | "confirm_password"
    | "confirm_suspend"
    | null;
  onViewCompany?: (id: string) => void;
  initialCompanyId?: string;
  defaultTab?: string;
}) {
  const effectiveSelectedId = selectedId || initialCompanyId;
  const { companies, isLoading, isFetching, connectionStatus, lastUpdated, refetch } = useCompaniesQuery();
  const mutations = useCompanyMutations();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(selectedId || null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompName, setNewCompName] = useState("");
  const [newCompContact, setNewCompContact] = useState("");
  const [newCompOwnerEmail, setNewCompOwnerEmail] = useState("");
  const [newCompPlan, setNewCompPlan] = useState<string>("");
  const [companyToDelete, setCompanyToDelete] = useState<SaaSCompany | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [isPlansLoading, setIsPlansLoading] = useState<boolean>(false);

  const [activeModal, setActiveModal] = useState<
    | "edit"
    | "change_plan"
    | "add_storage"
    | "confirm_trial"
    | "confirm_password"
    | "confirm_suspend"
    | "manage_overrides"
    | null
  >(initialModal || null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(false);
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false);

  const navigate = useNavigate();

  const handleCloseModal = () => {
    setActiveModal(null);
  };

  const handleOpenModal = (modal: typeof activeModal) => {
    setActiveModal(modal);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeModal) {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModal]);

  useEffect(() => {
    if (selectedId) setSelectedCompanyId(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (initialModal) setActiveModal(initialModal);
  }, [initialModal]);

  // Edit Profile form states
  const [editName, setEditName] = useState("");
  const [editGst, setEditGst] = useState("");
  const [editPan, setEditPan] = useState("");
  const [editCin, setEditCin] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editHrAdmin, setEditHrAdmin] = useState("");
  const [editOwnerName, setEditOwnerName] = useState("");
  const [editOwnerEmail, setEditOwnerEmail] = useState("");
  const [editPlan, setEditPlan] = useState<string>("PREMIUM");
  const [editBilling, setEditBilling] = useState("");
  const [editStorageUsed, setEditStorageUsed] = useState("");
  const [editStatus, setEditStatus] = useState<"Active" | "Trial" | "Expired" | "Suspended">(
    "Active",
  );
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [editEmployeesCount, setEditEmployeesCount] = useState(1);

  const [selectedPlan, setSelectedPlan] = useState<string>("PREMIUM");
  const [storageAmount, setStorageAmount] = useState<number>(20);
  const [activeTab, setActiveTab] = useState<"ACTIVE_TRIAL" | "SUSPENDED" | "ARCHIVED">("ACTIVE_TRIAL");
  const [companyToPurge, setCompanyToPurge] = useState<SaaSCompany | null>(null);
  const [purgeConfirmInput, setPurgeConfirmInput] = useState("");

  const selectedCompany = useMemo(() => {
    return companies.find((c) => c.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    if (selectedCompany) {
      setEditName(selectedCompany.name || "");
      setEditGst(selectedCompany.gst || "");
      setEditPan(selectedCompany.pan || "");
      setEditCin(selectedCompany.cin || "");
      setEditAddress(selectedCompany.address || "");
      setEditContact(selectedCompany.contact || "");
      setEditHrAdmin(selectedCompany.hrAdmin || "");
      setEditOwnerName(selectedCompany.ownerName || "");
      setEditOwnerEmail(selectedCompany.ownerEmail || "");
      setEditBilling(selectedCompany.billing || "");
      setEditStorageUsed(selectedCompany.storageUsed || "0 GB / 10 GB");
      setEditStatus((selectedCompany.status as any) || "Active");
      setEditExpiryDate(selectedCompany.expiryDate || "");
      setEditEmployeesCount(selectedCompany.employeesCount || 1);

      // Resolve plan code from plan name (or fallback if not found)
      const matchedPlan = plans.find(
        (p) =>
          p.name.toUpperCase() === (selectedCompany.plan || "").toUpperCase() ||
          p.code?.toUpperCase() === (selectedCompany.plan || "").toUpperCase(),
      );
      const planCode = matchedPlan?.code || selectedCompany.plan || "PLAN_PREM";
      setEditPlan(planCode);
      setSelectedPlan(planCode);
    }
  }, [selectedCompanyId, companies, plans]);

  const fetchPlans = async () => {
    setIsPlansLoading(true);
    setPlansError(null);
    try {
      const data = await plansService.getSelectablePlans();
      if (Array.isArray(data)) {
        setPlans(data);
      } else {
        setPlansError("Failed to load valid plans data.");
      }
    } catch (err: any) {
      console.error(err);
      setPlansError(err?.message || "Failed to load plans from server.");
    } finally {
      setIsPlansLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (plans.length > 0) {
      setNewCompPlan(plans[0].code || "");
    }
  }, [plans]);

  const activeTrialCount = useMemo(() => {
    return companies.filter(
      (c) =>
        c.status === "Active" ||
        c.status === "Trial" ||
        c.status === "Pending" ||
        c.status === "PENDING_APPROVAL" ||
        c.status === "Pending Approval",
    ).length;
  }, [companies]);

  const suspendedCount = useMemo(() => {
    return companies.filter((c) => c.status === "Suspended" || c.status === "Expired").length;
  }, [companies]);

  const archivedCount = useMemo(() => {
    return companies.filter((c) => c.status === "Archived" || c.status === "Cancelled").length;
  }, [companies]);

  const tabFiltered = useMemo(() => {
    return companies.filter((c) => {
      if (activeTab === "ACTIVE_TRIAL") {
        return (
          c.status === "Active" ||
          c.status === "Trial" ||
          c.status === "Pending" ||
          c.status === "PENDING_APPROVAL" ||
          c.status === "Pending Approval"
        );
      }
      if (activeTab === "SUSPENDED") {
        return c.status === "Suspended" || c.status === "Expired";
      }
      if (activeTab === "ARCHIVED") {
        return c.status === "Archived" || c.status === "Cancelled";
      }
      return true;
    });
  }, [companies, activeTab]);

  const filtered = useMemo(() => {
    return tabFiltered.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, tabFiltered]);

  const handleUpdateStatus = async (
    id: string,
    newStatus: "Active" | "Trial" | "Expired" | "Suspended",
  ) => {
    try {
      await mutations.updateStatus.mutateAsync({ id, status: newStatus });
      if (toast) toast(`Company status updated to ${newStatus}`, "success");
    } catch (err: any) {
      if (toast) toast(err?.message || "Failed to update company status", "error");
    }
  };

  const handleConfirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    try {
      await mutations.deleteCompany.mutateAsync(companyToDelete.id);
      if (selectedCompanyId === companyToDelete.id) {
        setSelectedCompanyId(null);
      }
      if (toast) toast(`Company "${companyToDelete.name}" archived successfully`, "success");
      setCompanyToDelete(null);
    } catch (err: any) {
      if (toast) toast(err?.message || "Failed to archive company", "error");
    }
  };

  const handleConfirmPurgeCompany = async () => {
    if (!companyToPurge) return;
    if (purgeConfirmInput.trim().toLowerCase() !== companyToPurge.name.trim().toLowerCase()) {
      if (toast) toast("Company name confirmation does not match exactly.", "error");
      return;
    }
    try {
      await mutations.purgeCompany.mutateAsync({
        id: companyToPurge.id,
        confirmCompanyName: purgeConfirmInput,
      });
      if (selectedCompanyId === companyToPurge.id) {
        setSelectedCompanyId(null);
      }
      if (toast)
        toast(
          `Company "${companyToPurge.name}" and all associated data permanently purged.`,
          "success",
        );
      setCompanyToPurge(null);
      setPurgeConfirmInput("");
    } catch (err: any) {
      if (toast) toast(err?.message || "Failed to purge company", "error");
    }
  };

  const handleLoginAs = async () => {
    if (!selectedCompany || isImpersonating) return;
    setIsImpersonating(true);
    try {
      const res = await authService.impersonate(selectedCompany.companyId, selectedCompany.name);
      if (res) {
        if (toast) {
          toast(`Opening Tenant HRMS session for ${selectedCompany.name}...`, "success");
        }
      }
    } catch (err: any) {
      if (toast) toast(err?.message || "Impersonation failed", "error");
    } finally {
      setIsImpersonating(false);
    }
  };

  const handleApproveCompany = () => {
    if (!selectedCompany) return;
    useUIStore.getState().setConfirmState({
      open: true,
      title: "Approve Company Registration",
      message: `Are you sure you want to approve "${selectedCompany.name}"? This will activate their trial subscription and grant system access.`,
      confirmText: "Approve Company",
      cancelText: "Cancel",
      confirmVariant: "primary",
      onConfirm: async () => {
        try {
          await mutations.approveCompany.mutateAsync(selectedCompany.id);
          if (toast) toast(`Company "${selectedCompany.name}" approved successfully! Trial activated.`, "success");
        } catch (err: any) {
          if (toast) toast(err?.message || "Failed to approve company", "error");
        }
      },
    });
  };

  const handleRejectCompany = () => {
    if (!selectedCompany) return;
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !editName.trim()) return;
    try {
      await mutations.editProfile.mutateAsync({
        id: selectedCompany.id,
        data: {
          name: editName,
          gst: editGst,
          pan: editPan,
          cin: editCin,
          address: editAddress,
          contact: editContact,
          hrAdmin: editHrAdmin,
          ownerName: editOwnerName,
          ownerEmail: editOwnerEmail,
          plan: editPlan,
          billing: editBilling,
          storageUsed: editStorageUsed,
          status: editStatus,
          expiryDate: editExpiryDate,
          employeesCount: editEmployeesCount,
        },
      });
      handleCloseModal();
      if (toast) toast("Company profile updated successfully", "success");
    } catch (err: any) {
      if (toast) toast(err?.message || "Failed to edit profile", "error");
    }
  };

  const handleResetPasswordSubmit = async () => {
    if (!selectedCompany || isResettingPassword) return;
    setIsResettingPassword(true);
    try {
      const res = await companyService.resetPassword(selectedCompany.id);
      handleCloseModal();
      if (toast) toast(res.message || "Password reset link sent", "success");
    } catch (err: any) {
      if (toast) toast(err?.message || "Failed to reset password", "error");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleChangePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    try {
      await mutations.changePlan.mutateAsync({ id: selectedCompany.id, plan: selectedPlan });
      handleCloseModal();
      if (toast) toast(`Plan changed to ${selectedPlan} successfully`, "success");
    } catch (err: any) {
      if (toast) toast(err?.message || "Failed to change plan", "error");
    }
  };

  const handleAddStorageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    try {
      const res = await mutations.addStorage.mutateAsync({
        id: selectedCompany.id,
        storageGB: storageAmount,
      });
      handleCloseModal();
      if (toast) toast(res.message || `Successfully added ${storageAmount} GB storage`, "success");
    } catch (err: any) {
      if (toast) toast(err?.message || "Failed to add storage", "error");
    }
  };

  const handleExtendTrialSubmit = async () => {
    if (!selectedCompany) return;
    try {
      await mutations.extendTrial.mutateAsync(selectedCompany.id);
      handleCloseModal();
      if (toast) toast("Trial extended by 14 days successfully", "success");
    } catch (err: any) {
      if (toast) toast(err?.message || "Failed to extend trial", "error");
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim()) return;
    try {
      const targetEmail = newCompOwnerEmail.trim();
      const newCompany = await mutations.createCompany.mutateAsync({
        name: newCompName,
        plan: newCompPlan,
        status: "Active",
        ownerName: newCompContact || "HR Admin",
        ownerEmail: targetEmail || undefined,
        contact: newCompContact || "HR Admin",
        hrAdmin: newCompContact || "HR Admin",
      });
      setNewCompName("");
      setNewCompContact("");
      setNewCompOwnerEmail("");
      setShowAddModal(false);
      if (toast)
        toast(
          `Company "${newCompany.name}" created! Welcome invitation & credentials sent to ${targetEmail || "HR Admin"} via Brevo email.`,
          "success",
        );
    } catch (err: any) {
      if (toast) toast(err?.message || "Failed to add company", "error");
    }
  };

  if (isLoading && companies.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="text-sm text-muted-foreground">Loading companies from server...</div>
        </div>
      </div>
    );
  }

  // Connection badge header component
  const ConnectionIndicator = (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
          connectionStatus === "connected"
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
            : connectionStatus === "reconnecting"
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            connectionStatus === "connected"
              ? "bg-emerald-500 animate-pulse"
              : connectionStatus === "reconnecting"
                ? "bg-amber-500 animate-ping"
                : "bg-rose-500"
          }`}
        />
        {connectionStatus === "connected"
          ? "Real-time Sync Active"
          : connectionStatus === "reconnecting"
            ? "Reconnecting SSE..."
            : "Sync Offline"}
      </span>
      {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  );

  if (selectedCompany) {
    return (
      <div className="space-y-6 w-full max-w-6xl mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <button
            onClick={() => {
              if (onViewCompany) {
                navigate({ to: "/super-admin/companies" });
              } else {
                setSelectedCompanyId(null);
              }
            }}
            className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
          >
            &larr; Back to Companies
          </button>
          {ConnectionIndicator}
        </div>

        <PageHeader
          title={selectedCompany.name}
          subtitle={`Company Profile & Settings — Last Synced: ${lastUpdated.toLocaleTimeString()}`}
          action={
            <Badge
              tone={
                selectedCompany.status === "Active"
                  ? "green"
                  : selectedCompany.status === "Trial"
                    ? "sky"
                    : selectedCompany.status === "Pending" ||
                        selectedCompany.status === "PENDING_APPROVAL" ||
                        selectedCompany.status === "Pending Approval"
                      ? "amber"
                      : "rose"
              }
            >
              {selectedCompany.status === "Pending" ? "Pending Approval" : selectedCompany.status}
            </Badge>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className={cardCls}>
              <h3 className="text-lg font-bold mb-4 border-b border-border pb-2">
                Business Details
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">GST Number</span>
                  {selectedCompany.gst || "N/A"}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">PAN Number</span>
                  {selectedCompany.pan || "N/A"}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">CIN Number</span>
                  {selectedCompany.cin || "N/A"}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Registered Address</span>
                  {selectedCompany.address || "N/A"}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Company Contact</span>
                  {selectedCompany.contact || "N/A"}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">HR Administrator</span>
                  {selectedCompany.hrAdmin || "N/A"}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Last Login Activity</span>
                  {selectedCompany.loginActivity || "Just now"}
                </div>
              </div>
            </div>

            <div className={cardCls}>
              <h3 className="text-lg font-bold mb-4 border-b border-border pb-2">
                Usage & Billing
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">Current Plan</span>
                  <span className="font-semibold text-primary">{selectedCompany.plan}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Employee Count</span>
                  {selectedCompany.employeesCount}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Storage Used</span>
                  {selectedCompany.storageUsed || "0 GB / 10 GB"}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Billing Details</span>
                  {selectedCompany.billing || "Active Subscription"}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Active API Keys</span>
                  {selectedCompany.apiKeys || 0}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Last Login Activity</span>
                  {selectedCompany.loginActivity || "Just now"}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className={cardCls}>
              <h3 className="text-base font-bold mb-3">Admin Actions</h3>
              <div className="flex flex-col gap-2">
                {selectedCompany.status === "Archived" || selectedCompany.status === "Cancelled" ? (
                  <>
                    <button
                      disabled
                      className={`${btnCls} w-full justify-start bg-muted text-muted-foreground opacity-40 cursor-not-allowed`}
                      title="Cannot impersonate an archived tenant. Reactivate company first."
                    >
                      <LogIn className="w-4 h-4 mr-2" /> Login as HR Admin (Disabled)
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedCompany.id, "Active")}
                      disabled={mutations.updateStatus.isPending}
                      className={`${btnCls} w-full justify-start bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {mutations.updateStatus.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Reactivating...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4 mr-2" /> Reactivate Company
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setCompanyToPurge(selectedCompany);
                        setPurgeConfirmInput("");
                      }}
                      disabled={mutations.purgeCompany.isPending}
                      className={`${btnCls} w-full justify-start bg-rose-700 hover:bg-rose-800 text-white mt-2 disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Permanently Purge Company
                    </button>
                  </>
                ) : (
                  <>
                    {(selectedCompany.status === "Pending" ||
                      selectedCompany.status === "PENDING_APPROVAL" ||
                      selectedCompany.status === "Pending Approval") && (
                      <>
                        <button
                          onClick={handleApproveCompany}
                          disabled={mutations.approveCompany.isPending}
                          className={`${btnCls} w-full justify-start bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Approve Registration
                        </button>
                        <button
                          onClick={handleRejectCompany}
                          disabled={mutations.rejectCompany.isPending}
                          className={`${btnCls} w-full justify-start bg-rose-600 hover:bg-rose-700 text-white shadow-sm disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          <XCircle className="w-4 h-4 mr-2" /> Reject Registration
                        </button>
                      </>
                    )}
                    {selectedCompany.status === "Active" || selectedCompany.status === "Trial" ? (
                      <button
                        onClick={handleLoginAs}
                        disabled={isImpersonating}
                        className={`${btnCls} w-full justify-start bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {isImpersonating ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Authenticating as HR
                            Admin...
                          </>
                        ) : (
                          <>
                            <LogIn className="w-4 h-4 mr-2" /> Login as HR Admin
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        disabled
                        className={`${btnCls} w-full justify-start bg-muted text-muted-foreground opacity-40 cursor-not-allowed`}
                        title="Cannot impersonate suspended company"
                      >
                        <LogIn className="w-4 h-4 mr-2" /> Login as HR Admin (Disabled)
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenModal("edit")}
                      disabled={mutations.editProfile.isPending}
                      className={`${btnCls} w-full justify-start bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <Edit3 className="w-4 h-4 mr-2" /> Edit Profile
                    </button>
                    <button
                      onClick={() => handleOpenModal("confirm_password")}
                      disabled={isResettingPassword}
                      className={`${btnCls} w-full justify-start bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <Key className="w-4 h-4 mr-2" /> Reset Admin Password
                    </button>
                    <button
                      onClick={() => handleOpenModal("change_plan")}
                      disabled={mutations.changePlan.isPending}
                      className={`${btnCls} w-full justify-start bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <Layers className="w-4 h-4 mr-2" /> Change Plan
                    </button>
                    <button
                      onClick={() => handleOpenModal("add_storage")}
                      disabled={mutations.addStorage.isPending}
                      className={`${btnCls} w-full justify-start bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <HardDrive className="w-4 h-4 mr-2" /> Add Extra Storage
                    </button>
                    <button
                      onClick={() => handleOpenModal("manage_overrides")}
                      className={`${btnCls} w-full justify-start bg-purple-600 hover:bg-purple-700 text-white shadow-sm`}
                    >
                      <Sliders className="w-4 h-4 mr-2" /> Manage Feature Overrides
                    </button>
                    {selectedCompany.status === "Trial" && (
                      <button
                        onClick={() => handleOpenModal("confirm_trial")}
                        disabled={mutations.extendTrial.isPending}
                        className={`${btnCls} w-full justify-start bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        <Calendar className="w-4 h-4 mr-2" /> Extend Trial (+14 Days)
                      </button>
                    )}
                    {selectedCompany.status === "Active" ? (
                      <button
                        onClick={() => handleOpenModal("confirm_suspend")}
                        disabled={mutations.updateStatus.isPending}
                        className={`${btnCls} w-full justify-start bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        <Power className="w-4 h-4 mr-2" /> Suspend Company
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(selectedCompany.id, "Active")}
                        disabled={mutations.updateStatus.isPending}
                        className={`${btnCls} w-full justify-start bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {mutations.updateStatus.isPending ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Activating...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-4 h-4 mr-2" /> Activate Company
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setCompanyToDelete(selectedCompany)}
                      disabled={mutations.deleteCompany.isPending}
                      className={`${btnCls} w-full justify-start bg-rose-600 hover:bg-rose-700 text-white mt-2 disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <Archive className="w-4 h-4 mr-2" /> Archive Company
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal overlays */}
        {activeModal === "edit" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl border border-border max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold">Edit Company Profile</h3>
                  <p className="text-xs text-muted-foreground">
                    Update business parameters, subscription settings, and billing details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCloseModal()}
                  className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditProfileSubmit} className="space-y-6">
                {/* Section 1: Business Details */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-3 pb-1 border-b border-border/60">
                    Business Details
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Company Name *</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={inputCls}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">GST Number</label>
                        <input
                          type="text"
                          placeholder="e.g. 22AAAAA0000A1Z5"
                          value={editGst}
                          onChange={(e) => setEditGst(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">PAN Number</label>
                        <input
                          type="text"
                          placeholder="e.g. ABCDE1234F"
                          value={editPan}
                          onChange={(e) => setEditPan(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">CIN Number</label>
                        <input
                          type="text"
                          placeholder="e.g. U12345MH2026PTC000000"
                          value={editCin}
                          onChange={(e) => setEditCin(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Contact Person</label>
                        <input
                          type="text"
                          placeholder="e.g. Sarah Jenkins"
                          value={editContact}
                          onChange={(e) => setEditContact(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">HR Admin Name</label>
                        <input
                          type="text"
                          placeholder="e.g. HR Admin"
                          value={editHrAdmin}
                          onChange={(e) => setEditHrAdmin(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Owner / Primary Contact Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. John Doe"
                          value={editOwnerName}
                          onChange={(e) => setEditOwnerName(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Owner Email</label>
                        <input
                          type="email"
                          placeholder="admin@company.com"
                          value={editOwnerEmail}
                          onChange={(e) => setEditOwnerEmail(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Office Address</label>
                        <input
                          type="text"
                          placeholder="e.g. 101 Tech Park, Mumbai"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Usage & Billing */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-3 pb-1 border-b border-border/60">
                    Usage & Billing Settings
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Subscription Plan
                        </label>
                        {isPlansLoading ? (
                          <div className="flex items-center gap-2 p-2 border border-border rounded-lg bg-muted text-xs text-muted-foreground animate-pulse">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            Loading plans...
                          </div>
                        ) : plansError ? (
                          <div className="text-xs text-rose-500 border border-rose-200 bg-rose-50/50 p-2 rounded-lg flex items-center justify-between">
                            <span>Error loading plans.</span>
                            <button
                              type="button"
                              onClick={fetchPlans}
                              className="text-xs font-bold text-primary hover:underline ml-1"
                            >
                              Retry
                            </button>
                          </div>
                        ) : plans.length === 0 ? (
                          <div className="text-xs text-amber-600 border border-amber-200 bg-amber-50/50 p-2 rounded-lg">
                            No published plans available.
                          </div>
                        ) : (
                          <select
                            value={editPlan}
                            onChange={(e: any) => setEditPlan(e.target.value)}
                            className={inputCls}
                          >
                            {plans.map((p) => (
                              <option key={p.id} value={p.code}>
                                {p.name} Plan
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Account Status</label>
                        <select
                          value={editStatus}
                          onChange={(e: any) => setEditStatus(e.target.value)}
                          className={inputCls}
                        >
                          <option value="Active">Active</option>
                          <option value="Trial">Trial</option>
                          <option value="Expired">Expired</option>
                          <option value="Suspended">Suspended</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Employee Count</label>
                        <input
                          type="number"
                          min={1}
                          value={editEmployeesCount}
                          onChange={(e) => setEditEmployeesCount(Number(e.target.value))}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Expiry Date</label>
                        <input
                          type="date"
                          value={editExpiryDate}
                          onChange={(e) => setEditExpiryDate(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Storage Allocation / Usage
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 2.5 GB / 10 GB"
                          value={editStorageUsed}
                          onChange={(e) => setEditStorageUsed(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Billing Description
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Annual Invoice Paid"
                          value={editBilling}
                          onChange={(e) => setEditBilling(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => handleCloseModal()}
                    disabled={mutations.editProfile.isPending}
                    className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={mutations.editProfile.isPending}
                    className={`${btnCls} disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {mutations.editProfile.isPending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving Changes...
                      </>
                    ) : (
                      "Save Profile & Billing Changes"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeModal === "confirm_password" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold mb-2">Reset Password</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to send a password reset email to{" "}
                <span className="font-semibold text-foreground">
                  {selectedCompany.ownerEmail || selectedCompany.contact || "HR Admin"}
                </span>
                ?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleCloseModal()}
                  disabled={isResettingPassword}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPasswordSubmit}
                  disabled={isResettingPassword}
                  className={`${btnCls} bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {isResettingPassword ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending Reset
                      Link...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeModal === "change_plan" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold mb-4">Change Plan</h3>
              {isPlansLoading ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Loading active plans...
                </div>
              ) : plansError ? (
                <div className="space-y-4 py-2">
                  <div className="text-sm text-rose-500 border border-rose-200 bg-rose-50/50 p-3 rounded-lg flex items-center justify-between">
                    <span>{plansError}</span>
                    <button
                      type="button"
                      onClick={fetchPlans}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => handleCloseModal()}
                      className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : plans.length === 0 ? (
                <div className="space-y-4 py-2">
                  <div className="text-sm text-amber-600 border border-amber-200 bg-amber-50/50 p-3 rounded-lg">
                    No active plans are currently published or available. Please configure your
                    plans first.
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => handleCloseModal()}
                      className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleChangePlanSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-2">Select Plan</label>
                    <div className="space-y-2">
                      {plans.map((p) => {
                        const pCode = p.code || p.name;
                        return (
                          <label
                            key={pCode}
                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                              selectedPlan === pCode
                                ? "border-primary bg-primary/5 font-semibold"
                                : "border-border hover:bg-accent"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="plan"
                                value={pCode}
                                checked={selectedPlan === pCode}
                                onChange={() => setSelectedPlan(pCode)}
                                className="text-primary"
                              />
                              <span>{p.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {p.employeeLimit
                                ? `Up to ${p.employeeLimit} Employees`
                                : "Unlimited / Enterprise"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => handleCloseModal()}
                      disabled={mutations.changePlan.isPending}
                      className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={mutations.changePlan.isPending}
                      className={`${btnCls} disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {mutations.changePlan.isPending ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Updating Plan...
                        </>
                      ) : (
                        "Update Plan"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {activeModal === "add_storage" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold mb-4">Add Storage</h3>
              <form onSubmit={handleAddStorageSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Storage Pack</label>
                  <select
                    value={storageAmount}
                    onChange={(e) => setStorageAmount(Number(e.target.value))}
                    className={inputCls}
                  >
                    <option value={10}>+10 GB Extra Storage</option>
                    <option value={20}>+20 GB Extra Storage</option>
                    <option value={50}>+50 GB Extra Storage</option>
                    <option value={100}>+100 GB Extra Storage</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => handleCloseModal()}
                    disabled={mutations.addStorage.isPending}
                    className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={mutations.addStorage.isPending}
                    className={`${btnCls} disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {mutations.addStorage.isPending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Adding Storage...
                      </>
                    ) : (
                      "Add Storage"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeModal === "confirm_trial" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold mb-2">Extend Trial</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Extend trial duration by an additional 14 days for{" "}
                <span className="font-semibold text-foreground">{selectedCompany.name}</span>?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleCloseModal()}
                  disabled={mutations.extendTrial.isPending}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtendTrialSubmit}
                  disabled={mutations.extendTrial.isPending}
                  className={`${btnCls} bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {mutations.extendTrial.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Extending Trial...
                    </>
                  ) : (
                    "Confirm Extension"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeModal === "confirm_suspend" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold mb-2 text-orange-600">Suspend Company</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to suspend{" "}
                <span className="font-semibold text-foreground">{selectedCompany.name}</span>? This
                will block system access for all employees and administrators of this company.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleCloseModal()}
                  disabled={mutations.updateStatus.isPending}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleUpdateStatus(selectedCompany.id, "Suspended");
                    handleCloseModal();
                  }}
                  disabled={mutations.updateStatus.isPending}
                  className={`${btnCls} bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {mutations.updateStatus.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Suspending...
                    </>
                  ) : (
                    "Confirm Suspension"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {companyToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold mb-2 text-rose-600">Archive Company</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to archive{" "}
                <span className="font-semibold text-foreground">{companyToDelete.name}</span>? This
                will disable logins for all users of this company while preserving audit, compliance,
                and payroll records. The company can be reactivated later.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCompanyToDelete(null)}
                  disabled={mutations.deleteCompany.isPending}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteCompany}
                  disabled={mutations.deleteCompany.isPending}
                  className={`${btnCls} bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {mutations.deleteCompany.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Archiving...
                    </>
                  ) : (
                    "Confirm Archive"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {companyToPurge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl border-2 border-rose-500/30 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-3 text-rose-600">
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Permanently Purge Company</h3>
                  <p className="text-xs text-rose-600 font-semibold uppercase tracking-wider">
                    Irreversible Destructive Action
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 mb-4 space-y-1.5 leading-relaxed">
                <p className="font-bold">⚠️ Warning: Permanent Data Loss</p>
                <p>
                  This action permanently wipes all data belonging to{" "}
                  <strong>"{companyToPurge.name}"</strong> across all 32 tenant child entities
                  (employees, departments, attendance, leave, payroll, tax declarations, expense
                  claims, support tickets, and uploaded documents).
                </p>
                <p>This action cannot be undone.</p>
              </div>

              <div className="space-y-3 mb-5">
                <label className="block text-xs font-semibold text-foreground">
                  To confirm permanent deletion, please type the exact company name{" "}
                  <span className="font-bold text-rose-600 underline select-all">
                    {companyToPurge.name}
                  </span>{" "}
                  below:
                </label>
                <input
                  type="text"
                  value={purgeConfirmInput}
                  onChange={(e) => setPurgeConfirmInput(e.target.value)}
                  placeholder={companyToPurge.name}
                  className={`${inputCls} border-rose-300 dark:border-rose-800 focus:border-rose-500 focus:ring-rose-500/20`}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCompanyToPurge(null);
                    setPurgeConfirmInput("");
                  }}
                  disabled={mutations.purgeCompany.isPending}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPurgeCompany}
                  disabled={
                    mutations.purgeCompany.isPending ||
                    purgeConfirmInput.trim().toLowerCase() !==
                      companyToPurge.name.trim().toLowerCase()
                  }
                  className={`${btnCls} bg-rose-700 hover:bg-rose-800 text-white disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {mutations.purgeCompany.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Purging Data...
                    </>
                  ) : (
                    "Permanently Delete Tenant"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Reject Registration Modal */}
        {rejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold mb-2 text-rose-600">Reject Company Registration</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Please enter an optional reason for rejecting the registration of{" "}
                <strong className="text-foreground">{selectedCompany.name}</strong>.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Incomplete business verification documents..."
                rows={3}
                className="w-full rounded-xl border border-input bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary mb-4 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectModalOpen(false);
                    setRejectReason("");
                  }}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={rejecting}
                  onClick={async () => {
                    try {
                      setRejecting(true);
                      await mutations.rejectCompany.mutateAsync({
                        id: selectedCompany.id,
                        reason: rejectReason.trim() || undefined,
                      });
                      if (toast) toast(`Company "${selectedCompany.name}" registration rejected.`, "info");
                      setRejectModalOpen(false);
                      setRejectReason("");
                    } catch (err: any) {
                      if (toast) toast(err?.message || "Failed to reject company", "error");
                    } finally {
                      setRejecting(false);
                    }
                  }}
                  className={`${btnCls} bg-rose-600 hover:bg-rose-700 text-white`}
                >
                  {rejecting ? "Rejecting..." : "Reject Registration"}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeModal === "manage_overrides" && selectedCompany && (
          <ManageFeatureOverridesModal
            company={{
              id: selectedCompany.companyId || selectedCompany.id,
              name: selectedCompany.name,
              plan: selectedCompany.plan,
            }}
            onClose={handleCloseModal}
            onUpdated={() => {
              refetch();
            }}
            toast={toast}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <PageHeader
            title="Company Management"
            subtitle={`Manage SaaS tenant accounts, subscriptions, & onboarding — Last Synced: ${lastUpdated.toLocaleTimeString()}`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {ConnectionIndicator}
          <button onClick={() => setShowAddModal(true)} className={btnCls}>
            + Onboard New Company
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("ACTIVE_TRIAL")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 shrink-0 ${
            activeTab === "ACTIVE_TRIAL"
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <span>Active & Trial</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === "ACTIVE_TRIAL"
                ? "bg-white/20 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {activeTrialCount}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("SUSPENDED")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 shrink-0 ${
            activeTab === "SUSPENDED"
              ? "bg-orange-600 text-white shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <span>Suspended</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === "SUSPENDED"
                ? "bg-white/20 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {suspendedCount}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("ARCHIVED")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 shrink-0 ${
            activeTab === "ARCHIVED"
              ? "bg-zinc-800 dark:bg-zinc-700 text-white shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <span>Archived</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === "ARCHIVED"
                ? "bg-white/20 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {archivedCount}
          </span>
        </button>
      </div>

      {/* Search Bar & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search company by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>
        <div className="text-xs text-muted-foreground font-medium">
          Showing: <span className="font-bold text-foreground">{filtered.length}</span> of{" "}
          <span className="font-bold text-foreground">{companies.length}</span>
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((company) => (
          <div
            key={company.id}
            className={`${cardCls} cursor-pointer transition hover:border-primary/50 relative flex flex-col justify-between`}
            onClick={() => {
              if (onViewCompany) {
                onViewCompany(company.id);
              } else {
                setSelectedCompanyId(company.id);
              }
            }}
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    {company.logo || company.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className="font-bold text-base hover:text-primary transition truncate"
                      title={company.name}
                    >
                      {company.name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {company.ownerEmail || company.contact || "Admin"}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 ml-2">
                  <Badge
                    tone={
                      company.status === "Active"
                        ? "green"
                        : company.status === "Trial"
                          ? "sky"
                          : company.status === "Pending" ||
                              company.status === "PENDING_APPROVAL" ||
                              company.status === "Pending Approval"
                            ? "amber"
                            : "rose"
                    }
                  >
                    {company.status === "Pending" ? "Pending Approval" : company.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs py-3 border-y border-border/60 my-3">
                <div>
                  <span className="text-muted-foreground block">Plan</span>
                  <span className="font-semibold text-foreground">{company.plan}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Employees</span>
                  <span className="font-semibold text-foreground">{company.employeesCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Purchased Seats</span>
                  <span className="font-semibold text-foreground">
                    {company.purchasedSeats ?? 50}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Expiry Date</span>
                  <span className="font-semibold text-foreground">
                    {company.expiryDate || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-primary">View Details &rarr;</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCompanyId(company.id);
                    setActiveModal("manage_overrides");
                  }}
                  className="text-muted-foreground hover:text-primary p-1 transition"
                  title="Manage Feature Overrides"
                >
                  <Sliders className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCompanyToDelete(company);
                  }}
                  className="text-muted-foreground hover:text-rose-600 p-1 transition"
                  title="Delete Company"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 bg-card rounded-2xl border border-border">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="font-bold text-lg mb-1">No Companies Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No company records matched your search query. Try searching for a different company
              name or onboard a new company.
            </p>
          </div>
        )}
      </div>

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-4">Onboard New Company</h3>
            <form onSubmit={handleCreateCompany} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Company Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corporation"
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">HR Admin Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={newCompContact}
                  onChange={(e) => setNewCompContact(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">HR Admin Email *</label>
                <input
                  type="email"
                  placeholder="admin@company.com"
                  value={newCompOwnerEmail}
                  onChange={(e) => setNewCompOwnerEmail(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Subscription Plan</label>
                {isPlansLoading ? (
                  <div className="flex items-center gap-2 p-2 border border-border rounded-lg bg-muted text-xs text-muted-foreground animate-pulse">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Loading plans...
                  </div>
                ) : plansError ? (
                  <div className="text-xs text-rose-500 border border-rose-200 bg-rose-50/50 p-2 rounded-lg flex items-center justify-between">
                    <span>Error loading plans.</span>
                    <button
                      type="button"
                      onClick={fetchPlans}
                      className="text-xs font-bold text-primary hover:underline ml-1"
                    >
                      Retry
                    </button>
                  </div>
                ) : plans.length === 0 ? (
                  <div className="text-xs text-amber-600 border border-amber-200 bg-amber-50/50 p-2 rounded-lg">
                    No published plans available.
                  </div>
                ) : (
                  <select
                    value={newCompPlan}
                    onChange={(e: any) => setNewCompPlan(e.target.value)}
                    className={inputCls}
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.name} Plan
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className={btnCls}>
                  Create & Send Welcome Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {companyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-2 text-rose-600">Delete Company</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-foreground">{companyToDelete.name}</span>? This
              action will remove all subscription data, employees, and tenant records.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCompanyToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteCompany}
                className={`${btnCls} bg-rose-600 hover:bg-rose-700 text-white`}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyManagementPage;
