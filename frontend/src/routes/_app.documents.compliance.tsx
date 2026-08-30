import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { DocCompliancePage } from "../features/employees/pages/DocCompliancePage";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/documents/compliance")({
  component: DocumentsComplianceComponent,
});

function DocumentsComplianceComponent() {
  return (
    <ProtectedRoute permission={PERMISSIONS.EMPLOYEES_PROFILE_DOCS_UPLOAD}>
      <DocCompliancePage />
    </ProtectedRoute>
  );
}
