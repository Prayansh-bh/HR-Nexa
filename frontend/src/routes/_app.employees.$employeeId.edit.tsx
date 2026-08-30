import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React from "react";
import { AddEmployeeModal } from "../features/employees/modals/AddEmployeeModal";
import { useEmployeesQuery } from "../hooks/useEmployeesQuery";
import { useDepartmentsQuery, useDesignationsQuery } from "../hooks/useOrgQuery";
import { saveEmployee } from "../store/actions/employeeActions";
import { useToast } from "../hooks";
import { Employee } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/employees/$employeeId/edit")({
  component: EditEmployeeRouteComponent,
});

function EditEmployeeRouteComponent() {
  const { employeeId } = Route.useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: employeesData, employees: employeesProp, isLoading: isEmpLoading } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data) ? (employeesData as any).data : (Array.isArray(employeesProp) ? employeesProp : [])));
  const { data: departments = [] } = useDepartmentsQuery();
  const { data: designations = [] } = useDesignationsQuery();

  const employee = employees.find((e: Employee) => e.id === employeeId);

  const handleClose = () => {
    navigate({ to: "/employees" });
  };

  const handleSave = async (emp: any, isEdit?: boolean) => {
    try {
      const res = await saveEmployee(emp, !!isEdit, toast);
      return !!res;
    } catch {
      return false;
    }
  };

  if (isEmpLoading) {
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

  return (
    <ProtectedRoute permission={PERMISSIONS.EMPLOYEES_LIST_EDIT}>
      <div className="py-6">
        <AddEmployeeModal
          onClose={handleClose}
          onSave={handleSave}
          departments={departments.map((d: any) => d.name)}
          designations={designations.map((d: any) => d.name)}
          editing={employee}
          employeeCount={employees.length}
          isPage={true}
        />
      </div>
    </ProtectedRoute>
  );
}
