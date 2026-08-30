import React, { useState } from "react";
import { Undo2, Loader2, AlertCircle } from "lucide-react";
import { ModalShell, Field, Btn, inputCls } from "../../../components/ui";
import { useReturnAssetMutation } from "../../../hooks/useAssetsQuery";
import { AssetRecord } from "../../../services/asset.service";

interface ReturnAssetModalProps {
  asset: AssetRecord;
  onClose: () => void;
  onSuccess?: () => void;
  toast?: (msg: string, tone?: "success" | "error" | "info") => void;
}

export function ReturnAssetModal({ asset, onClose, onSuccess, toast }: ReturnAssetModalProps) {
  const [condition, setCondition] = useState<"Good" | "Fair" | "Damaged">("Good");
  const [destinationStatus, setDestinationStatus] = useState<"Available" | "Maintenance" | "Retired">("Available");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [remarks, setRemarks] = useState("");

  const returnMutation = useReturnAssetMutation();

  const handleConditionChange = (newCond: "Good" | "Fair" | "Damaged") => {
    setCondition(newCond);
    if (newCond === "Damaged") {
      setDestinationStatus("Maintenance");
    } else if (destinationStatus === "Maintenance") {
      setDestinationStatus("Available");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await returnMutation.mutateAsync({
        id: asset.id,
        payload: {
          condition,
          destinationStatus,
          returnDate: returnDate || undefined,
          remarks: remarks.trim() || undefined,
        },
      });

      toast?.(`Asset "${asset.name}" returned to ${destinationStatus.toLowerCase()} inventory`, "success");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast?.(err.message || "Failed to return asset", "error");
    }
  };

  const assignedUserName =
    asset.assignedToUser?.name || asset.assignedTo?.name || "Employee";

  return (
    <ModalShell title={`Return Asset: ${asset.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-muted/30 p-3 rounded-lg border border-border text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Currently Assigned To:</span>
            <span className="font-bold text-foreground">{assignedUserName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Assigned Date:</span>
            <span className="text-foreground">{asset.assignedDate || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Asset Tag:</span>
            <span className="font-mono text-foreground">{asset.assetTag || "N/A"}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Return Condition *">
            <select
              value={condition}
              onChange={(e) => handleConditionChange(e.target.value as any)}
              className={inputCls}
            >
              <option value="Good">Good (Working fine)</option>
              <option value="Fair">Fair (Minor wear & tear)</option>
              <option value="Damaged">Damaged (Requires repair/service)</option>
            </select>
          </Field>

          <Field label="Destination Status *">
            <select
              value={destinationStatus}
              onChange={(e) => setDestinationStatus(e.target.value as any)}
              className={inputCls}
            >
              <option value="Available">Available (Return to Inventory)</option>
              <option value="Maintenance">Maintenance (Send for Repair)</option>
              <option value="Retired">Retired (Decommission)</option>
            </select>
          </Field>
        </div>

        <Field label="Return Date">
          <input
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Return Inspection Remarks">
          <textarea
            rows={2}
            placeholder="e.g. Device returned with power adapter. Screen intact, factory reset verified."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className={inputCls + " min-h-[60px] py-2"}
          />
        </Field>

        {condition === "Damaged" && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 text-amber-600 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Asset will automatically transition to Maintenance status for technical evaluation.</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Btn variant="outline" onClick={onClose} disabled={returnMutation.isPending}>
            Cancel
          </Btn>
          <Btn type="submit" variant="primary" disabled={returnMutation.isPending}>
            {returnMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="h-4 w-4" />
            )}
            <span>{returnMutation.isPending ? "Returning..." : "Accept Return"}</span>
          </Btn>
        </div>
      </form>
    </ModalShell>
  );
}
