import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useState } from "react";
import { ownerAuthService } from "../services/auth.service";
import { useOwnerAuthStore } from "../store/authStore";
import { useTheme } from "../context/ThemeContext";
import { Shield, Lock, Mail, AlertCircle, ArrowRight, Loader2, Sun, Moon } from "lucide-react";
import { TENANT_APP_URL } from "../config/api";

export const Route = createFileRoute("/login")({
  component: OwnerLoginPage,
});

function OwnerLoginPage() {
  const [email, setEmail] = useState("admin@demo.co");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot Password State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("admin@demo.co");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotStatus, setForgotStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Reset Password State (from email reset link)
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const navigate = useNavigate();
  const user = useOwnerAuthStore((s) => s.user);
  const { isDark, toggleTheme } = useTheme();

  // Auto-detect resetToken parameter from URL
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("resetToken") || params.get("token");
      if (token) {
        setResetToken(token);
        setResetModalOpen(true);
      }
    }
  }, []);

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    setForgotStatus(null);
    try {
      const res = await ownerAuthService.forgotPassword(forgotEmail.trim());
      setForgotStatus({
        type: "success",
        message: res.message || "Password reset link sent to your email successfully.",
      });
    } catch (err: any) {
      setForgotStatus({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Failed to request password reset. Please verify your email.",
      });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setResetStatus({ type: "error", message: "Password must be at least 6 characters long." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetStatus({ type: "error", message: "Passwords do not match." });
      return;
    }
    setResetLoading(true);
    setResetStatus(null);
    try {
      const res = await ownerAuthService.resetPassword(resetToken, newPassword);
      setResetStatus({
        type: "success",
        message: res?.message || "Password has been successfully reset! You can now sign in.",
      });
      if (typeof window !== "undefined") {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (err: any) {
      setResetStatus({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Invalid or expired reset token.",
      });
    } finally {
      setResetLoading(false);
    }
  };

  // If already authenticated SuperAdmin, redirect to dashboard
  React.useEffect(() => {
    if (user && user.role === "SuperAdmin") {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please provide both email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { user } = await ownerAuthService.login(email.trim(), password);
      if (user.role === "SuperAdmin") {
        navigate({ to: "/dashboard" });
      } else {
        setError("Access Denied: Owner Portal is restricted to SuperAdmin accounts.");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Invalid credentials. Please verify your SuperAdmin email and password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground transition-colors">
      {/* Theme Toggle in top-right */}
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors shadow-sm cursor-pointer"
        >
          {isDark ? (
            <Sun className="h-5 w-5 text-amber-400 animate-in fade-in zoom-in" />
          ) : (
            <Moon className="h-5 w-5 text-indigo-500 animate-in fade-in zoom-in" />
          )}
        </button>
      </div>

      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Platform Owner Console</h1>
          <p className="text-sm text-muted-foreground">
            HR Nexa SaaS multi-tenant control &amp; subscription provisioning
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              SuperAdmin Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@demo.co"
                required
                className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotModalOpen(true);
                  setForgotEmail(email);
                  setForgotStatus(null);
                }}
                className="text-xs text-primary hover:underline font-medium"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-primary/50 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                Sign In to Platform Console
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 text-center border-t border-border">
          <p className="text-xs text-muted-foreground">
            Tenant employee or HR admin?{" "}
            <a
              href={TENANT_APP_URL}
              className="text-primary hover:underline font-medium underline-offset-4"
            >
              Go to Tenant Portal
            </a>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Lock className="h-5 w-5 text-primary" />
                <span>Reset Owner Password</span>
              </div>
              <button
                onClick={() => setForgotModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {forgotStatus?.type === "success" ? (
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
                  {forgotStatus.message}
                </div>
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(false)}
                  className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Return to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Enter your SuperAdmin email address. We will generate an authoritative password reset authorization link.
                </p>

                {forgotStatus?.type === "error" && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                    {forgotStatus.message}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    SuperAdmin Email
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="admin@demo.co"
                    required
                    className="w-full rounded-xl border border-input bg-background py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-medium hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {forgotLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Reset Password Modal (from email reset link) */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Lock className="h-5 w-5 text-primary" />
                <span>Set New Password</span>
              </div>
              <button
                onClick={() => {
                  setResetModalOpen(false);
                  if (typeof window !== "undefined") {
                    window.history.replaceState({}, document.title, window.location.pathname);
                  }
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {resetStatus?.type === "success" ? (
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
                  {resetStatus.message}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setResetModalOpen(false);
                    setPassword("");
                  }}
                  className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Proceed to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Enter your new password below to update your SuperAdmin account credentials.
                </p>

                {resetStatus?.type === "error" && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                    {resetStatus.message}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={6}
                    className="w-full rounded-xl border border-input bg-background py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={6}
                    className="w-full rounded-xl border border-input bg-background py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResetModalOpen(false);
                      if (typeof window !== "undefined") {
                        window.history.replaceState({}, document.title, window.location.pathname);
                      }
                    }}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-medium hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                  >
                    {resetLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Update Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
