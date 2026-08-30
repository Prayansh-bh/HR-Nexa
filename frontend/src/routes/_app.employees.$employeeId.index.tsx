import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React from "react";
import { ViewEmployeeDrawer } from "../features/employees/components/ViewEmployeeDrawer";
import { useEmployeesQuery } from "../hooks/useEmployeesQuery";
import { Employee } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/employees/$employeeId/")({
  component: ViewEmployeeRouteComponent,
});

function ViewEmployeeRouteComponent() {
  const { employeeId } = Route.useParams();
  const navigate = useNavigate();

  const { data: employeesData, employees: employeesProp, isLoading } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data) ? (employeesData as any).data : (Array.isArray(employeesProp) ? employeesProp : [])));
  const employee = employees.find((e: Employee) => e.id === employeeId);

  const handleClose = () => {
    navigate({ to: "/employees" });
  };

  const handleEdit = () => {
    navigate({ to: `/employees/${employeeId}/edit` });
  };

  const handleMessage = () => {
    navigate({ to: "/inbox" });
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground animate-pulse">
        Loading employee details...
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        Employee with ID "{employeeId}" not found.
      </div>
    );
  }

  const rawUser = typeof window !== "undefined" ? localStorage.getItem("hrms.user") : null;
  const user = rawUser ? JSON.parse(rawUser) : {};
  const canEdit = user.role !== "Viewer";

  return (
    <ProtectedRoute permission={PERMISSIONS.EMPLOYEES_LIST_VIEW}>
      <div className="py-6">
        <ViewEmployeeDrawer
          emp={employee}
          onClose={handleClose}
          onEdit={handleEdit}
          onMessage={handleMessage}
          isPage={true}
          canEdit={canEdit}
        />
      </div>
    </ProtectedRoute>
  );
}
