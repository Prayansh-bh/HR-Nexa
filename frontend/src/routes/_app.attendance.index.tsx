import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { useLocalStorage, useToast, useShellActions } from "../hooks";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

const AttendancePage = React.lazy(() =>
  import("../features/attendance/pages/AttendancePage").then((m) => ({
    default: m.AttendancePage,
  })),
);

export const Route = createFileRoute("/_app/attendance/")({
  component: AttendanceDashboardComponent,
});

function AttendanceDashboardComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();
  const actions = useShellActions();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.EMPLOYEES_ATTENDANCE_VIEW}>
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
            Loading Attendance...
          </div>
        }
      >
        <AttendancePage
          sub="attendance.dashboard"
          user={user}
          toast={toast.push}
          triggerConfirm={actions.triggerConfirm}
        />
      </Suspense>
    </ProtectedRoute>
  );
}
