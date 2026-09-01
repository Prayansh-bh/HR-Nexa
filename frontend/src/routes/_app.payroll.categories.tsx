import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { ExpenseCategoriesAdminPage } from "../features/payroll/pages/ExpenseCategoriesAdminPage";
import { useToast } from "../hooks";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/payroll/categories")({
  component: ExpenseCategoriesRouteComponent,
});

function ExpenseCategoriesRouteComponent() {
  const toast = useToast();

  return (
    <ProtectedRoute permission={PERMISSIONS.EXPENSES_MANAGE}>
      <ExpenseCategoriesAdminPage toast={toast.push} />
    </ProtectedRoute>
  );
}
