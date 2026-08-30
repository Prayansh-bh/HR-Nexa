import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { SettingsPage } from "../features/settings/pages/SettingsPage";
import { useLocalStorage, useToast } from "../hooks";
import { AuthUser } from "../types";

export const Route = createFileRoute("/_app/settings/security")({
  component: SettingsSecurityComponent,
});

function SettingsSecurityComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();

  if (!user) return null;

  return <SettingsPage sub="settings.security" toast={toast.push} user={user} />;
}
