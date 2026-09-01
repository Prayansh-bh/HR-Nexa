import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { SettingsPage } from "../features/settings/pages/SettingsPage";
import { useLocalStorage, useToast } from "../hooks";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/settings/roles")({
  component: SettingsRolesComponent,
});

function SettingsRolesComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.SETTINGS_ROLES_VIEW}>
      <SettingsPage sub="settings.roles" toast={toast.push} user={user} />
    </ProtectedRoute>
  );
}
