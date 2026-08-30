import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { ExitListPage } from "../../features/exit/pages/ExitListPage";
import { useLocalStorage, useToast } from "../../hooks";
import { AuthUser } from "../../types";
import { ProtectedRoute, PERMISSIONS } from "../../auth";

export const Route = createFileRoute("/_app/exit")({
  component: ExitRouteComponent,
});

function ExitRouteComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.EXIT_VIEW}>
      <ExitListPage user={user} toast={toast.push} />
    </ProtectedRoute>
  );
}
