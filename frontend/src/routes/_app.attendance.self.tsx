import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { EmployeeClockPage } from "../features/attendance/pages/EmployeeClockPage";
import { useLocalStorage, useToast } from "../hooks";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/attendance/self")({
  component: EmployeeSelfAttendanceComponent,
});

function EmployeeSelfAttendanceComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.EMPLOYEES_ATTENDANCE_CLOCK}>
      <EmployeeClockPage toast={toast.push} user={user} />
    </ProtectedRoute>
  );
}
