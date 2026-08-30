import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { AnnouncementsPage } from "../../features/notifications";
import { EmployeeAnnouncementsPage } from "../../features/notifications/pages/EmployeeAnnouncementsPage.tsx";
import { useLocalStorage, useToast } from "../../hooks";
import { AuthUser } from "../../types";

export const Route = createFileRoute("/_app/announcements")({
  component: AnnouncementsRouteComponent,
});

function AnnouncementsRouteComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();

  if (!user) return null;

  if (user.role === "Employee") {
    return <EmployeeAnnouncementsPage />;
  }

  return <AnnouncementsPage user={user} toast={toast.push} />;
}
