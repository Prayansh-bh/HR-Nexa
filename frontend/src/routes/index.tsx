import { createFileRoute, redirect } from "@tanstack/react-router";
import { getDefaultDashboardRoute } from "../auth";
import { LandingPage } from "../components/landing";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const userString = typeof window !== "undefined" ? localStorage.getItem("hrms.user") : null;
    if (userString) {
      try {
        const user = JSON.parse(userString);
        if (user) {
          throw redirect({ to: getDefaultDashboardRoute(user) });
        }
      } catch (e) {
        if (e && (e as any).to) throw e;
      }
    }
  },
  component: LandingPage,
});

