import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { useLocalStorage, useToast } from "../hooks";
import { useUIStore } from "../store";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

const DocumentsPage = React.lazy(() =>
  import("../features/documents/pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })),
);

export const Route = createFileRoute("/_app/documents/")({
  component: DocumentsIndexComponent,
});

function DocumentsIndexComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();
  const company = user?.companyName || user?.company || "";

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.EMPLOYEES_PROFILE_DOCS_UPLOAD}>
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
            Loading Documents...
          </div>
        }
      >
        <DocumentsPage
          sub="documents.offer"
          user={user}
          company={company}
          toast={toast.push}
          onViewDoc={() => {}}
        />
      </Suspense>
    </ProtectedRoute>
  );
}
