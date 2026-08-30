import React, { useState } from "react";
import {
  CreditCard,
  Cloud,
  Mail,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCw,
  X,
  Shield,
} from "lucide-react";
import {
  usePlatformIntegrationsQuery,
  usePlatformIntegrationMutations,
} from "../../../hooks/useIntegrationsQuery";
import {
  IntegrationProvider,
  IntegrationStatus,
  SafeIntegrationCredentialResponse,
} from "../../../services/integrations.service";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)] space-y-4";
const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const btnCls =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition hover:brightness-110 px-3 py-1.5 text-xs bg-primary text-white";
const btnOutlineCls =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition px-3 py-1.5 text-xs border border-border bg-card hover:bg-muted text-foreground";
const btnDangerCls =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition px-3 py-1.5 text-xs bg-destructive text-destructive-foreground hover:brightness-110";

function Field({
  label,
  children,
  className = "",
  error,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  error?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
      {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "rose" | "indigo";
}) {
  const tones = {
    slate: "bg-muted text-muted-foreground",
    green: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    amber: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    rose: "bg-destructive/15 text-destructive",
    indigo: "bg-primary/15 text-primary",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        tones[tone] || tones.slate
      }`}
    >
      {children}
    </span>
  );
}

export function PlatformIntegrationsPage() {
  const {
    data: credentials = [],
    isLoading,
    isError,
    error,
    refetch,
  } = usePlatformIntegrationsQuery();
  const { createMutation, updateMutation, setStatusMutation, deleteMutation } =
    usePlatformIntegrationMutations();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] =
    useState<SafeIntegrationCredentialResponse | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider>(
    IntegrationProvider.RAZORPAY,
  );

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMessage({ type, msg });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Form States
  const [formName, setFormName] = useState("");
  // Razorpay
  const [rzpKeyId, setRzpKeyId] = useState("");
  const [rzpKeySecret, setRzpKeySecret] = useState("");
  const [rzpWebhookSecret, setRzpWebhookSecret] = useState("");
  // AWS S3
  const [s3Region, setS3Region] = useState("ap-south-1");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3AccessKeyId, setS3AccessKeyId] = useState("");
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState("");
  // SMTP
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpName, setSmtpName] = useState("HR Nexa Support");

  const [formError, setFormError] = useState("");

  const handleOpenCreate = (provider: IntegrationProvider) => {
    setSelectedCredential(null);
    setSelectedProvider(provider);
    setFormName(`Platform ${provider} Credential`);
    setRzpKeyId("");
    setRzpKeySecret("");
    setRzpWebhookSecret("");
    setS3Region("ap-south-1");
    setS3Bucket("");
    setS3AccessKeyId("");
    setS3SecretAccessKey("");
    setSmtpHost("");
    setSmtpPort("587");
    setSmtpSecure(false);
    setSmtpUser("");
    setSmtpPassword("");
    setSmtpFrom("");
    setSmtpName("HR Nexa Support");
    setFormError("");
    setModalOpen(true);
  };

  const handleOpenEdit = (cred: SafeIntegrationCredentialResponse) => {
    setSelectedCredential(cred);
    setSelectedProvider(cred.provider);
    setFormName(cred.name || `Platform ${cred.provider} Credential`);

    if (cred.provider === IntegrationProvider.RAZORPAY) {
      setRzpKeyId(cred.config.keyId || "");
      setRzpKeySecret("");
      setRzpWebhookSecret("");
    } else if (cred.provider === IntegrationProvider.AWS_S3) {
      setS3Region(cred.config.region || "ap-south-1");
      setS3Bucket(cred.config.bucket || "");
      setS3AccessKeyId(cred.config.accessKeyId || "");
      setS3SecretAccessKey("");
    } else if (cred.provider === IntegrationProvider.SMTP_EMAIL) {
      setSmtpHost(cred.config.host || "");
      setSmtpPort(String(cred.config.port || 587));
      setSmtpSecure(Boolean(cred.config.secure));
      setSmtpUser(cred.config.user || "");
      setSmtpPassword("");
      setSmtpFrom(cred.config.from || "");
      setSmtpName(cred.config.name || "HR Nexa Support");
    }

    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) {
      setFormError("Integration name is required");
      return;
    }

    let config: Record<string, any> = {};
    let secrets: Record<string, any> = {};

    if (selectedProvider === IntegrationProvider.RAZORPAY) {
      if (!rzpKeyId.trim()) {
        setFormError("Razorpay Key ID is required");
        return;
      }
      config = { keyId: rzpKeyId.trim() };
      if (rzpKeySecret.trim()) secrets.keySecret = rzpKeySecret.trim();
      if (rzpWebhookSecret.trim()) secrets.webhookSecret = rzpWebhookSecret.trim();
    } else if (selectedProvider === IntegrationProvider.AWS_S3) {
      if (!s3Bucket.trim() || !s3AccessKeyId.trim()) {
        setFormError("Bucket and Access Key ID are required");
        return;
      }
      config = {
        region: s3Region.trim(),
        bucket: s3Bucket.trim(),
        accessKeyId: s3AccessKeyId.trim(),
      };
      if (s3SecretAccessKey.trim()) secrets.secretAccessKey = s3SecretAccessKey.trim();
    } else if (selectedProvider === IntegrationProvider.SMTP_EMAIL) {
      if (!smtpHost.trim() || !smtpFrom.trim()) {
        setFormError("SMTP Host and From Address are required");
        return;
      }
      config = {
        host: smtpHost.trim(),
        port: parseInt(smtpPort, 10) || 587,
        secure: smtpSecure,
        user: smtpUser.trim(),
        from: smtpFrom.trim(),
        name: smtpName.trim(),
      };
      if (smtpPassword.trim()) secrets.password = smtpPassword.trim();
    }

    try {
      if (selectedCredential) {
        const updatePayload: any = {
          name: formName.trim(),
          config,
        };
        if (Object.keys(secrets).length > 0) {
          updatePayload.secrets = secrets;
        }
        await updateMutation.mutateAsync({
          id: selectedCredential.id,
          payload: updatePayload,
        });
        showToast("Platform integration credential updated successfully");
      } else {
        await createMutation.mutateAsync({
          provider: selectedProvider,
          name: formName.trim(),
          config,
          secrets,
        });
        showToast("Platform integration credential created successfully");
      }
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || "Failed to save platform integration credential");
    }
  };

  const handleToggleStatus = async (cred: SafeIntegrationCredentialResponse) => {
    try {
      await setStatusMutation.mutateAsync({
        id: cred.id,
        enabled: !cred.enabled,
      });
      showToast(
        `Platform integration ${!cred.enabled ? "enabled" : "disabled"} successfully`,
      );
    } catch (err: any) {
      showToast(err?.message || "Status toggle failed", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirmId(null);
      showToast("Platform integration credential deleted successfully");
    } catch (err: any) {
      showToast(err?.message || "Failed to delete platform credential", "error");
    }
  };

  const getCredForProvider = (provider: IntegrationProvider) =>
    credentials.find((c) => c.provider === provider && c.companyId === null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-3xl">Platform Integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Loading platform integration credentials...
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className={cardCls + " animate-pulse"}>
              <div className="h-6 w-32 rounded bg-muted"></div>
              <div className="h-4 w-48 rounded bg-muted/60"></div>
              <div className="h-10 w-full rounded bg-muted/40"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
          <div className="flex items-center gap-3 font-bold text-lg">
            <AlertCircle size={22} /> Failed to load platform integrations
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {(error as any)?.message || "Error communicating with backend API."}
          </p>
          <button className={btnCls + " mt-4"} onClick={() => refetch()}>
            <RefreshCw size={14} className="mr-1.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const razorpayCred = getCredForProvider(IntegrationProvider.RAZORPAY);
  const s3Cred = getCredForProvider(IntegrationProvider.AWS_S3);
  const smtpCred = getCredForProvider(IntegrationProvider.SMTP_EMAIL);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-3 shadow-lg backdrop-blur-md transition ${
            toastMessage.type === "success"
              ? "bg-[color:var(--color-success)]/20 text-[color:var(--color-success)] border border-[color:var(--color-success)]/30"
              : "bg-destructive/20 text-destructive border border-destructive/30"
          }`}
        >
          <div className="text-xs font-semibold">{toastMessage.msg}</div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider mb-1">
          <Shield size={14} /> SuperAdmin Platform Authority
        </div>
        <h1 className="text-xl font-bold tracking-tight md:text-3xl">Platform Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage system-wide platform integration credentials (companyId = null) for billing, object storage, and transactional mail.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Razorpay Platform */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-base">
              <CreditCard size={20} className="text-primary" /> Razorpay Gateway
            </div>
            {razorpayCred ? (
              <Badge tone={razorpayCred.enabled ? "green" : "amber"}>
                {razorpayCred.enabled ? "Active Platform DB" : "Disabled DB"}
              </Badge>
            ) : (
              <Badge tone="slate">Using .env Fallback</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Platform-wide payment gateway for tenant subscription checkouts and billing.
          </p>

          {razorpayCred ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{razorpayCred.name}</span>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Key ID:</span>
                <span className="font-mono">{razorpayCred.config.keyId || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Key Secret:</span>
                <span className="font-mono text-muted-foreground">••••••••</span>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Webhook Secret:</span>
                <span className="font-mono text-muted-foreground">••••••••</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No platform DB credential configured. Platform currently falling back to process.env credentials.
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {razorpayCred ? (
              <>
                <button className={btnOutlineCls} onClick={() => handleOpenEdit(razorpayCred)}>
                  <Edit2 size={14} className="mr-1" /> Configure
                </button>
                <div className="flex items-center gap-2">
                  <button
                    className={razorpayCred.enabled ? btnOutlineCls : btnCls}
                    onClick={() => handleToggleStatus(razorpayCred)}
                  >
                    {razorpayCred.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    className={btnOutlineCls + " text-destructive"}
                    onClick={() => setDeleteConfirmId(razorpayCred.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            ) : (
              <button className={btnCls + " w-full"} onClick={() => handleOpenCreate(IntegrationProvider.RAZORPAY)}>
                <Plus size={14} className="mr-1" /> Configure Platform Razorpay
              </button>
            )}
          </div>
        </div>

        {/* Card 2: AWS S3 Platform */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-base">
              <Cloud size={20} className="text-sky-500" /> AWS S3 Storage
            </div>
            {s3Cred ? (
              <Badge tone={s3Cred.enabled ? "green" : "amber"}>
                {s3Cred.enabled ? "Active Platform DB" : "Disabled DB"}
              </Badge>
            ) : (
              <Badge tone="slate">Using .env Fallback</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Default platform object storage for offer letters and system document attachments.
          </p>

          {s3Cred ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{s3Cred.name}</span>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Region:</span>
                <span className="font-mono">{s3Cred.config.region || "ap-south-1"}</span>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Bucket:</span>
                <span className="font-mono">{s3Cred.config.bucket || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Access Key ID:</span>
                <span className="font-mono">{s3Cred.config.accessKeyId || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Secret Access Key:</span>
                <span className="font-mono text-muted-foreground">••••••••</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No platform DB credential configured. Platform currently falling back to process.env credentials.
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {s3Cred ? (
              <>
                <button className={btnOutlineCls} onClick={() => handleOpenEdit(s3Cred)}>
                  <Edit2 size={14} className="mr-1" /> Configure
                </button>
                <div className="flex items-center gap-2">
                  <button
                    className={s3Cred.enabled ? btnOutlineCls : btnCls}
                    onClick={() => handleToggleStatus(s3Cred)}
                  >
                    {s3Cred.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    className={btnOutlineCls + " text-destructive"}
                    onClick={() => setDeleteConfirmId(s3Cred.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            ) : (
              <button className={btnCls + " w-full"} onClick={() => handleOpenCreate(IntegrationProvider.AWS_S3)}>
                <Plus size={14} className="mr-1" /> Configure Platform AWS S3
              </button>
            )}
          </div>
        </div>

        {/* Card 3: SMTP Email Platform */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-base">
              <Mail size={20} className="text-indigo-500" /> SMTP Mail Gateway
            </div>
            {smtpCred ? (
              <Badge tone={smtpCred.enabled ? "green" : "amber"}>
                {smtpCred.enabled ? "Active Platform DB" : "Disabled DB"}
              </Badge>
            ) : (
              <Badge tone="slate">Using .env Fallback</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Platform transactional mail server for system notifications, welcome emails, and password resets.
          </p>

          {smtpCred ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{smtpCred.name}</span>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Host:</span>
                <span className="font-mono">{smtpCred.config.host || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Port / TLS:</span>
                <span className="font-mono">{smtpCred.config.port} ({smtpCred.config.secure ? "SSL" : "TLS"})</span>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">From Address:</span>
                <span className="font-mono">{smtpCred.config.from || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Password:</span>
                <span className="font-mono text-muted-foreground">••••••••</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No platform DB credential configured. Platform currently falling back to process.env credentials.
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {smtpCred ? (
              <>
                <button className={btnOutlineCls} onClick={() => handleOpenEdit(smtpCred)}>
                  <Edit2 size={14} className="mr-1" /> Configure
                </button>
                <div className="flex items-center gap-2">
                  <button
                    className={smtpCred.enabled ? btnOutlineCls : btnCls}
                    onClick={() => handleToggleStatus(smtpCred)}
                  >
                    {smtpCred.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    className={btnOutlineCls + " text-destructive"}
                    onClick={() => setDeleteConfirmId(smtpCred.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            ) : (
              <button className={btnCls + " w-full"} onClick={() => handleOpenCreate(IntegrationProvider.SMTP_EMAIL)}>
                <Plus size={14} className="mr-1" /> Configure Platform SMTP
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Dialog: Create / Edit Platform Integration */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold">
                {selectedCredential
                  ? `Configure Platform ${selectedProvider}`
                  : `Add Platform ${selectedProvider}`}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle size={16} /> {formError}
                </div>
              )}

              <Field label="Platform Credential Display Name">
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Platform Razorpay Production"
                  className={inputCls}
                  required
                />
              </Field>

              {selectedProvider === IntegrationProvider.RAZORPAY && (
                <>
                  <Field label="Razorpay Key ID">
                    <input
                      type="text"
                      value={rzpKeyId}
                      onChange={(e) => setRzpKeyId(e.target.value)}
                      placeholder="rzp_live_xxxxxxxxxxxxxx"
                      className={inputCls + " font-mono"}
                      required
                    />
                  </Field>
                  <Field label="Razorpay Key Secret">
                    <input
                      type="password"
                      value={rzpKeySecret}
                      onChange={(e) => setRzpKeySecret(e.target.value)}
                      placeholder={
                        selectedCredential
                          ? "Leave blank to keep existing platform secret"
                          : "Enter Razorpay Key Secret"
                      }
                      className={inputCls + " font-mono"}
                      required={!selectedCredential}
                    />
                  </Field>
                  <Field label="Webhook Secret">
                    <input
                      type="password"
                      value={rzpWebhookSecret}
                      onChange={(e) => setRzpWebhookSecret(e.target.value)}
                      placeholder={
                        selectedCredential
                          ? "Leave blank to keep existing platform secret"
                          : "Enter Webhook Secret"
                      }
                      className={inputCls + " font-mono"}
                    />
                  </Field>
                </>
              )}

              {selectedProvider === IntegrationProvider.AWS_S3 && (
                <>
                  <Field label="AWS Region">
                    <input
                      type="text"
                      value={s3Region}
                      onChange={(e) => setS3Region(e.target.value)}
                      placeholder="ap-south-1"
                      className={inputCls + " font-mono"}
                      required
                    />
                  </Field>
                  <Field label="S3 Bucket Name">
                    <input
                      type="text"
                      value={s3Bucket}
                      onChange={(e) => setS3Bucket(e.target.value)}
                      placeholder="hrnexa-documents-prod"
                      className={inputCls + " font-mono"}
                      required
                    />
                  </Field>
                  <Field label="AWS Access Key ID">
                    <input
                      type="text"
                      value={s3AccessKeyId}
                      onChange={(e) => setS3AccessKeyId(e.target.value)}
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      className={inputCls + " font-mono"}
                      required
                    />
                  </Field>
                  <Field label="AWS Secret Access Key">
                    <input
                      type="password"
                      value={s3SecretAccessKey}
                      onChange={(e) => setS3SecretAccessKey(e.target.value)}
                      placeholder={
                        selectedCredential
                          ? "Leave blank to keep existing platform secret"
                          : "Enter AWS Secret Access Key"
                      }
                      className={inputCls + " font-mono"}
                      required={!selectedCredential}
                    />
                  </Field>
                </>
              )}

              {selectedProvider === IntegrationProvider.SMTP_EMAIL && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="SMTP Host">
                      <input
                        type="text"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.gmail.com"
                        className={inputCls + " font-mono"}
                        required
                      />
                    </Field>
                    <Field label="SMTP Port">
                      <input
                        type="number"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        placeholder="587"
                        className={inputCls + " font-mono"}
                        required
                      />
                    </Field>
                  </div>
                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="smtpSecure"
                      checked={smtpSecure}
                      onChange={(e) => setSmtpSecure(e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <label htmlFor="smtpSecure" className="text-xs font-semibold text-muted-foreground">
                      Use Direct SSL/TLS (Port 465)
                    </label>
                  </div>
                  <Field label="SMTP Username">
                    <input
                      type="text"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="user@domain.com"
                      className={inputCls + " font-mono"}
                    />
                  </Field>
                  <Field label="SMTP Password">
                    <input
                      type="password"
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder={
                        selectedCredential
                          ? "Leave blank to keep existing platform secret"
                          : "Enter SMTP Password"
                      }
                      className={inputCls + " font-mono"}
                      required={!selectedCredential}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="From Email Address">
                      <input
                        type="email"
                        value={smtpFrom}
                        onChange={(e) => setSmtpFrom(e.target.value)}
                        placeholder="noreply@domain.com"
                        className={inputCls + " font-mono"}
                        required
                      />
                    </Field>
                    <Field label="Sender Display Name">
                      <input
                        type="text"
                        value={smtpName}
                        onChange={(e) => setSmtpName(e.target.value)}
                        placeholder="HR Nexa Support"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <button type="button" className={btnOutlineCls} onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={btnCls}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Platform Integration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-destructive">Confirm Platform Credential Deletion</h2>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete this platform credential? Deleting this credential will cause platform-wide integrations to fall back to process.env credentials.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button className={btnOutlineCls} onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </button>
              <button
                className={btnDangerCls}
                disabled={deleteMutation.isPending}
                onClick={() => handleDelete(deleteConfirmId)}
              >
                {deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
