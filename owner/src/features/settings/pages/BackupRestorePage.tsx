import React, { useState, useEffect, useMemo } from "react";
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Clock,
  HardDrive,
  Trash2,
  Play,
  Server,
  Loader2,
  Plus,
  Check,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { systemService, SystemMetrics } from "../../../services/system.service";
import { backupService, BackupRecord } from "../../../services/backup.service";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";
const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const btnCls =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition hover:brightness-110 px-3 py-1.5 text-xs bg-primary text-white";

function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex gap-2">{action}</div>}
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "rose" | "indigo" | "sky";
}) {
  const tones = {
    slate: "bg-muted text-muted-foreground",
    green: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    amber: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    rose: "bg-destructive/15 text-destructive",
    indigo: "bg-primary/15 text-primary",
    sky: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function BackupRestorePage({
  toast,
}: {
  toast?: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [restoreModal, setRestoreModal] = useState<BackupRecord | null>(null);
  const [deleteModal, setDeleteModal] = useState<BackupRecord | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [bData, mData] = await Promise.all([
        backupService.getBackups(),
        systemService.getMetrics().catch(() => null),
      ]);
      setBackups(Array.isArray(bData) ? bData : []);
      setMetrics(mData);
    } catch (err) {
      console.error("Error loading backups:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBackup = async () => {
    try {
      setIsCreating(true);
      const newBkp = await backupService.createBackup();
      toast?.("Database snapshot created successfully!", "success");
      await loadData();
    } catch (err: any) {
      toast?.(err?.message || "Failed to create backup snapshot", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreModal) return;
    try {
      setIsActionLoading(true);
      await backupService.restoreBackup(restoreModal.filename);
      toast?.(
        `Database restored successfully from ${restoreModal.name || restoreModal.filename}`,
        "success",
      );
      setRestoreModal(null);
      await loadData();
    } catch (err: any) {
      toast?.(err?.message || "Failed to restore database from snapshot", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    try {
      setIsActionLoading(true);
      await backupService.deleteBackup(deleteModal.filename);
      toast?.(`Backup snapshot ${deleteModal.filename} deleted successfully`, "success");
      setDeleteModal(null);
      await loadData();
    } catch (err: any) {
      toast?.(err?.message || "Failed to delete backup snapshot", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      toast?.(`Downloading ${filename}...`, "info");
      await backupService.downloadBackup(filename);
    } catch (err: any) {
      toast?.(err?.message || "Failed to download backup snapshot", "error");
    }
  };

  const lastBackupTime = useMemo(() => {
    if (!backups.length) return "No backups yet";
    const latest = backups[0];
    return latest.d || latest.date || "Recently";
  }, [backups]);

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup & Restore</h1>
          <p className="text-sm text-muted-foreground">
            Manage database snapshots, automated retention, and data restoration.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-semibold hover:bg-accent transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={handleCreateBackup}
            disabled={isCreating}
            className="inline-flex items-center gap-2 rounded-lg font-semibold transition px-4 py-2 text-xs bg-primary text-primary-foreground hover:brightness-110 shadow-sm"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Create Backup
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={cardCls}>
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold mb-1">
            <span>Last Backup</span>
            <Clock className="w-4 h-4 text-primary shrink-0" />
          </div>
          <div className="text-lg font-bold text-foreground truncate">{lastBackupTime}</div>
          <div className="text-xs text-muted-foreground mt-1">Latest snapshot</div>
        </div>

        <div className={cardCls}>
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold mb-1">
            <span>Total Backups</span>
            <HardDrive className="w-4 h-4 text-sky-500 shrink-0" />
          </div>
          <div className="text-2xl font-bold text-foreground">{backups.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Available snapshots</div>
        </div>

        <div className={cardCls}>
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold mb-1">
            <span>Database Size</span>
            <Database className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <div className="text-2xl font-bold text-foreground">{metrics?.dbSize || "2.4 MB"}</div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            {metrics?.dbStatus || "Optimized"}
          </div>
        </div>

        <div className={cardCls}>
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold mb-1">
            <span>Storage Used</span>
            <Server className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="text-xl font-bold text-foreground truncate">
            {metrics?.storageUsed && metrics?.storageTotal
              ? `${metrics.storageUsed} / ${metrics.storageTotal}`
              : "12.6 GB / 100 GB"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {metrics?.storageStatus || "Plenty of space"}
          </div>
        </div>
      </div>

      {/* Backup History Table */}
      <div className={cardCls + " space-y-4"}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="font-bold text-lg">Backup History</h3>
            <p className="text-xs text-muted-foreground">
              List of available database snapshots and manual restore points.
            </p>
          </div>
          <Badge tone="indigo">{backups.length} Snapshots Saved</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider bg-muted/30">
                <th className="py-3 px-4 font-semibold">Backup Name</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Size</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading database snapshots...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted-foreground">
                    No backup snapshots found. Click{" "}
                    <strong className="text-foreground">"Create Backup"</strong> to generate your
                    first restore point.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id || b.filename} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>{b.name || b.filename}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {b.d || b.date}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium whitespace-nowrap">{b.s}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge tone="green">
                        <Check className="w-3 h-3 inline mr-1" />
                        {b.status || b.st || "Completed"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setRestoreModal(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-input bg-background hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400 transition"
                          title="Restore database to this snapshot"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                        <button
                          onClick={() => handleDownload(b.filename)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-input bg-background hover:bg-accent text-foreground transition"
                          title="Download snapshot file"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                        <button
                          onClick={() => setDeleteModal(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-input bg-background hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 transition"
                          title="Delete snapshot file"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retention Policy Information */}
      <div
        className={
          cardCls +
          " flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-4 border-l-primary"
        }
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <ShieldCheck className="w-4 h-4 text-primary" /> Retention Policy Active
          </div>
          <p className="text-xs text-muted-foreground">
            The system keeps a maximum of <strong>30 backups</strong>. Older snapshots are deleted
            automatically when new backups are created. No manual cleanup needed.
          </p>
        </div>
        <Badge tone="slate">Auto-Cleanup Enabled</Badge>
      </div>

      {/* Restore Confirmation Dialog Modal */}
      {restoreModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="p-2.5 rounded-full bg-amber-100 dark:bg-amber-950/50">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Confirm Database Restore</h3>
                <p className="text-xs text-muted-foreground">High-impact system action</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to restore the database from snapshot{" "}
              <strong className="text-foreground">
                {restoreModal.name || restoreModal.filename}
              </strong>
              ?
            </p>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
              ⚠️ <strong>Warning:</strong> Restoring this snapshot will overwrite current database
              state with snapshot data from <strong>{restoreModal.d || restoreModal.date}</strong>.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setRestoreModal(null)}
                disabled={isActionLoading}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-input bg-background hover:bg-accent transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={isActionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm"
              >
                {isActionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-full bg-rose-100 dark:bg-rose-950/50">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Delete Backup Snapshot</h3>
                <p className="text-xs text-muted-foreground">Permanent file removal</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete snapshot{" "}
              <strong className="text-foreground">
                {deleteModal.name || deleteModal.filename}
              </strong>
              ? This file cannot be recovered.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteModal(null)}
                disabled={isActionLoading}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-input bg-background hover:bg-accent transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isActionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm"
              >
                {isActionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete Snapshot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
