import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { EmployeesPage } from "../features/employees/pages/EmployeesPage";
import { useToast, useShellActions } from "../hooks";
import { ProtectedRoute, PERMISSIONS, useAuth } from "../auth";

export const Route = createFileRoute("/_app/employees/orgchart")({
  component: EmployeesOrgchartComponent,
});

function EmployeesOrgchartComponent() {
  const { user } = useAuth();
  const toast = useToast();
  const actions = useShellActions();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.EMPLOYEES_ORGCHART_VIEW}>
      <EmployeesPage
        sub="employees.orgchart"
        user={user}
        toast={toast.push}
        triggerConfirm={actions.triggerConfirm}
        onAddEmployee={actions.onAddEmployee}
        onEditEmployee={actions.onEditEmployee}
        onMessageEmployee={actions.onMessageEmployee}
        onView={actions.onView}
        setActive={actions.setActive}
      />
    </ProtectedRoute>
  );
}

