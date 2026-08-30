import { createFileRoute, Outlet, redirect, useNavigate, useLocation } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { useOwnerAuthStore } from "../store/authStore";
import { ownerAuthService } from "../services/auth.service";
import { clearOwnerSession } from "../api/axios";
import { OWNER_STORAGE_KEYS } from "../config/storage";
import { useTheme } from "../context/ThemeContext";
import {
  Shield,
  LayoutDashboard,
  Building2,
  CreditCard,
  Users,
  Settings,
  Activity,
  LogOut,
  ChevronRight,
  ExternalLink,
  Layers,
  Receipt,
  Key,
  LifeBuoy,
  UserPlus,
  FileText,
  Bell,
  Clock,
  Database,
  BarChart3,
  Sun,
  Moon,
  Menu,
  Lock,
  Loader2,
  Mail,
  CheckCircle2,
  Cpu,
} from "lucide-react";
import { TENANT_APP_URL } from "../config/api";
import { useUIStore } from "../store/uiStore";
import { ConfirmModal } from "../components/ui";
import { ToastHost } from "../hooks/useToast";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    const userString =
      typeof window !== "undefined"
        ? localStorage.getItem(OWNER_STORAGE_KEYS.USER)
        : null;

    if (!userString) {
      throw redirect({ to: "/login" });
    }

    try {
      const user = JSON.parse(userString);
      if (user.role !== "SuperAdmin") {
        throw redirect({ to: "/login" });
      }
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: OwnerAppLayout,
});

