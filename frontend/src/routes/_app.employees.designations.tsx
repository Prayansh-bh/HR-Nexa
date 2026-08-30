import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { EmployeesPage } from "../features/employees/pages/EmployeesPage";
import { useLocalStorage, useToast, useShellActions } from "../hooks";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/employees/designations")({
  component: EmployeesDesignationsComponent,
});

function EmployeesDesignationsComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();
  const actions = useShellActions();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.EMPLOYEES_DESIGNATIONS_MANAGE}>
      <EmployeesPage
        sub="employees.designations"
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
