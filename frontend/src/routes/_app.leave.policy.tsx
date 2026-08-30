import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { LeaveConfigPage } from "../features/leave/pages/LeaveConfigPage";
import { useToast, useShellActions } from "../hooks";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/leave/policy")({
  component: LeavePolicyComponent,
});

function LeavePolicyComponent() {
  const toast = useToast();
  const actions = useShellActions();

  return (
    <ProtectedRoute permissions={[PERMISSIONS.LEAVES_VIEW, PERMISSIONS.LEAVES_POLICY_MANAGE]} mode="any">
      <LeaveConfigPage toast={toast.push} />
    </ProtectedRoute>
  );
}
