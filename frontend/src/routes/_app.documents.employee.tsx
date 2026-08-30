import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { DocumentsPage } from "../features/documents/pages/DocumentsPage";
import { useLocalStorage, useToast } from "../hooks";
import { useUIStore } from "../store";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/documents/employee")({
  component: DocumentsEmployeeComponent,
});

function DocumentsEmployeeComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();
  const company = user?.companyName || user?.company || "";

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.EMPLOYEES_PROFILE_DOCS_DOWNLOAD}>
      <DocumentsPage
        sub="documents.employee"
        user={user}
        company={company}
        toast={toast.push}
        onViewDoc={() => {}}
      />
    </ProtectedRoute>
  );
}
