import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React from "react";
import { AddEmployeeModal } from "../features/employees/modals/AddEmployeeModal";
import { useEmployeesQuery } from "../hooks/useEmployeesQuery";
import { useDepartmentsQuery, useDesignationsQuery } from "../hooks/useOrgQuery";
import { saveEmployee } from "../store/actions/employeeActions";
import { useToast } from "../hooks";
import type { Employee } from "../types";

import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/employees/new")({
  component: AddEmployeeRouteComponent,
});

function AddEmployeeRouteComponent() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: employeesData, employees: employeesProp } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data) ? (employeesData as any).data : (Array.isArray(employeesProp) ? employeesProp : [])));
  const { data: departments = [] } = useDepartmentsQuery();
  const { data: designations = [] } = useDesignationsQuery();

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

  return (
    <ProtectedRoute permission={PERMISSIONS.EMPLOYEES_LIST_CREATE}>
      <div className="py-6">
        <AddEmployeeModal
          onClose={handleClose}
          onSave={handleSave}
          departments={departments.map((d) => d.name)}
          designations={designations.map((d) => d.name)}
          employeeCount={employees.length}
          isPage={true}
        />
      </div>
    </ProtectedRoute>
  );
}
