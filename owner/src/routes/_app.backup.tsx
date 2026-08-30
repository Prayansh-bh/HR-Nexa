import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { BackupRestorePage } from "../features/settings/pages/BackupRestorePage";
import { toast } from "../hooks/useToast";

export const Route = createFileRoute("/_app/backup")({
  component: BackupRouteComponent,
});

function BackupRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Backup &amp; Restore...
        </div>
      }
    >
      <BackupRestorePage toast={toast} />
    </Suspense>
  );
}
