import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { UserManagementPage } from "../features/super-admin/pages/UserManagementPage";
import { toast } from "../hooks/useToast";

export const Route = createFileRoute("/_app/users")({
  component: UsersRouteComponent,
});

function UsersRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading User Management...
        </div>
      }
    >
      <UserManagementPage toast={toast} />
    </Suspense>
  );
}
