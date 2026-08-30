import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { AttendancePage } from "../features/attendance/pages/AttendancePage";
import { useLocalStorage, useToast, useShellActions } from "../hooks";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/attendance/biometric")({
  component: AttendanceBiometricComponent,
});

function AttendanceBiometricComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();
  const actions = useShellActions();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.ATTENDANCE_DEVICES_MANAGE}>
      <AttendancePage
        sub="attendance.biometric"
        user={user}
        toast={toast.push}
        triggerConfirm={actions.triggerConfirm}
      />
    </ProtectedRoute>
  );
}
