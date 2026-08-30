import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React from "react";
import { EmployeesPage } from "../features/employees/pages/EmployeesPage";
import { useLocalStorage, useToast, useShellActions } from "../hooks";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/employees/onboarding")({
  component: EmployeesOnboardingComponent,
});

function EmployeesOnboardingComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();
  const actions = useShellActions();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.EMPLOYEES_ONBOARDING_MANAGE}>
      <EmployeesPage
        sub="employees.onboarding"
        user={user}
        toast={toast.push}
        triggerConfirm={actions.triggerConfirm}
        onAddEmployee={actions.onAddEmployee}
        onEditEmployee={actions.onEditEmployee}
        onMessageEmployee={actions.onMessageEmployee}
        onView={actions.onView}
        setActive={(path) => navigate({ to: `/${path.replace(/\./g, "/")}` })}
      />
    </ProtectedRoute>
  );
}
