import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { ViewerDocumentCheckPage } from "../features/employees/pages/ViewerDocumentCheckPage";
import { useToast } from "../hooks";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/documents/verification")({
  component: DocumentsVerificationComponent,
});

function DocumentsVerificationComponent() {
  const toast = useToast();
  return (
    <ProtectedRoute permission={PERMISSIONS.DOCUMENTS_VERIFY}>
      <ViewerDocumentCheckPage toast={toast.push} />
    </ProtectedRoute>
  );
}
