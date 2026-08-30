import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { AssetsPage } from "../../features/assets/pages/AssetsPage";
import { ProtectedRoute, PERMISSIONS } from "../../auth";

export const Route = createFileRoute("/_app/assets")({
  component: AssetsRouteComponent,
});

function AssetsRouteComponent() {
  return (
    <ProtectedRoute permission={PERMISSIONS.ASSETS_VIEW}>
      <AssetsPage />
    </ProtectedRoute>
  );
}
