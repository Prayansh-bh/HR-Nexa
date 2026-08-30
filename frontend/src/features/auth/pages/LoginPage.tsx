import React, { useState, useEffect } from "react";
import { Sun, Moon, LockKeyhole, Mail, ArrowLeft, CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Field, Btn, inputCls } from "../../../components/ui";
import { authService } from "../../../services/auth.service";
import { AuthUser } from "../types/auth.types";
import { DEMO_USERS, ROLE_LABEL } from "../constants/auth.constants";
import { BrandHeader } from "../components/BrandHeader";
import { useTheme } from "../../../context";
import { useTranslation } from "react-i18next";

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
  defaultViewMode?: "login" | "forgot" | "reset" | "otp";
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  defaultViewMode = "login",
}) => {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const [viewMode, setViewMode] = useState<"login" | "forgot" | "reset" | "otp">(defaultViewMode);
  const [email, setEmail] = useState("hr@demo.co");
  const [password, setPassword] = useState("demo1234");

  // OTP 2FA state
  const [challengeToken, setChallengeToken] = useState("");
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot & Reset Password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [err, setErr] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-detect resetToken parameter from email reset URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("resetToken") || params.get("token");
      if (token) {
        setResetToken(token);
        setViewMode("reset");
      }
    }
  }, []);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const quick = (u: (typeof DEMO_USERS)[number]) => {
    setEmail(u.email);
    setPassword(u.password || "demo1234");
    setErr("");
    setInfoMsg("");
  };

  const submitLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr("");
    setInfoMsg("");
    setLoading(true);
    try {
      const res = await authService.login(email.trim().toLowerCase(), password);
      if (res && res.requiresOtp) {
        setChallengeToken(res.challengeToken);
        setOtp("");
        setViewMode("otp");
        setResendCooldown(60);
        return;
      }
      if (res && res.email) {
        onLogin(res);
        return;
      } else {
        setErr("Invalid credentials. Please check your username and password.");
      }
    } catch (err: any) {
      setErr(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr("");
    setInfoMsg("");
    if (!otp || otp.trim().length !== 6) {
      setErr("Please enter the complete 6-digit verification code");
      return;
    }
    setLoading(true);
    try {
      const userDetails = await authService.verifyOtp(challengeToken, otp.trim());
      if (userDetails && userDetails.email) {
        onLogin(userDetails);
      } else {
        setErr("Verification failed. Please try again.");
      }
    } catch (err: any) {
      setErr(err.message || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  };

  const submitResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setErr("");
    setInfoMsg("");
    setLoading(true);
    try {
      const res = await authService.resendOtp(challengeToken);
      if (res && res.challengeToken) {
        setChallengeToken(res.challengeToken);
        setOtp("");
        setResendCooldown(60);
        setInfoMsg("A new 6-digit verification code has been dispatched to your email.");
      }
    } catch (err: any) {
      setErr(err.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  const submitForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setInfoMsg("");
    if (!forgotEmail.trim()) {
      setErr("Please enter your registered email address");
      return;
    }
    try {
      setLoading(true);
      const res = await authService.forgotPassword(forgotEmail.trim().toLowerCase());
      setInfoMsg(res?.message || "Password reset link sent! Check your inbox.");
    } catch (error: any) {
      setErr(error.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  const submitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setInfoMsg("");
    if (!newPassword || newPassword.length < 6) {
      setErr("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("Passwords do not match");
      return;
    }
    try {
      setLoading(true);
      const res = await authService.resetPassword(resetToken, newPassword);
      setInfoMsg(
        res?.message || "Password reset successfully! Please sign in with your new password.",
      );
      setViewMode("login");
      setPassword("");
      if (typeof window !== "undefined") {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error: any) {
      setErr(error.message || "Invalid or expired reset token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      <div
        className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10"
        style={{ backgroundImage: "var(--gradient-primary)" }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, oklch(1 0 0 / 0.3), transparent 50%), radial-gradient(circle at 80% 70%, oklch(1 0 0 / 0.25), transparent 50%)",
          }}
        />
        <BrandHeader variant="hero" />
        <div className="relative text-primary-foreground">
          <div className="text-4xl font-bold leading-tight">
            Run your entire
            <br />
            people ops
            <br />
            in one place.
          </div>
          <div className="mt-4 max-w-md text-sm opacity-90">
            Attendance, leave, payroll, documents, and role-based dashboards — designed for growing
            teams.
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            {[
              { n: "42+", l: "Employees" },
              { n: "5", l: "Roles" },
              { n: "12mo", l: "Payroll" },
            ].map((k) => (
              <div
                key={k.l}
                className="rounded-xl bg-white/15 backdrop-blur p-3 text-primary-foreground"
              >
                <div className="text-2xl font-bold">{k.n}</div>
                <div className="text-xs opacity-90">{k.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-primary-foreground/80">
          © 2026 HR Nexa - Modern HRMS
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8 lg:hidden">
            <BrandHeader variant="default" showTagline={false} />
            <button
              onClick={toggleTheme}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card"
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-warning" />
              ) : (
                <Moon className="h-4 w-4 text-primary" />
              )}
            </button>
          </div>

          <div className="hidden lg:flex justify-end mb-6">
            <button
              onClick={toggleTheme}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card hover:shadow-md transition"
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-warning" />
              ) : (
                <Moon className="h-4 w-4 text-primary" />
              )}
            </button>
          </div>

          {/* VIEW MODE 1: LOGIN */}
          {viewMode === "login" && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in to your workspace to continue.
              </p>

              {infoMsg && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span>{infoMsg}</span>
                </div>
              )}

              <form onSubmit={submitLogin} className="mt-8 space-y-4">
                <Field label={t("auth.email")} id="email-field">
                  <input
                    id="email-field"
                    name="email"
                    autoComplete="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                    placeholder="you@company.com"
                  />
                </Field>

                <Field label={t("auth.password")} id="password-field">
                  <div className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="password-field"
                      name="password"
                      autoComplete="current-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputCls + " pl-9 pr-10"}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition p-0.5"
                      title={showPassword ? "Hide password" : "Show password"}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setErr("");
                      setInfoMsg("");
                      setForgotEmail(email);
                      setViewMode("forgot");
                    }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {t("auth.forgotPassword")}
                  </button>
                </div>

                {err && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {err}
                  </div>
                )}

                <Btn type="submit" disabled={loading} className="w-full justify-center py-2.5">
                  {loading ? t("auth.signingIn") : t("auth.signIn")}
                </Btn>
              </form>

              <div className="mt-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground font-semibold">
                    Or try a demo role
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_USERS.map((u) => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => quick(u)}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5 text-left transition hover:border-primary hover:shadow-md"
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg btn-gradient text-xs font-bold">
                        {u.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold">{ROLE_LABEL[u.role]}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{u.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-center text-[11px] text-muted-foreground">
                  All demo passwords:{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono">demo1234</code>
                </div>
                <div className="mt-2 text-center text-[11px] text-muted-foreground/80 italic">
                  User accounts are provisioned directly by HR Administrators. Public
                  self-registration is disabled.
                </div>
              </div>
            </>
          )}

          {/* VIEW MODE: OTP TWO-FACTOR VERIFICATION */}
          {viewMode === "otp" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setErr("");
                  setInfoMsg("");
                  setOtp("");
                  setChallengeToken("");
                  setViewMode("login");
                }}
                className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
              >
                <ArrowLeft className="h-4 w-4" /> {t("auth.backToSignIn")}
              </button>

              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">{t("auth.twoFactorTitle")}</h1>
                  <p className="text-xs text-muted-foreground">
                    {t("auth.twoFactorSubtitle")}
                  </p>
                </div>
              </div>

              {infoMsg && (
                <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                  {infoMsg}
                </div>
              )}

              <form onSubmit={submitVerifyOtp} className="mt-6 space-y-4">
                <Field label={t("auth.verifyOtp")} id="otp-input">
                  <input
                    id="otp-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className={inputCls + " text-center text-xl tracking-[0.5em] font-mono font-bold py-3"}
                    placeholder={t("auth.enterOtpPlaceholder")}
                    autoFocus
                  />
                </Field>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Didn't receive the code?</span>
                  <button
                    type="button"
                    onClick={submitResendOtp}
                    disabled={resendCooldown > 0 || loading}
                    className="font-semibold text-primary hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0
                      ? t("auth.resendCountdown", { seconds: resendCooldown })
                      : t("auth.resendOtp")}
                  </button>
                </div>

                {err && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {err}
                  </div>
                )}

                <Btn type="submit" disabled={loading || otp.length !== 6} className="w-full justify-center py-2.5">
                  {loading ? t("auth.submitting") : t("auth.verifyOtp")}
                </Btn>
              </form>
            </>
          )}

          {/* VIEW MODE 2: FORGOT PASSWORD */}
          {viewMode === "forgot" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setErr("");
                  setInfoMsg("");
                  setViewMode("login");
                }}
                className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Sign in
              </button>

              <h1 className="text-3xl font-bold tracking-tight">Forgot Password?</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your registered email address and we'll send you a password reset link.
              </p>

              {infoMsg ? (
                <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <div className="text-sm font-semibold text-foreground">Reset Link Sent</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{infoMsg}</div>
                  <Btn
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setViewMode("login");
                      setInfoMsg("");
                    }}
                    className="w-full justify-center mt-2"
                  >
                    Return to Sign in
                  </Btn>
                </div>
              ) : (
                <form onSubmit={submitForgotPassword} className="mt-6 space-y-4">
                  <Field label="Email Address" id="forgot-email-field">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        id="forgot-email-field"
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className={inputCls + " pl-9"}
                        placeholder="you@company.com"
                      />
                    </div>
                  </Field>

                  {err && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {err}
                    </div>
                  )}

                  <Btn type="submit" disabled={loading} className="w-full justify-center py-2.5">
                    {loading ? "Sending link..." : "Send Reset Link"}
                  </Btn>
                </form>
              )}
            </>
          )}

          {/* VIEW MODE 3: RESET PASSWORD */}
          {viewMode === "reset" && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">Set New Password</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your new password below to reset your account credentials.
              </p>

              <form onSubmit={submitResetPassword} className="mt-6 space-y-4">
                <Field label="New Password" id="new-password-field">
                  <div className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="new-password-field"
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputCls + " pl-9 pr-10"}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition p-0.5"
                      title={showNewPassword ? "Hide password" : "Show password"}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>

                <Field label="Confirm New Password" id="confirm-password-field">
                  <div className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="confirm-password-field"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputCls + " pl-9 pr-10"}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition p-0.5"
                      title={showConfirmPassword ? "Hide password" : "Show password"}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>

                {err && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {err}
                  </div>
                )}

                <Btn type="submit" disabled={loading} className="w-full justify-center py-2.5">
                  {loading ? "Updating password..." : "Update Password"}
                </Btn>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
