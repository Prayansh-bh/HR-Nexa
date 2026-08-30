import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { AttendancePage } from "../features/attendance/pages/AttendancePage";
import { useLocalStorage, useToast, useShellActions } from "../hooks";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/attendance/history")({
  component: AttendanceHistoryComponent,
});

function AttendanceHistoryComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();
  const actions = useShellActions();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.EMPLOYEES_ATTENDANCE_VIEW}>
      <AttendancePage
        sub="attendance.history"
        user={user}
        toast={toast.push}
        triggerConfirm={actions.triggerConfirm}
      />
    </ProtectedRoute>
  );
}
