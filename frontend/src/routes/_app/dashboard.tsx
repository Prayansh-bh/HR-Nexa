import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { DashboardPage } from "../../features/dashboard/pages/DashboardPage";
import { useShellActions } from "../../hooks";
import { useAuth } from "../../auth";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardRouteComponent,
});

function DashboardRouteComponent() {
  const actions = useShellActions();
  const { user } = useAuth();

  if (!user) return null;

  return (
    <DashboardPage
      user={user}
      setActive={actions.setActive}
      onAddEmployee={actions.onAddEmployee}
      onApplyLeave={actions.onApplyLeave}
    />
  );
}

