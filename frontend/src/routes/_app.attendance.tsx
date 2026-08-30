import { createFileRoute, Outlet } from "@tanstack/react-router";
import React from "react";

export const Route = createFileRoute("/_app/attendance")({
  component: () => <Outlet />,
});
