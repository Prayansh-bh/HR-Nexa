import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { LeavePage } from "../features/leave/pages/LeavePage";
import { useLocalStorage, useToast, useShellActions } from "../hooks";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/leave/apply")({
  component: LeaveApplyComponent,
});

function LeaveApplyComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();
  const actions = useShellActions();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.LEAVES_REQUESTS_CREATE}>
      <LeavePage
        sub="leave.apply"
        user={user}
        toast={toast.push}
        triggerConfirm={actions.triggerConfirm}
        onApplyLeave={actions.onApplyLeave}
        setActive={actions.setActive}
      />
    </ProtectedRoute>
  );
}
