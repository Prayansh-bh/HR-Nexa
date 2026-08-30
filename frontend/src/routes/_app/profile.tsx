import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { ProfilePage } from "../../features/employees";
import { useLocalStorage, useToast } from "../../hooks";
import { AuthUser } from "../../types";

export const Route = createFileRoute("/_app/profile")({
  component: ProfileRouteComponent,
});

function ProfileRouteComponent() {
  const [user, setUser] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();

  if (!user) return null;

  return <ProfilePage user={user} setUser={setUser} toast={toast.push} />;
}