function OwnerAppLayout() {
  const { user, clearAuth, setUser } = useOwnerAuthStore();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const confirmState = useUIStore((s) => s.confirmState);
  const setConfirmState = useUIStore((s) => s.setConfirmState);

  // SuperAdmin Change Password Modal State
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // SuperAdmin Change Email Modal State
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<"REQUEST" | "VERIFY" | "SUCCESS">("REQUEST");
  const [emailForm, setEmailForm] = useState({ currentPassword: "", newEmail: "", confirmEmail: "" });
  const [otpCode, setOtpCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Auto-close mobile drawer on route navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mobileOpen) setMobileOpen(false);
        if (changePasswordOpen) setChangePasswordOpen(false);
        if (changeEmailOpen) setChangeEmailOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, changePasswordOpen, changeEmailOpen]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.currentPassword || !passwords.newPassword) return;
    if (passwords.newPassword.length < 8) {
      setPasswordStatus({ type: "error", message: "New password must be at least 8 characters long." });
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordStatus({ type: "error", message: "New passwords do not match." });
      return;
    }

    setPasswordLoading(true);
    setPasswordStatus(null);
    try {
      const res = await ownerAuthService.changePassword(passwords.currentPassword, passwords.newPassword);
      setPasswordStatus({ type: "success", message: res.message || "SuperAdmin password updated successfully!" });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      setPasswordStatus({ type: "error", message: err.message || "Failed to update password. Verify your current password." });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.currentPassword || !emailForm.newEmail) return;
    if (emailForm.newEmail.trim().toLowerCase() !== emailForm.confirmEmail.trim().toLowerCase()) {
      setEmailStatus({ type: "error", message: "New email addresses do not match." });
      return;
    }

    setEmailLoading(true);
    setEmailStatus(null);
    try {
      const res = await ownerAuthService.requestSuperAdminEmailChange(
        emailForm.currentPassword,
        emailForm.newEmail.trim(),
      );
      setChallengeToken(res.challengeToken);
      setEmailStep("VERIFY");
      setEmailStatus({
        type: "success",
        message: `Verification code sent to ${res.newEmail}. Please check your inbox and enter the 6-digit code below.`,
      });
    } catch (err: any) {
      setEmailStatus({
        type: "error",
        message: err.message || "Failed to request email change. Please verify your current password.",
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setEmailStatus({ type: "error", message: "Please enter the complete 6-digit verification code." });
      return;
    }

    setEmailLoading(true);
    setEmailStatus(null);
    try {
      const res = await ownerAuthService.verifySuperAdminEmailChange(
        challengeToken,
        otpCode.trim(),
        emailForm.newEmail.trim(),
      );
      setEmailStep("SUCCESS");
      setEmailStatus({
        type: "success",
        message: res.message || "SuperAdmin email changed successfully!",
      });
    } catch (err: any) {
      setEmailStatus({
        type: "error",
        message: err.message || "Failed to verify code. Please check the code and try again.",
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleFinishEmailChange = () => {
    clearOwnerSession();
    useOwnerAuthStore.getState().clearAuth();
    setChangeEmailOpen(false);
    navigate({ to: "/login" });
  };

  // Sync profile & permissions on session mount
  useEffect(() => {
    let cancelled = false;
    async function syncOwnerProfile() {
      try {
        const [profile, perms] = await Promise.all([
          ownerAuthService.getProfile(),
          ownerAuthService.getMyPermissions(),
        ]);
        if (!cancelled && profile && profile.role === "SuperAdmin") {
          setUser({
            ...profile,
            permissions: perms?.permissions || profile.permissions || [],
          });
        }
      } catch (err) {
        console.warn("Owner session sync warning:", err);
      }
    }
    void syncOwnerProfile();
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  const handleLogout = async () => {
    await ownerAuthService.logout();
    clearAuth();
    navigate({ to: "/login" });
  };

  const navSections = [
    {
      title: "Core Platform",
      items: [
        { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
        { label: "Companies", icon: Building2, path: "/companies" },
        { label: "Subscriptions", icon: CreditCard, path: "/subscriptions" },
        { label: "Plans & Tiers", icon: Layers, path: "/plans" },
        { label: "Billing & Invoices", icon: Receipt, path: "/billing" },
      ],
    },
    {
      title: "Administration",
      items: [
        { label: "User Management", icon: Users, path: "/users" },
        { label: "Roles & Permissions", icon: Key, path: "/roles" },
        { label: "Support Helpdesk", icon: LifeBuoy, path: "/support" },
        { label: "Platform Recruitment", icon: UserPlus, path: "/recruitment" },
      ],
    },
    {
      title: "System & Governance",
      items: [
        { label: "System Health", icon: Activity, path: "/monitoring" },
        { label: "Audit Logs", icon: FileText, path: "/audit-logs" },
        { label: "Reports & Analytics", icon: BarChart3, path: "/reports" },
        { label: "Notifications", icon: Bell, path: "/notifications" },
        { label: "Activity Timeline", icon: Clock, path: "/timeline" },
        { label: "Backup & Restore", icon: Database, path: "/backup" },
        { label: "Global Settings", icon: Settings, path: "/settings" },
        { label: "Platform Integrations", icon: Cpu, path: "/integrations" },
      ],
    },
  ];

  const currentPath = location.pathname;

  const renderNavContent = (isDrawer = false) => {
    const showLabels = isDrawer || !collapsed;
    return (
      <div className="flex h-full flex-col">
        {/* Header Branding */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            {showLabels && (
              <div className="flex flex-col overflow-hidden min-w-0">
                <span className="text-sm font-bold tracking-tight text-foreground truncate">
                  HR NEXA
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Owner Console
                </span>
              </div>
            )}
          </div>
          {isDrawer && (
            <button
              onClick={() => setMobileOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-4 p-3 overflow-y-auto">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {showLabels && (
                <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </div>
              )}
              {section.items.map((item, idx) => {
                const isActive =
                  item.path === "/dashboard"
                    ? currentPath === "/dashboard" || currentPath === "/"
                    : currentPath.startsWith(item.path);

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      navigate({ to: item.path as any });
                      if (isDrawer) setMobileOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all text-left ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    title={!showLabels ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {showLabels && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Info & Footer */}
        <div className="border-t border-border p-3 space-y-2 shrink-0">
          {showLabels && (
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-muted/40 border border-border">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                {user?.initials || "SA"}
              </div>
              <div className="flex flex-col overflow-hidden min-w-0">
                <span className="text-xs font-medium text-foreground truncate">{user?.name || "SuperAdmin"}</span>
                <span className="text-[10px] text-muted-foreground truncate">{user?.email || "owner@hrnexa.com"}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setChangeEmailOpen(true);
              setEmailStep("REQUEST");
              setEmailForm({ currentPassword: "", newEmail: "", confirmEmail: "" });
              setOtpCode("");
              setChallengeToken("");
              setEmailStatus(null);
              if (isDrawer) setMobileOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={!showLabels ? "Change Email" : undefined}
          >
            <Mail className="h-4 w-4 shrink-0 text-primary" />
            {showLabels && <span>Change Email</span>}
          </button>

          <button
            onClick={() => {
              setChangePasswordOpen(true);
              setPasswordStatus(null);
              if (isDrawer) setMobileOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={!showLabels ? "Change Password" : undefined}
          >
            <Key className="h-4 w-4 shrink-0 text-primary" />
            {showLabels && <span>Change Password</span>}
          </button>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            title={!showLabels ? "Sign Out" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {showLabels && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground font-sans">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity animate-in fade-in duration-200"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Off-Canvas Drawer (< lg) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card/98 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Mobile Navigation"
      >
        {renderNavContent(true)}
      </aside>

      {/* Desktop Persistent Sidebar (>= lg) */}
      <aside
        className={`hidden lg:flex lg:flex-col shrink-0 border-r border-border bg-card/95 backdrop-blur-xl transition-[width] duration-300 z-30 sticky top-0 h-screen overflow-hidden ${
          collapsed ? "w-20" : "w-64"
        }`}
        aria-label="Desktop Navigation"
      >
        {renderNavContent(false)}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        {/* Top App Header */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 sm:px-6 backdrop-blur-md min-w-0 w-full">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Drawer Trigger (< lg) */}
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors lg:hidden"
              aria-label="Open mobile menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Desktop Collapse Trigger (>= lg) */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Breadcrumb path */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden text-xs">
              <span className="hidden sm:inline font-medium text-muted-foreground truncate">HR Nexa Platform</span>
              <ChevronRight className="hidden sm:inline h-3 w-3 shrink-0 text-muted-foreground/60" />
              <span className="font-semibold text-foreground truncate">Owner Environment</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors shadow-sm cursor-pointer shrink-0"
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-amber-400 animate-in fade-in zoom-in" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-500 animate-in fade-in zoom-in" />
              )}
            </button>

            {/* Link to Tenant Portal */}
            <a
              href={TENANT_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 sm:px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm shrink-0"
              title="Open Tenant Application"
            >
              <span className="hidden sm:inline">Open Tenant App</span>
              <span className="sm:hidden">Tenant App</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </div>
        </header>

        {/* Outlet for Child Routes */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 w-full bg-background overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* SuperAdmin Change Password Modal */}
      {changePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex shrink-0 items-center justify-between border-b border-border p-4 sm:p-5">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Lock className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm sm:text-base">Change SuperAdmin Password</span>
              </div>
              <button
                onClick={() => setChangePasswordOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto">
              {passwordStatus?.type === "success" ? (
                <div className="space-y-4 py-2">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
                    {passwordStatus.message}
                  </div>
                  <button
                    type="button"
                    onClick={() => setChangePasswordOpen(false)}
                    className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Update your platform root authentication credentials. Changing your password will revoke all other active SuperAdmin sessions.
                  </p>

                  {passwordStatus?.type === "error" && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                      {passwordStatus.message}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwords.currentPassword}
                      onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                      placeholder="••••••••••••"
                      required
                      className="w-full rounded-xl border border-input bg-background py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwords.newPassword}
                      onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                      placeholder="Minimum 8 characters"
                      required
                      className="w-full rounded-xl border border-input bg-background py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwords.confirmPassword}
                      onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                      required
                      className="w-full rounded-xl border border-input bg-background py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setChangePasswordOpen(false)}
                      className="rounded-xl border border-border px-4 py-2 text-xs font-medium hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {passwordLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Update Password
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SuperAdmin Change Email Modal */}
      {changeEmailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex shrink-0 items-center justify-between border-b border-border p-4 sm:p-5">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Mail className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm sm:text-base">Change SuperAdmin Email</span>
              </div>
              <button
                onClick={() => setChangeEmailOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto">
              {emailStep === "SUCCESS" ? (
                <div className="space-y-4 py-2">
                  <div className="flex flex-col items-center text-center p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 space-y-2">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                    <h3 className="font-semibold text-foreground text-sm">Email Changed Successfully</h3>
                    <p className="text-xs text-muted-foreground">
                      Your platform SuperAdmin email address has been updated to{" "}
                      <strong className="text-foreground">{emailForm.newEmail}</strong>.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      For security, all active sessions have been terminated. Please log in with your new email address.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFinishEmailChange}
                    className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  >
                    Log In with New Email
                  </button>
                </div>
              ) : emailStep === "VERIFY" ? (
                <form onSubmit={handleVerifyEmailChange} className="space-y-4">
                  <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs text-foreground">
                    A 6-digit verification code was dispatched to{" "}
                    <strong>{emailForm.newEmail}</strong>. Please enter the code to confirm this change.
                  </div>

                  {emailStatus?.type === "error" && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                      {emailStatus.message}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      6-Digit Verification Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      required
                      className="w-full rounded-xl border border-input bg-background py-2.5 px-3 text-center text-lg font-bold tracking-widest text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailStep("REQUEST");
                        setEmailStatus(null);
                      }}
                      className="rounded-xl border border-border px-4 py-2 text-xs font-medium hover:bg-muted"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={emailLoading || otpCode.length !== 6}
                      className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                    >
                      {emailLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Confirm Email Change
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRequestEmailChange} className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Update the root SuperAdmin identity email for the platform. A 6-digit verification code will be sent to the new address to verify ownership.
                  </p>

                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    Current Email: <strong className="text-foreground">{user?.email || "owner@hrnexa.com"}</strong>
                  </div>

                  {emailStatus?.type === "error" && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                      {emailStatus.message}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={emailForm.currentPassword}
                      onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
                      placeholder="••••••••••••"
                      required
                      className="w-full rounded-xl border border-input bg-background py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      New Email Address
                    </label>
                    <input
                      type="email"
                      value={emailForm.newEmail}
                      onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                      placeholder="new-superadmin@yourdomain.com"
                      required
                      className="w-full rounded-xl border border-input bg-background py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Confirm New Email Address
                    </label>
                    <input
                      type="email"
                      value={emailForm.confirmEmail}
                      onChange={(e) => setEmailForm({ ...emailForm, confirmEmail: e.target.value })}
                      placeholder="Confirm new email address"
                      required
                      className="w-full rounded-xl border border-input bg-background py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setChangeEmailOpen(false)}
                      className="rounded-xl border border-border px-4 py-2 text-xs font-medium hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={emailLoading || !emailForm.currentPassword || !emailForm.newEmail}
                      className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                    >
                      {emailLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Send Verification Code
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Confirmation Dialog */}
      {confirmState.open && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          cancelText={confirmState.cancelText}
          confirmVariant={confirmState.confirmVariant}
          onConfirm={() => {
            confirmState.onConfirm();
            setConfirmState({ ...confirmState, open: false });
          }}
          onCancel={() => setConfirmState({ ...confirmState, open: false })}
        />
      )}

      {/* Global Toast Host */}
      <ToastHost />
    </div>
  );
}
