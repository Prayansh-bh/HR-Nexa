import React from "react";
import { History, Loader2, User, Clock, ShieldAlert } from "lucide-react";
import { ModalShell, Badge, Btn } from "../../../components/ui";
import { useAssetHistoryQuery } from "../../../hooks/useAssetsQuery";
import { AssetRecord } from "../../../services/asset.service";

interface AssetHistoryDrawerProps {
  asset: AssetRecord;
  onClose: () => void;
}

export function AssetHistoryDrawer({ asset, onClose }: AssetHistoryDrawerProps) {
  const { data: history = [], isLoading, isError, error } = useAssetHistoryQuery(asset.id);

  const getActionTone = (action: string) => {
    switch (action) {
      case "ASSIGNED":
        return "indigo";
      case "RETURNED":
        return "green";
      case "MAINTENANCE":
        return "amber";
      case "REPAIRED":
        return "green";
      case "RETIRED":
        return "rose";
      case "CREATED":
        return "blue";
      case "UPDATED":
      default:
        return "slate";
    }
  };

  return (
    <ModalShell title={`Custody History: ${asset.name}`} onClose={onClose}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="bg-muted/30 p-3 rounded-lg border border-border text-xs flex justify-between items-center">
          <div>
            <span className="text-muted-foreground mr-1">Asset Tag:</span>
            <span className="font-mono font-bold text-foreground">{asset.assetTag || "N/A"}</span>
          </div>
          <div>
            <span className="text-muted-foreground mr-1">Current Status:</span>
            <Badge tone={asset.status === "Assigned" ? "indigo" : asset.status === "Available" ? "green" : "slate"}>
              {asset.status}
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-xs gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading custody lifecycle log...</span>
          </div>
        ) : isError ? (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{(error as any)?.message || "Failed to load asset history."}</span>
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No custody lifecycle events recorded for this asset yet.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {history.map((record) => (
              <div key={record.id} className="relative group">
                {/* Timeline Dot */}
                <div className="absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary shadow-sm" />

                <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <Badge tone={getActionTone(record.action) as any}>
                      {record.action}
                    </Badge>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{new Date(record.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  {record.employee && (
                    <div className="flex items-center gap-1.5 text-foreground font-semibold">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{record.employee.name}</span>
                      {record.employee.department && (
                        <span className="text-muted-foreground font-normal">
                          ({record.employee.department})
                        </span>
                      )}
                    </div>
                  )}

                  {record.condition && (
                    <div className="text-muted-foreground">
                      Condition: <span className="text-foreground font-medium">{record.condition}</span>
                    </div>
                  )}

                  {record.remarks && (
                    <div className="p-2 rounded bg-muted/40 text-foreground italic">
                      "{record.remarks}"
                    </div>
                  )}

                  {record.actorName && (
                    <div className="text-[10px] text-muted-foreground text-right">
                      Logged by: <span className="font-medium text-foreground">{record.actorName}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-border">
          <Btn variant="outline" onClick={onClose}>
            Close
          </Btn>
        </div>
      </div>
    </ModalShell>
  );
}
