import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { ManagerApprovalsPage } from "../features/leave/pages/ManagerApprovalsPage";
import { LeavePage } from "../features/leave/pages/LeavePage";
import { useLocalStorage, useToast, useShellActions } from "../hooks";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/leave/approvals")({
  component: LeaveApprovalsComponent,
});

function LeaveApprovalsComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();
  const actions = useShellActions();

  if (!user) return null;

  return (
    <ProtectedRoute
      permissions={[PERMISSIONS.LEAVES_REQUESTS_APPROVE, PERMISSIONS.EMPLOYEES_ATTENDANCE_VERIFY]}
      mode="any"
    >
      <ManagerApprovalsPage toast={toast.push} />
    </ProtectedRoute>
  );
}
