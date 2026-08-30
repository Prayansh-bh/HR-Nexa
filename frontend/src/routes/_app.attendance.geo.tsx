import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { AttendancePage } from "../features/attendance/pages/AttendancePage";
import { useLocalStorage, useToast, useShellActions } from "../hooks";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/attendance/geo")({
  component: AttendanceGeoComponent,
});

function AttendanceGeoComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();
  const actions = useShellActions();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.ATTENDANCE_GEO_CONFIG}>
      <AttendancePage
        sub="attendance.geo"
        user={user}
        toast={toast.push}
        triggerConfirm={actions.triggerConfirm}
      />
    </ProtectedRoute>
  );
}
