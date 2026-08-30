import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { ReportsPage } from "../../../features/reports/pages/ReportsPage.tsx";
import { useToast } from "../../../hooks";

export const Route = createFileRoute("/_app/reports/")({
  component: ReportsRouteComponent,
});

function ReportsRouteComponent() {
  const toast = useToast();

  return (
    <ReportsPage
      setActive={(path) => (window.location.href = `/${path.replace(/\./g, "/")}`)}
      toast={toast.push}
    />
  );
}
