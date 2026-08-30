import React, { useState } from "react";
import { Wrench, CheckCircle2, Archive, Loader2 } from "lucide-react";
import { ModalShell, Field, Btn, inputCls } from "../../../components/ui";
import {
  useMaintenanceAssetMutation,
  useRepairAssetMutation,
  useRetireAssetMutation,
} from "../../../hooks/useAssetsQuery";
import { AssetRecord } from "../../../services/asset.service";

interface AssetMaintenanceModalProps {
  asset: AssetRecord;
  mode: "maintenance" | "repair" | "retire";
  onClose: () => void;
  onSuccess?: () => void;
  toast?: (msg: string, tone?: "success" | "error" | "info") => void;
}

export function AssetMaintenanceModal({
  asset,
  mode,
  onClose,
  onSuccess,
  toast,
}: AssetMaintenanceModalProps) {
  const [reason, setReason] = useState("");
  const [condition, setCondition] = useState(mode === "repair" ? "Good" : asset.condition || "Fair");
  const [remarks, setRemarks] = useState("");

  const maintenanceMutation = useMaintenanceAssetMutation();
  const repairMutation = useRepairAssetMutation();
  const retireMutation = useRetireAssetMutation();

  const isPending =
    maintenanceMutation.isPending || repairMutation.isPending || retireMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (mode === "maintenance") {
        await maintenanceMutation.mutateAsync({
          id: asset.id,
          payload: {
            reason: reason.trim() || "Routine inspection & repair",
            condition,
          },
        });
        toast?.(`Asset "${asset.name}" sent to Maintenance`, "info");
      } else if (mode === "repair") {
        await repairMutation.mutateAsync({
          id: asset.id,
          payload: {
            condition,
            remarks: remarks.trim() || "Repairs completed successfully",
          },
        });
        toast?.(`Asset "${asset.name}" repair completed and returned to inventory`, "success");
      } else if (mode === "retire") {
        await retireMutation.mutateAsync({
          id: asset.id,
          payload: {
            reason: reason.trim() || "Decommissioned / End of Lifecycle",
          },
        });
        toast?.(`Asset "${asset.name}" decommissioned and retired`, "info");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast?.(err.message || "Operation failed", "error");
    }
  };

  const titles = {
    maintenance: `Send to Maintenance: ${asset.name}`,
    repair: `Complete Maintenance / Repair: ${asset.name}`,
    retire: `Decommission / Retire Asset: ${asset.name}`,
  };

  return (
    <ModalShell title={titles[mode]} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-muted/30 p-3 rounded-lg border border-border text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Status:</span>
            <span className="font-bold text-foreground">{asset.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Asset Tag:</span>
            <span className="font-mono text-foreground">{asset.assetTag || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Serial Number:</span>
            <span className="font-mono text-foreground">{asset.serialNumber || "N/A"}</span>
          </div>
        </div>

        {mode === "maintenance" && (
          <>
            <Field label="Maintenance / Fault Reason *">
              <textarea
                rows={2}
                placeholder="e.g. Battery replacement needed; display flickering under load."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={inputCls + " min-h-[60px] py-2"}
                required
              />
            </Field>

            <Field label="Current Hardware Condition">
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className={inputCls}
              >
                <option value="Fair">Fair (Operational with faults)</option>
                <option value="Damaged">Damaged (Inoperable)</option>
              </select>
            </Field>
          </>
        )}

        {mode === "repair" && (
          <>
            <Field label="Repaired Condition *">
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className={inputCls}
              >
                <option value="Good">Good (Fully functional)</option>
                <option value="Fair">Fair (Repaired with cosmetic wear)</option>
              </select>
            </Field>

            <Field label="Repair Resolution Notes">
              <textarea
                rows={2}
                placeholder="e.g. Battery replaced under AppleCare warranty. Diagnostics passed 100%."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className={inputCls + " min-h-[60px] py-2"}
              />
            </Field>
          </>
        )}

        {mode === "retire" && (
          <>
            <Field label="Decommission Reason *">
              <textarea
                rows={2}
                placeholder="e.g. Beyond economical repair; hardware obsolete (5+ years in service)."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={inputCls + " min-h-[60px] py-2"}
                required
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Retiring will lock the asset out of active assignment while preserving its complete custody audit trail.
            </p>
          </>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Btn variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Btn>
          <Btn
            type="submit"
            variant={mode === "retire" ? "danger" : "primary"}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "maintenance" ? (
              <Wrench className="h-4 w-4" />
            ) : mode === "repair" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            <span>
              {isPending
                ? "Processing..."
                : mode === "maintenance"
                ? "Send to Maintenance"
                : mode === "repair"
                ? "Mark Repair Complete"
                : "Retire Asset"}
            </span>
          </Btn>
        </div>
      </form>
    </ModalShell>
  );
}
