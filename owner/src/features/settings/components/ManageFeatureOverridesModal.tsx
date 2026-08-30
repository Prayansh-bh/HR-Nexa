import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  PlusCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Info,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { ModalShell } from '../../../components/ui/ModalShell';
import { TenantFeatureOverviewItem } from '../../../services/feature-overrides.service';
import {
  useTenantFeatureOverridesQuery,
  useTenantFeatureOverrideMutations,
} from '../../../hooks/useTenantFeatureOverridesQuery';

interface ManageFeatureOverridesModalProps {
  company: { id: string; name: string; plan?: string };
  onClose: () => void;
  onUpdated?: () => void;
  toast?: (msg: string) => void;
}

export function ManageFeatureOverridesModal({
  company,
  onClose,
  onUpdated,
  toast,
}: ManageFeatureOverridesModalProps) {
  const { data, isLoading, isFetching, isError, error, refetch } =
    useTenantFeatureOverridesQuery(company.id);
  const mutations = useTenantFeatureOverrideMutations(company.id);

  const features = data?.features || [];

  // Edit / Override Action Form State
  const [activeFeature, setActiveFeature] =
    useState<TenantFeatureOverviewItem | null>(null);
  const [overrideState, setOverrideState] = useState<boolean>(true);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Reset Confirmation State (Replaces native window.confirm)
  const [featureToReset, setFeatureToReset] =
    useState<TenantFeatureOverviewItem | null>(null);
  const [resettingKey, setResettingKey] = useState<string | null>(null);

  const handleOpenAction = (
    feat: TenantFeatureOverviewItem,
    enable: boolean,
  ) => {
    setActiveFeature(feat);
    setOverrideState(enable);
    setReason(feat.override?.reason || '');
    setNotes(feat.override?.notes || '');
    setExpiresAt(
      feat.override?.expiresAt
        ? new Date(feat.override.expiresAt).toISOString().split('T')[0]
        : '',
    );
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFeature) return;

    if (!reason.trim()) {
      toast?.('Please provide a business reason for commercial auditing.');
      return;
    }

    try {
      setSubmitting(true);
      await mutations.setOverride.mutateAsync({
        featureKey: activeFeature.featureKey,
        data: {
          enabled: overrideState,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        },
      });
      toast?.(
        `Feature override for "${activeFeature.featureName}" applied successfully!`,
      );
      setActiveFeature(null);
      onUpdated?.();
    } catch (err: any) {
      toast?.(`Failed to save override: ${err?.message || 'Error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!featureToReset) return;
    const feat = featureToReset;
    setFeatureToReset(null);

    try {
      setResettingKey(feat.featureKey);
      await mutations.removeOverride.mutateAsync(feat.featureKey);
      toast?.(
        `Override removed. "${feat.featureName}" now inherits plan default.`,
      );
      onUpdated?.();
    } catch (err: any) {
      toast?.(`Failed to remove override: ${err?.message || 'Error'}`);
    } finally {
      setResettingKey(null);
    }
  };

  return (
    <ModalShell
      title={`Feature Entitlements & Overrides — ${company.name}`}
      onClose={onClose}
      wide={true}
    >
      <div className="space-y-6">
        {/* Context Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">
                Company:{' '}
                <span className="text-foreground">{company.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Base Subscription Plan:{' '}
                <span className="font-bold text-primary">
                  {company.plan || 'BASIC'}
                </span>{' '}
                · Formula:{' '}
                <span className="font-mono text-xs text-foreground">
                  Effective = Override ?? Plan
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition flex items-center gap-1.5"
            >
              <RotateCcw
                className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Override Form Panel (Modal in place when active) */}
        {activeFeature && (
          <form
            onSubmit={handleSaveOverride}
            className="p-5 rounded-xl border border-primary/30 bg-card shadow-lg space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Configure Override for:{' '}
                <span className="text-primary font-bold">
                  {activeFeature.featureName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveFeature(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕ Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium mb-1">
                  Desired Tenant Entitlement:
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOverrideState(true)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                      overrideState
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500 font-bold'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Grant (ON)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideState(false)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                      !overrideState
                        ? 'bg-rose-500/10 border-rose-500/50 text-rose-500 font-bold'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <XCircle className="w-4 h-4" /> Revoke (OFF)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">
                  Expiration Date (Optional):
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">
                Business Reason (Mandatory for Commercial Audit):
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Negotiated enterprise pilot add-on; Custom contract exception..."
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium">
                Internal Notes (Optional):
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contract reference, approval ticket #, or commercial details..."
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveFeature(null)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition shadow"
              >
                {submitting ? 'Saving...' : 'Apply Tenant Override'}
              </button>
            </div>
          </form>
        )}

        {/* Feature List Table */}
        {isLoading && features.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-xs animate-pulse flex flex-col items-center justify-center gap-2">
            <RotateCcw className="w-5 h-5 animate-spin text-primary" />
            <span>Loading tenant feature entitlements...</span>
          </div>
        ) : isError && features.length === 0 ? (
          <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-xs">
            {error instanceof Error
              ? error.message
              : 'Failed to load feature entitlements.'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">Feature / Module</th>
                  <th className="py-3 px-3 text-center">Plan Default</th>
                  <th className="py-3 px-3 text-center">Tenant Override</th>
                  <th className="py-3 px-3 text-center">Effective State</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {features.map((feat) => (
                  <tr
                    key={feat.featureKey}
                    className="hover:bg-muted/30 transition"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">
                        {feat.featureName}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {feat.featureKey} ·{' '}
                        <span className="text-primary/80">{feat.category}</span>
                      </div>
                    </td>

                    {/* Plan Default */}
                    <td className="py-3 px-3 text-center">
                      {feat.planIncluded ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          <CheckCircle2 className="w-3 h-3" /> Included
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded-md">
                          <XCircle className="w-3 h-3" /> Off
                        </span>
                      )}
                    </td>

                    {/* Tenant Override */}
                    <td className="py-3 px-3 text-center">
                      {feat.override ? (
                        feat.override.enabled ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3" /> Granted (ON)
                            </span>
                            {feat.override.reason && (
                              <span
                                className="text-[10px] text-muted-foreground max-w-[140px] truncate mt-0.5"
                                title={feat.override.reason}
                              >
                                {feat.override.reason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-md">
                              <XCircle className="w-3 h-3" /> Revoked (OFF)
                            </span>
                            {feat.override.reason && (
                              <span
                                className="text-[10px] text-muted-foreground max-w-[140px] truncate mt-0.5"
                                title={feat.override.reason}
                              >
                                {feat.override.reason}
                              </span>
                            )}
                          </div>
                        )
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60">
                          — Inherited
                        </span>
                      )}
                    </td>

                    {/* Effective State */}
                    <td className="py-3 px-3 text-center">
                      {feat.effectiveEnabled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 px-2.5 py-1 rounded-full shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />{' '}
                          Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-900/40 border border-slate-700/40 px-2.5 py-1 rounded-full">
                          <XCircle className="w-3.5 h-3.5 text-slate-500" />{' '}
                          Locked
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {feat.override ? (
                          <>
                            <button
                              onClick={() =>
                                handleOpenAction(feat, !feat.override!.enabled)
                              }
                              className="px-2 py-1 rounded text-[11px] border border-border hover:bg-muted font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setFeatureToReset(feat)}
                              disabled={resettingKey === feat.featureKey}
                              className="px-2 py-1 rounded text-[11px] text-amber-500 hover:bg-amber-500/10 font-medium transition disabled:opacity-50 flex items-center gap-1"
                              title="Reset to plan default"
                            >
                              {resettingKey === feat.featureKey && (
                                <RotateCcw className="w-3 h-3 animate-spin" />
                              )}
                              Reset
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() =>
                              handleOpenAction(feat, !feat.planIncluded)
                            }
                            className="px-2.5 py-1 rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-semibold transition"
                          >
                            {feat.planIncluded
                              ? 'Revoke Feature'
                              : 'Grant Override'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* In-App Professional Confirmation Dialog (Replaces native browser window.confirm) */}
        {featureToReset && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setFeatureToReset(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-3 text-amber-500">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Reset Entitlement: {featureToReset.featureName}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Restore standard plan inheritance
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                Are you sure you want to reset{' '}
                <span className="font-semibold text-foreground">
                  "{featureToReset.featureName}"
                </span>{' '}
                back to the plan default for{' '}
                <span className="font-semibold text-foreground">
                  {company.name}
                </span>
                ? This will remove the custom negotiated exception and restore
                standard{' '}
                <span className="font-bold text-primary">
                  {company.plan || 'BASIC'}
                </span>{' '}
                plan inheritance.
              </p>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setFeatureToReset(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition shadow-sm flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Confirm Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
