import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { InboxPage } from "../../features/messaging/pages/InboxPage.tsx";
import { useLocalStorage, useShellActions } from "../../hooks";
import { AuthUser } from "../../types";
import { ProtectedRoute, PERMISSIONS } from "../../auth";

export const Route = createFileRoute("/_app/inbox")({
  component: InboxRouteComponent,
});

function InboxRouteComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const actions = useShellActions();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.CHATBOX_ACCESS}>
      <InboxPage user={user} triggerConfirm={actions.triggerConfirm} />
    </ProtectedRoute>
  );
}
