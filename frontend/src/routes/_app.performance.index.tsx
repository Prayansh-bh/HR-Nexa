import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { MyReviewsPage } from "../features/performance";
import { useLocalStorage, useToast } from "../hooks";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/performance/")({
  component: MyReviewsRouteComponent,
});

function MyReviewsRouteComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.PERFORMANCE_REVIEWS_VIEW}>
      <MyReviewsPage user={user} toast={toast.push} />
    </ProtectedRoute>
  );
}
