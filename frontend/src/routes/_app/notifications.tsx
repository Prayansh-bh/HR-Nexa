import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { NotificationsPage } from "../../features/notifications/pages/NotificationsPage";
import { useLocalStorage } from "../../hooks";
import { AuthUser } from "../../types";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsRouteComponent,
});

function NotificationsRouteComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);

  if (!user) return null;

  return <NotificationsPage user={user} />;
}
